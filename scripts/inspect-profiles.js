
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function inspect() {
    console.log("--- Inspecting Profiles Table ---");
    // Try 'profiles', 'user_profiles', 'users'
    const { data: p1, error: e1 } = await supabase.from('profiles').select('*').limit(1);
    const { data: p2, error: e2 } = await supabase.from('user_profiles').select('*').limit(1);

    if (p1) console.log("profiles:", p1);
    if (e1) console.log("profiles error:", e1.message);

    if (p2) console.log("user_profiles:", p2);
    if (e2) console.log("user_profiles error:", e2.message);

    if (p1 && p1.length > 0) console.log("profiles keys:", Object.keys(p1[0]));
    if (p2 && p2.length > 0) console.log("user_profiles keys:", Object.keys(p2[0]));
}

inspect();
