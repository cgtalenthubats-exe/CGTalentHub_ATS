"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export interface PopulationFilters {
    groups?: string[];
    industries?: string[];
    countries?: string[];
    continents?: string[];
    position_keywords?: string[];
    set_symbols?: string[];
    hotel_chains?: string[];
    job_groupings?: string[];
    job_functions?: string[];
}

export interface PopulationData {
    total_db: number;
    total_filtered: number;
    currently_employed: number;
    set_experienced: number;
    by_group: { name: string; count: number }[];
    by_industry: { name: string; count: number }[];
    by_country: { name: string; count: number }[];
    by_continent: { name: string; count: number }[];
    by_position_keyword: { name: string; count: number }[];
    by_age_range: { name: string; count: number }[];
    by_nationality: { name: string; count: number }[];
    nationality_unknown_count: number;
    by_hotel_chain: { name: string; count: number }[];
    by_set_company: { name: string; count: number }[];
    by_job_grouping: { name: string; count: number }[];
    by_job_function: { name: string; count: number }[];
}

export interface SetCompany {
    symbol: string;
    company_name: string;
    index_group: string;
    sector: string;
}

export interface PopulationFilterOptions {
    groups: string[];
    industries: string[];
    countries: string[];
    continents: string[];
    position_keywords: string[];
    set_companies: SetCompany[];
    hotel_chains: string[];
    job_groupings: string[];
    job_functions: string[];
}

// Cascading options — same shape minus set_companies (that dropdown's options are
// always the full SET-listed company list, not derived from experience rows).
export interface CascadingOptions {
    groups: string[];
    industries: string[];
    countries: string[];
    continents: string[];
    position_keywords: string[];
    hotel_chains: string[];
    job_groupings: string[];
    job_functions: string[];
}

export interface OrgChartGroupCount {
    name: string;
    count: number;
    subIndustries: { name: string; count: number }[];
}

export interface OrgChartGroupSummary {
    groups: OrgChartGroupCount[];
    // Uploads whose company has no group and no industry mapped at all, so
    // they can't be bucketed into any of the 6 groups — kept out of `groups`
    // but surfaced here so the total can be reconciled against Total Org.
    uncategorizedCount: number;
}

const SKIP = new Set(['Unknown', 'N/A', 'Not Found', 'No Match Found', 'Undetermined', 'Unclassified', 'Wait AI Check', 'Unassigned', 'Uncategorized', '', 'null']);

const AGE_BUCKET_ORDER = ["<30", "30–39", "40–49", "50–59", "60+", "Unknown"];

// ── Hotel chain resolution ───────────────────────────────────────────────────
// Ported from the ai-search-v3 / ai-search-demo hotel chain system
// (see docs/hotel_chain_system.md): company_master.hotel_chain_id points at a
// hotel_chain_master row that is almost always a SUB-BRAND (parent_id NOT
// NULL), not the parent chain itself — e.g. it points at "InterContinental",
// not "IHG Hotels & Resorts". So every lookup here resolves up to the parent
// chain's name, never uses the sub-brand name directly.
type HotelChainMaps = {
    parentNameByBrandId: Map<number, string>;
    brandIdsByParentName: Map<string, number[]>;
    allParentNames: string[];
};

async function loadHotelChainMaps(supabase: any): Promise<HotelChainMaps> {
    const { data } = await supabase.from('hotel_chain_master').select('brand_id, brand_name, parent_id');
    const rows: { brand_id: number; brand_name: string; parent_id: number | null }[] = data || [];
    const byId = new Map(rows.map(r => [r.brand_id, r]));

    const parentNameByBrandId = new Map<number, string>();
    const brandIdsByParentName = new Map<string, number[]>();

    for (const r of rows) {
        const parentRow = r.parent_id != null ? byId.get(r.parent_id) : r;
        const parentName = parentRow?.brand_name;
        if (!parentName) continue;
        parentNameByBrandId.set(r.brand_id, parentName);
        if (!brandIdsByParentName.has(parentName)) brandIdsByParentName.set(parentName, []);
        brandIdsByParentName.get(parentName)!.push(r.brand_id);
    }

    const allParentNames = [...new Set(rows.filter(r => r.parent_id == null).map(r => r.brand_name))].sort();
    return { parentNameByBrandId, brandIdsByParentName, allParentNames };
}

// Resolves selected parent chain names to the full set of hotel_chain_master
// brand_ids that count as "belonging to" that chain (the parent's own id plus
// every sub-brand's id) — needed since company_master.hotel_chain_id points at
// sub-brands.
function resolveChainBrandIds(chainMaps: HotelChainMaps, selectedNames: string[] | undefined): number[] {
    if (!selectedNames?.length) return [];
    const ids: number[] = [];
    for (const name of selectedNames) {
        for (const id of chainMaps.brandIdsByParentName.get(name) ?? []) ids.push(id);
    }
    return ids;
}

export async function getPopulationFilterOptions(): Promise<PopulationFilterOptions> {
    const supabase = adminAuthClient as any;

    const [countryRes, setRes, cmRes, expRes, chainMaps, cpRes] = await Promise.all([
        supabase.from('country').select('country, continent'),
        supabase.from('company_set_group').select('symbol, company_name, index_group, sector').order('symbol'),
        supabase.from('company_master').select('group, industry').range(0, 19999),
        supabase.from('candidate_experiences').select('country, position_keyword').range(0, 49999),
        loadHotelChainMaps(supabase),
        supabase.from('Candidate Profile').select('job_grouping, job_function').range(0, 9999),
    ]);

    const continents = [...new Set<string>((countryRes.data || []).map((r: any) => r.continent).filter(Boolean))].sort();
    const groups = [...new Set<string>((cmRes.data || []).map((r: any) => r.group).filter((g: any) => g && !SKIP.has(g)))].sort();
    const industries = [...new Set<string>((cmRes.data || []).map((r: any) => r.industry).filter((i: any) => i && !SKIP.has(i)))].sort();
    const countries = [...new Set<string>((expRes.data || []).map((r: any) => r.country).filter((c: any) => c && !SKIP.has(c)))].sort();
    const position_keywords = [...new Set<string>((expRes.data || []).map((r: any) => r.position_keyword).filter(Boolean))].sort();
    const job_groupings = [...new Set<string>((cpRes.data || []).map((r: any) => r.job_grouping).filter((g: any) => g && !SKIP.has(g)))].sort();
    const job_functions = [...new Set<string>((cpRes.data || []).map((r: any) => r.job_function).filter((f: any) => f && !SKIP.has(f)))].sort();

    return {
        groups, industries, countries, continents, position_keywords,
        set_companies: setRes.data || [],
        hotel_chains: chainMaps.allParentNames,
        job_groupings, job_functions,
    };
}

/**
 * Cascading filter options — for each dimension, computes the values still
 * reachable given every OTHER currently active filter (exclude-self, same
 * pattern as ai-search-demo's get_cascading_options RPC). Uses a single
 * bounded range fetch per dimension (not the full paginated loop the main
 * data query uses) since we only need the *distinct* values, not every row —
 * matches the precedent already set by getPopulationFilterOptions' one-shot
 * range(0, 49999) fetch.
 */
export async function getCascadingPopulationOptions(filters: PopulationFilters): Promise<CascadingOptions> {
    const supabase = adminAuthClient as any;

    const [countryRes, setRes, chainMaps, cpRes] = await Promise.all([
        supabase.from('country').select('country, continent'),
        filters.set_symbols?.length
            ? supabase.from('company_set_group').select('company_name').in('symbol', filters.set_symbols)
            : Promise.resolve({ data: [] }),
        loadHotelChainMaps(supabase),
        supabase.from('Candidate Profile').select('job_grouping, job_function').range(0, 9999),
    ]);
    const countryContinent = new Map<string, string>((countryRes.data || []).map((r: any) => [r.country, r.continent]));
    const filterChainBrandIds = resolveChainBrandIds(chainMaps, filters.hotel_chains);

    let filterSetIds: Set<number> | null = null;
    if (filters.set_symbols?.length) {
        const filtSetNames = (setRes.data || []).map((r: any) => r.company_name);
        if (filtSetNames.length) {
            const { data: filtCmData } = await supabase.from('company_master').select('company_id').in('company_master', filtSetNames);
            filterSetIds = new Set((filtCmData || []).map((r: any) => r.company_id));
        } else {
            filterSetIds = new Set();
        }
    }

    // Continents and countries are separate filter fields (not one merged "geo"
    // dimension) — selecting a continent must still narrow the country list,
    // and vice versa. The full combined list (used by every OTHER dimension's
    // query) includes both; each geo dimension's OWN query swaps in a version
    // that excludes just itself.
    const fullCountryFilter = [...(filters.countries || [])];
    if (filters.continents?.length) {
        (countryRes.data || [])
            .filter((r: any) => filters.continents!.includes(r.continent))
            .forEach((r: any) => { if (r.country && !fullCountryFilter.includes(r.country)) fullCountryFilter.push(r.country); });
    }
    // For the "countries" dimension: keep the continent constraint, drop the manual country selection.
    const countryFilterForCountries: string[] = [];
    if (filters.continents?.length) {
        (countryRes.data || [])
            .filter((r: any) => filters.continents!.includes(r.continent))
            .forEach((r: any) => { if (r.country && !countryFilterForCountries.includes(r.country)) countryFilterForCountries.push(r.country); });
    }
    // For the "continents" dimension: keep the manual country selection, drop the continent constraint.
    const countryFilterForContinents = [...(filters.countries || [])];

    type Omit_ = 'groups' | 'industries' | 'countries' | 'continents' | 'position_keywords' | 'hotel_chains';
    const buildQuery = (omit: Omit_) => {
        let q = supabase
            .from('candidate_experiences')
            .select('country, position_keyword, company_id, company_master!inner(industry, group, hotel_chain_id)')
            .not('company_master.industry', 'is', null);
        if (omit !== 'groups' && filters.groups?.length) q = q.in('company_master.group', filters.groups);
        if (omit !== 'industries' && filters.industries?.length) q = q.in('company_master.industry', filters.industries);
        const geoFilter = omit === 'countries' ? countryFilterForCountries : omit === 'continents' ? countryFilterForContinents : fullCountryFilter;
        if (geoFilter.length) q = q.in('country', geoFilter);
        if (omit !== 'position_keywords' && filters.position_keywords?.length) q = q.in('position_keyword', filters.position_keywords);
        if (omit !== 'hotel_chains' && filterChainBrandIds.length) q = q.in('company_master.hotel_chain_id', filterChainBrandIds);
        // hotel_chain_id is only populated for ~1,282 of ~20,769 companies — when
        // extracting the chain dimension itself, narrow to just those rows so the
        // bounded range() below doesn't get crowded out by the much larger
        // non-hotel experience volume and undercount available chains.
        if (omit === 'hotel_chains') q = q.not('company_master.hotel_chain_id', 'is', null);
        return q.range(0, 19999);
    };

    const [groupsRes, industriesRes, countriesRes, continentsRes, keywordsRes, chainsRes] = await Promise.all([
        buildQuery('groups'),
        buildQuery('industries'),
        buildQuery('countries'),
        buildQuery('continents'),
        buildQuery('position_keywords'),
        buildQuery('hotel_chains'),
    ]);

    const applySet = (rows: any[]) => filterSetIds !== null ? rows.filter(r => filterSetIds!.has(r.company_id)) : rows;

    const groups = [...new Set<string>(applySet(groupsRes.data || []).map((r: any) => r.company_master?.group).filter((g: any) => g && !SKIP.has(g)))].sort();
    const industries = [...new Set<string>(applySet(industriesRes.data || []).map((r: any) => r.company_master?.industry).filter((i: any) => i && !SKIP.has(i)))].sort();
    const position_keywords = [...new Set<string>(applySet(keywordsRes.data || []).map((r: any) => r.position_keyword).filter(Boolean))].sort();

    const countries = [...new Set<string>(applySet(countriesRes.data || []).map((r: any) => r.country).filter((c: any) => c && !SKIP.has(c)))].sort();
    const continents = [...new Set<string>(
        applySet(continentsRes.data || []).map((r: any) => r.country ? countryContinent.get(r.country) : null).filter(Boolean) as string[]
    )].sort();
    const hotel_chains = [...new Set<string>(
        applySet(chainsRes.data || []).map((r: any) => {
            const brandId = r.company_master?.hotel_chain_id;
            return brandId != null ? chainMaps.parentNameByBrandId.get(brandId) : null;
        }).filter(Boolean) as string[]
    )].sort();

    const job_groupings = [...new Set<string>((cpRes.data || []).map((r: any) => r.job_grouping).filter((g: any) => g && !SKIP.has(g)))].sort();
    const job_functions = [...new Set<string>((cpRes.data || []).map((r: any) => r.job_function).filter((f: any) => f && !SKIP.has(f)))].sort();

    return { groups, industries, countries, continents, position_keywords, hotel_chains, job_groupings, job_functions };
}

const EMPTY_POPULATION_DATA: PopulationData = {
    total_db: 0, total_filtered: 0, currently_employed: 0, set_experienced: 0,
    by_group: [], by_industry: [], by_country: [], by_continent: [], by_position_keyword: [],
    by_age_range: [], by_nationality: [], nationality_unknown_count: 0,
    by_hotel_chain: [], by_set_company: [],
    by_job_grouping: [], by_job_function: [],
};

/**
 * Server-side aggregation via the get_candidate_population_data Postgres RPC
 * (see migration create_get_candidate_population_data_rpc) — replaces an
 * earlier version that paginated the full candidate_experiences join (~48
 * sequential round-trips) into Node and aggregated with JS Maps. The RPC does
 * the same join + "latest experience per candidate" resolution + reliable-
 * work-country/based-in fallback + hotel-chain/SET-company matching in one
 * query, returning only the small aggregated result — same correctness,
 * far fewer round-trips and far less data over the wire.
 */
export async function getCandidatePopulationData(filters: PopulationFilters = {}): Promise<PopulationData> {
    const supabase = adminAuthClient as any;

    const { data, error } = await supabase.rpc('get_candidate_population_data', {
        p_groups: filters.groups ?? [],
        p_industries: filters.industries ?? [],
        p_countries: filters.countries ?? [],
        p_continents: filters.continents ?? [],
        p_position_keywords: filters.position_keywords ?? [],
        p_hotel_chains: filters.hotel_chains ?? [],
        p_set_symbols: filters.set_symbols ?? [],
        p_job_groupings: filters.job_groupings ?? [],
        p_job_functions: filters.job_functions ?? [],
    });

    if (error || !data) {
        console.error('get_candidate_population_data RPC error:', error);
        return EMPTY_POPULATION_DATA;
    }

    // SQL GROUP BY doesn't guarantee bucket order — reorder to the display order.
    const ageMap = new Map<string, number>((data.by_age_range ?? []).map((b: any) => [b.name, b.count]));
    const by_age_range = AGE_BUCKET_ORDER
        .map(name => ({ name, count: ageMap.get(name) ?? 0 }))
        .filter(b => b.count > 0);

    // "SYMBOL — Company Name" matches the display convention already used by
    // the SET Company filter dropdown.
    const by_set_company = (data.by_set_company ?? []).map((r: any) => ({
        name: `${r.symbol} — ${r.name}`,
        count: r.count,
    }));

    return {
        total_db: data.total_db ?? 0,
        total_filtered: data.total_filtered ?? 0,
        currently_employed: data.currently_employed ?? 0,
        set_experienced: data.set_experienced ?? 0,
        by_group: data.by_group ?? [],
        by_industry: data.by_industry ?? [],
        by_country: data.by_country ?? [],
        by_continent: data.by_continent ?? [],
        by_position_keyword: data.by_position_keyword ?? [],
        by_age_range,
        by_nationality: data.by_nationality ?? [],
        nationality_unknown_count: data.nationality_unknown_count ?? 0,
        by_hotel_chain: data.by_hotel_chain ?? [],
        by_set_company,
        by_job_grouping: data.by_job_grouping ?? [],
        by_job_function: data.by_job_function ?? [],
    };
}

// Each org_chart_uploads row is one org chart (matches the "Total Org" KPI
// card's count). Group is resolved the same way as the Org Chart Directory
// page: company_master.group first, falling back to industry_group's mapping
// when a company has an industry but no group set directly.
export async function getOrgChartCountsByGroup(): Promise<OrgChartGroupSummary> {
    const supabase = adminAuthClient as any;
    const empty: OrgChartGroupSummary = { groups: [], uncategorizedCount: 0 };

    const { data: uploads, error: uploadsErr } = await supabase.from('org_chart_uploads').select('company_id');
    if (uploadsErr || !uploads) {
        console.error('getOrgChartCountsByGroup uploads error:', uploadsErr);
        return empty;
    }

    const companyIds = [...new Set(uploads.map((u: any) => u.company_id).filter((id: any) => id != null))];
    if (!companyIds.length) return { groups: [], uncategorizedCount: uploads.length };

    const [{ data: companies }, { data: industryGroups }] = await Promise.all([
        supabase.from('company_master').select('company_id, group, industry').in('company_id', companyIds),
        supabase.from('industry_group').select('industry, group'),
    ]);

    const companyById = new Map<string, { group: string | null; industry: string | null }>(
        (companies || []).map((c: any) => [String(c.company_id), { group: c.group, industry: c.industry }])
    );
    const groupByIndustry = new Map<string, string>((industryGroups || []).map((ig: any) => [ig.industry, ig.group]));

    const groupCounts = new Map<string, number>();
    const groupSubIndustries = new Map<string, Map<string, number>>();
    let uncategorizedCount = 0;

    for (const u of uploads as { company_id: string | number | null }[]) {
        const company = u.company_id != null ? companyById.get(String(u.company_id)) : null;
        const industry = company?.industry?.trim() || null;
        const group = (company?.group?.trim() || (industry ? groupByIndustry.get(industry) : null) || '').trim();
        if (!group || SKIP.has(group)) {
            uncategorizedCount++;
            continue;
        }

        groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);

        if (industry && !SKIP.has(industry)) {
            if (!groupSubIndustries.has(group)) groupSubIndustries.set(group, new Map());
            const sub = groupSubIndustries.get(group)!;
            sub.set(industry, (sub.get(industry) ?? 0) + 1);
        }
    }

    const groups = [...groupCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
            name,
            count,
            subIndustries: [...(groupSubIndustries.get(name)?.entries() ?? [])]
                .sort((a, b) => b[1] - a[1])
                .map(([n, c]) => ({ name: n, count: c })),
        }));

    return { groups, uncategorizedCount };
}
