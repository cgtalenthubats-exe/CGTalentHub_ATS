
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCandidate(nameFragment) {
    console.log(`Checking for candidate with name like "%${nameFragment}%"...`);
    const { data, error } = await supabase
        .from('Candidate Profile')
        .select('candidate_id, name, email, candidate_status, blacklist_note')
        .ilike('name', `%${nameFragment}%`)
        .limit(5);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Found:", data);
    }
}

(async () => {
    await checkCandidate("Sumeth");
    await checkCandidate("aldi");
})();
