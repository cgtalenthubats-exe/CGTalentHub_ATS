"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { type DemoFilterState, type AiParseResult } from "@/app/ai-search-demo/types";

// helper: convert DemoFilterState to RPC params
function toRpcParams(f: DemoFilterState) {
    return {
        p_position_keywords:  f.position_keywords,
        p_position_levels:    f.position_levels,
        p_positions:          f.positions,
        p_companies:          f.companies,
        p_countries:          f.countries,
        p_regions:            f.regions,
        p_hotel_ratings:      f.hotel_ratings,
        p_industry_group:     f.industry_group ?? null,
        p_industries:         f.industries,
        p_current_only:       f.current_only,
        p_job_functions:      f.job_functions,
        p_exclude_companies:  f.exclude_companies,
        p_exclude_countries:  f.exclude_countries,
        p_exclude_keywords:   f.exclude_keywords,
        p_genders:            f.genders,
        p_nationalities:      f.nationalities,
        p_age_min:            f.age_min ?? null,
        p_age_max:            f.age_max ?? null,
        p_age_include_unknown: f.age_include_unknown,
    };
}

function hasAnyFilter(f: DemoFilterState) {
    return (
        f.position_keywords.length > 0 ||
        f.position_levels.length > 0 ||
        f.positions.length > 0 ||
        f.companies.length > 0 ||
        f.countries.length > 0 ||
        f.regions.length > 0 ||
        f.hotel_ratings.length > 0 ||
        f.industry_group !== null ||
        f.industries.length > 0 ||
        f.current_only ||
        f.job_functions.length > 0 ||
        f.exclude_companies.length > 0 ||
        f.exclude_countries.length > 0 ||
        f.exclude_keywords.length > 0 ||
        f.genders.length > 0 ||
        f.nationalities.length > 0 ||
        f.age_min !== null ||
        f.age_max !== null
    );
}

// Load all static filter options in one call
export async function getDemoFilterOptions() {
    const [keywords, industries, countries, jobFunctions] = await Promise.all([
        adminAuthClient
            .from("position_keyword_vocab")
            .select("keyword, group_label")
            .order("group_label")
            .order("keyword"),
        adminAuthClient
            .from("industry_group")
            .select("group, industry")
            .order("group")
            .order("industry"),
        adminAuthClient
            .from("country")
            .select("country, region")
            .not("country", "is", null)
            .order("country"),
        adminAuthClient
            .from("Candidate Profile")
            .select("job_function")
            .not("job_function", "is", null)
            .neq("job_function", "")
            .neq("job_function", "Not found exp")
            .neq("job_function", "Unknown")
            .limit(3000),
    ]);

    const uniqueJobFunctions = [
        ...new Set((jobFunctions.data || []).map((r: any) => r.job_function as string)),
    ].sort();

    return {
        keywords:     (keywords.data   || []) as { keyword: string; group_label: string }[],
        industries:   (industries.data || []) as { group: string; industry: string }[],
        countries:    (countries.data  || []) as { country: string; region: string }[],
        jobFunctions: uniqueJobFunctions,
    };
}

// Cascading filter options — each field uses all OTHER filters (exclude-self), via RPC
export async function getCascadingFilterOptions(filters: DemoFilterState) {
    if (!hasAnyFilter(filters)) return null;

    const { data, error } = await (adminAuthClient as any).rpc(
        "get_cascading_options",
        toRpcParams(filters)
    );

    if (error || !data) return null;

    return data as {
        keywords:      string[];
        levels:        string[];
        positions:     string[];
        companies:     string[];
        countries:     string[];
        hotel_ratings: string[];
        regions:       string[];
        job_functions: string[];
        genders:       string[];
        nationalities: string[];
    };
}

// Search — returns all candidate_ids + summary stats (no profile fetch)
export async function searchDemoCandidates(filters: DemoFilterState) {
    if (!hasAnyFilter(filters)) return { candidateIds: [], total: 0, current: 0, past: 0, companies: 0 };

    const params = toRpcParams(filters);

    const [idsResult, summaryResult] = await Promise.all([
        (adminAuthClient as any).rpc("search_candidate_ids", params),
        (adminAuthClient as any).rpc("get_search_summary", params),
    ]);

    if (idsResult.error || !idsResult.data || (idsResult.data as any[]).length === 0)
        return { candidateIds: [], total: 0, current: 0, past: 0, companies: 0 };

    const candidateIds = (idsResult.data as { candidate_id: string }[]).map((r) => r.candidate_id);
    const stats = summaryResult.data as { total: number; current: number; companies: number } | null;
    const total     = stats?.total     ?? candidateIds.length;
    const current   = stats?.current   ?? 0;
    const companies = stats?.companies ?? 0;

    return { candidateIds, total, current, past: total - current, companies };
}

// Fetch profiles + experiences for a specific page of candidate_ids
export async function fetchCandidatePage(candidateIds: string[], page: number, pageSize: number) {
    const pageIds = candidateIds.slice((page - 1) * pageSize, page * pageSize);
    if (pageIds.length === 0) return [];

    const [profilesResult, experiencesResult] = await Promise.all([
        adminAuthClient
            .from("Candidate Profile")
            .select(`
                candidate_id, name, age, gender, nationality,
                photo, linkedin, checked, candidate_status,
                job_grouping, job_function, created_date, modify_date,
                year_of_bachelor_education
            `)
            .in("candidate_id", pageIds),
        adminAuthClient
            .from("candidate_experiences")
            .select("id, candidate_id, position, company, start_date, end_date, country, company_industry, is_current_job")
            .in("candidate_id", pageIds)
            .order("start_date", { ascending: false }),
    ]);

    const profiles = profilesResult.data || [];
    const expMap = new Map<string, any[]>();
    (experiencesResult.data || []).forEach((e: any) => {
        if (!expMap.has(e.candidate_id)) expMap.set(e.candidate_id, []);
        expMap.get(e.candidate_id)!.push(e);
    });

    return profiles.map((p: any) => ({ ...p, experiences: expMap.get(p.candidate_id) || [] }));
}

// Cohort analysis — aggregate skills/job_functions/languages for a set of candidate_ids
export async function getCohortAnalysis(candidateIds: string[]) {
    if (candidateIds.length === 0) return null;

    const { data, error } = await (adminAuthClient as any).rpc(
        "get_cohort_analysis",
        { p_candidate_ids: candidateIds }
    );

    if (error || !data) return null;
    return data as import("@/app/ai-search-demo/types").CohortAnalysis;
}

const N8N_AI_PARSE_URL = "https://n8n.srv1212906.hstgr.cloud/webhook/ai-parse-filters";

// Parse natural language query → filters + suggestions via n8n webhook
// n8n handles: code-based alias keyword matching + AI (Claude Haiku) for other filters
export async function parseQueryToFilters(query: string): Promise<AiParseResult> {
    try {
        const response = await fetch(N8N_AI_PARSE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
        });

        if (!response.ok) {
            console.error("n8n AI parse webhook failed:", response.statusText);
            return { filters: {}, suggestions: {} };
        }

        const data = await response.json();
        if (data.filters && data.suggestions) return data as AiParseResult;
        return { filters: {}, suggestions: {} };
    } catch (err: any) {
        console.error("AI parse error:", err?.message ?? err);
        return { filters: {}, suggestions: {} };
    }
}
