const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugJR(jrId) {
    console.log(`\n🔍 AUDIT REPORT FOR: ${jrId}`);

    // 1. Fetch Candidates (jr_candidates)
    const { data: cands, error: cErr } = await supabase
        .from('jr_candidates')
        .select('jr_candidate_id, candidate_id, list_type')
        .eq('jr_id', jrId);

    if (cErr) { console.error('Error fetching candidates:', cErr); return; }
    console.log(`\n1. Total Candidates: ${cands.length}`);

    // 2. Breakdown by List Type
    const listTypeMap = {};
    cands.forEach(c => {
        const type = c.list_type || 'Unknown';
        listTypeMap[type] = (listTypeMap[type] || 0) + 1;
    });
    console.log('2. By List Type:', listTypeMap);

    // 3. Fetch Logs (status_log)
    const jrCandIds = cands.map(c => c.jr_candidate_id);
    const { data: logs, error: lErr } = await supabase
        .from('status_log')
        .select('jr_candidate_id, status, timestamp, log_id')
        .in('jr_candidate_id', jrCandIds); // Fetch ALL logs for these candidates

    if (lErr) { console.error('Error fetching logs:', lErr); return; }

    // 4. Resolve REAL Status
    const statusCounts = {};
    const noLogCandidates = [];

    cands.forEach(c => {
        // Filter logs for this specific candidate (String comparison)
        const myLogs = logs.filter(l => String(l.jr_candidate_id) === String(c.jr_candidate_id));

        let finalStatus = 'No Log Found';
        if (myLogs.length > 0) {
            // SORT Logic: Timestamp DESC, then Log ID DESC
            myLogs.sort((a, b) => {
                const timeA = new Date(a.timestamp).getTime();
                const timeB = new Date(b.timestamp).getTime();
                if (timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) return timeB - timeA;
                return b.log_id - a.log_id;
            });
            finalStatus = myLogs[0].status; // Take the latest
        } else {
            noLogCandidates.push(c.jr_candidate_id);
        }

        statusCounts[finalStatus] = (statusCounts[finalStatus] || 0) + 1;
    });

    console.log('\n3. Real Status Breakdown (from Logs):');
    console.table(statusCounts);

    if (noLogCandidates.length > 0) {
        console.log(`\n⚠️ Candidates with NO LOGS: ${noLogCandidates.length} (IDs: ${noLogCandidates.slice(0, 5).join(', ')}...)`);
    }
}

debugJR('JR000014');
