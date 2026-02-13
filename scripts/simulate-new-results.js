const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateRefactoredResults() {
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
    console.log(`🚀 Simulating NEW Results for Session: ${sessionId}`);

    // Insert mock results with the NEW schema
    const mockResults = [
        {
            session_id: sessionId,
            source: 'external_db',
            candidate_ref_id: 'ext_v_123',
            name: 'Nguyen Van A',
            position: 'Head of Retail',
            company: 'VinCommerce',
            company_tier: 'Unicorn',
            business_model: 'Modern Trade',
            match_score: 92,
            scoring_breakdown: { leadership: 95, scale: 90, innovation: 85, culture: 92, resilience: 88 },
            demographic_tag: 'Viet Kieu',
            inferred_insights: { mobility: 'High', nationality: 'Vietnamese/USA' },
            executive_summary: 'Strong leadership in scaling retail operations across SEA. Proven track record in digital transformation.',
            red_flags: 'Exited previous company after 11 months (reorganization).'
        },
        {
            session_id: sessionId,
            source: 'internal_db',
            candidate_ref_id: 'int_c_456',
            name: 'Somchai Jaidee',
            position: 'Chief Commercial Officer',
            company: 'Central Group',
            company_tier: 'Top-tier',
            business_model: 'Traditional & Modern',
            match_score: 85,
            scoring_breakdown: { leadership: 88, scale: 85, innovation: 80, culture: 90, resilience: 85 },
            demographic_tag: 'Local',
            executive_summary: 'Veteran in the retail sector with deep connections in Thailand and Vietnam.',
        }
    ];

    const { error: insertError } = await supabase
        .from('consolidated_results')
        .insert(mockResults);

    if (insertError) {
        console.error("❌ Failed to insert results:", insertError.message);
    } else {
        console.log("✅ New results inserted successfully! Refresh the UI.");
    }
}

simulateRefactoredResults();
