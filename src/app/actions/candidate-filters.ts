"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

import { getCandidateIdsByExperienceFilters, CandidateFilters } from "@/lib/candidate-service";

export async function searchCompanies(query: string, limit = 20, filters?: any) {
    if (!query || query.length < 1) return { results: [], totalCount: 0 };

    try {
        // Fetch more than limit to allow grouping in memory
        const fetchLimit = 500;
        const { data, error, count } = await adminAuthClient
            .from('company_variation')
            .select('variation_name, logic4_key', { count: 'exact' })
            .ilike('variation_name', `%${query}%`)
            .limit(fetchLimit);

        if (error) {
            console.error("Error searching companies (Variations):", error);
            return { results: [], totalCount: 0 };
        }

        if (!data || data.length === 0) {
            return { results: [], totalCount: 0 };
        }

        // Group by logic4_key
        const groups = new Map<string, string[]>();
        data.forEach((row: any) => {
            const key = row.logic4_key || `no-key-${row.variation_name}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(row.variation_name);
        });

        // For each group, pick the best representative name
        const uniqueEntries = Array.from(groups.entries()).map(([key, names]) => {
            // Priority: 
            // 1. Exact match (ignore case)
            // 2. Starts with query
            // 3. Shortest name
            const lowerQuery = query.toLowerCase();
            const sorted = names.sort((a, b) => {
                const aLow = a.toLowerCase();
                const bLow = b.toLowerCase();
                
                if (aLow === lowerQuery) return -1;
                if (bLow === lowerQuery) return 1;
                
                const aStarts = aLow.startsWith(lowerQuery);
                const bStarts = bLow.startsWith(lowerQuery);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                
                return a.length - b.length;
            });
            return sorted[0];
        });

        return {
            results: uniqueEntries.slice(0, limit),
            totalCount: uniqueEntries.length
        };

    } catch (error) {
        console.error("Server Action Error (searchCompanies):", error);
        return { results: [], totalCount: 0 };
    }
}

export async function searchPositions(query: string, limit = 1000, filters?: any) {
    const hasActiveFilters = filters && Object.values(filters).some((v: any) => Array.isArray(v) ? v.length > 0 : !!v);

    if ((!query || query.length < 1) && !hasActiveFilters) return { results: [], totalCount: 0 };

    try {
        let candidateIds: string[] | null = null;
        if (hasActiveFilters) {
            const contextFilters = { ...filters };
            delete contextFilters.positions;
            const hasContext = Object.values(contextFilters).some((v: any) => Array.isArray(v) ? v.length > 0 : !!v);
            if (hasContext) {
                candidateIds = await getCandidateIdsByExperienceFilters(contextFilters);
            }
        }

        const { data, error } = await (adminAuthClient.rpc as any)('get_unique_experience_values', {
            field_name: 'position',
            search_term: query || '',
            match_limit: limit,
            filter_candidate_ids: candidateIds
        });

        if (error) {
            console.error("Error searching positions (RPC):", error);
            return { results: [], totalCount: 0 };
        }

        const results = (data as any[])?.map((item: any) => item.result_value) || [];
        return {
            results,
            totalCount: results.length // RPC doesn't currently return a full count easily, but this keeps format same
        };

    } catch (error) {
        console.error("Server Action Error (searchPositions):", error);
        return { results: [], totalCount: 0 };
    }
}

export async function getStatuses() {
    try {
        const { data, error } = await adminAuthClient
            .from('candidate_status_master')
            .select('*')
            .order('status', { ascending: true });

        if (error) {
            console.error("Error fetching statuses:", error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error("Server Action Error (getStatuses):", error);
        return [];
    }
}

export async function addStatus(status: string, color?: string) {
    try {
        const { error } = await adminAuthClient
            .from('candidate_status_master')
            .insert([{ status, color: color || '#64748b', description: 'User created' }] as any); // Default slate color

        if (error) {
            console.error("Error adding status:", error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Server Action Error (addStatus):", error);
        return { success: false, error: error.message };
    }
}
