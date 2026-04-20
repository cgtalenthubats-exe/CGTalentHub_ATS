const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("SUPABASE_URL or SUPABASE_KEY missing in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogic() {
    // 1. Find a node with a match
    const { data: nodes } = await supabase
        .from('all_org_nodes')
        .select('node_id, name, is_verified, company_id')
        .not('matched_candidate_id', 'is', null)
        .limit(1);

    if (!nodes || nodes.length === 0) {
        console.log("No matched nodes found to test.");
        return;
    }

    const testNode = nodes[0];
    console.log(`\n--- STARTING TEST FOR: ${testNode.name} ---`);
    console.log(`1. Current State: ${testNode.is_verified}`);

    // 2. Set to 'NOT_MATCH' (Should turn RED)
    console.log("2. Updating is_verified to 'NOT_MATCH'...");
    await supabase
        .from('all_org_nodes')
        .update({ is_verified: 'NOT_MATCH' })
        .eq('node_id', testNode.node_id);

    console.log(">>> SUCCESS: Set to 'NOT_MATCH'. Please observe the UI (Node should turn RED).");

    // Wait 5 seconds
    console.log("Waiting 5 seconds...");
    await new Promise(r => setTimeout(r, 5000));

    // 3. Set to 'TRUE' (Should turn GREEN)
    console.log("3. Updating is_verified to 'TRUE'...");
    await supabase
        .from('all_org_nodes')
        .update({ is_verified: 'TRUE' })
        .eq('node_id', testNode.node_id);
    
    console.log(">>> SUCCESS: Set to 'TRUE'. Please observe the UI (Node should turn GREEN).");
    console.log("--- TEST COMPLETE ---\n");
}

testLogic();
