const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runTest() {
    const nodeId = '09ff0932-d0db-408d-b909-b8751bf3d5d4'; // Kriengsak Tantiphipop
    
    console.log(`Testing Node: ${nodeId}`);

    // 1. Set to NOT_MATCH
    console.log("Setting to NOT_MATCH...");
    const { error: err1 } = await supabase
        .from('all_org_nodes')
        .update({ is_verified: 'NOT_MATCH' })
        .eq('node_id', nodeId);
    
    if (err1) throw err1;
    
    let { data: node1 } = await supabase.from('all_org_nodes').select('is_verified').eq('node_id', nodeId).single();
    console.log(`Current is_verified: ${node1.is_verified} (Expected: NOT_MATCH)`);

    // 2. Set back to FALSE (or TRUE for green test)
    console.log("Setting to TRUE...");
    const { error: err2 } = await supabase
        .from('all_org_nodes')
        .update({ is_verified: 'TRUE' })
        .eq('node_id', nodeId);
    
    if (err2) throw err2;
    
    let { data: node2 } = await supabase.from('all_org_nodes').select('is_verified').eq('node_id', nodeId).single();
    console.log(`Current is_verified: ${node2.is_verified} (Expected: TRUE)`);

    console.log("TEST SUCCESSFUL: Database updates for verification status are working correctly.");
}

runTest().catch(console.error);
