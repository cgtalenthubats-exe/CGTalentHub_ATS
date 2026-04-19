"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export interface CompanyMaster {
    company_id: number;
    company_master: string;
    industry: string | null;
    group: string | null;
    logic4_key: string | null;
}

export interface CompanyVariation {
    variation_id: number;
    variation_name: string;
    company_id: number;
}

/**
 * Fetches hierarchical statistics for the sidebar (Group > Industry)
 * Returns unique groups and industries with counts.
 */
/**
 * Fetches hierarchical statistics for the sidebar (Group > Industry)
 * Uses a pre-aggregated view for high performance with 11k+ rows.
 */
export async function getCompanySidebarStats() {
    const supabase = adminAuthClient;

    const { data: statsData, error } = await supabase
        .from('company_stats_view')
        .select('*');

    if (error) {
        console.error("Error fetching company stats view:", error);
        return { groups: {}, industriesByGroup: {} };
    }

    const groups: Record<string, number> = {};
    const industriesByGroup: Record<string, Record<string, number>> = {};

    statsData.forEach(row => {
        const group = row.group;
        const industry = row.industry;
        const count = Number(row.company_count);

        // Group Counts (Accumulate industry counts)
        groups[group] = (groups[group] || 0) + count;

        // Industry Counts within Group
        if (!industriesByGroup[group]) industriesByGroup[group] = {};
        industriesByGroup[group][industry] = count;
    });

    return { groups, industriesByGroup };
}

/**
 * Paginated fetcher for companies
 */
export async function getCompaniesPaginated(params: {
    group?: string;
    industry?: string;
    search?: string;
    page: number;
    pageSize: number;
}) {
    const supabase = adminAuthClient;
    const { group, industry, search, page, pageSize } = params;

    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('company_master')
        .select('*', { count: 'exact' });

    if (group && group !== 'All') {
        query = query.eq('group', group);
    }
    if (industry && industry !== 'All') {
        query = query.eq('industry', industry);
    }
    if (search) {
        // Search in master name or variations (via subquery or joined if possible, but let's keep it simple first)
        query = query.ilike('company_master', `%${search}%`);
    }

    const { data, count, error } = await query
        .order('company_master', { ascending: true })
        .range(from, to);

    if (error) {
        console.error("Error fetching companies:", error);
        return { data: [], total: 0 };
    }

    return { data: data as CompanyMaster[], total: count || 0 };
}

/**
 * Fetches variations for a specific company
 */
export async function getCompanyVariations(companyId: number): Promise<CompanyVariation[]> {
    const supabase = adminAuthClient;
    const { data, error } = await supabase
        .from('company_variation')
        .select('*')
        .eq('company_id', companyId);

    if (error) {
        console.error("Error fetching variations:", error);
        return [];
    }
    return data as CompanyVariation[];
}

/**
 * Single update for a master company
 */
export async function updateCompanyMaster(id: number, updates: Partial<CompanyMaster>) {
    const supabase = adminAuthClient;

    const { data, error } = await supabase
        .from('company_master')
        .update(updates)
        .eq('company_id', id)
        .select()
        .single();

    if (error) {
        console.error("Update failed:", error);
        return { success: false, error: error.message };
    }

    // Optional: Trigger a webhook or log the change
    return { success: true, data: data as CompanyMaster };
}

/**
 * Bulk update for companies
 */
export async function bulkUpdateCompanies(ids: number[], updates: { group?: string; industry?: string }) {
    const supabase = adminAuthClient;

    const { error } = await supabase
        .from('company_master')
        .update(updates)
        .in('company_id', ids);

    if (error) {
        console.error("Bulk update failed:", error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Global Search with Jump-to-Context Logic
 * Searches both Master names and Variation names.
 */
export async function globalCompanySearch(term: string) {
    if (!term || term.length < 2) return [];

    const supabase = adminAuthClient;

    // Search Master first
    const { data: masters } = await supabase
        .from('company_master')
        .select('company_id, company_master, group, industry')
        .ilike('company_master', `%${term}%`)
        .limit(20);

    // Search Variations
    const { data: variants } = await supabase
        .from('company_variation')
        .select('company_id, variation_name, company_master_name')
        .ilike('variation_name', `%${term}%`)
        .limit(20);

    // Combine results (mapping variation matches to their Master metadata)
    const resultsMap: Record<number, any> = {};

    masters?.forEach(m => {
        resultsMap[m.company_id] = { ...m, matchType: 'master' };
    });

    if (variants && variants.length > 0) {
        const variantMasterIds = variants.map(v => v.company_id).filter(Boolean);
        const { data: mastersForVariants } = await supabase
            .from('company_master')
            .select('company_id, company_master, group, industry')
            .in('company_id', variantMasterIds);
        
        mastersForVariants?.forEach(m => {
            if (!resultsMap[m.company_id]) {
                const variantMatch = variants.find(v => v.company_id === m.company_id);
                resultsMap[m.company_id] = { ...m, matchType: 'variant', matchDetail: variantMatch?.variation_name };
            }
        });
    }

    return Object.values(resultsMap);
}
