
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function inspect() {
    console.log("--- Inspecting Status Log Schema ---");
    const { data, error } = await supabase
        .from('status_log')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Status Log Sample:", data);
        if (data.length > 0) {
            console.log("Keys:", Object.keys(data[0]));
        }
    }
}

inspect();
