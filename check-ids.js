const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use Service Key directly as we know anon key is acting weird/is same as service key temporarily
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkIds() {
    const { data, error } = await supabase
        .from('candidate_profile') // Note: table name might be 'Candidate Profile' based on check-db.js
        .select('candidate_id')
        .order('candidate_id', { ascending: false })
        .limit(5);

    if (error) {
        // Try with snake_case if "Candidate Profile" failed, but check-db.js used "Candidate Profile"
        console.error("Error fetching IDs (likely table name issue):", error.message);
        console.log("Retrying with 'Candidate Profile'...");
        const { data: data2, error: error2 } = await supabase
            .from('Candidate Profile')
            .select('candidate_id')
            .order('candidate_id', { ascending: false })
            .limit(5);

        if (error2) console.error("Retry Error:", error2);
        else console.log("IDs found:", data2);
    } else {
        console.log("IDs found:", data);
    }
}

checkIds();
