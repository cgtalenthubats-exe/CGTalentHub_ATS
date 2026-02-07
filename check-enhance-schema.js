require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('--- Checking Schema for candidate_profile_enhance ---');

    // Fetch one row to inspect keys
    const { data, error } = await supabase
        .from('candidate_profile_enhance')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        console.log('Columns found:', columns.join(', '));

        // Check specific columns
        const hasResume = columns.includes('resume_url');
        console.log(`Has 'resume_url': ${hasResume}`);

    } else {
        // If no data, we can't infer schema easily from JS client without metadata API or valid row
        console.log('No data found in table to infer schema from.');
    }
}

checkSchema();
