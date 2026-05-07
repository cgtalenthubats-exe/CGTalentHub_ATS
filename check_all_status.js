require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAllStatus() {
  let allStatuses = [];
  let page = 0;
  const limit = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('Candidate Profile')
      .select('enrichment_status')
      .range(page * limit, (page + 1) * limit - 1);
      
    if (error) {
      console.error(error);
      break;
    }
    
    allStatuses = allStatuses.concat(data);
    if (data.length < limit) hasMore = false;
    page++;
  }
  
  const counts = {};
  for (const row of allStatuses) {
    const s = row.enrichment_status || 'NULL/EMPTY';
    counts[s] = (counts[s] || 0) + 1;
  }
  
  console.table(Object.entries(counts).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count));
}
checkAllStatus();
