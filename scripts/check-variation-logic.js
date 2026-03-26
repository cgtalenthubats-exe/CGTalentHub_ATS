const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking company_variation columns...");
    // Fallback search to see data structure
    const { data: sample, error: sampleError } = await supabase
        .from('company_variation')
        .select('*')
        .limit(1);

    if (sampleError) {
        console.error("Sample Error:", sampleError);
    } else if (sample && sample.length > 0) {
        console.log("Found entry:", sample[0]);
    } else {
        console.log("No data in company_variation.");
    }
}

check();
