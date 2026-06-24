"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

const N8N_SEARCH_STAGE3_URL = "https://n8n.srv1212906.hstgr.cloud/webhook/search-stage3";
const N8N_VECTOR_RANK_URL = "https://n8n.srv1212906.hstgr.cloud/webhook/vector-rank";

export type SearchJobData = {
    status: string;
    query: string | null;
    summary: {
        highlights?: string[];
        top5?: any[];
        final_recommendation?: string;
    } | null;
    results: SearchResult[];
    result_count: number | null;
};

export type SearchResult = {
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
    experience_score: number | null;
    experience_summary: string | null;
    leadership_score: number | null;
    leadership_summary: string | null;
    market_score: number | null;
    market_summary: string | null;
    skills_score: number | null;
    skills_summary: string | null;
};

export async function createSearchSession(
    name: string,
    filterSnapshot: Record<string, any> | null,
    candidateCount: number,
): Promise<string> {
    const { data, error } = await adminAuthClient
        .from("ai_search_sessions")
        .insert({ name, filter_snapshot: filterSnapshot, candidate_count: candidateCount } as any)
        .select("session_id")
        .single();
    if (error || !data) throw new Error("ไม่สามารถสร้าง session ได้");
    return (data as any).session_id as string;
}

export async function triggerSearchRanking(
    sessionId: string | null,
    candidateIds: string[],
    query: string,
): Promise<{ jobId: string; candidateCount: number }> {
    if (!candidateIds.length) throw new Error("ไม่มี candidates ที่จะประเมิน");
    const jobId = crypto.randomUUID();

    // Insert job record before calling n8n so polling can find it immediately
    const { error: insertError } = await adminAuthClient
        .from("ai_search_jobs")
        .insert({
            job_id: jobId,
            session_id: sessionId,
            query,
            candidate_count: candidateIds.length,
            status: "pending",
            candidate_ids: candidateIds,
        } as any);

    if (insertError) throw new Error(`ไม่สามารถสร้าง job ได้: ${insertError.message}`);

    const response = await fetch(N8N_SEARCH_STAGE3_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            job_id: jobId,
            session_id: sessionId,
            candidate_ids: candidateIds,
            candidate_count: candidateIds.length,
            query,
        }),
    });

    if (!response.ok) throw new Error(`n8n webhook failed: ${response.statusText}`);
    return { jobId, candidateCount: candidateIds.length };
}

export async function triggerVectorRankAssessment(
    candidateIds: string[],
    criteria: string,
): Promise<{ jobId: string; sessionId: string; candidateCount: number }> {
    if (!candidateIds.length) throw new Error("ไม่มี candidates ที่จะประเมิน");

    const sessionId = `v2_${Math.floor(Date.now() / 1000)}`;

    const { error: insertError } = await adminAuthClient
        .from("v2_search_results")
        .insert(candidateIds.map((candidateId) => ({ session_id: sessionId, candidate_id: candidateId })) as any);

    if (insertError) throw new Error(`ไม่สามารถสร้าง pool ได้: ${insertError.message}`);

    const response = await fetch(N8N_VECTOR_RANK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, jd_text: criteria, query: criteria }),
        signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) throw new Error(`n8n webhook failed: ${response.statusText}`);
    const data = await response.json();
    if (!data.job_id) throw new Error("ไม่ได้รับ job_id จาก vector-rank");

    return { jobId: data.job_id, sessionId: data.session_id ?? sessionId, candidateCount: data.candidate_count ?? candidateIds.length };
}

export type SearchJobSummary = {
    job_id: string;
    query: string;
    status: string;
    candidate_count: number;
    result_count: number | null;
    created_at: string;
    final_recommendation: string | null;
};

export async function getSearchJobHistory(limit = 20): Promise<SearchJobSummary[]> {
    const { data } = await adminAuthClient
        .from("ai_search_jobs")
        .select("job_id, query, status, candidate_count, result_count, summary, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

    return (data ?? []).map((row: any) => ({
        job_id: row.job_id,
        query: row.query,
        status: row.status,
        candidate_count: row.candidate_count,
        result_count: row.result_count ?? null,
        created_at: row.created_at,
        final_recommendation: row.summary?.final_recommendation ?? null,
    }));
}

export async function getSearchJobStatus(jobId: string): Promise<SearchJobData | null> {
    const { data: job } = await adminAuthClient
        .from("ai_search_jobs")
        .select("status, query, summary, result_count")
        .eq("job_id", jobId)
        .single();

    if (!job) return null;
    const jobData = job as any;

    const { data: results } = await adminAuthClient
        .from("ai_search_results")
        .select("candidate_id, score, strengths, gaps, tradeoff, rank, experience_score, experience_summary, leadership_score, leadership_summary, market_score, market_summary, skills_score, skills_summary")
        .eq("job_id", jobId)
        .eq("status", "done")
        .order("score", { ascending: false });

    const candidateIds = (results ?? []).map((r: any) => r.candidate_id);
    if (!candidateIds.length) {
        return { status: jobData.status, query: jobData.query ?? null, summary: jobData.status === "completed" ? jobData.summary : null, results: [], result_count: jobData.result_count };
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

    const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.candidate_id, p]));
    const expMap = new Map((expRes.data ?? []).map((e: any) => [e.candidate_id, e]));
    const enhanceMap = new Map((enhanceRes.data ?? []).map((e: any) => [e.candidate_id, e]));

    const enriched: SearchResult[] = (results ?? []).map((r: any) => {
        const profile = profileMap.get(r.candidate_id) as any;
        const enhance = enhanceMap.get(r.candidate_id) as any;
        return {
        candidate_id: r.candidate_id,
        name: profile?.name ?? r.candidate_id,
        photo_url: profile?.photo ?? null,
        linkedin: profile?.linkedin ?? null,
        age: profile?.age ?? null,
        age_source: profile?.age_source ?? null,
        address: [enhance?.country, enhance?.full_address].filter(Boolean).join(", ") || null,
        position: (expMap.get(r.candidate_id) as any)?.position ?? null,
        company: (expMap.get(r.candidate_id) as any)?.company ?? null,
        score: r.score,
        strengths: r.strengths ?? "",
        gaps: r.gaps ?? "",
        tradeoff: r.tradeoff ?? "",
        rank: r.rank ?? null,
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
        query: jobData.query ?? null,
        summary: jobData.status === "completed" ? jobData.summary : null,
        results: enriched,
        result_count: jobData.result_count,
    };
}
