const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log('--- Advanced Location Identification (Step 4) ---');

    // 1. Fetch countries
    const { data: countriesData, error: eC } = await supabase.from('country').select('country');
    if (eC) { console.error('Error fetching countries:', eC); return; }

    let countries = countriesData.map(c => c.country).filter(Boolean);

    // Add common aliases and City-to-Country mappings
    const cityToCountry = {
        'Bangkok': 'Thailand',
        'Krabi': 'Thailand',
        'Hua Hin': 'Thailand',
        'Phuket': 'Thailand',
        'Nonthaburi': 'Thailand',
        'Samut Prakan': 'Thailand',
        'Pathum Thani': 'Thailand',
        'Chonburi': 'Thailand',
        'Rayong': 'Thailand',
        'Chiang Mai': 'Thailand',
        'Khon Kaen': 'Thailand',
        'Khonkaen': 'Thailand',
        'Korat': 'Thailand',
        'United States': 'United States of America',
        'US': 'United States of America',
        'UK': 'United Kingdom',
        'UAE': 'United Arab Emirates',
        'Dubai': 'United Arab Emirates',
        'London': 'United Kingdom',
        'Singapore': 'Singapore',
        'Hong Kong': 'Hong Kong',
        'Sydney': 'Australia',
        'Melbourne': 'Australia',
        'Brisbane': 'Australia',
        'Perth': 'Australia',
        'New York': 'United States of America',
        'Chicago': 'United States of America',
        'Florida': 'United States of America',
        'California': 'United States of America',
        'Brasil': 'Brazil',
        'OH': 'United States of America',
        'IL': 'United States of America',
        'NC': 'United States of America',
        'NJ': 'United States of America',
        'TX': 'United States of America',
        'PA': 'United States of America',
        'GA': 'United States of America',
        'VA': 'United States of America',
        'MA': 'United States of America',
        'Cincinnati': 'United States of America',
        'Mahidol University': 'Thailand',
        'Phang Nga': 'Thailand',
        'Phang-nga': 'Thailand',
        'Bratislava': 'Slovakia',
        'Prague': 'Czech Republic',
        'Cusco': 'Peru',
        'Tahiti': 'French Polynesia',
        'Italia': 'Italy',
        'Pescara': 'Italy',
        'Brasil': 'Brazil',
        'Brazil': 'Brazil',
        'Duesseldorf': 'Germany',
        'Dusseldorf': 'Germany',
        'Paris': 'France',
        'Yvelines': 'France',
        'Belfort': 'France',
        'Cergy': 'France',
        'Carcassonne': 'France'
    };

    // Merge city mappings into countries for search (as keys)
    const extraSearchTerms = Object.keys(cityToCountry);
    countries = [...new Set([...countries, ...extraSearchTerms])];

    console.log(`Loaded ${countries.length} search terms (countries + common cities/aliases).`);

    // 2. Fetch references (to avoid duplicate inserts)
    const { data: refsData } = await supabase.from('unique_location_name').select('unique_location, country');
    const refs = refsData || [];

    // 3. Process experiences in batches
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    let totalUpdated = 0;
    let newRefsCount = 0;

    console.log('\nScanning for missing countries...');

    while (hasMore) {
        console.log(`   Batch: ${from} to ${from + batchSize}...`);
        const { data: exp, error: eExp } = await supabase
            .from('candidate_experiences')
            .select('id, work_location, country')
            .not('work_location', 'is', null)
            .neq('work_location', '')
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
            const loc = ce.work_location;
            let matchedCountry = null;

            // Sort by length descending to catch specific patterns first
            const sortedSearchTerms = [...countries].sort((a, b) => b.length - a.length);

            for (const term of sortedSearchTerms) {
                // Word boundary matching for short terms like "US", "UK"
                const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');

                if (regex.test(loc)) {
                    matchedCountry = term;
                    // Map back to standard country name if it's a city or alias
                    if (cityToCountry[term]) {
                        matchedCountry = cityToCountry[term];
                    }
                    break;
                }
            }

            if (matchedCountry) {
                // Update experience
                const { error: uErr } = await supabase
                    .from('candidate_experiences')
                    .update({ country: matchedCountry })
                    .eq('id', ce.id);

                if (!uErr) {
                    totalUpdated++;

                    // Sync to unique_location_name
                    const existingRef = refs.find(r => r.unique_location === loc);
                    if (!existingRef) {
                        const { error: iErr } = await supabase
                            .from('unique_location_name')
                            .insert({ unique_location: loc, country: matchedCountry });
                        if (!iErr) {
                            newRefsCount++;
                            refs.push({ unique_location: loc, country: matchedCountry });
                        }
                    }
                }
            }
        }

        if (exp.length < batchSize) {
            hasMore = false;
        } else {
            // Since we are updating, we don't necessarily need to increment 'from' 
            // if we want to re-process the next 1000 that now fall into the range.
            // But if some didn't match, we'd skip them. 
            // Let's increment and just assume we process the whole set once.
            from += batchSize;
        }
    }

    console.log(`\n✅ Step 4 Complete:`);
    console.log(`   - Updated ${totalUpdated} experiences with newly identified countries.`);
    console.log(`   - Added ${newRefsCount} new mappings to unique_location_name.`);
}

run();
