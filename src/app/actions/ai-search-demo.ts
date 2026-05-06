"use server";

import Anthropic from "@anthropic-ai/sdk";
import { adminAuthClient } from "@/lib/supabase/admin";
import { POSITION_LEVELS, HOTEL_RATINGS, type DemoFilterState, type AiParseResult } from "@/app/ai-search-demo/types";

// helper: convert DemoFilterState to RPC params
function toRpcParams(f: DemoFilterState) {
    return {
        p_position_keywords: f.position_keywords,
        p_position_levels:   f.position_levels,
        p_positions:         f.positions,
        p_companies:         f.companies,
        p_countries:         f.countries,
        p_regions:           f.regions,
        p_hotel_ratings:     f.hotel_ratings,
        p_industry_group:    f.industry_group ?? null,
        p_industries:        f.industries,
        p_current_only:      f.current_only,
        p_job_functions:     f.job_functions,
        p_exclude_companies: f.exclude_companies,
        p_exclude_countries: f.exclude_countries,
        p_exclude_keywords:  f.exclude_keywords,
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
        f.exclude_keywords.length > 0
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

// Parse natural language query → filters + suggestions using Claude
export async function parseQueryToFilters(query: string): Promise<AiParseResult> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Fetch vocab from DB in parallel
    const [keywordsRes, industriesRes, countriesRes, jobFunctionsRes] = await Promise.all([
        adminAuthClient.from("position_keyword_vocab").select("keyword, aliases, group_label").order("group_label").order("keyword"),
        adminAuthClient.from("industry_group").select("group, industry").order("group").order("industry"),
        adminAuthClient.from("country").select("country, region").not("country", "is", null).order("country"),
        adminAuthClient.from("Candidate Profile").select("job_function").not("job_function", "is", null).neq("job_function", "").neq("job_function", "Not found exp").neq("job_function", "Unknown").limit(3000),
    ]);

    const keywordRows = (keywordsRes.data || []) as { keyword: string; aliases: string | null; group_label: string }[];
    const keywords = keywordRows.map((k) => k.keyword);
    const keywordsWithAliases = keywordRows.map((k) =>
        k.aliases ? `${k.keyword} (aliases: ${k.aliases})` : k.keyword
    );
    const industryGroups = [...new Set((industriesRes.data || []).map((i: any) => i.group as string))];
    const industries = (industriesRes.data || []).map((i: any) => i.industry as string);
    const regions = [...new Set((countriesRes.data || []).map((c: any) => c.region as string).filter(Boolean))].sort();
    const countries = (countriesRes.data || []).map((c: any) => c.country as string);
    const jobFunctions = [...new Set((jobFunctionsRes.data || []).map((r: any) => r.job_function as string))].sort();

    const systemPrompt = `You are a hospitality & recruitment search assistant. Parse a natural language search query into filter criteria AND expansion suggestions.

Return ONLY a valid JSON object in this exact shape (no markdown, no explanation):
{
  "filters": {
    "position_keywords": string[],
    "position_levels": string[],
    "industry_group": string | null,
    "industries": string[],
    "regions": string[],
    "countries": string[],
    "hotel_ratings": string[],
    "current_only": boolean,
    "job_functions": string[],
    "positions": [],
    "companies": [],
    "exclude_companies": string[],
    "exclude_countries": string[],
    "exclude_keywords": string[]
  },
  "suggestions": {
    "position_keywords": string[],
    "position_levels": string[],
    "industries": string[],
    "regions": string[],
    "countries": string[],
    "hotel_ratings": string[],
    "job_functions": string[]
  }
}

FILTERS = values you are HIGHLY confident the user wants from their query.
SUGGESTIONS = values the user did NOT explicitly mention, but could expand or refine their search (similar roles, nearby regions, adjacent star ratings, etc.). Must NOT overlap with filters. Max 5 items per field.
EXCLUDE fields = use when user says "exclude", "not", "except", "ยกเว้น", "ไม่เอา" — put those values in exclude_* fields, NOT in the include fields.

Allowed values:
- position_keywords (use EXACT keyword value, aliases shown for matching user input): ${JSON.stringify(keywordsWithAliases)}
- position_levels: ${JSON.stringify(POSITION_LEVELS)}
- industry_group (filters only): one of ${JSON.stringify(industryGroups)} or null
- industries: ${JSON.stringify(industries)}
- regions: ${JSON.stringify(regions)}
- countries: ${JSON.stringify(countries)}
- hotel_ratings: ${JSON.stringify(HOTEL_RATINGS)}
- job_functions: ${JSON.stringify(jobFunctions)}

Rules:
- Use EXACT keyword strings from allowed values only (not aliases)
- Match user input against aliases to find the correct keyword, then return the keyword
- Use empty arrays [] for fields not applicable
- For regions, prefer region over listing individual countries
- Industry mapping warnings:
  · "F&B", "Food and Beverage", "Restaurant" → industry_group = "Retail / FMCG / F&B" (NOT Hospitality)
  · "Luxury hotel", "5-star hotel", "5 star" → use hotel_ratings filter, NOT industry field
  · "Hospital", "Healthcare", "Pharma" → industry_group = "Others" (no dedicated group)
- Return ONLY the JSON, no other text`;

    const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: query }],
        system: systemPrompt,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    const tryParse = (raw: string): AiParseResult | null => {
        try {
            const parsed = JSON.parse(raw.trim());
            if (parsed.filters && parsed.suggestions) return parsed as AiParseResult;
            // If AI returned flat filters without wrapper, wrap it
            return { filters: parsed as Partial<DemoFilterState>, suggestions: {} };
        } catch {
            return null;
        }
    };

    const result = tryParse(text) ?? (() => {
        const match = text.match(/\{[\s\S]*\}/);
        return match ? tryParse(match[0]) : null;
    })();

    return result ?? { filters: {}, suggestions: {} };
}
