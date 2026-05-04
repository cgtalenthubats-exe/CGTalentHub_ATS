require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const matches = JSON.parse(fs.readFileSync('partial_matches.json', 'utf8'));
    console.log(`Starting update for ${matches.length} companies...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Batch updates in chunks of 50 to avoid rate limits / overwhelming the server
    const batchSize = 50;
    for (let i = 0; i < matches.length; i += batchSize) {
        const batch = matches.slice(i, i + batchSize);
        const promises = batch.map(match => {
            return supabase
                .from('company_master')
                .update({ rating: match.proposed_rating })
                .eq('company_master', match.company_name)
                .eq('industry', 'Hospitality') // safety check
                .is('rating', null); // safety check, only update if empty
        });
        
        const results = await Promise.all(promises);
        
        for (const res of results) {
            if (res.error) {
                console.error("Error updating:", res.error);
                errorCount++;
            } else {
                successCount++;
            }
        }
        console.log(`Processed ${Math.min(i + batchSize, matches.length)} / ${matches.length}`);
    }
    
    console.log("\n=== UPDATE COMPLETE ===");
    console.log(`Successfully processed updates for: ${successCount} companies`);
    console.log(`Errors: ${errorCount}`);
}

main();
