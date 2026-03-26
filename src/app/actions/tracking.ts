"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export interface TrackingStats {
    totalJRs: number;
    totalCandidates: number;
    funnelData: {
        status: string;
        count: number;
        avgDays: number;
        maxDays: number;
        color?: string;
    }[];
    buData: { bu: string; count: number }[];
    positionData: { position: string; count: number }[];
    industryData: { industry: string; count: number }[];
    countryData: { country: string; count: number }[];
}

export async function getTrackingData(filters: {
    jr_id?: string[];
    position_jr?: string[];
    bu?: string[];
    sub_bu?: string[];
    status?: string[];
}) {
    const supabase = adminAuthClient;

    // 1. Fetch Status Master
    const { data: statusMaster } = await supabase
        .from('status_master')
        .select('status, stage_order')
        .order('stage_order', { ascending: true });

    const masters = ((statusMaster as any[]) || []).sort((a: any, b: any) => {
        const orderA = a.stage_order === 99 ? -1 : a.stage_order;
        const orderB = b.stage_order === 99 ? -1 : b.stage_order;
        return orderA - orderB;
    });

    // 2. Fetch Job Requisitions
    let jrQuery = supabase.from('job_requisitions').select('jr_id, position_jr, bu, sub_bu');
    if (filters.jr_id?.length) jrQuery = jrQuery.in('jr_id', filters.jr_id);
    if (filters.position_jr?.length) jrQuery = jrQuery.in('position_jr', filters.position_jr);
    if (filters.bu?.length) jrQuery = jrQuery.in('bu', filters.bu);
    if (filters.sub_bu?.length) jrQuery = jrQuery.in('sub_bu', filters.sub_bu);

    const { data: jrs } = await jrQuery;
    const jrsList = (jrs as any[]) || [];
    const filteredJrIds = jrsList.map(j => j.jr_id);

    const emptyResult: TrackingStats = {
        totalJRs: jrsList.length,
        totalCandidates: 0,
        funnelData: [],
        buData: [],
        positionData: [],
        industryData: [],
        countryData: []
    };

    if (filteredJrIds.length === 0) return emptyResult;

    // 3. Aggregate JRs (Local)
    const buCountMap: Record<string, number> = {};
    const posCountMap: Record<string, number> = {};
    jrsList.forEach(j => {
        const bu = j.bu || "Unknown";
        const pos = j.position_jr || "Unknown";
        buCountMap[bu] = (buCountMap[bu] || 0) + 1;
        posCountMap[pos] = (posCountMap[pos] || 0) + 1;
    });

    // 4. Fetch Candidates
    const { data: jrCands, error: candErr } = await supabase
        .from('jr_candidates')
        .select('jr_candidate_id, candidate_id, jr_id')
        .in('jr_id', filteredJrIds);

    const candList = (jrCands as any[]) || [];
    if (candList.length === 0) return {
        ...emptyResult,
        buData: Object.keys(buCountMap).map(k => ({ bu: k, count: buCountMap[k] })).sort((a, b) => b.count - a.count),
        positionData: Object.keys(posCountMap).map(k => ({ position: k, count: posCountMap[k] })).sort((a, b) => b.count - a.count)
    };

    const jrCandIds = candList.map(c => c.jr_candidate_id);
    const candidateIds = Array.from(new Set(candList.map(c => c.candidate_id))).filter(Boolean);

    // parallel fetch logs and experiences
    const [logsRes, expRes] = await Promise.all([
        supabase.from('status_log').select('jr_candidate_id, status, timestamp, log_id').in('jr_candidate_id', jrCandIds),
        supabase.from('candidate_experiences').select('candidate_id, country, company_industry, start_date').in('candidate_id', candidateIds)
    ]);

    const logsMap = new Map();
    (logsRes.data || []).forEach((l: any) => {
        if (!logsMap.has(l.jr_candidate_id)) logsMap.set(l.jr_candidate_id, []);
        logsMap.get(l.jr_candidate_id).push(l);
    });

    const expMap = new Map();
    (expRes.data || []).forEach((e: any) => {
        if (!expMap.has(e.candidate_id)) expMap.set(e.candidate_id, []);
        expMap.get(e.candidate_id).push(e);
    });

    const candidateContextMap = new Map();
    expMap.forEach((exps, cId) => {
        exps.sort((a: any, b: any) => (b.start_date || "").localeCompare(a.start_date || ""));
        candidateContextMap.set(cId, exps[0]);
    });

    const statusCounts: Record<string, number> = {};
    const statusAging: Record<string, number[]> = {};
    masters.forEach(m => {
        statusCounts[m.status] = 0;
        statusAging[m.status] = [];
    });

    const indCountMap: Record<string, number> = {};
    const countryCountMap: Record<string, number> = {};
    const now = new Date();

    let actualCandidatesCount = 0;

    candList.forEach(c => {
        const cLogs = logsMap.get(c.jr_candidate_id) || [];
        // Resolve status from status_log only (temp_status ignored)
        let s = "Pool Candidate";

        if (cLogs.length > 0) {
            cLogs.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() || a.log_id - b.log_id);
            s = cLogs[cLogs.length - 1].status;
        }

        const masterMatch = masters.find(m => m.status.toLowerCase() === s.toLowerCase());
        const finalStatus = masterMatch ? masterMatch.status : s;

        // Apply Status Filter
        if (filters.status?.length && !filters.status.includes(finalStatus)) return;

        actualCandidatesCount++;

        // Aging calculation (only for funnel statuses)
        if (cLogs.length > 0) {
            for (let i = 0; i < cLogs.length; i++) {
                const step = cLogs[i];
                const start = new Date(step.timestamp).getTime();
                const end = i < cLogs.length - 1 ? new Date(cLogs[i + 1].timestamp).getTime() : now.getTime();
                const days = Math.max(0, (end - start) / (1000 * 3600 * 24));
                if (statusAging[step.status]) statusAging[step.status].push(days);
            }
        }

        if (statusCounts[finalStatus] !== undefined) statusCounts[finalStatus]++;
        else statusCounts[finalStatus] = (statusCounts[finalStatus] || 0) + 1;

        const ctx = candidateContextMap.get(c.candidate_id);

        // Ensure every candidate is counted in Industry/Country even if missing data
        // "Unknown" for truly missing, include "#N/A" as a category if it exists in data but treat as Unknown for clarity
        const industryRaw = ctx?.company_industry;
        const countryRaw = ctx?.country;

        const industry = (!industryRaw || industryRaw === "#N/A") ? "Unknown" : industryRaw;
        const country = (!countryRaw || countryRaw === "#N/A") ? "Unknown" : countryRaw;

        indCountMap[industry] = (indCountMap[industry] || 0) + 1;
        countryCountMap[country] = (countryCountMap[country] || 0) + 1;
    });

    const funnelData = masters.map(m => {
        const durs = statusAging[m.status] || [];
        return {
            status: m.status,
            count: statusCounts[m.status] || 0,
            avgDays: durs.length > 0 ? Math.round((durs.reduce((a: number, b: number) => a + b, 0) / durs.length) * 10) / 10 : 0,
            maxDays: durs.length > 0 ? Math.round(Math.max(...durs) * 10) / 10 : 0,
            color: (m as any).color_code || undefined
        };
    }).filter(f => f.count > 0);

    return {
        totalJRs: jrsList.length,
        totalCandidates: actualCandidatesCount,
        funnelData,
        buData: Object.keys(buCountMap).map(k => ({ bu: k, count: buCountMap[k] })).sort((a, b) => b.count - a.count).slice(0, 15),
        positionData: Object.keys(posCountMap).map(k => ({ position: k, count: posCountMap[k] })).sort((a, b) => b.count - a.count).slice(0, 15),
        industryData: Object.keys(indCountMap).map(k => ({ industry: k, count: indCountMap[k] })).sort((a, b) => b.count - a.count).slice(0, 15),
        countryData: Object.keys(countryCountMap).map(k => ({ country: k, count: countryCountMap[k] })).sort((a, b) => b.count - a.count).slice(0, 15)
    };
}

export async function getTrackingFilters() {
    const supabase = adminAuthClient;
    const { data: jrs } = await supabase.from('job_requisitions').select('jr_id, position_jr, bu, sub_bu');
    const { data: statusMaster } = await supabase.from('status_master').select('status').order('stage_order');

    return {
        rawJrs: (jrs as any[]) || [],
        statuses: Array.from(new Set((statusMaster || []).map((s: any) => s.status))).filter(Boolean)
    };
}
