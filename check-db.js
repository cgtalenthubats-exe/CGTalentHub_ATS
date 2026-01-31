const { createClient } = require('@supabase/supabase-js');

// Read env vars manually since this is a standalone script
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    console.log("Checking tables...");

    // Attempt to list tables by querying a known table or just trying generic selects
    // standard way to list tables in supabase via api is tricky without direct sql access if not exposed
    // But we can try to select from the suspected ones and see if they error.

    // Check candidate_profile for salary
    const { data: profile, error: profError } = await supabase.from('Candidate Profile').select('*').limit(1);
    if (profile && profile.length > 0) console.log("Profile Columns:", Object.keys(profile[0]));

    // Check company_master for rating
    const { data: comp, error: compError } = await supabase.from('company_master').select('*').limit(1);
    if (comp && comp.length > 0) console.log("Company Columns:", Object.keys(comp[0]));

    // Check if country_master exists
    const { data: country, error: countryError } = await supabase.from('country_master').select('*').limit(1);
    if (countryError) console.log("Country Master Error (likely doesn't exist):", countryError.message);
    else console.log("Country Master Columns:", Object.keys(country[0] || {}));
}

checkTables();
