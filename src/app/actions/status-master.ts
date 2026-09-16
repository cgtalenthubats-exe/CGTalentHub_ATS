"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type StatusMasterRow = {
    status: string;
    stage_order: number;
    font_color: string | null;
    bg_color: string | null;
    row_color_enabled: boolean;
    /** Who owns the next action while a candidate sits in this status — drives Stage Aging. */
    owner_role: string | null;
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

// Toggles whether this status also tints the whole candidate-list row (vs. just the status chip).
export async function updateStatusOwnerRole(status: string, ownerRole: string | null) {
    const { error } = await (adminAuthClient
        .from('status_master' as any)
        .update({ owner_role: ownerRole })
        .eq('status', status) as any);

    if (error) {
        // Most likely the migration adding the column hasn't been applied yet.
        const missingColumn = /owner_role|column .* does not exist/i.test(error.message || "");
        return {
            success: false,
            error: missingColumn
                ? "Owner column is not in the database yet. Apply migration 20260916000000_add_jr_budget_and_stage_owner.sql first."
                : error.message,
        };
    }

    revalidatePath('/settings');
    return { success: true };
}

export async function updateRowColorEnabled(status: string, enabled: boolean) {
    const { error } = await (adminAuthClient
        .from('status_master' as any)
        .update({ row_color_enabled: enabled })
        .eq('status', status) as any);

    if (error) return { success: false, error: error.message };
    revalidatePath('/settings');
    return { success: true };
}

// Persists a full drag-reordered sequence in one go — stage_order becomes 1..N in array order.
export async function reorderStatusMaster(orderedStatuses: string[]) {
    const supabase = adminAuthClient;

    for (let i = 0; i < orderedStatuses.length; i++) {
        const { error } = await (supabase
            .from('status_master' as any)
            .update({ stage_order: i + 1 })
            .eq('status', orderedStatuses[i]) as any);

        if (error) return { success: false, error: error.message };
    }

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
