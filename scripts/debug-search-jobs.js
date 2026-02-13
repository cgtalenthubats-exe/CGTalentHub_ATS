
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

async function inspectSchema() {
    console.log("--- Inspecting 'search_jobs' table ---");

    // Attempt to get column info via RPC or just a sample row
    const { data, error } = await supabase
        .from('search_jobs')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching data:", error.message);
    } else {
        console.log("Sample row (to check keys):", data[0] || "No rows found");
        if (data[0]) {
            console.log("Columns:", Object.keys(data[0]).join(", "));
        }
    }

    // Try to check if we can insert with a random UUID
    console.log("\n--- Testing Insertion with UUID ---");
    const { v4: uuidv4 } = require('uuid');
    const sessionId = uuidv4();
    const testRow = {
        session_id: sessionId,
        original_query: 'debug_test_' + Date.now(),
        user_email: 'debug@test.com',
        status: 'processing'
    };

    const { data: insertData, error: insertError } = await supabase
        .from('search_jobs')
        .insert([testRow])
        .select();

    if (insertError) {
        console.error("Insertion failed:", insertError.message);
        console.error("Full error details:", JSON.stringify(insertError, null, 2));
    } else {
        console.log("Insertion successful:", insertData);
    }
}

inspectSchema();
