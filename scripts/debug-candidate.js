
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCandidate() {
    const candidateId = 'C05896';
    console.log(`Fetching data for candidate: ${candidateId}`);

    // Fetch Profile (Try Title Case first as per User/Codebase hint)
    const { data: profile, error: profileError } = await supabase
        .from('Candidate Profile')
        .select('*')
        .eq('candidate_id', candidateId)
        .single();

    if (!profile) {
        console.log("Title Case 'Candidate Profile' check failed/empty. Trying lowercase...");
        const { data: profileLower } = await supabase
            .from('candidate_profile')
            .select('*')
            .eq('candidate_id', candidateId)
            .single();
        console.log("Lowercase 'candidate_profile' result:", profileLower);
    }

    if (profileError) {
        console.error("Profile Error:", profileError);
    } else {
        console.log("Profile Data Keys:", Object.keys(profile));
        console.log("Profile Photo Value:", profile.photo);
        console.log("Profile Photo URL Value:", profile.photo_url);
        console.log("Profile Data:", profile);
    }

    // Fetch Experiences
    const { data: experiences, error: expError } = await supabase
        .from('candidate_experiences')
        .select('*')
        .eq('candidate_id', candidateId);

    if (expError) {
        console.error("Experience Error:", expError);
    } else {
        console.log(`Found ${experiences?.length} experiences:`, experiences);
    }

    // Check capitalization of ID if not found
    if (!profile) {
        console.log("Checking for lowercase/uppercase variations...");
        const { data: params } = await supabase
            .from('candidate_profile')
            .select('candidate_id')
            .ilike('candidate_id', candidateId);
        console.log("Matches:", params);
    }
}

debugCandidate();
