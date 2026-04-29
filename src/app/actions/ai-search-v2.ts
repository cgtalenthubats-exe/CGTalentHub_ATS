"use server";

import { createClient } from "@supabase/supabase-js";
import { ConsolidatedResult, SearchJob } from "@/components/ai-search/types";
import { PipelineStatus } from "@/components/ai-search/types-status";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- 1. Get Search Results ---
// enrich=true fetches profile photo/linkedin/sex/age for top N candidates only (after Stage 3)
export async function v2GetSearchResults(sessionId: string, enrich = false) {
    try {
        const { data: results, error } = await supabase
            .from("v2_search_results")
            .select("*")
            .eq("session_id", sessionId)
            .eq("stage1_included", true)
            .order("stage3_score", { ascending: false, nullsFirst: false })
            .order("candidate_id", { ascending: true });

        if (error) throw error;

        // Only enrich top 30 scored candidates — skip for raw Stage 1 counts
        const enrichThreshold = 30;
        const enriched = await Promise.all(
            results.map(async (r, idx) => {
                let photo_url: string | null = null;
                let linkedin_url: string | undefined;
                let sex: string | undefined;
                let age: number | null = null;
                let country: string | undefined;
                let onboarded_id: string | undefined = undefined;

                const shouldEnrich = enrich && idx < enrichThreshold;
                if (shouldEnrich) {
                    const { data: profile } = await supabase
                        .from("Candidate Profile")
                        .select("photo, linkedin_url, sex, dob, country")
                        .eq("candidate_id", r.candidate_id)
                        .maybeSingle();

                    if (profile) {
                        photo_url = profile.photo;
                        linkedin_url = profile.linkedin_url ?? undefined;
                        sex = profile.sex ?? undefined;
                        country = profile.country ?? undefined;
                        if (profile.dob) {
                            const birth = new Date(profile.dob);
                            const today = new Date();
                            age = today.getFullYear() - birth.getFullYear();
                            if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--;
                        }
                    }
                }

                const mapped: ConsolidatedResult = {
                    id: r.id,
                    session_id: r.session_id,
                    source: r.source ?? "internal_db",
                    candidate_ref_id: r.candidate_id,
                    name: r.name ?? "",
                    position: r.position ?? "",
                    company: r.company ?? "",
                    photo_url: photo_url ?? undefined,
                    linkedin_url,
                    sex,
                    age,
                    country,
                    onboarded_id,

                    // Scores — populated after Stage 3
                    final_total_score: r.stage3_score ?? 0,
                    match_score: r.stage3_score ?? undefined,
                    score_part_a: 0,
                    score_part_b: 0,

                    // Analysis — populated after Stage 3
                    gap_analysis: r.stage3_gaps ?? undefined,
                    highlight_project: r.stage3_strengths ?? undefined,
                    vision_strategy: undefined,
                    executive_summary: r.stage3_summary ?? undefined,
                    inferred_insights: undefined,

                    // Stage 2 screening
                    stage2_pass: r.stage2_pass ?? null,
                    stage2_reason: r.stage2_reason ?? undefined,

                    // Stage 3 scoring
                    stage3_score: r.stage3_score ?? null,
                    stage3_rank: r.stage3_rank ?? null,
                    stage3_tradeoff: r.stage3_tradeoff ?? undefined,
                    stage3_summary: r.stage3_summary ?? undefined,

                    created_at: r.created_at,
                };

                return mapped;
            })
        );

        // Sort: by stage3_score desc, then stage2 passed/pending, then failed last
        const sorted = enriched.sort((a, b) => {
            if (a.stage2_pass === false && b.stage2_pass !== false) return 1;
            if (b.stage2_pass === false && a.stage2_pass !== false) return -1;
            const aScore = a.stage3_score ?? -1;
            const bScore = b.stage3_score ?? -1;
            return bScore - aScore;
        });

        return { success: true, data: sorted };
    } catch (error: any) {
        console.error("[v2GetSearchResults]", error);
        return { success: false, error: error.message };
    }
}

// --- 2. Get Session (maps to SearchJob shape) ---
export async function v2GetSession(sessionId: string) {
    try {
        const { data, error } = await supabase
            .from("v2_search_sessions")
            .select("*")
            .eq("session_id", sessionId)
            .maybeSingle();

        if (error) throw error;
        if (!data) return { success: false, error: "Session not found" };

        const mapped: SearchJob = {
            session_id: data.session_id,
            original_query: data.original_query ?? "",
            status: data.status ?? "processing",
            timestamp: data.created_at,
            user_email: data.user_email ?? "",
            internal_db_summary: undefined,
            external_db_summary: undefined,
            stage3_overall_summary: data.stage3_overall_summary ?? undefined,
        };

        return { success: true, data: mapped };
    } catch (error: any) {
        console.error("[v2GetSession]", error);
        return { success: false, error: error.message };
    }
}

// --- 3. Get Pipeline Statuses ---
export async function v2GetPipelineStatuses(sessionId: string) {
    try {
        const { data, error } = await supabase
            .from("v2_pipeline_status")
            .select("*")
            .eq("session_id", sessionId)
            .order("stage", { ascending: true });

        if (error) throw error;

        // Map v2_pipeline_status → PipelineStatus shape used by StatusPipeline component
        const mapped: PipelineStatus[] = (data ?? []).map((row) => ({
            id: row.id,
            session_id: row.session_id,
            source: `Stage ${row.stage}`,
            summary_agent_1: row.stage === 1 ? (row.status === "completed" ? "Completed" : row.status ?? "Waiting...") : "Waiting...",
            summary_agent_2: row.stage === 2 ? (row.status === "completed" ? "Completed" : row.status ?? "Waiting...") : "Waiting...",
            summary_agent_3: row.stage === 3 ? (row.status === "completed" ? "Completed" : row.status ?? "Waiting...") : "Waiting...",
            summary_agent_4: "Waiting...",
            updated_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
        }));

        return { success: true, data: mapped };
    } catch (error: any) {
        console.error("[v2GetPipelineStatuses]", error);
        return { success: false, error: error.message };
    }
}

// --- 4. Get Search History ---
export async function v2GetHistory() {
    try {
        const { data, error } = await supabase
            .from("v2_search_sessions")
            .select("session_id, original_query, status, created_at")
            .order("created_at", { ascending: false })
            .limit(50);

        if (error) throw error;

        const mapped = (data ?? []).map((row) => ({
            session_id: row.session_id,
            original_query: row.original_query ?? "Untitled",
            status: row.status ?? "processing",
            timestamp: row.created_at,
        }));

        return { success: true, data: mapped };
    } catch (error: any) {
        console.error("[v2GetHistory]", error);
        return { success: false, error: error.message };
    }
}

// --- 5. Get Chat Messages ---
export async function v2GetChatMessages(sessionId: string) {
    try {
        const { data, error } = await supabase
            .from("v2_chat_messages")
            .select("id, role, content, created_at")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });

        if (error) throw error;
        return { success: true, data: data ?? [] };
    } catch (error: any) {
        console.error("[v2GetChatMessages]", error);
        return { success: false, error: error.message };
    }
}

// --- 6. Save Chat Message ---
export async function v2SaveChatMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string
) {
    try {
        const { error } = await supabase
            .from("v2_chat_messages")
            .insert({ session_id: sessionId, role, content });

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error("[v2SaveChatMessage]", error);
        return { success: false, error: error.message };
    }
}

// --- 7. Ensure Session Row Exists ---
export async function v2EnsureSession(sessionId: string, userEmail: string) {
    try {
        const { data: existing } = await supabase
            .from("v2_search_sessions")
            .select("session_id")
            .eq("session_id", sessionId)
            .maybeSingle();

        if (!existing) {
            await supabase.from("v2_search_sessions").insert({
                session_id: sessionId,
                user_email: userEmail,
                status: "chatting",
            });
        }

        return { success: true };
    } catch (error: any) {
        console.error("[v2EnsureSession]", error);
        return { success: false, error: error.message };
    }
}

// --- 8. Delete Session ---
export async function v2DeleteSession(sessionId: string) {
    try {
        await Promise.all([
            supabase.from("v2_search_results").delete().eq("session_id", sessionId),
            supabase.from("v2_pipeline_status").delete().eq("session_id", sessionId),
            supabase.from("v2_chat_messages").delete().eq("session_id", sessionId),
        ]);
        await supabase.from("v2_search_sessions").delete().eq("session_id", sessionId);

        return { success: true };
    } catch (error: any) {
        console.error("[v2DeleteSession]", error);
        return { success: false, error: error.message };
    }
}
