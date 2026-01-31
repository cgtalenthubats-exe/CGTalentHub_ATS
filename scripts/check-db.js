
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load env
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName) {
    console.log(`\n🔍 Checking table: [${tableName}]...`);
    const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: false }) // Head false to get data
        .limit(1);

    if (error) {
        console.error(`   ❌ Error: ${error.message} (Code: ${error.code})`);
        return false;
    } else {
        console.log(`   ✅ Success! Found ${count} rows.`);
        if (data && data.length > 0) {
            console.log(`   📝 Sample Column Keys:`, Object.keys(data[0]).join(", "));
        } else {
            console.log(`   ⚠️ Table is empty, but exists.`);
        }
        return true;
    }
}

async function run() {
    console.log("🔌 Connecting to Supabase...");
    console.log(`   URL: ${supabaseUrl}`);

    const tablesToCheck = process.argv.slice(2);
    if (tablesToCheck.length === 0) {
        // Default checks if no args provided
        await checkTable("Candidate Profile");
        await checkTable("job_requisitions");
    } else {
        for (const table of tablesToCheck) {
            await checkTable(table);
        }
    }

    console.log("\n🏁 Diagnostic Complete.");
}

run();
