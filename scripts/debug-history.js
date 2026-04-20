const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ddeqeaicjyrevqdognbn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkZXFlYWljanlyZXZxZG9nbmJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTc1ODc4MiwiZXhwIjoyMDc3MzM0NzgyfQ.quecutt2ZrUTUjA4ReDxgAYJpFRkfp9b4Qk177zMOTM');

async function check() {
    const { data, error } = await supabase
        .from('jr_candidates')
        .select('jr_id, candidate_id')
        .eq('candidate_id', 'C02946');
    
    if (error) {
        console.error(error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

check();
