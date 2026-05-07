require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHealth() {
  const { count: total, error: totalErr } = await supabase
    .from('candidate_experiences')
    .select('*', { count: 'exact', head: true });
    
  if (totalErr) {
    console.error('Error getting total count:', totalErr);
    return;
  }
  
  console.log(`Total Rows in candidate_experiences: ${total}\n`);

  const cols = [
    'country',
    'company_industry',
    'company_group',
    'position_keyword',
    'position_level',
    'is_current_job'
  ];

  for (const col of cols) {
    // Check for null or empty string
    const { count, error } = await supabase
      .from('candidate_experiences')
      .select('*', { count: 'exact', head: true })
      .or(`${col}.is.null,${col}.eq.,${col}.eq. `);

    if (error) {
      console.error(`Error checking ${col}:`, error);
      continue;
    }
    
    const validCount = total - count;
    const missingPct = ((count / total) * 100).toFixed(2);
    console.log(`[${col}]`);
    console.log(`  - Missing/Null: ${count} (${missingPct}%)`);
    console.log(`  - Valid Data: ${validCount}`);
    console.log();
  }
}

checkHealth();
