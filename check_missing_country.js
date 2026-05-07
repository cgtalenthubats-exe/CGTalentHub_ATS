require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectCountry() {
  const { data, error } = await supabase
    .from('candidate_experiences')
    .select('id, candidate_id, company, position, country')
    .or('country.is.null,country.eq.,country.eq. ')
    .limit(30);
    
  if (error) {
    console.error('Error fetching data:', error);
    return;
  }
  
  console.log(`Found ${data.length} records missing country. Showing sample:`);
  console.table(data);
}
inspectCountry();
