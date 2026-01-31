
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

async function inspect(table) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (data && data.length > 0) {
        console.log(`\n📋 [${table}] Keys:`);
        console.log(Object.keys(data[0]).join(', '));
    } else {
        console.log(`❌ [${table}] Empty or Error: ${error?.message}`);
    }
}

async function run() {
    await inspect("Candidate Profile");
    await inspect("candidate_experiences");
    await inspect("company_master");
}

run();
