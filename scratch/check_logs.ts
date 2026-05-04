
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    const jrId = 'JR000186';
    const { data: cands } = await supabase.from('jr_candidates').select('jr_candidate_id').eq('jr_id', jrId);
    
    if (!cands || cands.length === 0) {
        console.log('No candidates found for', jrId);
        return;
    }

    const ids = cands.map(c => c.jr_candidate_id);
    const { data: logs } = await supabase.from('status_log').select('*').in('jr_candidate_id', ids);

    console.log('Candidate count:', cands.length);
    console.log('Log count:', logs?.length || 0);
    if (logs && logs.length > 0) {
        const statuses = logs.map(l => l.status);
        const unique = [...new Set(statuses)];
        console.log('Unique statuses:', unique);
        const countMap: any = {};
        statuses.forEach(s => countMap[s] = (countMap[s] || 0) + 1);
        console.log('Counts:', countMap);
    }
}

checkLogs();
