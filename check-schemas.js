const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchemas() {
    console.log("--- Checking Industry Group ---");
    const { data: ind, error: iErr } = await supabase.from('industry_group').select('*').limit(3);
    if (iErr) console.error("Error industry_group:", iErr.message);
    else console.log("Industry Group Sample:", ind);

    console.log("\n--- Checking Candidate Profile Enhance ---");
    const { data: enh, error: eErr } = await supabase.from('candidate_profile_enhance').select('*').limit(1);
    if (eErr) console.error("Error candidate_profile_enhance:", eErr.message);
    else console.log("Enhance Sample:", enh);

    console.log("\n--- Checking Candidate Profile (Cols) ---");
    const { data: prof, error: pErr } = await supabase.from('Candidate Profile').select('*').limit(1);
    if (pErr) console.error("Error Candidate Profile:", pErr.message);
    else if (prof && prof.length > 0) console.log("Profile Keys:", Object.keys(prof[0]));
}

checkSchemas();
