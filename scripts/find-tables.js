
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY; // Use Service Key to see everything

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName) {
    const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .limit(1);

    if (error) {
        console.log(`❌ [${tableName}]: ${error.message}`);
        return false;
    } else {
        console.log(`✅ [${tableName}]: Found ${count} rows.`);
        return true;
    }
}

async function run() {
    console.log("🔍 Searching for Experience Tables...");

    await checkTable("candidate_experiences");
    await checkTable("Candidate_Experiences");
    await checkTable("Candidate Experiences");
    await checkTable("employment_record"); // Another common name

    console.log("\n🔍 Searching for Filter Master Data...");
    await checkTable("company_master");
    await checkTable("industry_group");
}

run();
