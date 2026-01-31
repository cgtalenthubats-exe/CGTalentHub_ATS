const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFK() {
    console.log('--- Checking Foreign Keys for jr_candidates ---');
    // Query internal postgres tables to find constraints (simplified via RPC if possible, or just guessing)
    // Since we can't query pg_catalog directly easily via client without rpc, 
    // we'll try a test query with different join hints to see what works.

    // Attempt 1: Default inference
    const { data: d1, error: e1 } = await supabase
        .from('jr_candidates')
        .select('candidate_id, Candidate Profile!candidate_id(*)')
        .limit(1);

    if (e1) console.log('Attempt 1 (Candidate Profile!candidate_id) Failed:', e1.message);
    else console.log('Attempt 1 Success:', d1?.length);

    // Attempt 2: "candidate_profile" inferred
    const { data: d2, error: e2 } = await supabase
        .from('jr_candidates')
        .select('candidate_id, candidate_profile(*)')
        .limit(1);

    if (e2) console.log('Attempt 2 (candidate_profile) Failed:', e2.message);
    else console.log('Attempt 2 Success:', d2?.length);

    // Attempt 3: "Candidate Profile" inferred
    const { data: d3, error: e3 } = await supabase
        .from('jr_candidates')
        .select('candidate_id, "Candidate Profile"(*)')
        .limit(1);

    if (e3) console.log('Attempt 3 ("Candidate Profile") Failed:', e3.message);
    else console.log('Attempt 3 Success:', d3?.length);
}

checkFK();
