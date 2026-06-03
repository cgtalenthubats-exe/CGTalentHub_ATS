import { google } from "@ai-sdk/google";
import { streamText, stepCountIs } from "ai";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tool = (t: any) => t;
import { z } from "zod";
import { adminAuthClient } from "@/lib/supabase/admin";

const SYSTEM_PROMPT = `You are a recruitment search assistant for CG Talent Hub ATS.
Help recruiters find candidates from the internal database.

## HOW TO SEARCH

Use searchCandidates tool with structured filters:
- position_search: role keywords e.g. ["General Manager", "CFO"]
- hotel_ratings: ["5 Star"] or ["4 Star"] or ["3 Star"]
- countries: current residence e.g. ["Thailand"]
- industries: e.g. ["Hospitality"]
- position_levels: ["C-Level", "Director", "Manager"]
- genders: ["Male"] or ["Female"]
- hotel_chains: chain names e.g. ["Marriott International"]
- current_and_latest: false (DEFAULT) = search ALL experiences including past
- current_and_latest: true = current job only (most recent experience)
- current_only: true = strictly current job only

## FALLBACK RULE
If searchCandidates returns few results (< 10):
1. Try with current_and_latest: false to include all past experiences
2. Try broader search terms

## BEHAVIOR
1. Understand the query
2. Call searchCandidates with appropriate filters
3. Call setFilters to populate the UI filter panel
4. Reply naturally with findings

For analytics (counts per brand, stats): call getAnalytics tool.

Always respond in the same language as the user. Be concise.`;

export async function POST(req: Request) {
    const { messages, model = "gemini-2.5-flash" } = await req.json();

    const supabase = adminAuthClient;

    // Convert SDK 6 UIMessage[] → CoreMessage[] for streamText
    const coreMessages = (messages as any[])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
            role: m.role as "user" | "assistant",
            content: (m.parts as any[] ?? [])
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("") || String(m.content ?? ""),
        }))
        .filter((m) => m.content.trim().length > 0);

    const result = streamText({
        model: google(model),
        system: SYSTEM_PROMPT,
        messages: coreMessages,
        stopWhen: stepCountIs(3),
        tools: {
            searchCandidates: tool({
                description: "Search candidates using structured filters. Returns total count and sample candidates.",
                parameters: z.object({
                    position_search: z.array(z.string()).optional(),
                    position_levels: z.array(z.string()).optional(),
                    hotel_ratings: z.array(z.string()).optional(),
                    countries: z.array(z.string()).optional(),
                    industries: z.array(z.string()).optional(),
                    hotel_chains: z.array(z.string()).optional(),
                    genders: z.array(z.string()).optional(),
                    current_only: z.boolean().optional(),
                    current_and_latest: z.boolean().optional(),
                    nationalities: z.array(z.string()).optional(),
                }),
                execute: async (params: any) => {
                    try {
                        const rpcParams = {
                            p_position_keywords: [],
                            p_position_levels: params.position_levels ?? [],
                            p_positions: [],
                            p_companies: [],
                            p_countries: params.countries ?? [],
                            p_regions: [],
                            p_hotel_ratings: params.hotel_ratings ?? [],
                            p_hotel_chains: params.hotel_chains ?? [],
                            p_industry_group: null,
                            p_industries: params.industries ?? [],
                            p_current_only: params.current_only ?? false,
                            p_job_functions: [],
                            p_exclude_companies: [],
                            p_exclude_countries: [],
                            p_exclude_keywords: [],
                            p_hotel_sub_brands: [],
                            p_genders: params.genders ?? [],
                            p_nationalities: params.nationalities ?? [],
                            p_age_min: null,
                            p_age_max: null,
                            p_age_include_unknown: true,
                            p_current_and_latest: params.current_and_latest ?? false,
                            p_position_search: params.position_search ?? [],
                            p_internal_only: false,
                        };

                        const [summaryRes, idsRes] = await Promise.all([
                            (supabase as any).rpc("get_search_summary", rpcParams),
                            (supabase as any).rpc("search_candidate_ids", rpcParams),
                        ]);

                        const total = summaryRes.data?.[0]?.total ?? 0;
                        const ids: string[] = (idsRes.data ?? []).slice(0, 5).map((r: any) => r.candidate_id);

                        let sample: any[] = [];
                        if (ids.length > 0) {
                            const { data: sd } = await supabase
                                .from("Candidate Profile" as any)
                                .select("candidate_id, name, job_function")
                                .in("candidate_id", ids);
                            sample = sd ?? [];
                        }

                        return { total, sample, filters_applied: params };
                    } catch (e: any) {
                        return { error: e.message, total: 0, sample: [] };
                    }
                },
            }),

            setFilters: tool({
                description: "Set the filter panel UI with the search criteria. Call this after searchCandidates.",
                parameters: z.object({
                    position_search: z.array(z.string()).optional(),
                    position_levels: z.array(z.string()).optional(),
                    hotel_ratings: z.array(z.string()).optional(),
                    countries: z.array(z.string()).optional(),
                    industries: z.array(z.string()).optional(),
                    hotel_chains: z.array(z.string()).optional(),
                    genders: z.array(z.string()).optional(),
                    current_only: z.boolean().optional(),
                    current_and_latest: z.boolean().optional(),
                    total: z.number().optional(),
                }),
                execute: async (params: any) => {
                    return { filters: params, applied: true };
                },
            }),

            getAnalytics: tool({
                description: "Get analytics data: count by hotel brand/chain, rating distribution, etc.",
                parameters: z.object({
                    type: z.enum(["brands_by_rating", "candidates_per_chain"]),
                    rating: z.string().optional(),
                }),
                execute: async ({ type, rating }: { type: string; rating?: string }) => {
                    try {
                        if (type === "brands_by_rating") {
                            const { data } = await (supabase as any)
                                .from("hotel_chain_master")
                                .select("brand_name, rating, parent_id")
                                .eq("rating", rating ?? "5 Star")
                                .is("parent_id", null);

                            return { type, rating, count: (data ?? []).length, sample: (data ?? []).slice(0, 10).map((r: any) => r.brand_name) };
                        }

                        if (type === "candidates_per_chain") {
                            const { data } = await (supabase as any).rpc("get_chain_candidate_counts");
                            return { type, data: (data ?? []).slice(0, 20) };
                        }

                        return { error: "Unknown analytics type" };
                    } catch (e: any) {
                        return { error: e.message };
                    }
                },
            }),
        },
    });

    // Stream text back as plain SSE — compatible with manual fetch on client
    const stream = result.textStream;
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
        async start(controller) {
            for await (const chunk of stream) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
        },
    });
    return new Response(readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
