import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { normalizeName, normalizeLinkedIn, normalizeEmail } from './src/lib/candidate-utils';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function doubleCheck() {
    console.log('--- Starting System-Logic Double Check ---');

    // 1. Fetch all 'New' records from staging
    const { data: stagingRecords, error: stagingError } = await supabase
        .from('import_gm_hotel_list')
        .select('*')
        .eq('import_status', 'New');

    if (stagingError) {
        console.error('Error fetching staging:', stagingError);
        return;
    }

    // 2. Fetch all candidates EXCEPT the ones we just imported (with Pagination)
    let existingCandidates: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    console.log('Fetching existing candidates from DB...');
    while (hasMore) {
        const { data, error } = await supabase
            .from('Candidate Profile' as any)
            .select('candidate_id, name, linkedin, email')
            .or('enrichment_status.is.null,enrichment_status.neq.import_gm_hotel')
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            console.error('Error fetching existing candidates:', error);
            return;
        }

        if (data && data.length > 0) {
            existingCandidates.push(...data);
            from += PAGE_SIZE;
            if (data.length < PAGE_SIZE) hasMore = false;
        } else {
            hasMore = false;
        }
    }

    console.log(`Analyzing ${stagingRecords.length} new records against ${existingCandidates.length} existing candidates...`);

    const duplicatesFound: any[] = [];

    // Pre-normalize existing for speed
    const normalizedExisting = existingCandidates.map(c => ({
        ...c,
        normName: normalizeName(c.name || ""),
        normLinkedIn: normalizeLinkedIn(c.linkedin || ""),
        normEmail: normalizeEmail(c.email || "")
    }));

    for (const stg of stagingRecords) {
        const stgNormName = normalizeName(stg.full_name || "");
        const stgNormLinkedIn = normalizeLinkedIn(stg.profile_url || "");
        const stgNormEmail = normalizeEmail(stg.email_address || "");

        const match = normalizedExisting.find(ex => {
            const nameMatch = ex.normName === stgNormName && stgNormName !== "";
            const linkedinMatch = ex.normLinkedIn === stgNormLinkedIn && stgNormLinkedIn !== "" && stgNormLinkedIn.includes('linkedin');
            const emailMatch = ex.normEmail === stgNormEmail && stgNormEmail !== "";
            
            return nameMatch || linkedinMatch || emailMatch;
        });

        if (match) {
            duplicatesFound.push({
                stagingId: stg.id,
                stagingName: stg.full_name,
                stagingReservedId: stg.candidate_id,
                existingName: match.name,
                existingId: match.candidate_id,
                reason: (normalizeName(match.name || "") === stgNormName) ? 'Name Match (Normalized)' : 'LinkedIn/Email Match'
            });
        }
    }

    console.log(`\nFound ${duplicatesFound.length} fuzzy duplicates!`);
    
    if (duplicatesFound.length > 0) {
        console.log('\nTop 10 Examples:');
        duplicatesFound.slice(0, 10).forEach(d => {
            console.log(`- Staging: "${d.stagingName}" (${d.stagingReservedId}) <-> Existing: "${d.existingName}" (${d.existingId}) [${d.reason}]`);
        });
    }

    // Optional: Output all to a file for review
    // fs.writeFileSync('double_check_results.json', JSON.stringify(duplicatesFound, null, 2));
}

doubleCheck().catch(err => console.error(err));
