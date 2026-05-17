"use server";

import Anthropic from "@anthropic-ai/sdk";
import { adminAuthClient } from "@/lib/supabase/admin";
import { type DemoFilterState, type AiParseResult, type AiSuggestions } from "@/app/ai-search-demo/types";

const anthropic = new Anthropic();

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
        p_hotel_chains:       f.hotel_chains,
        p_industry_group:     f.industry_group ?? null,
        p_industries:         f.industries,
        p_current_only:       f.current_only,
        p_job_functions:      f.job_functions,
        p_exclude_companies:  f.exclude_companies,
        p_exclude_countries:  f.exclude_countries,
        p_exclude_keywords:   f.exclude_keywords,
        p_hotel_sub_brands:   f.hotel_sub_brands,
        p_genders:            f.genders,
        p_nationalities:      f.nationalities,
        p_age_min:            f.age_min ?? null,
        p_age_max:            f.age_max ?? null,
        p_age_include_unknown: f.age_include_unknown,
        p_current_and_latest:  f.current_and_latest,
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
        f.hotel_chains.length > 0 ||
        f.industry_group !== null ||
        f.industries.length > 0 ||
        f.current_only ||
        f.job_functions.length > 0 ||
        f.exclude_companies.length > 0 ||
        f.exclude_countries.length > 0 ||
        f.exclude_keywords.length > 0 ||
        f.hotel_sub_brands.length > 0 ||
        f.genders.length > 0 ||
        f.nationalities.length > 0 ||
        f.age_min !== null ||
        f.age_max !== null
    );
}

// Load all static filter options in one call
export async function getDemoFilterOptions() {
    const [keywords, industries, countries, jobFunctions, hotelChains, chainCounts, subBrandsResult] = await Promise.all([
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
        (adminAuthClient as any).rpc("get_distinct_job_functions"),
        adminAuthClient
            .from("hotel_chain_master")
            .select("brand_id, brand_name")
            .is("parent_id", null)
            .order("brand_name"),
        (adminAuthClient as any).rpc("get_chain_candidate_counts"),
        adminAuthClient
            .from("hotel_chain_master")
            .select("brand_name, parent_id")
            .not("parent_id", "is", null)
            .order("brand_name"),
    ]);

    const uniqueJobFunctions = (jobFunctions.data || []).map((r: any) => r.job_function as string);
    const hotelChainNames = (hotelChains.data || []).map((r: any) => r.brand_name as string);
    const chainCountData = (chainCounts.data || []).map((r: any) => ({
        chain_name: r.chain_name as string,
        candidate_count: Number(r.candidate_count),
    }));

    // Build id→name map for parent chains, then chain→sub-brands mapping
    // Use String() to normalize id type (Supabase can return bigint as string)
    const parentIdToName = new Map<string, string>(
        (hotelChains.data || []).map((r: any) => [String(r.brand_id), r.brand_name as string])
    );
    const subBrandsByChain: Record<string, string[]> = {};
    (subBrandsResult.data || []).forEach((r: any) => {
        const chainName = parentIdToName.get(String(r.parent_id));
        if (!chainName) return;
        if (!subBrandsByChain[chainName]) subBrandsByChain[chainName] = [];
        subBrandsByChain[chainName].push(r.brand_name as string);
    });

    return {
        keywords:        (keywords.data   || []) as { keyword: string; group_label: string }[],
        industries:      (industries.data || []) as { group: string; industry: string }[],
        countries:       (countries.data  || []) as { country: string; region: string }[],
        jobFunctions:    uniqueJobFunctions,
        hotelChains:     hotelChainNames,
        chainCounts:     chainCountData,
        subBrandsByChain,
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
        hotel_chains:  string[];
        sub_brands:    string[];
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
        (adminAuthClient as any).rpc("search_candidate_ids", params).limit(50000),
        (adminAuthClient as any).rpc("get_search_summary", params),
    ]);

    if (idsResult.error || !idsResult.data || (idsResult.data as any[]).length === 0)
        return { candidateIds: [], total: 0, current: 0, past: 0, companies: 0 };

    const candidateIds = (idsResult.data as { candidate_id: string }[]).map((r) => r.candidate_id);
    const stats = summaryResult.data as { total: number; current: number; companies: number; countries: number } | null;
    const total     = stats?.total     ?? candidateIds.length;
    const current   = stats?.current   ?? 0;
    const companies = stats?.companies ?? 0;
    const countries = stats?.countries ?? 0;

    return { candidateIds, total, current, past: total - current, companies, countries };
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
            .select("id, candidate_id, position, company, company_id, start_date, end_date, country, company_industry, is_current_job")
            .in("candidate_id", pageIds)
            .order("start_date", { ascending: false }),
    ]);

    const experiences = experiencesResult.data || [];

    // Enrich experiences with hotel chain + rating
    const companyIds = [...new Set(experiences.map((e: any) => e.company_id).filter(Boolean))] as number[];
    const chainMap = new Map<number, { chain_name: string | null; effective_rating: string | null }>();
    if (companyIds.length > 0) {
        const { data: chainData } = await (adminAuthClient as any).rpc("get_company_chain_info", { p_company_ids: companyIds });
        (chainData || []).forEach((r: any) => {
            chainMap.set(r.company_id, { chain_name: r.chain_name, effective_rating: r.effective_rating });
        });
    }

    const enrichedExperiences = experiences.map((e: any) => ({
        ...e,
        hotel_chain_name: chainMap.get(e.company_id)?.chain_name ?? null,
        hotel_rating:     chainMap.get(e.company_id)?.effective_rating ?? null,
    }));

    const profiles = profilesResult.data || [];
    const expMap = new Map<string, any[]>();
    enrichedExperiences.forEach((e: any) => {
        if (!expMap.has(e.candidate_id)) expMap.set(e.candidate_id, []);
        expMap.get(e.candidate_id)!.push(e);
    });

    return profiles.map((p: any) => ({ ...p, experiences: expMap.get(p.candidate_id) || [] }));
}

// Position autocomplete — DISTINCT positions via RPC (up to 200), optionally scoped to matching candidates
export async function searchPositionSuggestions(query: string, filters?: DemoFilterState): Promise<string[]> {
    const q = query?.trim() ?? "";
    if (q.length === 1) return [];

    const scopedFilters = filters ? { ...filters, positions: [] } : null;
    const useScope = scopedFilters && hasAnyFilter(scopedFilters);

    if (useScope) {
        const { data: ids } = await (adminAuthClient as any).rpc("search_candidate_ids", toRpcParams(scopedFilters!));
        if (!ids || (ids as any[]).length === 0) return [];
        const candidateIds = (ids as { candidate_id: string }[]).map(r => r.candidate_id);
        const { data } = await (adminAuthClient as any).rpc("suggest_positions", { p_query: q, p_candidate_ids: candidateIds });
        return (data || []).map((r: any) => r.pos as string);
    }

    const { data } = await (adminAuthClient as any).rpc("suggest_positions", { p_query: q });
    return (data || []).map((r: any) => r.pos as string);
}

// Company autocomplete — DISTINCT companies via RPC (up to 200), optionally scoped to matching candidates
export async function searchCompanySuggestions(query: string, filters?: DemoFilterState): Promise<string[]> {
    const q = query?.trim() ?? "";
    if (q.length === 1) return [];

    const scopedFilters = filters ? { ...filters, companies: [], exclude_companies: [] } : null;
    const useScope = scopedFilters && hasAnyFilter(scopedFilters);

    if (useScope) {
        const { data: ids } = await (adminAuthClient as any).rpc("search_candidate_ids", toRpcParams(scopedFilters!));
        if (!ids || (ids as any[]).length === 0) return [];
        const candidateIds = (ids as { candidate_id: string }[]).map(r => r.candidate_id);
        const { data } = await (adminAuthClient as any).rpc("suggest_companies", { p_query: q, p_candidate_ids: candidateIds });
        return (data || []).map((r: any) => r.co as string);
    }

    const { data } = await (adminAuthClient as any).rpc("suggest_companies", { p_query: q });
    return (data || []).map((r: any) => r.co as string);
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

// Parse natural language query → filters + suggestions directly via Anthropic SDK
// Replicates n8n "AI Parse Filters" workflow: keyword alias match → Claude Haiku → normalize
export async function parseQueryToFilters(query: string): Promise<AiParseResult> {
    try {
        const [vocabRes, countriesRes, industriesRes, jobFnsRes] = await Promise.all([
            adminAuthClient.from("position_keyword_vocab").select("keyword, aliases"),
            adminAuthClient.from("country").select("country, region").not("country", "is", null),
            adminAuthClient.from("industry_group").select("group, industry"),
            (adminAuthClient as any).rpc("get_distinct_job_functions"),
        ]);

        const keywordVocab = (vocabRes.data ?? []) as { keyword: string; aliases: string }[];
        const countriesData = (countriesRes.data ?? []) as { country: string; region: string }[];
        const industriesData = (industriesRes.data ?? []) as { group: string; industry: string }[];
        const jobFunctions = ((jobFnsRes.data ?? []) as any[]).map((r) => r.job_function as string);

        const allCountries = countriesData.map((c) => c.country);
        const allRegions = [...new Set(countriesData.map((c) => c.region).filter(Boolean))];
        const allIndustryGroups = [...new Set(industriesData.map((d) => d.group))];
        const allIndustries = industriesData.map((d) => d.industry);
        const allKeywords = keywordVocab.map((k) => k.keyword);

        // Step 1: substring-match keywords + aliases (same logic as n8n "Match Keywords" node)
        const q = query.toLowerCase();
        const matched_keywords: string[] = [];
        for (const kw of keywordVocab) {
            const aliasList = kw.aliases
                ? kw.aliases.split(",").map((a) => a.trim().toLowerCase())
                : [];
            const terms = [kw.keyword.toLowerCase(), ...aliasList];
            if (terms.some((t) => q.includes(t))) matched_keywords.push(kw.keyword);
        }

        // Step 2: build system prompt with all allowed values as context
        const systemPrompt = `You are a search filter extractor for a hospitality talent database.

Extract structured filters from the user's natural language query and return ONLY a JSON object.

## Output format (return this exact structure)
{
  "filters": { ...values EXPLICITLY stated in the query },
  "suggestions": { ...additional values you recommend to broaden results }
}

## Filter fields and allowed values

position_levels (string[]): ${JSON.stringify(["C-Level", "VP", "Director", "Manager", "Supervisor", "Staff"])}

countries (string[]): ${JSON.stringify(allCountries)}

regions (string[]): ${JSON.stringify(allRegions)}

hotel_ratings (string[]): ["3 Star", "4 Star", "5 Star"]

industry_group (string | null): ${JSON.stringify(allIndustryGroups)}

industries (string[]): ${JSON.stringify(allIndustries)}

job_functions (string[]): ${JSON.stringify(jobFunctions)}

genders (string[]): ["Male", "Female"]

current_only (boolean): true if user mentions "current", "currently working at", "now at"

exclude_companies (string[]): company names to exclude (user says "not at X" or "exclude X")
exclude_countries (string[]): country names to exclude
exclude_keywords (string[]): keyword labels to exclude (from: ${JSON.stringify(allKeywords)})

## Rules
- Only use values from the allowed lists above. Never invent values.
- "filters" = what the user explicitly said. "suggestions" = related values worth trying.
- Do NOT include position_keywords in your output — handled separately.
- Return empty objects {} if nothing applies.
- Return ONLY the JSON object, no explanation.`;

        // Step 3: call Claude Haiku directly
        const message = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1500,
            system: systemPrompt,
            messages: [{ role: "user", content: query }],
        });

        const text = message.content[0]?.type === "text" ? message.content[0].text : "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return { filters: {}, suggestions: {} };

        const parsed = JSON.parse(jsonMatch[0]) as { filters?: any; suggestions?: any };

        // Step 4: normalize — ensure arrays are arrays, strings are strings
        const filters = normalizeFilterShape(parsed.filters ?? {});
        const suggestions = normalizeFilterShape(parsed.suggestions ?? {}) as AiSuggestions;

        // Merge alias-matched keywords into filters
        if (matched_keywords.length > 0) {
            const existing = Array.isArray(filters.position_keywords) ? filters.position_keywords : [];
            filters.position_keywords = [...new Set([...existing, ...matched_keywords])];
        }

        return { filters, suggestions };
    } catch (err: any) {
        console.error("AI parse error:", err?.message ?? err);
        return { filters: {}, suggestions: {} };
    }
}

function normalizeFilterShape(raw: Record<string, any>): Partial<DemoFilterState> {
    const ensureArr = (v: any): string[] =>
        Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    return {
        ...(raw.position_keywords !== undefined && { position_keywords: ensureArr(raw.position_keywords) }),
        ...(raw.position_levels !== undefined && { position_levels: ensureArr(raw.position_levels) }),
        ...(raw.countries !== undefined && { countries: ensureArr(raw.countries) }),
        ...(raw.regions !== undefined && { regions: ensureArr(raw.regions) }),
        ...(raw.hotel_ratings !== undefined && { hotel_ratings: ensureArr(raw.hotel_ratings) }),
        ...(raw.industries !== undefined && { industries: ensureArr(raw.industries) }),
        ...(raw.job_functions !== undefined && { job_functions: ensureArr(raw.job_functions) }),
        ...(raw.genders !== undefined && { genders: ensureArr(raw.genders) }),
        ...(raw.nationalities !== undefined && { nationalities: ensureArr(raw.nationalities) }),
        ...(raw.exclude_companies !== undefined && { exclude_companies: ensureArr(raw.exclude_companies) }),
        ...(raw.exclude_countries !== undefined && { exclude_countries: ensureArr(raw.exclude_countries) }),
        ...(raw.exclude_keywords !== undefined && { exclude_keywords: ensureArr(raw.exclude_keywords) }),
        ...(raw.industry_group !== undefined && typeof raw.industry_group === "string" && { industry_group: raw.industry_group }),
        ...(raw.current_only === true && { current_only: true }),
    };
}
