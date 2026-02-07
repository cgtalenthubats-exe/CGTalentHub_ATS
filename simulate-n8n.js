const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runValidation() {
    console.log("\n🚀 --- Simulating n8n Workflow ---");

    // 1. Create Dummy Upload
    console.log("\n📦 1. User Uploads Resume (Simulated)");
    const fileName = `test_resume_${Date.now()}.pdf`;
    const { data: upload, error } = await supabase
        .from('resume_uploads')
        .insert([{
            file_name: fileName,
            resume_url: 'https://example.com/fake_resume.pdf', // Mock URL
            uploader_email: 'tester@simulator.com',
            status: 'pending'
        }])
        .select()
        .single();

    if (error) {
        console.error("❌ Setup failed (DB Insert):", error.message);
        return;
    }
    console.log(`   ✅ File stored in DB! ID: ${upload.id}`);
    console.log(`   Status: 'pending'`);

    // 2. Poll Queue API
    console.log("\n🔄 2. n8n Polls API (GET /api/n8n/queue)");
    try {
        const queueRes = await fetch('http://localhost:3000/api/n8n/queue');
        if (!queueRes.ok) {
            const errText = await queueRes.text();
            throw new Error(`API Error ${queueRes.status}: ${errText.substring(0, 500)}`);
        }

        const queueData = await queueRes.json();
        console.log(`   ✅ API Reponse: Found ${queueData.count} tasks.`);

        const task = queueData.tasks.find(t => t.id === upload.id);
        if (!task) {
            console.error("   ❌ Error: Our uploaded task was NOT found in the queue!");
            console.log("   (Maybe queue logic is discarding it? Only pending items are returned.)");
            return;
        }
        console.log(`   ✅ Task found in queue! Ready to process.`);

        // 3. Simulate n8n Processing (Callback)
        console.log("\n🤖 3. n8n Sends Callback (POST /api/n8n/callback)");
        console.log("   (Pretending to have parsed the PDF...)");

        const callbackPayload = {
            upload_id: task.id,
            resume_url: task.resume_url,
            profile: {
                name: `Simulated Candidate ${Date.now().toString().slice(-4)}`,
                email: "simulated@test.com",
                linkedin: "https://linkedin.com/in/simulated_candidate"
            },
            experience: [
                {
                    company: "Test Corp",
                    position: "Senior Tester",
                    is_current: true
                }
            ]
        };

        const callbackRes = await fetch('http://localhost:3000/api/n8n/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(callbackPayload)
        });

        if (!callbackRes.ok) {
            const errText = await callbackRes.text();
            throw new Error(`Callback API Failed: ${callbackRes.status} - ${errText}`);
        }

        const callbackData = await callbackRes.json();
        console.log(`   ✅ Callback Success! Server says:`, callbackData);

        // 4. Verification
        console.log("\n🔍 4. Verifying Final Status in DB");
        const { data: check } = await supabase.from('resume_uploads').select('status, candidate_id, candidate_name').eq('id', upload.id).single();

        if (check.status === 'Completed' || check.status === 'Complete') {
            console.log(`   ✅ SUCCESS! Status is '${check.status}'`);
            console.log(`   ✅ Created Candidate ID: ${check.candidate_id}`);
            console.log(`   ✅ Name: ${check.candidate_name}`);
        } else {
            console.log(`   ⚠️ Warning: Status is '${check.status}' (Expected 'Complete')`);
        }

    } catch (err) {
        console.error("❌ Simulation Failed:", err.message);
    }
}

runValidation();
