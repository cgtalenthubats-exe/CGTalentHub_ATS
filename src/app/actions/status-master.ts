"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export interface StatusMaster {
    status: string;
    stage_order: number;
}

export async function getStatusMaster(): Promise<StatusMaster[]> {
    const supabase = adminAuthClient;
    const { data, error } = await supabase
        .from('status_master')
        .select('status, stage_order')
        .order('stage_order', { ascending: true });

    if (error) {
        console.error("Error fetching Status Master:", error);
        return [];
    }

    return data;
}
