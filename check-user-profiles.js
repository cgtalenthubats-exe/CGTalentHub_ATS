
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserProfileSchema() {
    console.log('--- Checking Schema for user_profiles ---');

    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching user_profiles:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]).join(', '));
        console.log('Sample row:', data[0]);
    } else {
        console.log('Table found but empty.');
        // Try to get column info another way or just assume empty
    }
}

checkUserProfileSchema();
