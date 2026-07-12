"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Get current logged-in user email from session
export async function getCurrentUserEmail(): Promise<string> {
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
    note: string | null = null,
    customTimestamp?: string
) {
    const supabase = adminAuthClient;
    const resolvedUpdatedBy = updatedBy || await getCurrentUserEmail();
    
    if (newStatus === 'Successful Placement') {
        return { success: false, error: "Please use 'Confirm Placement' button for Successful Placement to ensure employment records are created correctly." };
    }

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

        // Use custom timestamp if provided (assumes YYYY-MM-DD or M/D/YYYY), otherwise M/D/YYYY
        const now = new Date();
        const timestampStr = customTimestamp || `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

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

const HEAD_RECRUIT_FEEDBACK_STATUS_MAP: Record<string, string> = {
    "Can Approach": "Pool Candidate",
    "Keep in Longlist": "Pool Candidate",
    "Not fit - Remove": "Not fit",
    "Not fit - Too Junior": "Not fit",
    "Not fit - Too Senior": "Not fit",
    "Not fit - Compensation Gap": "Not fit",
    "Not fit": "Not fit",
    "Don't touch": "Pool Candidate",
};

const HEAD_RECRUIT_FEEDBACK_UPDATED_BY = "Thikamporn";

// Resets the Head Recruit Feedback dropdown back to blank (e.g. picked the wrong option by mistake).
// Only clears the marker itself — the status_log entry it created stays as history, and any
// Remark tag (e.g. "Don't touch") it added must be untoggled separately via the Remark cell,
// since both are shared/global concepts that shouldn't be silently reverted.
export async function clearHeadRecruitFeedback(jrCandidateId: string) {
    const supabase = adminAuthClient;
    try {
        const { error } = await (supabase
            .from('jr_candidates') as any)
            .update({ head_recruit_feedback: null })
            .eq('jr_candidate_id', jrCandidateId);

        if (error) throw error;

        revalidatePath("/requisitions/manage");
        return { success: true };
    } catch (e: any) {
        console.error("Error clearing head recruit feedback:", e);
        return { success: false, error: e.message };
    }
}

export async function updateHeadRecruitFeedback(jrCandidateId: string, feedback: string) {
    const supabase = adminAuthClient;
    const mappedStatus = HEAD_RECRUIT_FEEDBACK_STATUS_MAP[feedback];

    if (!mappedStatus) {
        return { success: false, error: `Unknown feedback option: ${feedback}` };
    }

    try {
        // 1. Persist the selected feedback on jr_candidates, and grab candidate_id for the Remark step below
        const { data: jrCandRow, error: jrCandError } = await (supabase
            .from('jr_candidates') as any)
            .update({ head_recruit_feedback: feedback })
            .eq('jr_candidate_id', jrCandidateId)
            .select('candidate_id')
            .single();

        if (jrCandError) throw jrCandError;

        // 2. Insert a status_log entry (note keeps the full feedback text for traceability)
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

        const { error: logError } = await supabase
            .from('status_log')
            .insert({
                log_id: nextLogId,
                jr_candidate_id: jrCandidateId,
                status: mappedStatus,
                updated_By: HEAD_RECRUIT_FEEDBACK_UPDATED_BY,
                updated_by: HEAD_RECRUIT_FEEDBACK_UPDATED_BY,
                timestamp: timestampStr,
                note: feedback,
            } as any);

        if (logError) throw logError;

        // 3. "Don't touch" also tags the candidate globally via the existing Remark schema
        //    (Candidate Profile.candidate_status is shared across every JR this candidate is in)
        if (feedback === "Don't touch") {
            const candidateId = (jrCandRow as any)?.candidate_id;
            if (candidateId) {
                const { data: profile, error: profileFetchError } = await supabase
                    .from('Candidate Profile')
                    .select('candidate_status')
                    .eq('candidate_id', candidateId)
                    .maybeSingle();

                if (profileFetchError) throw profileFetchError;

                const existingStatuses: string[] = ((profile as any)?.candidate_status as string[] | null) || [];
                if (!existingStatuses.includes("Don't touch")) {
                    const { error: profileUpdateError } = await (supabase
                        .from('Candidate Profile') as any)
                        .update({ candidate_status: [...existingStatuses, "Don't touch"] })
                        .eq('candidate_id', candidateId);

                    if (profileUpdateError) throw profileUpdateError;
                }
            }
        }

        revalidatePath("/requisitions/manage");
        return { success: true };
    } catch (e: any) {
        console.error("Error updating head recruit feedback:", e);
        return { success: false, error: e.message };
    }
}

export async function batchUpdateCandidateStatus(
    jrCandidateIds: string[],
    newStatus: string,
    updatedBy?: string,
    note: string | null = null,
    customTimestamp?: string
) {
    const supabase = adminAuthClient;
    const resolvedUpdatedBy = updatedBy || await getCurrentUserEmail();
    
    if (newStatus === 'Successful Placement') {
        return { success: false, error: "Successful Placement cannot be set via batch update. Please use the individual 'Confirm Placement' flow." };
    }

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
        const timestampStr = customTimestamp || `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

        // 2. Prepare logs
        const logsInsert = jrCandidateIds.map((id, index) => ({
            log_id: nextLogId + index,
            jr_candidate_id: id,
            status: newStatus,
            updated_By: resolvedUpdatedBy,
            updated_by: resolvedUpdatedBy,
            timestamp: timestampStr,
            note: note || "Batch update"
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

export async function copyCandidatesToJR(jrCandidateIds: string[], targetJrId: string, updatedBy?: string) {
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

        // 2. DUPLICATE CHECK: Get existing candidate_ids in target JR
        const targetCandidateIds = source.map(s => s.candidate_id);
        const { data: existingInTarget, error: checkError } = await supabase
            .from('jr_candidates')
            .select('candidate_id')
            .eq('jr_id', targetJrId)
            .in('candidate_id', targetCandidateIds);

        if (checkError) throw checkError;

        const alreadyPresentIds = new Set((existingInTarget as any[] || []).map(row => row.candidate_id));
        const filteredToCopy = source.filter(s => !alreadyPresentIds.has(s.candidate_id));

        if (filteredToCopy.length === 0) {
            return { 
                success: true, 
                addedCount: 0, 
                skippedCount: source.length,
                message: "All selected candidates are already present in target JR."
            };
        }

        // 3. Prepare for insert (get max jr_candidate_id)
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

        // 4. Insert into target JR
        const insertData = filteredToCopy.map((s, index) => ({
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

        // 5. Create initial status logs for the copies
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
            updated_By: updatedBy || "Copy Action",
            updated_by: updatedBy || "Copy Action",
            timestamp: timestampStr,
            note: "Copied from another JR"
        }));

        await supabase.from('status_log').insert(logsInsert as any);

        revalidatePath("/requisitions/manage");
        return { 
            success: true, 
            addedCount: filteredToCopy.length, 
            skippedCount: alreadyPresentIds.size 
        };
    } catch (e: any) {
        console.error("Error copying to JR:", e);
        return { success: false, error: e.message };
    }
}
