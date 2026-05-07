require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectMissing() {
  const { data, error } = await supabase
    .from('candidate_experiences')
    .select('id, candidate_id, position, company, start_date, end_date')
    .or('is_current_job.is.null,is_current_job.eq.,is_current_job.eq. ')
    .limit(50);
    
  if (error) {
    console.error('Error fetching data:', error);
    return;
  }
  
  console.log(`Found ${data.length} records.`);
  console.table(data);
}
inspectMissing();
