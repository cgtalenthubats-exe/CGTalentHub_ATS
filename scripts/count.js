
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

async function count() {
    const { count: profileCount, error: pErr } = await supabase.from('Candidate Profile').select('*', { count: 'exact', head: true });
    const { count: expCount, error: eErr } = await supabase.from('candidate_experiences').select('*', { count: 'exact', head: true });

    console.log('Profile Count:', profileCount, pErr?.message);
    console.log('Experience Count:', expCount, eErr?.message);
}

count();
