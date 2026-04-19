"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export async function getDashboardOverviewStats(lookbackDays: number = 30) {
    const client = adminAuthClient as any;
    const now = new Date();
    const lookbackDate = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Basic Counts (Candidate, Resume, OrgChart, JRs)
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
    const activeJRs = totalJRs || 0; // Deprecated is_active filter

    // 2. Trend Data (Created Date for Candidates, Request Date for JRs)
    // Increase limit to 10,000 to avoid Supabase default 1,000 suppression
    const [
        { data: candidateTrend },
        { data: jrTrend }
    ] = await Promise.all([
        client.from('Candidate Profile').select('created_date').gte('created_date', lookbackDate).limit(10000),
        client.from('job_requisitions').select('request_date').gte('request_date', lookbackDate).limit(10000)
    ]);

    // 3. Distribution Data
    const { data: expCounts } = await client
        .from('candidate_experiences')
        .select('company_industry, company_group')
        .limit(3000);

    // Helper: Process cumulative weekly buckets (Working backwards for 100% accuracy)
    const processTrendData = (rawData: any[], dateKey: string, currentTotal: number) => {
        const buckets: { label: string; start: Date; end: Date; addition: number }[] = [];
        
        // Create 7-day buckets leading up to 'now'
        for (let i = 0; i < Math.ceil(lookbackDays / 7); i++) {
            const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
            const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
            const label = `W${Math.ceil(lookbackDays / 7) - i} (${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
            buckets.unshift({ label, start, end, addition: 0 });
        }

        // Count additions per bucket
        rawData.forEach(item => {
            if (!item[dateKey]) return;
            const d = new Date(item[dateKey]);
            const bucketIndex = buckets.findIndex(b => d >= b.start && d < b.end);
            if (bucketIndex !== -1) {
                buckets[bucketIndex].addition++;
            }
        });

        // Calculate cumulative totals working backwards from the current total
        // We assume currentTotal is the state AT THIS MOMENT.
        let runningTotal = currentTotal;
        const result = [];
        
        // Reverse to iterate from most recent to oldest
        const reversedBuckets = [...buckets].reverse();
        for (const b of reversedBuckets) {
            const currentWeekTotal = runningTotal;
            result.unshift({
                week: b.label,
                count: currentWeekTotal,
                addition: b.addition
            });
            runningTotal -= b.addition; // Go back in time
        }

        return result;
    };

    // Helper: Process distribution
    const processDistData = (rawData: any[], key: string) => {
        const counts: Record<string, number> = {};
        rawData.forEach(item => {
            const val = item[key];
            if (val && val !== "#N/A") {
                counts[val] = (counts[val] || 0) + 1;
            }
        });
        return Object.keys(counts).map(k => ({ name: k, count: counts[k] }))
            .sort((a, b) => b.count - a.count);
    };

    return {
        totalCandidates: totalCandidates || 0,
        resumeCount: resumeCount || 0,
        orgChartCount: orgChartCount || 0,
        totalJRs: totalJRs || 0,
        activeJRs: activeJRs || 0,
        candidateGrowth: processTrendData(candidateTrend || [], 'created_date', totalCandidates || 0),
        jrGrowth: processTrendData(jrTrend || [], 'request_date', totalJRs || 0),
        industryDist: processDistData(expCounts || [], 'company_industry'),
        groupDist: processDistData(expCounts || [], 'company_group')
    };
}
