const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    console.log('--- Checking for remaining missing country data ---');
    const { count, error } = await supabase
        .from('candidate_experiences')
        .select('*', { count: 'exact', head: true })
        .not('work_location', 'is', null)
        .neq('work_location', '')
        .or('country.is.null,country.eq.""');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Remaining records with work_location but NO country: ${count}`);

    if (count > 0) {
        const { data: samples } = await supabase
            .from('candidate_experiences')
            .select('work_location, country')
            .not('work_location', 'is', null)
            .neq('work_location', '')
            .or('country.is.null,country.eq.""')
            .limit(20);

        console.log('\nSample locations missing from reference/country:');
        const uniqueSamples = Array.from(new Set(samples.map(s => s.work_location)));
        uniqueSamples.forEach(loc => console.log(`- ${loc}`));
    }
}

check();
