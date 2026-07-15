"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export interface FunnelFilters {
    countries?: string[];
    regions?: string[];
    position_keywords?: string[];
    age_min?: number;
    age_max?: number;
    current_only?: boolean;
}

export interface FunnelGroup {
    name: string;
    count: number;
}

export interface FunnelIndustry {
    name: string;
    count: number;
    groups: FunnelGroup[];
}

export interface FunnelData {
    total: number;
    industries: FunnelIndustry[];
    filter_options: {
        countries: string[];
        regions: string[];
        position_keywords: string[];
    };
}

export async function getCandidateFunnelData(filters: FunnelFilters = {}): Promise<FunnelData> {
    const supabase = adminAuthClient as any;

    // Build the experience query with joins
    let expQuery = supabase
        .from('candidate_experiences')
        .select('candidate_id, country, position_keyword, company_id, is_current_job, company_master!inner(industry, group)')
        .not('company_master.industry', 'is', null)
        .not('company_master.industry', 'in', '("Unknown","Unassigned","N/A","Not Found","No Match Found","Undetermined","Unclassified","Wait AI Check")');

    if (filters.current_only) {
        expQuery = expQuery.eq('is_current_job', 'Current');
    }
    if (filters.countries?.length) {
        expQuery = expQuery.in('country', filters.countries);
    }
    if (filters.position_keywords?.length) {
        expQuery = expQuery.in('position_keyword', filters.position_keywords);
    }

    // Fetch page-by-page (candidate_experiences can be large)
    let allExp: any[] = [];
    const PAGE = 1000;
    let start = 0;
    while (true) {
        const { data, error } = await expQuery.range(start, start + PAGE - 1);
        if (error) { console.error("Funnel exp error:", error); break; }
        if (data) allExp = [...allExp, ...data];
        if (!data || data.length < PAGE) break;
        start += PAGE;
    }

    // If age filter, fetch profiles and intersect
    let eligibleCandidateIds: Set<string> | null = null;
    if (filters.age_min !== undefined || filters.age_max !== undefined) {
        let profileQ = supabase.from('Candidate Profile').select('candidate_id, age');
        if (filters.age_min !== undefined) profileQ = profileQ.gte('age', filters.age_min);
        if (filters.age_max !== undefined) profileQ = profileQ.lte('age', filters.age_max);
        const { data: profileData } = await profileQ;
        eligibleCandidateIds = new Set((profileData || []).map((p: any) => p.candidate_id));
    }

    // Filter by age if needed
    const filtered = eligibleCandidateIds
        ? allExp.filter(e => eligibleCandidateIds!.has(e.candidate_id))
        : allExp;

    // Build industry → group aggregation (distinct candidates per bucket)
    const industryMap = new Map<string, Map<string, Set<string>>>();
    const allCandidates = new Set<string>();

    for (const e of filtered) {
        const industry = e.company_master?.industry || "Unknown";
        const group = e.company_master?.group || "Unknown";
        const cid = e.candidate_id;

        allCandidates.add(cid);

        if (!industryMap.has(industry)) industryMap.set(industry, new Map());
        const groupMap = industryMap.get(industry)!;
        if (!groupMap.has(group)) groupMap.set(group, new Set());
        groupMap.get(group)!.add(cid);
    }

    // Also count distinct candidates per industry (a candidate may appear in multiple groups)
    const industryCandidates = new Map<string, Set<string>>();
    for (const e of filtered) {
        const industry = e.company_master?.industry || "Unknown";
        if (!industryCandidates.has(industry)) industryCandidates.set(industry, new Set());
        industryCandidates.get(industry)!.add(e.candidate_id);
    }

    const industries: FunnelIndustry[] = [...industryMap.entries()]
        .map(([industry, groupMap]) => ({
            name: industry,
            count: industryCandidates.get(industry)?.size || 0,
            groups: [...groupMap.entries()]
                .map(([name, ids]) => ({ name, count: ids.size }))
                .sort((a, b) => b.count - a.count),
        }))
        .sort((a, b) => b.count - a.count);

    // Fetch filter options (distinct values)
    const { data: countryData } = await supabase
        .from('candidate_experiences')
        .select('country')
        .not('country', 'is', null)
        .not('country', 'in', '("","Unknown","N/A","null")');
    const countries = [...new Set((countryData || []).map((r: any) => r.country).filter(Boolean))].sort() as string[];

    const { data: pkData } = await supabase
        .from('candidate_experiences')
        .select('position_keyword')
        .not('position_keyword', 'is', null);
    const position_keywords = [...new Set((pkData || []).map((r: any) => r.position_keyword).filter(Boolean))].sort() as string[];

    return {
        total: allCandidates.size,
        industries,
        filter_options: { countries, regions: [], position_keywords },
    };
}
