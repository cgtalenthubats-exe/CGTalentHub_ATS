const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfigs() {
    const { data, error } = await supabase
        .from('n8n_configs')
        .select('*');

    if (error) {
        console.error("Error fetching configs:", error);
        process.exit(1);
    }

    console.log("N8N Configurations:");
    console.table(data);
}

checkConfigs();
