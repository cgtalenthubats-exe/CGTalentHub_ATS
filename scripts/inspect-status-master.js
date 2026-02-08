
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectStatus() {
    const { data, error } = await supabase
        .from('status_master')
        .select('*')
        .order('stage_order', { ascending: true });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Status Master:', data);
}

inspectStatus();
