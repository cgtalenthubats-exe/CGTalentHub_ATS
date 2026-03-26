const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Searching for 'metro' in company_variation...");
    const { data, error } = await supabase
        .from('company_variation')
        .select('variation_name')
        .ilike('variation_name', '%metro%')
        .limit(20);

    if (error) {
        console.error("Error searching companies:", error);
    } else {
        const names = data.map(item => item.variation_name);
        console.log("Suggestions for 'metro':", names);
        console.log("Total unique results found (capped at 20):", new Set(names).size);
    }
}

check();
