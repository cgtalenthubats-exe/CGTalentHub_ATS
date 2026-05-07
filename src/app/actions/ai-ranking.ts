"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

const N8N_STAGE3_URL = "https://n8n.srv1212906.hstgr.cloud/webhook/demo-stage3";

export async function getLatestJobForJR(jrId: string): Promise<{ jobId: string; status: string; candidateCount: number } | null> {
    const { data } = await adminAuthClient
        .from("ai_ranking_jobs")
        .select("job_id, status, candidate_count")
        .eq("jr_id", jrId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (!data) return null;
    return { jobId: data.job_id, status: data.status, candidateCount: data.candidate_count ?? 0 };
}

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
    // 4-Dimension scoring (Top 20 only, null for others)
    experience_score: number | null;
    experience_summary: string | null;
    leadership_score: number | null;
    leadership_summary: string | null;
    market_score: number | null;
    market_summary: string | null;
    skills_score: number | null;
    skills_summary: string | null;
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
        .select("candidate_id, score, strengths, gaps, tradeoff, rank, experience_score, experience_summary, leadership_score, leadership_summary, market_score, market_summary, skills_score, skills_summary")
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
        experience_score: r.experience_score ?? null,
        experience_summary: r.experience_summary ?? null,
        leadership_score: r.leadership_score ?? null,
        leadership_summary: r.leadership_summary ?? null,
        market_score: r.market_score ?? null,
        market_summary: r.market_summary ?? null,
        skills_score: r.skills_score ?? null,
        skills_summary: r.skills_summary ?? null,
    }));

    return {
        status: job.status,
        summary: job.status === "completed" ? job.summary : null,
        results: enriched,
        result_count: job.result_count,
    };
}

export type JobHistoryItem = {
    jobId: string;
    query: string;
    status: string;
    candidateCount: number;
    resultCount: number | null;
    createdAt: string;
};

export async function getJobHistoryForJR(jrId: string): Promise<JobHistoryItem[]> {
    const { data } = await adminAuthClient
        .from("ai_ranking_jobs")
        .select("job_id, query, status, candidate_count, result_count, created_at")
        .eq("jr_id", jrId)
        .order("created_at", { ascending: false })
        .limit(10);

    if (!data) return [];
    return data.map((d: any) => ({
        jobId: d.job_id,
        query: d.query,
        status: d.status,
        candidateCount: d.candidate_count ?? 0,
        resultCount: d.result_count ?? null,
        createdAt: d.created_at,
    }));
}
