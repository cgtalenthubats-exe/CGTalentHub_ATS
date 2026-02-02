const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("URL:", supabaseUrl);
// console.log("Anon Key:", supabaseAnonKey); // Security risk to print keys, but useful for debugging if truncated

async function checkJobs() {
    console.log("\n--- Testing with ANON KEY (Client Simulation) ---");
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const { data: jobsAnon, error: errorAnon } = await supabaseAnon
        .from('job_requisitions')
        .select('*')
        .limit(1);

    if (errorAnon) {
        console.error("❌ Anon Key Error:");
        console.error(JSON.stringify(errorAnon, null, 2));
    } else {
        console.log("✅ Anon Key Success! Rows found:", jobsAnon.length);
    }

    console.log("\n--- Testing with SERVICE ROLE KEY (Server Simulation) ---");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: jobsAdmin, error: errorAdmin } = await supabaseAdmin
        .from('job_requisitions')
        .select('*')
        .limit(1);

    if (errorAdmin) {
        console.error("❌ Service Key Error:");
        console.error(JSON.stringify(errorAdmin, null, 2));
    } else {
        console.log("✅ Service Key Success! Rows found:", jobsAdmin.length);
    }
}

checkJobs();
