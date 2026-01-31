require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    console.log("--- Checking Schema for candidate_experiences ---");

    // Get one row to see all columns
    const { data, error } = await supabase
        .from('candidate_experiences')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error:", error.message);
    } else if (data && data.length > 0) {
        const keys = Object.keys(data[0]);
        console.log("Columns found:", keys.join(", "));

        // Check for specific columns mentioned by user
        const currentCols = keys.filter(k => k.includes('current') || k.includes('Current'));
        console.log("Columns like 'current':", currentCols);

        // Check values for 'is_current_job' if it exists
        if (keys.includes('is_current_job')) {
            const { data: samples } = await supabase
                .from('candidate_experiences')
                .select('is_current_job')
                .limit(20);
            console.log("Sample values for is_current_job:", samples.map(s => s.is_current_job));

            // Count 'Current'
            const { count } = await supabase
                .from('candidate_experiences')
                .select('*', { count: 'exact', head: true })
                .eq('is_current_job', 'Current');
            console.log("Count where is_current_job = 'Current':", count);
        }
    } else {
        console.log("Table empty or no access.");
    }
}

checkSchema();
