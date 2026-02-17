
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

async function verifyLogic() {
    console.log('--- Verifying Bulk Add Logic (Simulation) ---');

    const search = "Sumeth";
    console.log(`\n1. Simulating "Select All Matching" with search="${search}"`);

    // 1. Search Candidates Robust (RPC)
    const { data: searchResults, error: searchError } = await supabase.rpc('search_candidates_robust', {
        p_search: search,
        p_limit: 1000,
        p_offset: 0
    });

    if (searchError) {
        console.error('RPC Error:', searchError);
        return;
    }

    const candidates = searchResults.map(c => ({ id: c.candidate_id, name: c.name }));
    console.log(`RPC returned ${candidates.length} candidates.`);
    candidates.forEach(c => console.log(` - Found: ${c.name} (${c.id})`));

    // 2. Simulate Blacklist Check
    const ids = candidates.map(c => c.id);
    const { data: blacklistData, error: blError } = await supabase
        .from('Candidate Profile')
        .select('candidate_id, blacklist_note')
        .in('candidate_id', ids)
        .not('blacklist_note', 'is', null);

    if (blError) {
        console.error('Blacklist Check Error:', blError);
        return;
    }

    const blacklistedIds = new Set(blacklistData.map(b => b.candidate_id));
    const blacklistedNames = [];
    const safeCandidates = [];

    candidates.forEach(c => {
        if (blacklistedIds.has(c.id)) {
            blacklistedNames.push(c.name);
        } else {
            safeCandidates.push(c);
        }
    });

    console.log(`\n--- logic Result ---`);
    console.log(`Total Matches: ${candidates.length}`);
    console.log(`Blacklisted: ${blacklistedNames.length} (${blacklistedNames.join(', ')})`);
    console.log(`Safe to Add: ${safeCandidates.length}`);

    if (blacklistedNames.length > 0 && safeCandidates.length < candidates.length) {
        console.log('\n✅ VERIFICATION PASSED: Logic correctly identifies blacklisted candidates.');
    } else {
        console.log('\n⚠️ VERIFICATION INCONCLUSIVE: Did not find mixed results (all safe or all blacklisted).');
    }
}

verifyLogic();
