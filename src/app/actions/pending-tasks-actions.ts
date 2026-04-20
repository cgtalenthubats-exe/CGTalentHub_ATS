"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { triggerCandidateRefresh } from "./n8n-actions";

export async function getPendingJRs() {
    try {
        const client = adminAuthClient as any;
        const { data, error } = await client
            .from('job_requisitions')
            .select('jr_id, position_jr, bu, sub_bu, created_at, request_date, last_refreshed_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Process aging locally
        const processed = data?.map((jr: any) => {
            const startAgingDate = jr.last_refreshed_at || jr.created_at || jr.request_date;
            
            let monthsAging = 0;
            if (startAgingDate) {
                const start = new Date(startAgingDate);
                const now = new Date();
                
                // Simple months difference
                monthsAging = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
                if (now.getDate() < start.getDate()) {
                    monthsAging--; // Subtract a month if we haven't hit the day yet
                }
                monthsAging = Math.max(0, monthsAging);
            }

            return {
                ...jr,
                agingMonths: monthsAging,
                agingStart: startAgingDate
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

        // 1. Fetch candidates linked to this JR
        const { data: linkedCandidates, error: linkError } = await client
            .from('jr_candidates')
            .select('candidate_id, candidate:Candidate Profile(first_name, last_name, linkedin_url)')
            .eq('jr_id', jrId);

        if (linkError) throw linkError;

        if (!linkedCandidates || linkedCandidates.length === 0) {
            return { success: false, error: "No candidates found attached to this Job Requisition." };
        }

        // Format for n8n
        const candidatesPayload = linkedCandidates.map((c: any) => ({
            id: c.candidate_id,
            name: c.candidate ? `${c.candidate.first_name || ''} ${c.candidate.last_name || ''}`.trim() : "Unknown",
            linkedin: c.candidate?.linkedin_url || ""
        }));

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
