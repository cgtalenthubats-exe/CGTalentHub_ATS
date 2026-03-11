const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    console.log('--- Full List of Remaining Missing Countries ---');
    const { data, error } = await supabase
        .from('candidate_experiences')
        .select('work_location')
        .not('work_location', 'is', null)
        .neq('work_location', '')
        .or('country.is.null,country.eq.""');

    if (error) {
        console.error('Error:', error);
        return;
    }

    const counts = {};
    data.forEach(d => {
        counts[d.work_location] = (counts[d.work_location] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    console.log(`Total remaining rows: ${data.length}`);
    console.log(`Unique locations without country mapping: ${sorted.length}`);
    console.log('\nList of locations (Grouped by frequency):');
    sorted.forEach(([loc, count]) => {
        console.log(`- [${count}] ${loc}`);
    });
}

check();
