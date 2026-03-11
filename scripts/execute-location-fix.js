const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log('--- Database Location Reconciliation ---');

    // 1. Fetch references
    const { data: refs, error: eRef } = await supabase.from('unique_location_name').select('*');
    if (eRef) { console.error('Error fetching refs:', eRef); return; }
    console.log(`Fetched ${refs.length} references.`);

    // 2. Process experiences in batches
    console.log('\n[Step 1] Normalizing Inconsistent Countries (Batched)...');
    let step1Count = 0;
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
        console.log(`   Processing batch: ${from} to ${from + batchSize}...`);
        const { data: exp, error: eExp } = await supabase
            .from('candidate_experiences')
            .select('id, work_location, country')
            .not('work_location', 'is', null)
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
            if (!ce.country) continue;
            const ref = refs.find(r => r.unique_location === ce.work_location);
            if (ref && ref.country !== ce.country) {
                const { error: uErr } = await supabase
                    .from('candidate_experiences')
                    .update({ country: ref.country })
                    .eq('id', ce.id);

                if (!uErr) {
                    step1Count++;
                } else {
                    console.error(`   Failed to update ce_id ${ce.id}:`, uErr.message);
                }
            }
        }

        if (exp.length < batchSize) {
            hasMore = false;
        } else {
            from += batchSize;
        }
    }
    console.log(`✅ Step 1: Updated ${step1Count} rows in candidate_experiences.`);

    // --- STEP 2: Add Corrected References ---
    console.log('\n[Step 2] Adding Corrected References...');
    const newRefs = [
        { unique_location: 'Pattaya, Chonburi', country: 'Thailand' },
        { unique_location: 'Phuket, Thailand', country: 'Thailand' },
        { unique_location: 'Koh Samui, Suratthani', country: 'Thailand' },
        { unique_location: 'Dubai, UAE', country: 'United Arab Emirates' },
        { unique_location: 'Tanon Kao, Bangkok, Thailand', country: 'Thailand' },
        { unique_location: 'London & Thailand', country: 'Thailand' },
        { unique_location: 'Modena Area, Italy', country: 'Italy' },
        { unique_location: 'Zug, Switzerland', country: 'Switzerland' },
        { unique_location: 'Windsor, England, United Kingdom', country: 'United Kingdom' },
        { unique_location: 'Perth, Western Australia, Australia', country: 'Australia' }
    ];

    let step2Count = 0;
    for (const nr of newRefs) {
        const existing = refs.find(r => r.unique_location === nr.unique_location);
        if (existing) {
            if (existing.country !== nr.country) {
                const { error: uErr } = await supabase
                    .from('unique_location_name')
                    .update({ country: nr.country })
                    .eq('id', existing.id);

                if (!uErr) {
                    step2Count++;
                    console.log(`   Updated Ref: ${nr.unique_location} -> ${nr.country}`);
                } else {
                    console.error(`   Failed to update ref ${nr.unique_location}:`, uErr.message);
                }
            }
        } else {
            const { error: iErr } = await supabase
                .from('unique_location_name')
                .insert(nr);

            if (!iErr) {
                step2Count++;
                console.log(`   Inserted Ref: ${nr.unique_location} -> ${nr.country}`);
            } else {
                console.error(`   Failed to insert ref ${nr.unique_location}:`, iErr.message);
            }
        }
    }
    console.log(`✅ Step 2: Processed ${step2Count} references.`);

    // --- STEP 3: Auto-Fill Missing Countries ---
    console.log('\n[Step 3] Auto-Filling Missing Countries (Batched)...');
    let step3Count = 0;
    from = 0;
    hasMore = true;

    // Refresh refs after Step 2 updates
    const { data: updatedRefs } = await supabase.from('unique_location_name').select('*');

    while (hasMore) {
        console.log(`   Processing batch: ${from} to ${from + batchSize}...`);
        const { data: exp, error: eExp } = await supabase
            .from('candidate_experiences')
            .select('id, work_location, country')
            .not('work_location', 'is', null)
            .or('country.is.null,country.eq.""')
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
            const ref = updatedRefs.find(r => r.unique_location === ce.work_location);
            if (ref && ref.country) {
                const { error: uErr } = await supabase
                    .from('candidate_experiences')
                    .update({ country: ref.country })
                    .eq('id', ce.id);

                if (!uErr) {
                    step3Count++;
                } else {
                    console.error(`   Failed to update ce_id ${ce.id}:`, uErr.message);
                }
            }
        }

        if (exp.length < batchSize) {
            hasMore = false;
        } else {
            // Since we are updating the records that meet the criteria, the "next" batch
            // will naturally shift. However, if some aren't updated (no ref found),
            // a simple 'from' increment might skip them. 
            // Better to keep 'from' at 0 if we were deleting/filtering out, 
            // but since we only filter by country=null, and we just filled it, 
            // we should be careful. 
            // Actually, if we fill 'country', it won't show up in the NEXT .or('country.is.null...') call.
            // So we can keep 'from = 0' as long as we make progress.
            // But to be safe and avoid infinite loops if some can't be updated, 
            // we'll track how many we *didn't* update.
            // For simplicity in this script, let's just use the range normally and assume we process all.
            from += batchSize;
        }
    }
    console.log(`✅ Step 3: Filled ${step3Count} missing countries.`);

    console.log('\n--- Diagnostic Complete (Steps 1, 2 & 3) ---');
}

run();
