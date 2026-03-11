const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const TARGET_NOTE = 'Location from profile input by candidate';

async function run() {
    console.log('--- Backfilling Location Notes ---');

    // 1. Fetch references
    const { data: refs, error: eRef } = await supabase.from('unique_location_name').select('unique_location, country');
    if (eRef) { console.error('Error fetching refs:', eRef); return; }
    console.log(`Fetched ${refs.length} references.`);

    // 2. Process experiences in batches
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    let totalUpdated = 0;

    console.log('\nProcessing candidate_experiences...');

    while (hasMore) {
        console.log(`   Batch: ${from} to ${from + batchSize}...`);
        const { data: exp, error: eExp } = await supabase
            .from('candidate_experiences')
            .select('id, work_location, country, note')
            .not('work_location', 'is', null)
            .neq('work_location', '')
            .not('country', 'is', null)
            .neq('country', '')
            .range(from, from + batchSize - 1);

        if (eExp) {
            console.error('Error fetching batch:', eExp);
            break;
        }

        if (exp.length === 0) {
            hasMore = false;
            break;
        }

        for (const ce of exp) {
            const ref = refs.find(r => r.unique_location === ce.work_location);
            // If the country matches our reference, we consider it "reconciled"
            if (ref && ref.country === ce.country) {
                let currentNote = ce.note || '';

                if (!currentNote.includes(TARGET_NOTE)) {
                    let newNote = currentNote;
                    if (newNote.length > 0) {
                        newNote += ` | ${TARGET_NOTE}`;
                    } else {
                        newNote = TARGET_NOTE;
                    }

                    const { error: uErr } = await supabase
                        .from('candidate_experiences')
                        .update({ note: newNote })
                        .eq('id', ce.id);

                    if (!uErr) {
                        totalUpdated++;
                    } else {
                        console.error(`   Failed to update note for id ${ce.id}:`, uErr.message);
                    }
                }
            }
        }

        if (exp.length < batchSize) {
            hasMore = false;
        } else {
            from += batchSize;
        }
    }

    console.log(`\n✅ Backfill Complete: Updated ${totalUpdated} records with the target note.`);
}

run();
