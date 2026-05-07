require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function applyUpdates() {
  console.log("Fetching target candidates...");
  const { data: candidates, error: getErr } = await supabase
    .from('Candidate Profile')
    .select('candidate_id')
    .eq('created_by', 'Bulk Import GM Hotel v2');

  if (getErr) {
    console.error("Error fetching candidates:", getErr);
    return;
  }

  const ids = candidates.map(c => c.candidate_id);
  console.log(`Found ${ids.length} candidates from Bulk Import GM Hotel v2.`);

  if (ids.length === 0) {
    console.log("No action needed.");
    return;
  }

  console.log("1. Updating enrichment_status to 'industry_issue_v2'...");
  const { data: updateData, error: updateErr } = await supabase
    .from('Candidate Profile')
    .update({ enrichment_status: 'industry_issue_v2' })
    .in('candidate_id', ids)
    .select('candidate_id');

  if (updateErr) {
    console.error("Error updating Candidate Profile:", updateErr);
  } else {
    console.log(`Successfully updated ${updateData.length} candidate profiles.`);
  }

  console.log("2. Deleting records from candidate_experiences...");
  const { data: delData, error: delErr } = await supabase
    .from('candidate_experiences')
    .delete()
    .in('candidate_id', ids)
    .select('id');

  if (delErr) {
    console.error("Error deleting experiences:", delErr);
  } else {
    console.log(`Successfully deleted ${delData.length} experience records.`);
  }
}

applyUpdates();
