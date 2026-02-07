import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkDuplicateCandidate } from '@/app/actions/candidate-check';
import { updateUploadStatus } from '@/app/actions/resume-actions';

// Initialize Supabase Client (Service Role for backend ops)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { upload_id, resume_url, profile, experience } = body;

        // Validation
        if (!upload_id || !profile || !profile.name) {
            return NextResponse.json({ error: 'Missing required fields: upload_id, profile.name' }, { status: 400 });
        }

        console.log(`Processing Callback for Upload ID: ${upload_id}, Name: ${profile.name}`);

        // 1. Check Duplicates
        const { isDuplicate, candidateId: existingId, reason } = await checkDuplicateCandidate(
            profile.name,
            profile.linkedin || ""
        );

        if (isDuplicate && existingId) {
            console.log(`Duplicate found (${reason}): ${existingId}`);
            // Update Duplicate Status
            await updateUploadStatus(
                upload_id,
                `Found duplicate with ${existingId} ${profile.name.substring(0, 20)}...`
            );

            // Link upload to existing candidate anyway? Maybe useful. 
            // For now just update status as per requirement.

            return NextResponse.json({
                success: true,
                status: 'Duplicate',
                candidate_id: existingId,
                message: `Duplicate found by ${reason}`
            });
        }

        // 2. Reserve ID (Safe Sequence)
        const { data: idRange, error: rpcError } = await supabase.rpc('reserve_candidate_ids', { batch_size: 1 });

        if (rpcError || !idRange || idRange.length === 0) {
            console.error("ID Reservation Failed:", rpcError);
            throw new Error("Failed to reserve Candidate ID");
        }

        const numericId = idRange[0].start_id;
        const newCandidateId = `C${numericId.toString().padStart(5, '0')}`;

        console.log(`Reserved New ID: ${newCandidateId}`);

        // 3. Insert Candidate Profile
        const now = new Date().toISOString();
        const profileData = {
            candidate_id: newCandidateId,
            name: profile.name,
            email: profile.email || null,
            mobile_phone: profile.phone || null,
            linkedin: profile.linkedin || null,
            nationality: profile.nationality || null,
            gender: profile.gender || null, // Assuming n8n sends 'Male'/'Female' or similar
            date_of_birth: profile.dob || null, // Format YYYY-MM-DD
            age: profile.age ? parseInt(profile.age) : null,
            resume_url: resume_url || null,
            created_date: now,
            modify_date: now
            // Add other mapped fields if n8n provides them
        };

        const { error: insertProfileError } = await supabase
            .from('Candidate Profile')
            .insert([profileData]);

        if (insertProfileError) {
            console.error("Insert Profile Error:", insertProfileError);
            throw insertProfileError;
        }

        // 4. Insert Experiences (if any)
        if (experience && Array.isArray(experience) && experience.length > 0) {
            const expData = experience.map((exp: any) => ({
                candidate_id: newCandidateId,
                name: profile.name, // Denormalized name in experience table
                company: exp.company,
                position: exp.position,
                start_date: exp.start_date || null,
                end_date: exp.end_date || null,
                is_current_job: exp.is_current ? 'Current' : 'Past',
                row_status: 'Active',
                // Map other fields as needed
            }));

            const { error: insertExpError } = await supabase
                .from('candidate_experiences') // Verified table name
                .insert(expData);

            if (insertExpError) {
                console.error("Insert Experience Error (Non-blocking):", insertExpError);
                // We don't fail the whole process if experience fails, but good to log
            }
        }

        // 5. Update Upload Status to Completed
        await supabase
            .from('resume_uploads')
            .update({
                status: 'Complete',
                candidate_id: newCandidateId,
                candidate_name: profile.name,
                company: experience?.[0]?.company || '', // Store updated company info
                position: experience?.[0]?.position || ''
            })
            .eq('id', upload_id);

        return NextResponse.json({
            success: true,
            candidate_id: newCandidateId,
            status: 'Completed'
        });

    } catch (error: any) {
        console.error("Callback API Error:", error);

        // Try to update status to Failed if possible
        if (req.body) {
            // Hard to get ID if JSON parse failed, but assuming we got past that
            // Actually request body can only be read once. We read it at top.
            // We can use 'upload_id' if it was extracted. 
            // Implementing detailed error handling later if needed.
        }

        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
