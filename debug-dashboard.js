require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugDashboard() {
    console.log("--- Debugging Dashboard Data ---");

    // 1. Check Candidate Profile Count
    const { count: profileCount, error: profileError } = await supabase
        .from('Candidate Profile')
        .select('*', { count: 'exact', head: true });

    console.log(`Candidate Profile Count: ${profileCount} (Error: ${profileError?.message})`);

    // 2. Check Candidate Experiences Count
    const { count: expCount, error: expError } = await supabase
        .from('candidate_experiences')
        .select('*', { count: 'exact', head: true });

    console.log(`Candidate Experiences Count: ${expCount} (Error: ${expError?.message})`);

    // 3. Check 'Current Job' Candidates (end_date is NULL)
    const { data: currentJobs, error: currError } = await supabase
        .from('candidate_experiences')
        .select('candidate_id, country, company, end_date')
        .is('end_date', null)
        .limit(5);

    console.log(`Jobs with end_date NULL: ${currentJobs?.length}`);
    if (currentJobs && currentJobs.length > 0) {
        console.log("Sample Active Job:", currentJobs[0]);
    } else {
        console.log("No jobs with end_date NULL found.");

        // Check what end_date looks like for a few rows
        const { data: anyJobs } = await supabase
            .from('candidate_experiences')
            .select('candidate_id, end_date')
            .limit(5);
        console.log("Sample end_dates:", anyJobs);
    }

    // 4. Join Check
    // Get one candidate ID from Profile
    const { data: profiles } = await supabase.from('Candidate Profile').select('candidate_id').limit(1);
    if (profiles && profiles.length > 0) {
        const testId = profiles[0].candidate_id;
        console.log(`Checking experiences for Candidate: ${testId}`);
        const { data: userExps } = await supabase
            .from('candidate_experiences')
            .select('*')
            .eq('candidate_id', testId);
        console.log(`Experiences found: ${userExps?.length}`);
    }
}

debugDashboard();
