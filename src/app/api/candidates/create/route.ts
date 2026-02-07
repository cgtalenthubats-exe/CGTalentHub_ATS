import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client (Service Role needed for reliable ID checking maybe? 
// Actually try to use anon if possible, but for ID generation we might need consistency.
// The user provided config uses Service Key as Anon Key in .env.local workaround, so standard client is fine.)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use Service Key for backend ops to be safe

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, email, phone, position, nationality } = body;

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        // 1. Get the latest candidate_id via Centralized RPC (Safe)
        const { data: idRange, error: rpcError } = await supabase.rpc('reserve_candidate_ids', { batch_size: 1 });

        if (rpcError || !idRange || idRange.length === 0) {
            console.error("ID Reservation Failed:", rpcError);
            return NextResponse.json({ error: 'Failed to generate ID' }, { status: 500 });
        }

        const numericId = idRange[0].start_id;
        const newId = `C${numericId.toString().padStart(5, '0')}`;
        console.log(`Reserved New Candidate ID: ${newId}`);

        // 2. Insert new candidate into Candidate Profile
        // Columns mapped from check-db.js output / user context
        // 2. Insert new candidate into Candidate Profile
        // Columns mapped from check-db.js output / user context
        const { error: insertError } = await supabase
            .from('Candidate Profile')
            .insert([
                {
                    candidate_id: newId,
                    name: name,
                    email: email || null,
                    mobile_phone: phone || null,
                    nationality: nationality || null,
                    gender: body.gender || null,
                    linkedin: body.linkedin || null,
                    date_of_birth: body.date_of_birth || null,
                    year_of_bachelor_education: body.year_of_bachelor_education ? parseInt(body.year_of_bachelor_education) : null,
                    age: body.age ? parseInt(body.age) : null,
                    created_date: new Date().toISOString(),
                    modify_date: new Date().toISOString()
                }
            ]);

        if (insertError) {
            console.error("Error inserting candidate:", insertError);
            return NextResponse.json({ error: 'Failed to create candidate: ' + insertError.message }, { status: 500 });
        }

        // 3. Insert into candidate_profile_enhance
        const { error: enhanceError } = await supabase
            .from('candidate_profile_enhance')
            .insert([
                {
                    candidate_id: newId,
                    name: name,
                    linkedin_url: body.linkedin || null,
                    skills_list: body.skills || null,
                    education_summary: body.education || null,
                    languages: body.languages || null
                }
            ]);

        if (enhanceError) {
            console.error("Error inserting enhancement data:", enhanceError);
            // We don't return error here to avoid blocking valid candidate creation, but we log it.
        }

        /* 
        // Optional Fields - keeping commented out as per instruction/redundancy
        if (body.skills || body.education || body.languages || body.linkedin) {
            // ... implementation if needed
        } 
        */

        return NextResponse.json({
            success: true,
            candidate_id: newId,
            message: 'Candidate created successfully'
        });

    } catch (error: any) {
        console.error("Server error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
