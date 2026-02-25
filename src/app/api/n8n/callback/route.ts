import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkDuplicateCandidate, checkActiveProcessing } from '@/app/actions/candidate-check';
import { updateUploadStatus } from '@/app/actions/resume-actions';

// Initialize Supabase Client (Service Role for backend ops)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            upload_id,
            resume_url,

            // New n8n Fields
            FirstName,
            LastName,
            Gender,
            Dateofbirth,
            Telephone,
            email,
            CurrentJob,
            Company,
            // Industry, Level, LatestSalary, // Skipped per user feedback
            Experience, // Array from "code that separates Experience"
            Full_Experience,
            normallizedfullname
        } = body;

        // Fallback for name: Combined > Normalized > Profile.name (legacy)
        const combinedName = (FirstName && LastName) ? `${FirstName} ${LastName}` : null;
        // Check legacy structure just in case
        const legacyName = body.profile?.name;

        const candidateName = combinedName || normallizedfullname || legacyName || "Unknown Candidate";

        // Validation
        if (!upload_id || !candidateName) {
            return NextResponse.json({ error: 'Missing required fields: upload_id, FirstName/LastName' }, { status: 400 });
        }

        console.log(`Processing Callback for Upload ID: ${upload_id}, Name: ${candidateName}`);

        // Lookup uploader_email from resume_uploads to use as created_by
        const { data: uploadRecord } = await supabase
            .from('resume_uploads')
            .select('uploader_email')
            .eq('id', upload_id)
            .maybeSingle();
        const createdBy = (uploadRecord as any)?.uploader_email || 'Resume Parser';

        // 1. Check Duplicates (DB)
        const { isDuplicate, candidateId: existingId, reason } = await checkDuplicateCandidate(
            candidateName,
            "" // LinkedIn not provided in new output list, sending empty
        );

        // 1.1 Check Active Processing (Queue)
        const { isProcessing, source } = await checkActiveProcessing(candidateName, "", upload_id);

        if (isProcessing) {
            console.log(`Active Duplicate found in ${source}: ${candidateName}`);
            await updateUploadStatus(
                upload_id,
                `Duplicate found in ${source} (Active Processing)`
            );
            return NextResponse.json({
                success: true,
                status: 'Duplicate',
                message: `Duplicate processing in ${source}`
            });
        }

        if (isDuplicate && existingId) {
            console.log(`Duplicate found (${reason}): ${existingId}`);
            // Update Duplicate Status
            // Update Duplicate Status with ID
            await updateUploadStatus(
                upload_id,
                `Found duplicate with ${existingId} ${candidateName.substring(0, 20)}...`,
                undefined, // note
                existingId // candidateId
            );

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

        // Handling Date of Birth
        let dob = null;
        if (Dateofbirth && !isNaN(Date.parse(Dateofbirth))) {
            dob = new Date(Dateofbirth).toISOString().split('T')[0];
        }

        const profileData = {
            candidate_id: newCandidateId,
            name: candidateName,
            email: email || null,
            mobile_phone: Telephone || null,
            gender: Gender || null,
            date_of_birth: dob,
            year_of_bachelor_education: body['bachelor degree date'] || null,
            gross_salary_base_b_mth: body['LatestSalary'] || null,
            resume_url: resume_url || null,
            created_date: now,
            modify_date: now,
            created_by: createdBy  // ← email ของคนที่ upload resume
        };

        const { error: insertProfileError } = await supabase
            .from('Candidate Profile')
            .insert([profileData] as any);

        if (insertProfileError) {
            console.error("Insert Profile Error:", insertProfileError);
            throw insertProfileError;
        }

        // 3.1 Insert into candidate_profile_enhance
        const enhanceData = {
            candidate_id: newCandidateId,
            name: candidateName,
            gender: Gender || null,
            headline: CurrentJob || null, // Fixed: User said use CurrentJob (mapped from LatestPositionName in n8n, but body has CurrentJob)
            email: email || null,
            mobile_number: Telephone || null,
            current_position: CurrentJob || null, // Fixed: Map current_position to CurrentJob
            current_company: Company || null,
            country: Array.isArray(Experience) && Experience.length > 0 ? (Experience[0].Work_locator || Experience[0].work_location) : null,
            experience_summary: Full_Experience || null,
        };

        const { error: enhanceError } = await supabase
            .from('candidate_profile_enhance')
            .insert([enhanceData] as any);

        if (enhanceError) {
            console.error("Insert Enhance Error (Non-blocking):", enhanceError);
        }

        // 4. Insert Experiences
        const experienceList = Experience || [];

        // Helper to convert DD/MM/YYYY to YYYY-MM-DD
        const parseDate = (dateStr: string | null) => {
            if (!dateStr || typeof dateStr !== 'string') return null;
            if (dateStr.toLowerCase() === 'present') return null;

            // Try explicit DD/MM/YYYY format
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const [day, month, year] = parts;
                // Ensure valid numbers
                if (!isNaN(Number(day)) && !isNaN(Number(month)) && !isNaN(Number(year))) {
                    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                }
            }

            // Fallback for other formats or already ISO
            const parsed = Date.parse(dateStr);
            if (!isNaN(parsed)) {
                return new Date(parsed).toISOString().split('T')[0];
            }

            return null; // Invalid date
        };

        if (Array.isArray(experienceList) && experienceList.length > 0) {
            const expData = experienceList.map((exp: any) => {
                const companyName = exp.Company || exp.company || "Unknown Company";
                const location = exp.Work_locator || exp.work_location || exp.location || null;
                const startDateStr = exp.StartDate || null;
                const endDateStr = exp.EndDate || exp.endDate || null;

                return {
                    candidate_id: newCandidateId,
                    name: candidateName,
                    company: companyName, // Verified column: 'company'
                    // company_name_text: companyName, // Removed: Not in DB
                    position: exp.Position || exp.position || "Unknown Position",
                    start_date: parseDate(startDateStr),
                    end_date: parseDate(endDateStr),
                    work_location: location,
                    is_current_job: (endDateStr?.toLowerCase() === 'present') || false, // Verified column: 'is_current_job'
                    row_status: 'Active' // Verified column: 'row_status'
                };
            });

            const validExpData = expData.filter((e: any) => e.position !== "Unknown Position" || e.company !== "Unknown Company");

            if (validExpData.length > 0) {
                const { error: insertExpError } = await supabase
                    .from('candidate_experiences') // Fixed: Plural table name confirmed by schema check
                    .insert(validExpData as any);

                if (insertExpError) {
                    console.error("Insert Experience Error (Non-blocking):", insertExpError);
                }
            }
        }

        // 5. Update Upload Status to Completed
        await supabase
            .from('resume_uploads')
            .update({
                status: 'Complete',
                candidate_id: newCandidateId,
                candidate_name: candidateName,
                company: Company || (Array.isArray(experienceList) && experienceList[0]?.Company) || '',
                position: CurrentJob || (Array.isArray(experienceList) && experienceList[0]?.Position) || ''
            })
            .eq('id', upload_id);

        return NextResponse.json({
            success: true,
            candidate_id: newCandidateId,
            status: 'Completed'
        });

    } catch (error: any) {
        console.error("Callback API Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
