const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function simulate() {
    const sid = 'session_1774412306537_7yim22b'; // สวัสดี
    console.log(`Simulating fetch for session: ${sid}`);
    
    // Step 1: Metadata
    const { data: meta, error: metaErr } = await supabase
        .from('n8n_chat_histories')
        .select('id')
        .eq('session_id', sid)
        .order('id', { ascending: false })
        .limit(15);
        
    if (metaErr) return console.error("Meta Err:", metaErr);
    const ids = (meta || []).map(d => d.id.toString());
    console.log("Found Meta IDs:", ids);
    
    if (ids.length === 0) return console.log("No IDs found. Stoppping.");
    
    // Step 2: Content
    const { data: content, error: contentErr } = await supabase
        .from('n8n_chat_histories')
        .select('id, message')
        .in('id', ids);
        
    if (contentErr) return console.error("Content Err:", contentErr);
    console.log(`Found ${content.length} content rows.`);
    
    // Check first message
    if (content.length > 0) {
        console.log("Sample Content Record:", JSON.stringify(content[0], null, 2));
    }
}

simulate();
