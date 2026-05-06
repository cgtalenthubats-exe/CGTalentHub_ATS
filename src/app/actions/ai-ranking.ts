"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

const N8N_STAGE3_URL = "https://n8n.srv1212906.hstgr.cloud/webhook/demo-stage3";

export async function triggerStage3Ranking(jrId: string, query: string) {
    // Get all candidate_ids in this JR
    const { data: jrCandidates, error } = await adminAuthClient
        .from("jr_candidates")
        .select("candidate_id")
        .eq("jr_id", jrId);

    if (error || !jrCandidates?.length)
        throw new Error("ไม่พบ candidates ใน JR นี้");

    const candidateIds = jrCandidates.map((c: any) => c.candidate_id);
    const jobId = crypto.randomUUID();

    const response = await fetch(N8N_STAGE3_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, candidate_ids: candidateIds, query, jr_id: jrId }),
    });

    if (!response.ok)
        throw new Error(`n8n webhook failed: ${response.statusText}`);

    return { jobId, candidateCount: candidateIds.length };
}

export type Stage3Result = {
    candidate_id: string;
    name: string;
    position: string | null;
    company: string | null;
    score: number;
    strengths: string;
    gaps: string;
    tradeoff: string;
    rank: number;
    list_type: string;
};

export type Stage3JobData = {
    status: string;
    summary: {
        highlights?: string[];
        top5?: any[];
        final_recommendation?: string;
    } | null;
    results: Stage3Result[];
    result_count: number | null;
};

export async function getStage3JobStatus(jobId: string, jrId: string): Promise<Stage3JobData | null> {
    const { data: job } = await adminAuthClient
        .from("ai_ranking_jobs")
        .select("status, summary, result_count")
        .eq("job_id", jobId)
        .single();

    if (!job) return null;

    // Fetch done candidates progressively — show results as they arrive
    const { data: results } = await adminAuthClient
        .from("ai_ranking_results")
        .select("candidate_id, score, strengths, gaps, tradeoff, rank")
        .eq("job_id", jobId)
        .eq("status", "done")
        .order("score", { ascending: false });

    const candidateIds = (results ?? []).map((r: any) => r.candidate_id);

    if (!candidateIds.length) {
        return { status: job.status, summary: job.status === "completed" ? job.summary : null, results: [], result_count: job.result_count };
    }

    const [profilesRes, expRes, jrRes] = await Promise.all([
        adminAuthClient
            .from("Candidate Profile")
            .select("candidate_id, name")
            .in("candidate_id", candidateIds),
        adminAuthClient
            .from("candidate_experiences")
            .select("candidate_id, position, company")
            .in("candidate_id", candidateIds)
            .eq("is_current_job", "Current"),
        adminAuthClient
            .from("jr_candidates")
            .select("candidate_id, list_type")
            .eq("jr_id", jrId)
            .in("candidate_id", candidateIds),
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.candidate_id, p]));
    const expMap = new Map((expRes.data ?? []).map((e: any) => [e.candidate_id, e]));
    const jrMap = new Map((jrRes.data ?? []).map((j: any) => [j.candidate_id, j]));

    const enriched: Stage3Result[] = (results ?? []).map((r: any) => ({
        candidate_id: r.candidate_id,
        name: profileMap.get(r.candidate_id)?.name ?? r.candidate_id,
        position: expMap.get(r.candidate_id)?.position ?? null,
        company: expMap.get(r.candidate_id)?.company ?? null,
        score: r.score,
        strengths: r.strengths ?? "",
        gaps: r.gaps ?? "",
        tradeoff: r.tradeoff ?? "",
        rank: r.rank ?? null,
        list_type: jrMap.get(r.candidate_id)?.list_type ?? "Longlist",
    }));

    return {
        status: job.status,
        summary: job.status === "completed" ? job.summary : null,
        results: enriched,
        result_count: job.result_count,
    };
}
