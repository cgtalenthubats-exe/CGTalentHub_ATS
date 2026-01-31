const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- Status Master ---');
    const { data: master } = await supabase.from('status_master').select('*').order('stage_order');
    console.table(master);

    console.log('\n--- Recent Status Logs ---');
    const { data: logs } = await supabase.from('status_log').select('status').limit(20);
    const distinctLogs = [...new Set(logs.map(l => l.status))];
    console.log(distinctLogs);
}

check();
