
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env from root
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkBlacklist() {
    console.log('--- Checking Blacklist Data ---');

    // 1. Check for existing blacklisted candidates
    const { data: blacklisted, error } = await supabase
        .from('Candidate Profile')
        .select('candidate_id, name, blacklist_note')
        .not('blacklist_note', 'is', null)
        .limit(5);

    if (error) {
        console.error('Error fetching blacklist:', error);
        return;
    }

    if (blacklisted && blacklisted.length > 0) {
        console.log(`Found ${blacklisted.length} blacklisted candidates:`);
        blacklisted.forEach(c => console.log(`- ${c.name} (${c.candidate_id}): ${c.blacklist_note}`));
    } else {
        console.log('No blacklisted candidates found. Creating one for testing...');

        // 2. Fetch a random candidate to blacklist
        const { data: candidates } = await supabase
            .from('Candidate Profile')
            .select('candidate_id, name')
            .limit(1);

        if (candidates && candidates.length > 0) {
            const target = candidates[0];
            console.log(`Blacklisting candidate: ${target.name} (${target.candidate_id})`);

            const { error: updateError } = await supabase
                .from('Candidate Profile')
                .update({ blacklist_note: 'Automated test blacklist note' })
                .eq('candidate_id', target.candidate_id);

            if (updateError) {
                console.error('Failed to blacklist candidate:', updateError);
            } else {
                console.log('Successfully blacklisted candidate.');
            }
        } else {
            console.log('No candidates found in database to blacklist.');
        }
    }
}

checkBlacklist();
