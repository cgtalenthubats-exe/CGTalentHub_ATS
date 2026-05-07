require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzePositionKeyword() {
  let allMissing = [];
  let page = 0;
  const limit = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('candidate_experiences')
      .select('candidate_id, is_current_job')
      .or('position_keyword.is.null,position_keyword.eq.,position_keyword.eq. ')
      .range(page * limit, (page + 1) * limit - 1);
      
    if (error) {
      console.error('Error fetching data:', error);
      break;
    }
    
    allMissing = allMissing.concat(data);
    if (data.length < limit) hasMore = false;
    page++;
  }
  
  const uniqueCandidates = new Set(allMissing.map(d => d.candidate_id));
  
  // Try to match variations of 'Current', 'Present', 'Yes' just in case
  const currentJobs = allMissing.filter(d => 
    d.is_current_job && 
    (d.is_current_job.toLowerCase() === 'current' || 
     d.is_current_job.toLowerCase() === 'present' || 
     d.is_current_job.toLowerCase() === 'yes' ||
     d.is_current_job === '1' ||
     d.is_current_job === true)
  );
  
  console.log('--- Analysis Results ---');
  console.log(`Total rows missing position_keyword: ${allMissing.length}`);
  console.log(`Number of unique candidate_ids affected: ${uniqueCandidates.size}`);
  console.log(`Of those ${allMissing.length} rows, number of 'is_current_job = Current': ${currentJobs.length}`);
}

analyzePositionKeyword();
