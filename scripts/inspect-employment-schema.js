
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectSchema() {
    console.log('--- Inspecting employment_record Schema ---');

    const { data, error } = await supabase
        .from('employment_record')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Keys:', Object.keys(data[0]));
        console.log('Sample:', data[0]);
    } else {
        console.log('Table is empty. Trying to insert a dummy to see errors or just guessing keys?');
        // If empty, we can't infer keys easily without admin API or just attempting insert.
        // listing distinct columns is difficult without SQL.
        // Let's try to infer from the code usage in src/app/actions/employment.ts
    }
}

inspectSchema();
