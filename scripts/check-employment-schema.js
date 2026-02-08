
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    const { data, error } = await supabase
        .from('employment_record')
        .select('*')
        .limit(1);

    if (error) {
        console.error(error);
    } else {
        if (data.length > 0) {
            console.log('Columns:', Object.keys(data[0]));
        } else {
            console.log('Table exists but empty. Cannot infer columns easily via select * on empty table without info schema.');
            // Fallback: try to insert a dummy record to see error? No, that's risky.
            // Let's just list keys from a successful fetch if possible.
            // If empty, I might have to guess or check previous migrations.
        }
    }
}

checkSchema();
