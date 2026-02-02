const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log("Attempting insert WITHOUT candidate_id...");
    const { data, error } = await supabase
        .from('Candidate Profile')
        .insert([
            {
                name: 'Test Insert Logic',
                email: 'test_logic@example.com'
            }
        ])
        .select();

    if (error) {
        console.error("❌ Insert failed:", error.message);
        console.log("Conclusion: ID generation likely needs to be manual.");
    } else {
        console.log("✅ Insert Success:", data);
        console.log("Conclusion: DB handles ID generation.");
        // Cleanup
        await supabase.from('Candidate Profile').delete().eq('candidate_id', data[0].candidate_id);
    }
}

testInsert();
