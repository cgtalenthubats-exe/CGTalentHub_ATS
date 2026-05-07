require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function countStatus(status) {
  const { count, error } = await supabase
    .from('Candidate Profile')
    .select('*', { count: 'exact', head: true })
    .eq('enrichment_status', status);
  return count;
}

async function checkStatus() {
  const waitCount = await countStatus('Wait AI check');
  const indCount = await countStatus('industry_issue_v2');
  
  const { count: nullCount } = await supabase
    .from('Candidate Profile')
    .select('*', { count: 'exact', head: true })
    .or('enrichment_status.is.null,enrichment_status.eq.');

  const { count: total } = await supabase
    .from('Candidate Profile')
    .select('*', { count: 'exact', head: true });

  console.log(`Total Candidates: ${total}`);
  console.log(`- 'Wait AI check': ${waitCount}`);
  console.log(`- 'industry_issue_v2': ${indCount}`);
  console.log(`- NULL or Empty: ${nullCount}`);
}

checkStatus();
