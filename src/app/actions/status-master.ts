"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type StatusMasterRow = {
    status: string;
    stage_order: number;
    font_color: string | null;
    bg_color: string | null;
};

export async function getStatusMaster() {
    const { data, error } = await adminAuthClient
        .from('status_master')
        .select('*')
        .order('stage_order', { ascending: true });

    if (error) {
        console.error("Error fetching status master:", error);
        return [];
    }
    return data || [];
}

export async function createStatus(status: string) {
    if (!status?.trim()) return { success: false, error: "Status name is required" };

    const { error } = await (adminAuthClient
        .from('status_master' as any)
        .insert({ status: status.trim(), stage_order: 50 }) as any);

    if (error) return { success: false, error: error.message };
    revalidatePath('/settings');
    return { success: true };
}

export async function updateStatusColors(status: string, font_color: string | null, bg_color: string | null) {
    const { error } = await (adminAuthClient
        .from('status_master' as any)
        .update({ font_color: font_color || null, bg_color: bg_color || null })
        .eq('status', status) as any);

    if (error) return { success: false, error: error.message };
    revalidatePath('/settings');
    return { success: true };
}

export async function deleteStatus(status: string) {
    // Guard: check if this status is used in any status_log
    const { count } = await (adminAuthClient
        .from('status_log' as any)
        .select('log_id', { count: 'exact', head: true })
        .eq('status', status) as any);

    if ((count ?? 0) > 0) {
        return { success: false, error: `Cannot delete: "${status}" is used in ${count} status log entries.` };
    }

    const { error } = await (adminAuthClient
        .from('status_master' as any)
        .delete()
        .eq('status', status) as any);

    if (error) return { success: false, error: error.message };
    revalidatePath('/settings');
    return { success: true };
}
