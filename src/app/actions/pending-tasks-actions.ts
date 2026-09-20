"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { triggerCandidateRefresh } from "./n8n-actions";

function monthsSince(dateString: string | null): number {
    if (!dateString) return 0;
    const start = new Date(dateString);
    const now = new Date();
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (now.getDate() < start.getDate()) {
        months--;
    }
    return Math.max(0, months);
}

// The Supabase project caps rows-per-request (db-max-rows) regardless of the
// range requested, so tables bigger than that limit need paged fetching.
async function fetchAllRows(client: any, table: string, columns: string) {
    const PAGE = 1000;
    let allRows: any[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await client
            .from(table)
            .select(columns)
            .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows = allRows.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
    }
    return allRows;
}

export async function getPendingJRs() {
    try {
        const client = adminAuthClient as any;
        const { data, error } = await client
            .from('job_requisitions')
            .select('jr_id, position_jr, bu, sub_bu, created_at, request_date, last_refreshed_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Candidate-level profile aging: how stale each candidate's own profile is,
        // independent of the JR's own last_refreshed_at.
        const jrCandidates = await fetchAllRows(client, 'jr_candidates', 'jr_id, candidate_id');
        const profiles = await fetchAllRows(client, 'Candidate Profile', 'candidate_id, modify_date, created_date');

        const profileDatesByCandidateId = new Map<string, { modify_date: string | null; created_date: string | null }>(
            profiles.map((p: any) => [p.candidate_id, { modify_date: p.modify_date, created_date: p.created_date }])
        );

        // Aggregate candidate profile aging per JR
        const candidateAgingByJrId = new Map<string, { total: number; under6: number; over6: number }>();
        for (const jc of jrCandidates) {
            const bucket = candidateAgingByJrId.get(jc.jr_id) || { total: 0, under6: 0, over6: 0 };
            const profileDates = profileDatesByCandidateId.get(jc.candidate_id);
            // Mirror the Candidate Explorer's ProfileAgeIndicator: prefer modify_date, fall back to created_date
            const months = monthsSince(profileDates?.modify_date || profileDates?.created_date || null);
            bucket.total++;
            if (months >= 6) bucket.over6++;
            else bucket.under6++;
            candidateAgingByJrId.set(jc.jr_id, bucket);
        }

        // Process aging locally
        const processed = data?.map((jr: any) => {
            const startAgingDate = jr.last_refreshed_at || jr.created_at || jr.request_date;
            const monthsAging = monthsSince(startAgingDate);
            const candidateAging = candidateAgingByJrId.get(jr.jr_id) || { total: 0, under6: 0, over6: 0 };

            return {
                ...jr,
                agingMonths: monthsAging,
                agingStart: startAgingDate,
                candidateTotal: candidateAging.total,
                candidateUnder6: candidateAging.under6,
                candidateOver6: candidateAging.over6
            };
        }) || [];

        return { success: true, data: processed };
    } catch (err: any) {
        console.error("Error fetching Pending JRs:", err);
        return { success: false, error: err.message };
    }
}

export async function getDistributionStats() {
    try {
        const client = adminAuthClient as any;
        
        // Fetch pre-aggregated data from the database views to bypass 1000 row limits
        const { data: industryDist, error: industryError } = await client
            .from('vw_candidate_industry_distribution')
            .select('*');

        if (industryError) throw industryError;

        const { data: groupDist, error: groupError } = await client
            .from('vw_candidate_group_distribution')
            .select('*');

        if (groupError) throw groupError;

        const { data: jobGroupDist, error: jobGroupError } = await client
            .from('vw_candidate_job_grouping_distribution')
            .select('*');

        if (jobGroupError) throw jobGroupError;

        const { data: jobFuncDist, error: jobFuncError } = await client
            .from('vw_candidate_job_function_distribution')
            .select('*');

        if (jobFuncError) throw jobFuncError;

        return {
            success: true,
            industryDist: industryDist || [],
            groupDist: groupDist || [],
            jobGroupDist: jobGroupDist || [],
            jobFuncDist: jobFuncDist || []
        };
    } catch (err: any) {
        console.error("Error fetching Distribution Stats:", err);
        return { success: false, error: err.message };
    }
}

export async function refreshJRCandidates(jrId: string) {
    try {
        const client = adminAuthClient as any;

        // 1. Fetch candidate_ids linked to this JR
        const { data: linkedCandidates, error: linkError } = await client
            .from('jr_candidates')
            .select('candidate_id')
            .eq('jr_id', jrId);

        if (linkError) throw linkError;

        if (!linkedCandidates || linkedCandidates.length === 0) {
            return { success: false, error: "No candidates found attached to this Job Requisition." };
        }

        const candidateIds = linkedCandidates.map((c: any) => c.candidate_id);

        // 2. Fetch profile data separately (table name with space doesn't support inline join)
        const { data: profiles } = await client
            .from('Candidate Profile')
            .select('candidate_id, name, linkedin, modify_date, created_date')
            .in('candidate_id', candidateIds);

        const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.candidate_id, p]));

        // Only refresh candidates whose own profile is stale (>= 6 months), not the whole JR pool
        const staleCandidateIds = candidateIds.filter((id: string) => {
            const p = profileMap.get(id);
            const months = monthsSince(p?.modify_date || p?.created_date || null);
            return months >= 6;
        });

        if (staleCandidateIds.length === 0) {
            return { success: false, error: "No candidates over 6 months old were found for this Job Requisition." };
        }

        // Format for n8n
        const candidatesPayload = staleCandidateIds.map((id: string) => {
            const p = profileMap.get(id);
            return {
                id,
                name: p?.name || "Unknown",
                linkedin: p?.linkedin || ""
            };
        });

        // 2. Trigger Webhook
        const refreshRes = await triggerCandidateRefresh(candidatesPayload, "JR Maintenance Board");
        if (!refreshRes.success) {
            throw new Error(refreshRes.error);
        }

        // 3. Update last_refreshed_at on the job_requisitions table
        const { error: updateError } = await client
            .from('job_requisitions')
            .update({ last_refreshed_at: new Date().toISOString() })
            .eq('jr_id', jrId);

        if (updateError) throw updateError;

        return { success: true, count: candidatesPayload.length };
    } catch (err: any) {
        console.error("Error refreshing JR candidates:", err);
        return { success: false, error: err.message };
    }
}
