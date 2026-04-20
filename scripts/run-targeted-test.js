const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const nodeId = '0698bc0f-56a9-452a-92d0-95ed239959c7'; // Chollachat Meksupha

async function runTest() {
    console.log(`\nStarting Realtime Test for Node: ${nodeId}\n`);

    // 1. Set to 'NOT_MATCH' -> RED
    console.log("Setting is_verified to 'NOT_MATCH' (Node should turn RED in 1-2 seconds)");
    await supabase.from('all_org_nodes').update({ is_verified: 'NOT_MATCH' }).eq('node_id', nodeId);
    await new Promise(r => setTimeout(r, 6000));

    // 2. Set to 'TRUE' -> GREEN
    console.log("Setting is_verified to 'TRUE' (Node should turn GREEN)");
    await supabase.from('all_org_nodes').update({ is_verified: 'TRUE' }).eq('node_id', nodeId);
    await new Promise(r => setTimeout(r, 6000));

    // 3. Set to 'FALSE' -> Should follow auto-logic (Green if match, Red if mismatch)
    // In this case, I'll set it back to the default state
    console.log("Setting is_verified back to 'FALSE' (Default Auto-Logic)");
    await supabase.from('all_org_nodes').update({ is_verified: 'FALSE' }).eq('node_id', nodeId);
    
    console.log("\n--- TEST COMPLETE ---");
}

runTest();
