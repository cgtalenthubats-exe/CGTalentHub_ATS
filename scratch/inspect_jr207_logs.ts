
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectStatusLog() {
    const jrId = 'JR000207';
    console.log(`Inspecting status_log for ${jrId}...`);

    // 1. Find all jr_candidate_ids for this JR
    const { data: candidates, error: candError } = await supabase
        .from('jr_candidates')
        .select('jr_candidate_id, candidate_id')
        .eq('jr_id', jrId);

    if (candError) {
        console.error('Error fetching candidates:', candError);
        return;
    }

    const cIds = candidates.map(c => c.jr_candidate_id);
    
    // 2. Fetch logs for these candidates
    const { data: logs, error: logError } = await supabase
        .from('status_log')
        .select('log_id, jr_candidate_id, status, timestamp, updated_by')
        .in('jr_candidate_id', cIds);

    if (logError) {
        console.error('Error fetching logs:', logError);
        return;
    }

    // 3. Filter and Group
    const internalScreeningLogs = logs.filter(l => l.status === 'Internal Screening');
    console.log(`Found ${internalScreeningLogs.length} logs with 'Internal Screening' status.`);
    
    if (internalScreeningLogs.length > 0) {
        console.log('Sample logs:', internalScreeningLogs.slice(0, 5));
    }

    // List unique statuses found in this JR's logs
    const uniqueStatuses = [...new Set(logs.map(l => l.status))];
    console.log('All unique statuses found in JR000207 logs:', uniqueStatuses);
}

inspectStatusLog();
