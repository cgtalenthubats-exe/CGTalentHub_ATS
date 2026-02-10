
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const { data, error } = await supabase
        .from('employment_record')
        .select('*')
        .limit(1);

    if (error) {
        console.error(error);
    } else {
        console.log('Employment Record Keys:', Object.keys(data[0] || {}));
        console.log('Sample Record:', data[0]);
    }

    const { data: candidateData, error: candidateError } = await supabase
        .from('candidate_profile')
        .select('*')
        .limit(1);

    if (candidateError) {
        console.error(candidateError);
    } else {
        console.log('Candidate Profile Keys:', Object.keys(candidateData[0] || {}));
    }
}

inspect();
