require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getPrimaryJob(experiences) {
    if (!experiences || experiences.length === 0) return null;

    // 1. Try 'Current'
    const currents = experiences.filter(e => e.is_current_job === 'Current');
    if (currents.length > 0) {
        return currents.sort((a, b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime())[0];
    }

    // 2. Try 'Past'
    return experiences.sort((a, b) => new Date(b.end_date || b.start_date || 0).getTime() - new Date(a.end_date || a.start_date || 0).getTime())[0];
}

async function debugV2() {
    console.log("--- Debugging V2 Logic ---");

    // 1. Fetch raw data (Paginated)
    console.log("Fetching all experiences (Paginated)...");
    let allExps = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from("candidate_experiences")
            .select("candidate_id, country, company, is_current_job, start_date, end_date, company_industry, company_group, position")
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error("Fetch Error:", error.message);
            break;
        }

        if (data.length > 0) {
            allExps = allExps.concat(data);
            page++;
            console.log(`Fetched page ${page} (${data.length} rows)... Total: ${allExps.length}`);
            if (data.length < pageSize) hasMore = false;
        } else {
            hasMore = false;
        }
    }

    console.log(`Fetched ${allExps.length} rows.`);

    // 2. Group
    const grouped = {};
    allExps.forEach(exp => {
        if (!grouped[exp.candidate_id]) grouped[exp.candidate_id] = [];
        grouped[exp.candidate_id].push(exp);
    });

    console.log(`Unique Candidates in Experiences: ${Object.keys(grouped).length}`);

    // 3. Select Primary
    const primaryJobs = [];
    Object.values(grouped).forEach(exps => {
        const primary = getPrimaryJob(exps);
        if (primary) {
            primaryJobs.push(primary);
        }
    });

    console.log(`Primary Jobs Selected: ${primaryJobs.length}`);
    if (primaryJobs.length > 0) {
        console.log("Sample Primary:", primaryJobs[0]);
    }

    // 4. Check 'Current' count in raw data
    const rawCurrents = allExps.filter(e => e.is_current_job === 'Current').length;
    console.log(`Raw 'Current' rows: ${rawCurrents}`);
}

debugV2();
