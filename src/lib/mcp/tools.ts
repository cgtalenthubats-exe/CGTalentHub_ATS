import { z } from "zod";
import { adminAuthClient } from "@/lib/supabase/admin";

// Read-only MCP tools (phase 1). Nothing here writes to the DB.
const db = adminAuthClient as any;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_IDS = 50000;
const QUERY_TIMEOUT_MS = 25_000;

const sig = () => AbortSignal.timeout(QUERY_TIMEOUT_MS);

export function ok(data: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

export function fail(message: string) {
    return { isError: true, content: [{ type: "text" as const, text: message }] };
}

const arr = () => z.array(z.string()).default([]);

export const filterShape = {
    position_search: arr().describe("Free-text position terms (ilike on position + position_keyword), e.g. ['General Manager','Hotel Manager']"),
    position_keywords: arr(),
    position_levels: arr(),
    positions: arr().describe("Exact position titles"),
    companies: arr(),
    exclude_companies: arr(),
    countries: arr().describe("Work country (from experiences)"),
    exclude_countries: arr(),
    based_in_countries: arr().describe("Current residence country"),
    regions: arr(),
    hotel_chains: arr().describe("Parent chain names e.g. 'IHG Hotels & Resorts'"),
    hotel_sub_brands: arr(),
    hotel_ratings: arr().describe("'3 Star' | '4 Star' | '5 Star' | 'Unknown'"),
    industry_group: z.string().nullable().default(null),
    industries: arr(),
    job_functions: arr(),
    exclude_keywords: arr(),
    genders: arr(),
    nationalities: arr(),
    age_min: z.number().nullable().default(null),
    age_max: z.number().nullable().default(null),
    current_only: z.boolean().default(false).describe("Only candidates currently in a matching role"),
    current_and_latest: z.boolean().default(true),
    internal_only: z.boolean().default(false),
};

export const filterSchema = z.object(filterShape);
export type McpFilters = z.infer<typeof filterSchema>;

function toRpcParams(f: McpFilters) {
    return {
        p_position_keywords: f.position_keywords,
        p_position_levels: f.position_levels,
        p_positions: f.positions,
        p_companies: f.companies,
        p_countries: f.countries,
        p_based_in_countries: f.based_in_countries,
        p_regions: f.regions,
        p_hotel_ratings: f.hotel_ratings,
        p_hotel_chains: f.hotel_chains,
        p_industry_group: f.industry_group ?? null,
        p_industries: f.industries,
        p_current_only: f.current_only,
        p_job_functions: f.job_functions,
        p_exclude_companies: f.exclude_companies,
        p_exclude_countries: f.exclude_countries,
        p_exclude_keywords: f.exclude_keywords,
        p_hotel_sub_brands: f.hotel_sub_brands,
        p_genders: f.genders,
        p_nationalities: f.nationalities,
        p_age_min: f.age_min ?? null,
        p_age_max: f.age_max ?? null,
        p_age_include_unknown: true,
        p_current_and_latest: f.current_and_latest,
        p_position_search: f.position_search.slice(0, 80),
        p_internal_only: f.internal_only,
    };
}

function hasAnyFilter(f: McpFilters) {
    return (
        f.position_search.length || f.position_keywords.length || f.position_levels.length ||
        f.positions.length || f.companies.length || f.countries.length || f.based_in_countries.length ||
        f.regions.length || f.hotel_ratings.length || f.hotel_chains.length || f.hotel_sub_brands.length ||
        f.industry_group || f.industries.length || f.job_functions.length || f.genders.length ||
        f.nationalities.length || f.age_min != null || f.age_max != null || f.internal_only
    );
}

const pageArgs = {
    limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe(`Rows per page (max ${MAX_LIMIT})`),
    offset: z.number().int().min(0).default(0),
};

function page<T>(rows: T[], total: number, limit: number, offset: number) {
    return { total, limit, offset, returned: rows.length, has_more: offset + rows.length < total, rows };
}

export const searchCandidates = {
    name: "search_candidates",
    config: {
        title: "Search candidates",
        description:
            "Search candidates with the same filter engine as /ai-search-demo. At least one filter is required. " +
            "Returns summary counts (total/current/companies/countries) plus one page of candidates with their " +
            "current/latest experience. Use offset to page through results; check has_more.",
        inputSchema: z.object({ ...filterShape, ...pageArgs }),
    },
    handler: async (args: McpFilters & { limit: number; offset: number }) => {
        if (!hasAnyFilter(args)) return fail("Provide at least one filter.");
        const params = toRpcParams(args);

        const [idsRes, sumRes] = await Promise.all([
            db.rpc("search_candidate_ids", params).limit(MAX_IDS).abortSignal(sig()),
            db.rpc("get_search_summary", params).abortSignal(sig()),
        ]);
        if (idsRes.error) return fail(`search failed: ${idsRes.error.message}`);

        const allIds: string[] = (idsRes.data ?? []).map((r: any) => r.candidate_id);
        const stats = sumRes.data ?? {};
        const total = allIds.length;
        const pageIds = allIds.slice(args.offset, args.offset + args.limit);

        let rows: any[] = [];
        if (pageIds.length) {
            const [profiles, exps] = await Promise.all([
                db.from("Candidate Profile")
                    .select("candidate_id,name,photo,gender,nationality,age,job_function,candidate_status,linkedin")
                    .in("candidate_id", pageIds).abortSignal(sig()),
                db.from("candidate_experiences")
                    .select("candidate_id,position,company,country,is_current_job,is_primary_current,start_date,end_date,position_level")
                    .in("candidate_id", pageIds).order("start_date", { ascending: false }).abortSignal(sig()),
            ]);
            if (profiles.error) return fail(`profile fetch failed: ${profiles.error.message}`);
            const byId = new Map<string, any>((profiles.data ?? []).map((p: any) => [p.candidate_id, p]));
            const expBy = new Map<string, any[]>();
            for (const e of exps.data ?? []) {
                if (!expBy.has(e.candidate_id)) expBy.set(e.candidate_id, []);
                expBy.get(e.candidate_id)!.push(e);
            }
            rows = pageIds.map((id) => {
                const list = expBy.get(id) ?? [];
                const latest = list.find((e) => e.is_primary_current === "Yes" || e.is_primary_current === true)
                    ?? list.find((e) => String(e.is_current_job).toLowerCase() === "yes" || e.is_current_job === true)
                    ?? list[0] ?? null;
                return { ...(byId.get(id) ?? { candidate_id: id }), latest_experience: latest };
            });
        }
        return ok({ summary: { ...stats, total }, ...page(rows, total, args.limit, args.offset) });
    },
};

export const getCandidateProfile = {
    name: "get_candidate_profile",
    config: {
        title: "Get candidate profile",
        description:
            "Full profile of one candidate: profile fields (incl. photo URL, LinkedIn, compensation), all work experiences, " +
            "and the JRs they are in with status.",
        inputSchema: z.object({ candidate_id: z.string() }),
    },
    handler: async ({ candidate_id }: { candidate_id: string }) => {
        const [p, e, j] = await Promise.all([
            db.from("Candidate Profile").select("*").eq("candidate_id", candidate_id).maybeSingle().abortSignal(sig()),
            db.from("candidate_experiences")
                .select("position,company,company_id,country,city,work_location,start_date,end_date,is_current_job,position_keyword,position_level,company_industry,description:note")
                .eq("candidate_id", candidate_id).order("start_date", { ascending: false }).abortSignal(sig()),
            db.from("jr_candidates")
                .select("jr_candidate_id,jr_id,list_type,rank,temp_status,head_recruit_feedback")
                .eq("candidate_id", candidate_id).abortSignal(sig()),
        ]);
        if (p.error) return fail(p.error.message);
        if (!p.data) return fail(`candidate ${candidate_id} not found`);
        return ok({ profile: p.data, experiences: e.data ?? [], jrs: j.data ?? [] });
    },
};

export const listJrs = {
    name: "list_jrs",
    config: {
        title: "List job requisitions",
        description: "List JRs, newest first. Optional text search on position/JR id and BU filters.",
        inputSchema: z.object({
            search: z.string().optional().describe("Matches jr_id or position_jr"),
            bu: z.string().optional(),
            sub_bu: z.string().optional(),
            active_only: z.boolean().default(false),
            ...pageArgs,
        }),
    },
    handler: async (a: { search?: string; bu?: string; sub_bu?: string; active_only: boolean; limit: number; offset: number }) => {
        let q = db.from("job_requisitions")
            .select("jr_id,position_jr,bu,sub_bu,jr_type,is_active,request_date,closed_date,create_by,budget_min,budget_max,jr_note", { count: "exact" })
            .order("jr_number", { ascending: false })
            .range(a.offset, a.offset + a.limit - 1);
        if (a.search) {
            const s = a.search.replace(/[%,()]/g, " ").trim();
            q = q.or(`jr_id.ilike.%${s}%,position_jr.ilike.%${s}%`);
        }
        if (a.bu) q = q.eq("bu", a.bu);
        if (a.sub_bu) q = q.eq("sub_bu", a.sub_bu);
        if (a.active_only) q = q.eq("is_active", "Active");
        const { data, count, error } = await q.abortSignal(sig());
        if (error) return fail(error.message);
        return ok(page(data ?? [], count ?? 0, a.limit, a.offset));
    },
};

export const getJr = {
    name: "get_jr",
    config: {
        title: "Get job requisition",
        description:
            "One JR with its pipeline: counts per status and a page of its candidates (name, photo, status, list_type, rank), plus job description.",
        inputSchema: z.object({
            jr_id: z.string().describe("e.g. JR000214"),
            status: z.string().optional().describe("Filter candidates by temp_status"),
            ...pageArgs,
        }),
    },
    handler: async (a: { jr_id: string; status?: string; limit: number; offset: number }) => {
        const jrRes = await db.from("job_requisitions").select("*").eq("jr_id", a.jr_id).maybeSingle().abortSignal(sig());
        if (jrRes.error) return fail(jrRes.error.message);
        if (!jrRes.data) return fail(`JR ${a.jr_id} not found`);

        const all = await db.from("jr_candidates")
            .select("jr_candidate_id,candidate_id,list_type,rank,temp_status,temp_note,head_recruit_feedback,time_stamp")
            .eq("jr_id", a.jr_id).limit(5000).abortSignal(sig());
        if (all.error) return fail(all.error.message);

        const rowsAll: any[] = all.data ?? [];
        const statusCounts: Record<string, number> = {};
        for (const r of rowsAll) statusCounts[r.temp_status ?? "Unknown"] = (statusCounts[r.temp_status ?? "Unknown"] ?? 0) + 1;

        const filtered = a.status ? rowsAll.filter((r) => r.temp_status === a.status) : rowsAll;
        filtered.sort((x, y) => (x.rank ?? 1e9) - (y.rank ?? 1e9));
        const slice = filtered.slice(a.offset, a.offset + a.limit);

        let candidates = slice;
        if (slice.length) {
            const { data: profs } = await db.from("Candidate Profile")
                .select("candidate_id,name,photo,job_function,candidate_status,linkedin")
                .in("candidate_id", slice.map((r) => r.candidate_id)).abortSignal(sig());
            const byId = new Map<string, any>((profs ?? []).map((p: any) => [p.candidate_id, p]));
            candidates = slice.map((r) => ({ ...r, candidate: byId.get(r.candidate_id) ?? null }));
        }
        return ok({
            jr: jrRes.data,
            status_counts: statusCounts,
            total_candidates: rowsAll.length,
            candidates: page(candidates, filtered.length, a.limit, a.offset),
        });
    },
};

export const tools = [searchCandidates, getCandidateProfile, listJrs, getJr];
