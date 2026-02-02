const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use the key that the client is likely using to test permissions, 
// BUT for inspection we need admin. Let's start with Service Role to see schema.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCompanyMaster() {
    console.log("--- Checking Company Master Schema ---");
    // Try to insert a dummy to see specific error if possible, or just read a row
    const testName = "Debug_Test_Comp_" + Date.now();

    // 1. Check Columns by reading one
    const { data: existing, error: readError } = await supabase.from('company_master').select('*').limit(1);
    if (readError) {
        console.error("Read Error:", readError);
    } else if (existing.length > 0) {
        console.log("Existing Row Keys:", Object.keys(existing[0]));
    } else {
        console.log("Table is empty, cannot infer keys from data. Trying insert...");
    }

    // 2. Try Insert with Service Role (Admin)
    const { data: insertData, error: insertError } = await supabase
        .from('company_master')
        .insert([{ company_name: testName, industry: "Test Ind", group: "Test Grp" }])
        .select();

    if (insertError) {
        console.error("Admin Insert Error:", insertError);
    } else {
        console.log("Admin Insert Success:", insertData);
        // Clean up
        await supabase.from('company_master').delete().eq('company_name', testName);
    }
}

debugCompanyMaster();
