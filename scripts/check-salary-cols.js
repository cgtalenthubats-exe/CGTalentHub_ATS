require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
    const { data, error } = await supabase.rpc('execute_sql', {
        sql_query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Candidate Profile' AND column_name IN ('gross_salary_base_b_mth', 'car_allowance_b_mth', 'gasoline_b_mth', 'phone_b_mth');"
    });
    
    if (error) {
        // If RPC doesn't work, try just a select with limit 1 to see values
        console.log("RPC failed, fetching sample data instead...");
        const { data: sample, error: sampleError } = await supabase.from('Candidate Profile').select('gross_salary_base_b_mth, car_allowance_b_mth, gasoline_b_mth, phone_b_mth').limit(5);
        if (sampleError) console.error(sampleError);
        else console.log(JSON.stringify(sample, null, 2));
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

checkColumns();
