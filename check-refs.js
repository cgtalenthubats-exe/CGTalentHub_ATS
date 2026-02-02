const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRefTables() {
    console.log("--- Checking Country Table ---");
    const { data: countries, error: cErr } = await supabase.from('country').select('*').limit(1);
    if (cErr) console.error("Error country:", cErr.message);
    else console.log("Country Sample:", countries[0]);

    console.log("\n--- Checking Nationality Table (if exists) ---");
    // User mentioned "nationality" table.
    const { data: nats, error: nErr } = await supabase.from('nationality').select('*').limit(1);
    if (nErr) console.error("Error nationality:", nErr.message);
    else console.log("Nationality Sample:", nats[0]);
}

checkRefTables();
