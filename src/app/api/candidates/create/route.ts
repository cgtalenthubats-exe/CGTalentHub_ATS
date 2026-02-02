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

        // 1. Get the latest candidate_id
        // Table name verified as 'Candidate Profile' in check-db.js
        const { data: latestCandidates, error: fetchError } = await supabase
            .from('Candidate Profile')
            .select('candidate_id')
            .order('candidate_id', { ascending: false })
            .limit(1);

        if (fetchError) {
            console.error("Error fetching latest ID:", fetchError);
            return NextResponse.json({ error: 'Failed to generate ID' }, { status: 500 });
        }

        let newId = 'C00001'; // Default fallback
        if (latestCandidates && latestCandidates.length > 0) {
            const lastId = latestCandidates[0].candidate_id;
            // Extract number part (assuming format Cxxxxx)
            const match = lastId.match(/C(\d+)/);
            if (match && match[1]) {
                const num = parseInt(match[1]);
                const nextNum = num + 1;
                newId = `C${nextNum.toString().padStart(5, '0')}`;
            }
        }

        console.log(`Generating new Candidate ID: ${newId}`);

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
                    nationality: nationality || null, // check-db.js confirmed this column exists
                    // New Fields
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

        // 3. Insert into candidate_profile_enhance (Optional fields)
        if (body.skills || body.education || body.languages || body.linkedin) {
            const { error: enhanceError } = await supabase
                .from('candidate_profile_enhance')
                .insert([
                    {
                        candidate_id: newId,
                        name: name, // Enhance table also has name based on schema check
                        skills_list: body.skills || null,
                        education_summary: body.education || null,
                        languages: body.languages || null,
                        linkedin_url: body.linkedin || null // Stored in 2 places as requested
                    }
                ]);

            if (enhanceError) {
                console.warn("Error inserting enhance profile:", enhanceError);
                // We don't fail the whole request if optional enhance fails, but good to log
            }
        }

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
