const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("SUPABASE_URL or SUPABASE_KEY missing in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateLogic() {
    const candidateId = 'C07189';
    console.log(`--- Simulating OrgChart Logic for ${candidateId} ---`);

    // 1. Fetch Node
    const { data: nodes } = await supabase
        .from('all_org_nodes')
        .select('*')
        .eq('matched_candidate_id', candidateId);

    if (!nodes || nodes.length === 0) {
        console.log("No node found for this candidate.");
        return;
    }

    const node = nodes[0];
    console.log(`\n1. Found Org Node:`);
    console.log(`   - Name: ${node.name}`);
    console.log(`   - Title: ${node.title}`);
    console.log(`   - is_verified: ${node.is_verified}`);
    console.log(`   - upload_id: ${node.upload_id}`);

    // 2. Fetch Upload Data (Company Master)
    const { data: upload } = await supabase
        .from('org_chart_uploads')
        .select('company_name, company_id')
        .eq('upload_id', node.upload_id)
        .single();
    
    console.log(`\n2. Found Upload Context:`);
    console.log(`   - Chart Company Name: ${upload?.company_name}`);
    console.log(`   - Chart Company ID: ${upload?.company_id}`);

    // 3. Fetch Experiences using exact same query logic
    const { data: experiences } = await supabase
        .from('candidate_experiences')
        .select('candidate_id, company_id, company, position, is_current_job, start_date')
        .eq('candidate_id', candidateId);

    console.log(`\n3. Found Candidate Experiences (Total: ${experiences?.length || 0})`);
    
    let currentExp = null;
    if (experiences && experiences.length > 0) {
        currentExp = experiences.find((e) => e.is_current_job === 'Current');
        if (!currentExp) {
            currentExp = experiences.sort((a, b) => {
                if (!a.start_date) return 1;
                if (!b.start_date) return -1;
                return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
            })[0];
        }
    }

    console.log(`   - Selected "Current" Experience:`);
    console.log(currentExp);

    // 4. Do the Comparison Logic
    console.log(`\n4. Evaluating Logic:`);
    const chartCoId = upload?.company_id || '';
    let matchStatus = 'unmapped';

    if (currentExp) {
        const candCoId = currentExp.company_id || '';
        const candPosition = currentExp.position?.toLowerCase() || '';
        const nodeTitle = node.title?.toLowerCase() || '';

        console.log(`   [Compare Company]: Chart CoId (${chartCoId}) vs Candidate CoId (${candCoId})`);
        console.log(`   [Compare Position]: Chart Title ("${nodeTitle}") vs Candidate Position ("${candPosition}")`);

        if (candCoId && chartCoId && candCoId !== chartCoId) {
            matchStatus = 'mismatch_company';
            console.log("   -> Result: mismatch_company (Red)");
        } else if (candPosition === nodeTitle) {
            matchStatus = 'matched';
            console.log("   -> Result: matched (Green)");
        } else {
            matchStatus = 'mismatch_position';
            console.log("   -> Result: mismatch_position (Yellow)");
        }
    } else {
        matchStatus = node.linkedin ? 'n8n_processing' : 'unmapped';
        console.log(`   -> Result: ${matchStatus} (No valid experience)`);
    }

    // 5. Final Color Status
    console.log(`\n5. Final Outcome:`);
    const finalStatus = (node.is_verified === 'TRUE' || matchStatus === 'matched') ? 'matched' : 
                        (matchStatus === 'mismatch_company' || node.is_verified === 'NOT_MATCH') ? 'mismatch_company' :
                        (currentExp || node.linkedin) ? 'mismatch_position' : 'unmapped';

    let color = 'White';
    if (finalStatus === 'matched') color = 'Green (🟢)';
    else if (finalStatus === 'mismatch_company') color = 'Red (🔴)';
    else if (finalStatus === 'mismatch_position') color = 'Yellow (🟡)';
    else if (finalStatus === 'n8n_processing') color = 'Indigo (🔵)';

    console.log(`   - Final Status Code: ${finalStatus}`);
    console.log(`   - UI Color should be: ${color}`);
}

simulateLogic().catch(console.error);
