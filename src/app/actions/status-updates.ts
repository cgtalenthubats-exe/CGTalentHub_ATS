"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Get current logged-in user email from session
async function getCurrentUserEmail(): Promise<string> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        return user?.email || 'System';
    } catch {
        return 'System';
    }
}

export async function updateCandidateStatus(
    jrCandidateId: string,
    newStatus: string,
    updatedBy?: string,
    note: string | null = null
) {
    const supabase = adminAuthClient;
    const resolvedUpdatedBy = updatedBy || await getCurrentUserEmail();

    try {
        // 1. Get current max ID for log_id (numeric)
        const { data: maxLogResult } = await supabase
            .from('status_log')
            .select('log_id')
            .order('log_id', { ascending: false })
            .limit(1)
            .maybeSingle();

        let nextLogId = 1;
        if (maxLogResult && (maxLogResult as any).log_id) {
            nextLogId = parseInt((maxLogResult as any).log_id) + 1;
        }

        // Date format: M/D/YYYY
        const now = new Date();
        const timestampStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

        // 2. Insert new Log
        const { error: logError } = await supabase
            .from('status_log')
            .insert({
                log_id: nextLogId,
                jr_candidate_id: jrCandidateId,
                status: newStatus,
                updated_By: resolvedUpdatedBy,
                updated_by: resolvedUpdatedBy,
                timestamp: timestampStr,
                note: note
            } as any);

        if (logError) throw logError;

        // Note: We don't update temp_status in jr_candidates as per user request.
        // Truth is resolved from log_id.

        revalidatePath("/requisitions/manage");
        return { success: true };
    } catch (e: any) {
        console.error("Error updating candidate status:", e);
        return { success: false, error: e.message };
    }
}

export async function batchUpdateCandidateStatus(
    jrCandidateIds: string[],
    newStatus: string,
    updatedBy?: string
) {
    const supabase = adminAuthClient;
    const resolvedUpdatedBy = updatedBy || await getCurrentUserEmail();

    try {
        // 1. Get current max ID for log_id (numeric)
        const { data: maxLogResult } = await supabase
            .from('status_log')
            .select('log_id')
            .order('log_id', { ascending: false })
            .limit(1)
            .maybeSingle();

        let nextLogId = 1;
        if (maxLogResult && (maxLogResult as any).log_id) {
            nextLogId = parseInt((maxLogResult as any).log_id) + 1;
        }

        const now = new Date();
        const timestampStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

        // 2. Prepare logs
        const logsInsert = jrCandidateIds.map((id, index) => ({
            log_id: nextLogId + index,
            jr_candidate_id: id,
            status: newStatus,
            updated_By: resolvedUpdatedBy,
            timestamp: timestampStr,
            note: "Batch update"
        }));

        // 3. Batch Insert Logs
        const { error: logError } = await (supabase as any).from('status_log').insert(logsInsert as any);
        if (logError) throw logError;

        revalidatePath("/requisitions/manage");
        return { success: true };
    } catch (e: any) {
        console.error("Error batch updating candidate status:", e);
        return { success: false, error: e.message };
    }
}

export async function updateJRCandidateMetadata(
    jrCandidateId: string,
    updates: { rank?: string | null; list_type?: string | null }
) {
    const supabase = adminAuthClient;

    try {
        const { error } = await (supabase as any)
            .from('jr_candidates')
            .update(updates as any)
            .eq('jr_candidate_id', jrCandidateId);

        if (error) throw error;

        revalidatePath("/requisitions/manage");
        return { success: true };
    } catch (e: any) {
        console.error("Error updating JR candidate metadata:", e);
        return { success: false, error: e.message };
    }
}

export async function removeFromJR(jrCandidateIds: string[]) {
    const supabase = adminAuthClient;
    try {
        const { error } = await supabase
            .from('jr_candidates')
            .delete()
            .in('jr_candidate_id', jrCandidateIds);

        if (error) throw error;

        // Also cleanup status logs
        await supabase
            .from('status_log')
            .delete()
            .in('jr_candidate_id', jrCandidateIds);

        revalidatePath("/requisitions/manage");
        return { success: true };
    } catch (e: any) {
        console.error("Error removing from JR:", e);
        return { success: false, error: e.message };
    }
}

export async function copyCandidatesToJR(jrCandidateIds: string[], targetJrId: string) {
    const supabase = adminAuthClient;
    try {
        // 1. Get candidate_ids and other data from original entries
        const { data: sourceData, error: fetchError } = await supabase
            .from('jr_candidates')
            .select('candidate_id, list_type, rank')
            .in('jr_candidate_id', jrCandidateIds);

        const source = sourceData as any[];
        if (fetchError) throw fetchError;
        if (!source || source.length === 0) throw new Error("No candidates found to copy");

        // 2. Prepare for insert (get max jr_candidate_id)
        const { data: maxIdResult } = await supabase
            .from('jr_candidates')
            .select('jr_candidate_id')
            .order('jr_candidate_id', { ascending: false })
            .limit(1)
            .maybeSingle();

        let nextIdNum = 1;
        const maxRow = maxIdResult as any;
        if (maxRow && maxRow.jr_candidate_id) {
            nextIdNum = parseInt(maxRow.jr_candidate_id) + 1;
        }

        // 3. Insert into target JR
        const insertData = source.map((s, index) => ({
            jr_candidate_id: (nextIdNum + index).toString(),
            jr_id: targetJrId,
            candidate_id: s.candidate_id,
            list_type: s.list_type,
            rank: s.rank,
            time_stamp: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
            .from('jr_candidates')
            .insert(insertData as any);

        if (insertError) throw insertError;

        // 4. Create initial status logs for the copies
        const { data: maxLogResult } = await supabase
            .from('status_log')
            .select('log_id')
            .order('log_id', { ascending: false })
            .limit(1)
            .maybeSingle();

        let nextLogId = 1;
        const maxLogRow = maxLogResult as any;
        if (maxLogRow && maxLogRow.log_id) {
            nextLogId = parseInt(maxLogRow.log_id) + 1;
        }

        const now = new Date();
        const timestampStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

        const logsInsert = insertData.map((d, index) => ({
            log_id: nextLogId + index,
            jr_candidate_id: d.jr_candidate_id,
            status: "Pool Candidate", // Default for copy
            updated_By: "Copy Action",
            timestamp: timestampStr,
            note: "Copied from another JR"
        }));

        await supabase.from('status_log').insert(logsInsert as any);

        revalidatePath("/requisitions/manage");
        return { success: true };
    } catch (e: any) {
        console.error("Error copying to JR:", e);
        return { success: false, error: e.message };
    }
}
