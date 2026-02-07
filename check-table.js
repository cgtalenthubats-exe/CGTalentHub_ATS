
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log('--- Checking resume_uploads Table ---');
    try {
        const { data, error } = await supabase
            .from('resume_uploads')
            .select('id')
            .limit(1);

        if (error) {
            console.error('Table Check Error:', error.message);
            if (error.code === '42P01') { // PostgreSQL error code for undefined table
                console.log('Table does not exist.');
            }
        } else {
            console.log('Table exists. Sample data:', data);
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

checkTable();
