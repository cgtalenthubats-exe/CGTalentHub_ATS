const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking assistant_sessions...");
    const { data, error } = await supabase.from('assistant_sessions').select('*').limit(10);
    
    if (error) {
        console.error("Error fetching sessions:", error);
    } else {
        console.log(`Found ${data.length} sessions.`);
        if (data.length > 0) {
            console.log("Sample Session:", JSON.stringify(data[0], null, 2));
        }
        
        // Count by user
        const users = data.map(s => s.user_email);
        console.log("Unique users in sessions:", [...new Set(users)]);
    }
}

check();
