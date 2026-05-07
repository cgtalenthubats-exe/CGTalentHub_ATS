require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkIds() {
  const { data, error } = await supabase
    .from('Candidate Profile')
    .select('candidate_id, enrichment_status')
    .eq('created_by', 'Bulk Import GM Hotel v2')
    .limit(5);
  console.log(data);
}
checkIds();
