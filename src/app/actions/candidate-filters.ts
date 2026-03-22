"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

import { getCandidateIdsByExperienceFilters, CandidateFilters } from "@/lib/candidate-service";

export async function searchCompanies(query: string, limit = 10, filters?: any) {
    if (!query || query.length < 1) return [];

    try {
        const { data, error } = await adminAuthClient
            .from('company_variation')
            .select('variation_name')
            .ilike('variation_name', `%${query}%`)
            .limit(limit);

        if (error) {
            console.error("Error searching companies (Variations):", error);
            return [];
        }

        // Return unique variation names
        const names = data?.map((item: any) => item.variation_name) || [];
        return Array.from(new Set(names));

    } catch (error) {
        console.error("Server Action Error (searchCompanies):", error);
        return [];
    }
}

export async function searchPositions(query: string, limit = 1000, filters?: any) {
    const hasActiveFilters = filters && Object.values(filters).some((v: any) => Array.isArray(v) ? v.length > 0 : !!v);

    if ((!query || query.length < 1) && !hasActiveFilters) return [];

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
            return [];
        }

        return (data as any[])?.map((item: any) => item.result_value) || [];

    } catch (error) {
        console.error("Server Action Error (searchPositions):", error);
        return [];
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
