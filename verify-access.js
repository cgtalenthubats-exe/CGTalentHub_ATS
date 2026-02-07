
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Use Anon Key
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // For setup

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function verifyAccess() {
    console.log('--- Verifying Access ---');

    // 1. Setup: Insert a dummy record using Admin to ensure data exists
    const testId = '00000000-0000-0000-0000-000000000000'; // Specific ID for cleanup

    // Cleanup first
    await supabaseAdmin.from('resume_uploads').delete().eq('uploader_email', 'test_access_check');

    const { error: insertError } = await supabaseAdmin
        .from('resume_uploads')
        .insert([{
            resume_url: 'test.pdf',
            file_name: 'test.pdf',
            uploader_email: 'test_access_check',
            status: 'test'
        }]);

    if (insertError) {
        console.error('Setup Insert Failed (Admin):', insertError.message);
        return;
    }
    console.log('Setup: Inserted test record.');

    // 2. Test Select with Anon
    const { data: selectData, error: selectError } = await supabaseAnon
        .from('resume_uploads')
        .select('*')
        .eq('uploader_email', 'test_access_check');

    if (selectError) {
        console.error('Anon Select Failed:', selectError.message);
    } else if (selectData.length === 0) {
        console.error('Anon Select Success BUT returned 0 rows. RLS might be blocking.');
    } else {
        console.log('Anon Select Success. Rows:', selectData.length);
    }

    // 3. Test Storage Bucket 'resumes'
    const { data: bucketData, error: bucketError } = await supabaseAdmin
        .storage
        .getBucket('resumes');

    if (bucketError) {
        console.error("Bucket 'resumes' check failed:", bucketError.message);
        // Try creating it?
        console.log("Attempting to create bucket 'resumes'...");
        const { error: createError } = await supabaseAdmin.storage.createBucket('resumes', {
            public: true,
            fileSizeLimit: 5242880, // 5MB
            allowedMimeTypes: ['application/pdf']
        });
        if (createError) console.error("Create Bucket Failed:", createError.message);
        else console.log("Bucket 'resumes' created.");
    } else {
        console.log("Bucket 'resumes' exists.");
    }

    // Cleanup
    await supabaseAdmin.from('resume_uploads').delete().eq('uploader_email', 'test_access_check');
}

verifyAccess();
