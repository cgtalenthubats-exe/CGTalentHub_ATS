const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateProgress() {
    // 1. Get the latest session
    const { data: job, error: jobError } = await supabase
        .from('search_jobs')
        .select('session_id')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

    if (jobError || !job) {
        console.error("❌ No recent session found. Please start a search on the UI first.");
        return;
    }

    const sessionId = job.session_id;
    console.log(`🚀 Simulating progress for Session: ${sessionId}`);

    const sources = ['Internal_db', 'external_db', 'linkedin_db'];

    // Reset/Ensure rows exist
    for (const src of sources) {
        await supabase.from('search_job_status').upsert({
            session_id: sessionId,
            source: src,
            summary_agent_1: 'Waiting...',
            summary_agent_2: null,
            summary_agent_3: null,
            summary_agent_4: null
        }, { onConflict: 'session_id,source' });
    }

    // Step 1: Agent 1 updates
    console.log("Updating Agent 1...");
    await new Promise(r => setTimeout(r, 2000));
    await supabase.from('search_job_status').update({ summary_agent_1: 'ค้นพบ 45 บริษัทเป้าหมาย', summary_agent_2: 'Waiting...' }).match({ session_id: sessionId, source: 'Internal_db' });
    await supabase.from('search_job_status').update({ summary_agent_1: 'ค้นพบ 12 โปรไฟล์ที่ตรงกัน', summary_agent_2: 'Waiting...' }).match({ session_id: sessionId, source: 'external_db' });

    // Step 2: Agent 2 updates
    console.log("Updating Agent 2...");
    await new Promise(r => setTimeout(r, 3000));
    await supabase.from('search_job_status').update({ summary_agent_2: 'วิเคราะห์โครงสร้างแผนกสำเร็จ', summary_agent_3: 'Waiting...' }).match({ session_id: sessionId, source: 'Internal_db' });

    // Step 3: All Agents update some text
    console.log("Updating Agent 3 & 4...");
    await new Promise(r => setTimeout(r, 3000));
    await supabase.from('search_job_status').update({ summary_agent_3: 'เชื่อมโยงข้อมูลผู้สมัคร 8 ราย', summary_agent_4: 'Waiting...' }).match({ session_id: sessionId, source: 'linkedin_db' });

    console.log("✅ Simulation steps complete. Check the UI!");
}

simulateProgress();
