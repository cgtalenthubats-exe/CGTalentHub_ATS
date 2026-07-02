"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

const N8N_STAGE3_URL = "https://n8n.srv1212906.hstgr.cloud/webhook/demo-stage3";
const N8N_JR_ASSESS_URL = "https://n8n.srv1212906.hstgr.cloud/webhook/jr-assess";

export async function getLatestJobForJR(jrId: string): Promise<{ jobId: string; status: string; candidateCount: number } | null> {
    const { data } = await adminAuthClient
        .from("ai_ranking_jobs")
        .select("job_id, status, candidate_count")
        .eq("jr_id", jrId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (!data) return null;
    const d = data as any;
    return { jobId: d.job_id, status: d.status, candidateCount: d.candidate_count ?? 0 };
}

export async function triggerStage3RankingDirect(candidateIds: string[], query: string) {
    if (!candidateIds.length) throw new Error("ไม่มี candidates ที่จะประเมิน");
    const jobId = crypto.randomUUID();

    const response = await fetch(N8N_STAGE3_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, candidate_ids: candidateIds, candidate_count: candidateIds.length, query, jr_id: null }),
    });

    if (!response.ok)
        throw new Error(`n8n webhook failed: ${response.statusText}`);

    return { jobId, candidateCount: candidateIds.length };
}

export async function triggerStage3Ranking(jrId: string, query: string) {
    const response = await fetch(N8N_JR_ASSESS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jr_id: jrId, jd_text: query, query }),
    });

    if (!response.ok)
        throw new Error(`n8n webhook failed: ${response.statusText}`);

    const data = await response.json();
    if (!data.job_id)
        throw new Error("n8n did not return a job_id");

    return { jobId: data.job_id as string, candidateCount: (data.candidate_count ?? 0) as number };
}

export type Stage3Result = {
    candidate_id: string;
    name: string;
    photo_url: string | null;
    linkedin: string | null;
    age: number | null;
    age_source: string | null;
    address: string | null;
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

export async function getStage3JobStatus(jobId: string, jrId?: string | null): Promise<Stage3JobData | null> {
    const { data: job } = await adminAuthClient
        .from("ai_ranking_jobs")
        .select("status, summary, result_count")
        .eq("job_id", jobId)
        .single();

    if (!job) return null;
    const jobData = job as any;

    // Fetch done candidates progressively — show results as they arrive
    const { data: results } = await adminAuthClient
        .from("ai_ranking_results")
        .select("candidate_id, score, strengths, gaps, tradeoff, rank, experience_score, experience_summary, leadership_score, leadership_summary, market_score, market_summary, skills_score, skills_summary")
        .eq("job_id", jobId)
        .eq("status", "done")
        .order("score", { ascending: false });

    const candidateIds = (results ?? []).map((r: any) => r.candidate_id);

    if (!candidateIds.length) {
        return { status: jobData.status, summary: jobData.status === "completed" ? jobData.summary : null, results: [], result_count: jobData.result_count };
    }

    const [profilesRes, expRes, enhanceRes] = await Promise.all([
        adminAuthClient
            .from("Candidate Profile")
            .select("candidate_id, name, photo, linkedin, age, age_source")
            .in("candidate_id", candidateIds),
        adminAuthClient
            .from("candidate_experiences")
            .select("candidate_id, position, company")
            .in("candidate_id", candidateIds)
            .eq("is_current_job", "Current"),
        adminAuthClient
            .from("candidate_profile_enhance")
            .select("candidate_id, country, full_address")
            .in("candidate_id", candidateIds),
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.candidate_id, p as any]));
    const expMap = new Map((expRes.data ?? []).map((e: any) => [e.candidate_id, e as any]));
    const enhanceMap = new Map((enhanceRes.data ?? []).map((e: any) => [e.candidate_id, e as any]));

    let jrMap = new Map<string, any>();
    if (jrId) {
        const jrRes = await adminAuthClient
            .from("jr_candidates")
            .select("candidate_id, list_type")
            .eq("jr_id", jrId)
            .in("candidate_id", candidateIds);
        jrMap = new Map((jrRes.data ?? []).map((j: any) => [j.candidate_id, j]));
    }

    const enriched: Stage3Result[] = (results ?? []).map((r: any) => {
        const profile = profileMap.get(r.candidate_id);
        const enhance = enhanceMap.get(r.candidate_id);
        return {
        candidate_id: r.candidate_id,
        name: profile?.name ?? r.candidate_id,
        photo_url: profile?.photo ?? null,
        linkedin: profile?.linkedin ?? null,
        age: profile?.age ?? null,
        age_source: profile?.age_source ?? null,
        address: [enhance?.country, enhance?.full_address].filter(Boolean).join(", ") || null,
        position: expMap.get(r.candidate_id)?.position ?? null,
        company: expMap.get(r.candidate_id)?.company ?? null,
        score: r.score,
        strengths: r.strengths ?? "",
        gaps: r.gaps ?? "",
        tradeoff: r.tradeoff ?? "",
        rank: r.rank ?? null,
        list_type: jrId ? (jrMap.get(r.candidate_id)?.list_type ?? "Longlist") : "Search Result",
        experience_score: r.experience_score ?? null,
        experience_summary: r.experience_summary ?? null,
        leadership_score: r.leadership_score ?? null,
        leadership_summary: r.leadership_summary ?? null,
        market_score: r.market_score ?? null,
        market_summary: r.market_summary ?? null,
        skills_score: r.skills_score ?? null,
        skills_summary: r.skills_summary ?? null,
        };
    });

    return {
        status: jobData.status,
        summary: jobData.status === "completed" ? jobData.summary : null,
        results: enriched,
        result_count: jobData.result_count,
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
