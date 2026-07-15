"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export interface PopulationFilters {
    groups?: string[];
    industries?: string[];
    countries?: string[];
    continents?: string[];
    position_keywords?: string[];
    set_symbols?: string[];
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
}

const SKIP = new Set(['Unknown', 'N/A', 'Not Found', 'No Match Found', 'Undetermined', 'Unclassified', 'Wait AI Check', 'Unassigned', '', 'null']);

export async function getPopulationFilterOptions(): Promise<PopulationFilterOptions> {
    const supabase = adminAuthClient as any;

    const [countryRes, setRes, cmRes, expRes] = await Promise.all([
        supabase.from('country').select('country, continent'),
        supabase.from('company_set_group').select('symbol, company_name, index_group, sector').order('symbol'),
        supabase.from('company_master').select('group, industry').range(0, 19999),
        supabase.from('candidate_experiences').select('country, position_keyword').range(0, 49999),
    ]);

    const continents = [...new Set<string>((countryRes.data || []).map((r: any) => r.continent).filter(Boolean))].sort();
    const groups = [...new Set<string>((cmRes.data || []).map((r: any) => r.group).filter((g: any) => g && !SKIP.has(g)))].sort();
    const industries = [...new Set<string>((cmRes.data || []).map((r: any) => r.industry).filter((i: any) => i && !SKIP.has(i)))].sort();
    const countries = [...new Set<string>((expRes.data || []).map((r: any) => r.country).filter((c: any) => c && !SKIP.has(c)))].sort();
    const position_keywords = [...new Set<string>((expRes.data || []).map((r: any) => r.position_keyword).filter(Boolean))].sort();

    return {
        groups, industries, countries, continents, position_keywords,
        set_companies: setRes.data || [],
    };
}

export async function getCandidatePopulationData(filters: PopulationFilters = {}): Promise<PopulationData> {
    const supabase = adminAuthClient as any;

    const [countryRes, totalDbRes, setRes] = await Promise.all([
        supabase.from('country').select('country, continent'),
        supabase.from('Candidate Profile').select('candidate_id', { count: 'exact', head: true }),
        supabase.from('company_set_group').select('company_name'),
    ]);

    const countryContinent = new Map<string, string>(
        (countryRes.data || []).map((r: any) => [r.country, r.continent])
    );

    // All SET company_ids for "set_experienced" count
    const allSetNames: string[] = (setRes.data || []).map((r: any) => r.company_name);
    let allSetIds = new Set<number>();
    if (allSetNames.length) {
        const { data: cmData } = await supabase.from('company_master').select('company_id').in('company_master', allSetNames);
        allSetIds = new Set((cmData || []).map((r: any) => r.company_id));
    }

    // Expand continent filter → country list
    const countryFilter = [...(filters.countries || [])];
    if (filters.continents?.length) {
        (countryRes.data || [])
            .filter((r: any) => filters.continents!.includes(r.continent))
            .forEach((r: any) => { if (r.country && !countryFilter.includes(r.country)) countryFilter.push(r.country); });
    }

    // Expand SET symbol filter → company_id set
    let filterSetIds: Set<number> | null = null;
    if (filters.set_symbols?.length) {
        const { data: filtSetData } = await supabase
            .from('company_set_group').select('company_name').in('symbol', filters.set_symbols);
        const filtSetNames = (filtSetData || []).map((r: any) => r.company_name);
        if (filtSetNames.length) {
            const { data: filtCmData } = await supabase.from('company_master').select('company_id').in('company_master', filtSetNames);
            filterSetIds = new Set((filtCmData || []).map((r: any) => r.company_id));
        } else {
            filterSetIds = new Set();
        }
    }

    // Build experience query (server-side group/industry/country/keyword filters)
    let expQuery = supabase
        .from('candidate_experiences')
        .select('candidate_id, country, position_keyword, company_id, is_current_job, company_master!inner(industry, group)')
        .not('company_master.industry', 'is', null);

    if (filters.groups?.length) expQuery = expQuery.in('company_master.group', filters.groups);
    if (filters.industries?.length) expQuery = expQuery.in('company_master.industry', filters.industries);
    if (countryFilter.length) expQuery = expQuery.in('country', countryFilter);
    if (filters.position_keywords?.length) expQuery = expQuery.in('position_keyword', filters.position_keywords);

    // Paginate through all matching experiences
    let allExp: any[] = [];
    const PAGE = 1000;
    let start = 0;
    while (true) {
        const { data, error } = await expQuery.range(start, start + PAGE - 1);
        if (error) { console.error('Population fetch error:', error); break; }
        if (data) allExp = [...allExp, ...data];
        if (!data || data.length < PAGE) break;
        start += PAGE;
    }

    // Apply in-memory SET filter if needed
    const experiences = filterSetIds !== null
        ? allExp.filter(e => filterSetIds!.has(e.company_id))
        : allExp;

    // Aggregate distinct candidates per dimension
    const candidateSet = new Set<string>();
    const currentSet = new Set<string>();
    const setExpSet = new Set<string>();
    const groupMap = new Map<string, Set<string>>();
    const industryMap = new Map<string, Set<string>>();
    const countryMap = new Map<string, Set<string>>();
    const continentMap = new Map<string, Set<string>>();
    const kwMap = new Map<string, Set<string>>();

    for (const e of experiences) {
        const cid = e.candidate_id;
        candidateSet.add(cid);
        if (e.is_current_job === 'Current') currentSet.add(cid);
        if (allSetIds.has(e.company_id)) setExpSet.add(cid);

        const group = e.company_master?.group;
        const industry = e.company_master?.industry;
        const country = e.country;
        const continent = country ? countryContinent.get(country) : null;
        const kw = e.position_keyword;

        if (group && !SKIP.has(group)) {
            if (!groupMap.has(group)) groupMap.set(group, new Set());
            groupMap.get(group)!.add(cid);
        }
        if (industry && !SKIP.has(industry)) {
            if (!industryMap.has(industry)) industryMap.set(industry, new Set());
            industryMap.get(industry)!.add(cid);
        }
        if (country && !SKIP.has(country)) {
            if (!countryMap.has(country)) countryMap.set(country, new Set());
            countryMap.get(country)!.add(cid);
        }
        if (continent) {
            if (!continentMap.has(continent)) continentMap.set(continent, new Set());
            continentMap.get(continent)!.add(cid);
        }
        if (kw) {
            if (!kwMap.has(kw)) kwMap.set(kw, new Set());
            kwMap.get(kw)!.add(cid);
        }
    }

    const toArr = (map: Map<string, Set<string>>, limit = 15) =>
        [...map.entries()]
            .map(([name, ids]) => ({ name, count: ids.size }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);

    return {
        total_db: totalDbRes.count || 0,
        total_filtered: candidateSet.size,
        currently_employed: currentSet.size,
        set_experienced: setExpSet.size,
        by_group: toArr(groupMap, 10),
        by_industry: toArr(industryMap, 15),
        by_country: toArr(countryMap, 15),
        by_continent: toArr(continentMap, 10),
        by_position_keyword: toArr(kwMap, 15),
    };
}
