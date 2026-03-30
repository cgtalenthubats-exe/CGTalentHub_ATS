import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

// Initialize Supabase Client (Service Role needed for reliable ID checking)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; 

const supabase = createClient(supabaseUrl, supabaseKey);

import { extractYear, formatDateForInput, getEffectiveAge } from '@/lib/date-utils';
import { getCheckedStatus, normalizeName, normalizeEmail, normalizeLinkedIn } from '@/lib/candidate-utils';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, email, phone, position, nationality, createdBy: explicitCreatedBy } = body;

        // Calculate age on server to ensure DB sync
        const calculatedAge = getEffectiveAge(
            body.age_input_type === 'dob' ? body.date_of_birth : null,
            body.age_input_type === 'bachelor' ? body.year_of_bachelor_education : null
        );
        const ageToSave = calculatedAge ? parseInt(calculatedAge) : (body.age ? parseInt(body.age) : null);

        // Get current user for audit trail (Fallback)
        const supabaseServer = await createServerClient();
        const { data: { user } } = await supabaseServer.auth.getUser();
        const createdBy = explicitCreatedBy || user?.email || 'Manual Input';

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        // 0. Duplicate Check (Name, Email, or LinkedIn)
        const normName = normalizeName(name);
        const normEmail = normalizeEmail(email);
        const normLinkedIn = normalizeLinkedIn(body.linkedin);

        const { data: existing } = await supabase
            .from('Candidate Profile' as any)
            .select('candidate_id, name, email, linkedin')
            .or(`name.ilike.${normName},email.eq.${normEmail === "" ? "NULL" : normEmail},linkedin.ilike.${normLinkedIn === "" ? "NULL" : normLinkedIn}`)
            .maybeSingle();

        if (existing) {
            // Check if it's truly a duplicate
            const nameMatch = normalizeName(existing.name) === normName;
            const emailMatch = normEmail !== "" && normalizeEmail(existing.email) === normEmail;
            const linkedinMatch = normLinkedIn !== "" && normalizeLinkedIn(existing.linkedin) === normLinkedIn;

            if (nameMatch || emailMatch || linkedinMatch) {
                return NextResponse.json({
                    error: `Duplicate candidate found: ${existing.name} (${existing.candidate_id})`,
                    duplicate: existing
                }, { status: 409 });
            }
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
                    date_of_birth: formatDateForInput(body.date_of_birth) || null,
                    year_of_bachelor_education: extractYear(body.year_of_bachelor_education) || null,
                    age: ageToSave,
                    checked: getCheckedStatus(body.linkedin),
                    action_needed: 'Wait_for_vector', // AI System Flag
                    // Compensation & Benefits (all optional)
                    gross_salary_base_b_mth: body.gross_salary_base_b_mth || null,
                    other_income: body.other_income || null,
                    bonus_mth: body.bonus_mth || null,
                    car_allowance_b_mth: body.car_allowance_b_mth || null,
                    gasoline_b_mth: body.gasoline_b_mth || null,
                    phone_b_mth: body.phone_b_mth || null,
                    provident_fund_pct: body.provident_fund_pct || null,
                    medical_b_annual: body.medical_b_annual || null,
                    medical_b_mth: body.medical_b_mth || null,
                    insurance: body.insurance || null,
                    housing_for_expat_b_mth: body.housing_for_expat_b_mth || null,
                    others_benefit: body.others_benefit || null,
                    created_date: new Date().toISOString(),
                    modify_date: new Date().toISOString(),
                    created_by: createdBy
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
        }

        // 4. Insert Work Experiences (Optional)
        if (body.experiences && Array.from(body.experiences).length > 0) {
            const expData = body.experiences.map((exp: any) => ({
                candidate_id: newId,
                name: name,
                position: exp.position,
                company: exp.company,
                company_industry: exp.company_industry || null,
                company_group: exp.company_group || null,
                work_location: exp.work_location || null,
                start_date: exp.start_date || null,
                end_date: exp.end_date || null,
                is_current: exp.is_current || false
            }));

            const { error: expError } = await supabase
                .from('candidate_experiences')
                .insert(expData);

            if (expError) {
                console.error("Error inserting experiences:", expError);
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
