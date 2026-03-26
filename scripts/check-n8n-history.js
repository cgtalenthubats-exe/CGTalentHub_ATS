const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking n8n_chat_histories...");
    const { data: cols, error: colError } = await supabase.rpc('execute_sql', { 
        query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'n8n_chat_histories';" 
    });

    if (colError) {
        console.error("Error fetching columns:", colError);
        // Fallback: just try to select one row
        const { data: sample, error: sampleError } = await supabase.from('n8n_chat_histories').select('*').limit(1);
        if (sampleError) console.error("Sample Error:", sampleError);
        else {
            console.log("Sample Row ID:", sample[0]?.id);
            console.log("Sample Row SessionID:", sample[0]?.session_id);
            console.log("Sample Message JSON:", JSON.stringify(sample[0]?.message, null, 2));
        }
    } else {
        console.log("Columns:", cols);
    }

    const { data: sessions, error: sessionError } = await supabase.from('n8n_chat_histories').select('session_id').limit(100);
    if (sessionError) console.error("Session Error:", sessionError);
    else {
        const unique = [...new Set(sessions.map(s => s.session_id))];
        console.log("Unique Session IDs (sample):", unique);
    }
}

check();
