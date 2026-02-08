
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectSchema() {
    console.log('--- Inspecting Database Schema ---');

    // 1. List Tables
    const { data: tables, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

    // Note: Supabase JS client might not allow querying information_schema directly depending on permissions.
    // If it fails, we fall back to RPC or guessing.

    if (tableError) {
        console.log('Error listing tables. Checking Candidate Profile directly...');
        const { data, error } = await supabase
            .from('Candidate Profile')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Candidate Profile Check Failed:', error);
        } else {
            console.log('Candidate Profile Found. Sample keys:', Object.keys(data[0] || {}));
        }

        // Also check if `resume_uploads` has processed text
        const { data: resumes } = await supabase.from('resume_uploads').select('*').limit(1);
        if (resumes && resumes.length > 0) {
            console.log('Resume Uploads Sample keys:', Object.keys(resumes[0]));
        }
    } else {
        console.log('Tables found:', tables.map(t => t.table_name));

        // Check process_resume columns if it exists
        if (tables.some(t => t.table_name === 'process_resume')) {
            const { data: cols } = await supabase
                .from('process_resume')
                .select('*')
                .limit(1);
            console.log('process_resume sample:', cols);
        }
    }
}

inspectSchema();
