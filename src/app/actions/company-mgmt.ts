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
    groups?: string[];
    industry?: string;
    search?: string;
    page: number;
    pageSize: number;
}) {
    const supabase = adminAuthClient;
    const { group, groups, industry, search, page, pageSize } = params;

    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('company_master')
        .select('*', { count: 'exact' });

    if (groups && groups.length > 0) {
        // "Unassigned" represents true NULL group values (coalesced by company_stats_view
        // for display), but `group IN (...)` never matches NULL rows in SQL — so it must
        // be filtered separately via `group.is.null`, OR'd together with the rest.
        const hasUnassigned = groups.includes('Unassigned');
        const realGroups = groups.filter(g => g !== 'Unassigned');
        if (hasUnassigned) {
            const orParts = ['group.is.null'];
            if (realGroups.length > 0) {
                orParts.push(`group.in.(${realGroups.map(g => `"${g}"`).join(',')})`);
            }
            query = query.or(orParts.join(','));
        } else {
            query = query.in('group', groups);
        }
    } else if (group && group !== 'All') {
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
 * Fetches a single company_master row by id — used to show the currently
 * mapped company (name/group/industry) in the org-chart "Edit Org Info" dialog.
 */
export async function getCompanyMasterById(companyId: number) {
    const supabase = adminAuthClient;
    const { data, error } = await supabase
        .from('company_master')
        .select('company_id, company_master, group, industry')
        .eq('company_id', companyId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching company by id:", error);
        return null;
    }
    return data;
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

export async function getSetCompanies() {
    const supabase = adminAuthClient as any;

    const { data: setList, error } = await supabase
        .from('company_set_group')
        .select('id, symbol, company_name, index_group, sector')
        .order('symbol');

    if (error) throw error;

    // Try to find matching company_master records by company_name (case-insensitive)
    const names = (setList || []).map((s: any) => s.company_name);

    let masterMatches: any[] = [];
    if (names.length > 0) {
        const { data: masters } = await supabase
            .from('company_master')
            .select('company_id, company_master, industry, group')
            .in('company_master', names);
        masterMatches = masters || [];
    }

    // Count candidates per company_id via candidate_experiences
    const masterIds = masterMatches.map((m: any) => m.company_id);
    let candidateCounts: Record<number, number> = {};

    if (masterIds.length > 0) {
        const { data: expData } = await supabase
            .from('candidate_experiences')
            .select('company_id')
            .in('company_id', masterIds);

        (expData || []).forEach((e: any) => {
            if (e.company_id) {
                candidateCounts[e.company_id] = (candidateCounts[e.company_id] || 0) + 1;
            }
        });
    }

    return (setList || []).map((s: any) => {
        const match = masterMatches.find((m: any) =>
            m.company_master?.toLowerCase() === s.company_name?.toLowerCase()
        );
        return {
            ...s,
            company_master_id: match?.company_id || null,
            company_master_name: match?.company_master || null,
            candidate_count: match ? (candidateCounts[match.company_id] || 0) : null,
        };
    });
}

// ─── Hotel Chain Mapping ─────────────────────────────────────────────────────

export interface HotelChainQueueItem {
    company_id: number;
    company_master: string;
    rating: string | null;
    chain_mapping_status: string | null;
    candidate_count: number;
    total_count: number;
}

export interface HotelChainPickerItem {
    brand_id: number;
    brand_name: string;
    parent_id: number | null;
    rating: string | null;
    parent_name: string | null;
}

export async function getHotelChainMappingQueue(params: {
    filter: 'all' | 'with_candidates' | 'pending';
    showIndependent: boolean;
    page: number;
    pageSize: number;
}) {
    const supabase = adminAuthClient;
    const { data, error } = await (supabase.rpc as any)('get_hotel_chain_mapping_queue', {
        p_filter: params.filter,
        p_show_independent: params.showIndependent,
        p_page: params.page,
        p_page_size: params.pageSize,
    });
    if (error) {
        console.error('getHotelChainMappingQueue error:', error);
        return { data: [], total: 0 };
    }
    const rows = (data as HotelChainQueueItem[]) ?? [];
    const total = rows[0]?.total_count ?? 0;
    return { data: rows, total: Number(total) };
}

export async function getHotelChainsForPicker(): Promise<HotelChainPickerItem[]> {
    const supabase = adminAuthClient;
    const { data, error } = await (supabase.rpc as any)('get_hotel_chains_for_picker');
    if (error) {
        console.error('getHotelChainsForPicker error:', error);
        return [];
    }
    return (data as HotelChainPickerItem[]) ?? [];
}

export async function assignCompanyToChain(companyId: number, chainId: number) {
    const supabase = adminAuthClient;
    const { error } = await (supabase.from('company_master') as any)
        .update({ hotel_chain_id: chainId, chain_mapping_status: 'mapped' })
        .eq('company_id', companyId);
    if (error) return { success: false, error: (error as any).message };
    return { success: true };
}

export async function markCompanyIndependent(companyId: number) {
    const supabase = adminAuthClient;
    const { error } = await (supabase.from('company_master') as any)
        .update({ chain_mapping_status: 'independent' })
        .eq('company_id', companyId);
    if (error) return { success: false, error: (error as any).message };
    return { success: true };
}

export async function updateCompanyRatingOnly(companyId: number, rating: string) {
    const supabase = adminAuthClient;
    const { error } = await (supabase.from('company_master') as any)
        .update({ rating })
        .eq('company_id', companyId);
    if (error) return { success: false, error: (error as any).message };
    return { success: true };
}

export async function addHotelChainEntry(params: {
    brand_name: string;
    parent_id: number | null;
    rating: string | null;
}) {
    const supabase = adminAuthClient;
    const { data, error } = await (supabase.from('hotel_chain_master') as any)
        .insert({
            brand_name: params.brand_name,
            parent_id: params.parent_id,
            rating: params.rating ?? null,
        })
        .select('brand_id, brand_name, parent_id, rating')
        .single();
    if (error) return { success: false, error: error.message, brand: null };
    return { success: true, brand: data };
}

export async function updateSubBrandRating(brandId: number, rating: string | null) {
    const supabase = adminAuthClient;
    const { error } = await (supabase.from('hotel_chain_master') as any)
        .update({ rating })
        .eq('brand_id', brandId);
    if (error) return { success: false, error: (error as any).message };
    return { success: true };
}

export interface HotelChainStats {
    total_chains: number;
    sub_brand_5star: number;
    sub_brand_4star: number;
    sub_brand_3star: number;
    sub_brand_unrated: number;
    unmapped_companies: number;
}

export async function getHotelChainStats(): Promise<HotelChainStats> {
    const supabase = adminAuthClient;
    const { data, error } = await (supabase.rpc as any)('get_hotel_chain_stats');
    if (error || !data?.[0]) {
        return { total_chains: 0, sub_brand_5star: 0, sub_brand_4star: 0, sub_brand_3star: 0, sub_brand_unrated: 0, unmapped_companies: 0 };
    }
    const row = data[0];
    return {
        total_chains: Number(row.total_chains),
        sub_brand_5star: Number(row.sub_brand_5star),
        sub_brand_4star: Number(row.sub_brand_4star),
        sub_brand_3star: Number(row.sub_brand_3star),
        sub_brand_unrated: Number(row.sub_brand_unrated),
        unmapped_companies: Number(row.unmapped_companies),
    };
}
