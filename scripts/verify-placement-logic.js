
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function verifyPlacementLogic() {
    console.log('--- Verifying Placement Logic (Optional Fields + JR Deactivation) ---');

    // 1. Fetch a real JR Candidate ID
    const { data: jrCand, error: fetchError } = await supabase
        .from('jr_candidates')
        .select('jr_candidate_id, candidate_id, jr_id')
        .limit(1)
        .single();

    if (fetchError || !jrCand) {
        console.error('Error fetching sample candidate:', fetchError);
        return;
    }

    // 2. Fetch Profile
    const { data: profile } = await supabase
        .from('Candidate Profile')
        .select('name')
        .eq('candidate_id', jrCand.candidate_id)
        .single();

    console.log('Using sample candidate:', profile?.name, 'JR:', jrCand.jr_id);

    // 2.5 Generate ID
    const { data: maxResult } = await supabase
        .from('employment_record')
        .select('employment_record_id')
        .order('employment_record_id', { ascending: false })
        .limit(1)
        .maybeSingle();

    let nextIdNum = 1;
    if (maxResult && maxResult.employment_record_id) {
        const currentId = maxResult.employment_record_id;
        const numPart = currentId.replace(/^ER/, '');
        const parsed = parseInt(numPart);
        if (!isNaN(parsed)) {
            nextIdNum = parsed + 1;
        }
    }
    const nextErId = 'ER' + nextIdNum.toString().padStart(6, '0');
    console.log('Generated ID:', nextErId);

    // 3. Prepare Payload (Simulating optional fields missing)
    const payload = {
        employment_record_id: nextErId,
        jr_id: jrCand.jr_id,
        candidate_id: jrCand.candidate_id,
        candidate_name: profile?.name || 'Test Candidate',
        position: 'Overridden Position', // Testing override
        bu: 'Overridden BU',
        sub_bu: 'Overridden SubBU',
        // hire_date: null, // Test optional
        // base_salary: 0, // Test optional
        hiring_status: 'Active',
        note: 'VERIFICATION_SCRIPT_TEST_2',
        create_by: 'Verification Script'
    };

    // 4. Attempt Insert
    const { data, error } = await supabase
        .from('employment_record')
        .insert(payload)
        .select();

    if (error) {
        console.error('Insert Failed:', error);
    } else {
        console.log('Employment Record Insert Successful:', data);

        // 5. Verify JR Deactivation
        // In logical flow, confirmPlacement calls `update` on `job_requisitions`.
        // We'll just check if we can update it manually here to confirm permissions/column exists.
        const { data: jrData, error: jrError } = await supabase
            .from('job_requisitions')
            .update({ is_active: 'Inactive' })
            .eq('jr_id', jrCand.jr_id)
            .select('is_active');

        if (jrError) console.error("JR Deactivation Check Failed:", jrError);
        else console.log("JRs Deactivation Check Successful:", jrData);

        // Cleanup
        const { error: delError } = await supabase
            .from('employment_record')
            .delete()
            .eq('note', 'VERIFICATION_SCRIPT_TEST_2');

        if (!delError) console.log('Cleanup Successful');
    }
}

verifyPlacementLogic();
