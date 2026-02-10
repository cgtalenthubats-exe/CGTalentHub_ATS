
// Mock environment for server action if needed, or just use raw supabase client in script for verification
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function verify() {
    console.log("--- Verifying Candidate Count (Loop Logic) ---");

    let allData = [];
    let from = 0;
    const step = 1000;
    let more = true;

    while (more) {
        console.log(`Fetching from ${from}...`);
        const { data, error } = await supabase
            .from('jr_candidates')
            .select('jr_candidate_id')
            .range(from, from + step - 1);

        if (error) {
            console.error("Error:", error);
            break;
        }

        if (data && data.length > 0) {
            allData = allData.concat(data);
            console.log(`Fetched ${data.length} items. Total: ${allData.length}`);

            if (data.length < step) more = false;
            else from += step;
        } else {
            more = false;
        }
    }

    console.log(`FINAL COUNT: ${allData.length}`);
    if (allData.length > 1000) {
        console.log("SUCCESS: Count is greater than 1000.");
    } else {
        console.log("WARNING: Count is <= 1000. Limit might still be active or DB is small.");
    }
}

verify();
