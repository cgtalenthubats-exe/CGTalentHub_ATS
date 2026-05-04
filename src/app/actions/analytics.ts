"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export async function getDashboardOverviewStats(lookbackDays: number = 60) {
    const client = adminAuthClient as any;
    
    // 1. Basic Counts
    const [
        { count: totalCandidates },
        { count: resumeCount },
        { count: orgChartCount },
        { count: totalJRs }
    ] = await Promise.all([
        client.from('Candidate Profile').select('*', { count: 'exact', head: true }),
        client.from('Candidate Profile').select('*', { count: 'exact', head: true })
            .not('resume_url', 'is', null)
            .neq('resume_url', ''),
        client.from('org_chart_uploads').select('*', { count: 'exact', head: true }),
        client.from('job_requisitions').select('*', { count: 'exact', head: true })
    ]);

    // 2. Fetch TREND data using our NEW RPC
    // This is 100% accurate as it runs inside Postgres and isn't affected by row limits
    const [
        { data: candidateGrowth, error: candError },
        { data: jrGrowth, error: jrError }
    ] = await Promise.all([
        client.rpc('get_cumulative_growth', { 
            tbl: 'Candidate Profile', 
            date_col: 'created_date' 
        }),
        client.rpc('get_cumulative_growth', { 
            tbl: 'job_requisitions', 
            date_col: 'request_date' 
        })
    ]);

    if (candError) console.error("Candidate Growth RPC Error:", candError);
    if (jrError) console.error("JR Growth RPC Error:", jrError);

    return {
        totalCandidates: totalCandidates || 0,
        resumeCount: resumeCount || 0,
        orgChartCount: orgChartCount || 0,
        totalJRs: totalJRs || 0,
        candidateGrowth: candidateGrowth || [],
        jrGrowth: jrGrowth || []
    };
}
