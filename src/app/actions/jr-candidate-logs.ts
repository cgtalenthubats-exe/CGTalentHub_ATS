"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export async function getJRCandidateDetails(jrCandidateId: string) {
    const supabase = adminAuthClient;

    // 1. Get JR Candidate Meta & Logs
    // 1. Get JR Candidate Meta
    const { data: jrCandidate, error: jrError } = await (supabase as any)
        .from('jr_candidates')
        .select('*')
        .eq('jr_candidate_id', jrCandidateId)
        .single();

    if (jrError || !jrCandidate) {
        console.error("Error fetching JR candidate:", jrError);
        return null;
    }

    // 2. Get Candidate Profile (Manual Join due to missing FK and Table Name space)
    const { data: candidateProfile, error: profileError } = await (supabase as any)
        .from('Candidate Profile')
        .select('name, photo')
        .eq('candidate_id', jrCandidate.candidate_id)
        .single();

    if (profileError) {
        console.error("Error fetching Candidate Profile:", profileError);
        // Continue without profile if error, or handle as needed. 
        // For now, attaching what we have.
    }

    const meta = {
        ...jrCandidate,
        candidate_profile: {
            name: candidateProfile?.name,
            photo_url: candidateProfile?.photo // 'photo' is the column name from list_tables, mapped to photo_url for frontend
        }
    };

    // 2. Get Logs
    const { data: logs, error: logsError } = await (supabase as any)
        .from('status_log')
        .select('*')
        .eq('jr_candidate_id', jrCandidateId)
        .order('log_id', { ascending: false });

    // 3. Get Interview Feedback
    const { data: feedback, error: feedbackError } = await (supabase as any)
        .from('interview_feedback')
        .select('*')
        .eq('jr_candidate_id', jrCandidateId)
        .order('interview_date', { ascending: false });

    return {
        meta,
        logs: logs || [],
        feedback: feedback || []
    };
}

export async function addActivityLog(jrCandidateId: string, status: string, note: string | null = null, updatedBy: string = "System") {
    const supabase = adminAuthClient;

    try {
        const { data: maxResult } = await supabase
            .from('status_log')
            .select('log_id')
            .order('log_id', { ascending: false })
            .limit(1)
            .maybeSingle();

        let nextId = 1;
        if (maxResult && (maxResult as any).log_id) {
            nextId = parseInt((maxResult as any).log_id) + 1;
        }

        const now = new Date();
        const timestampStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

        const { error } = await supabase
            .from('status_log')
            .insert({
                log_id: nextId,
                jr_candidate_id: jrCandidateId,
                status,
                updated_By: updatedBy,
                timestamp: timestampStr,
                note
            } as any);

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error("Error adding activity log:", e);
        return { success: false, error: e.message };
    }
}

export async function updateActivityLog(logId: number, status: string, note: string | null = null) {
    const supabase = adminAuthClient;

    try {
        const { error } = await supabase
            .from('status_log')
            .update({
                status,
                note,
                // We keep original timestamp or could add updated_at if schema supports it
            } as any)
            .eq('log_id', logId);

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error("Error updating activity log:", e);
        return { success: false, error: e.message };
    }
}

export async function deleteActivityLog(logId: number) {
    const supabase = adminAuthClient;

    try {
        const { error } = await supabase
            .from('status_log')
            .delete()
            .eq('log_id', logId);

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error("Error deleting activity log:", e);
        return { success: false, error: e.message };
    }
}

export async function deleteInterviewFeedback(feedbackId: string | number) {
    const supabase = adminAuthClient;

    try {
        const { error } = await (supabase as any)
            .from('interview_feedback')
            .delete()
            .eq('feedback_id', feedbackId);

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error("Error deleting interview feedback:", e);
        return { success: false, error: e.message };
    }
}
