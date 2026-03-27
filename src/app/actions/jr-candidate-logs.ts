"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export async function getJRCandidateDetails(jrCandidateId: string) {
    const supabase = adminAuthClient;

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

    const candidateId = jrCandidate.candidate_id;

    // 2. Fetch all related data in parallel for performance
    const [
        profileRes,
        experiencesRes,
        enhanceRes,
        logsRes,
        feedbackRes
    ] = await Promise.all([
        // Global Profile
        (supabase as any)
            .from('Candidate Profile')
            .select('*')
            .eq('candidate_id', candidateId)
            .single(),
        
        // Experiences
        (supabase as any)
            .from('candidate_experiences')
            .select('*')
            .eq('candidate_id', candidateId)
            .order('start_date', { ascending: false }),

        // AI Enhancement / About / Skills
        (supabase as any)
            .from('candidate_profile_enhance')
            .select('*')
            .eq('candidate_id', candidateId)
            .maybeSingle(),

        // Status Logs (JR specific)
        (supabase as any)
            .from('status_log')
            .select('*')
            .eq('jr_candidate_id', jrCandidateId)
            .order('log_id', { ascending: false }),

        // Interview Feedback (JR specific)
        (supabase as any)
            .from('interview_feedback')
            .select('*')
            .eq('jr_candidate_id', jrCandidateId)
            .order('interview_date', { ascending: false })
    ]);

    const { data: candidateProfile, error: profileError } = profileRes;
    const { data: experiences, error: expError } = experiencesRes;
    const { data: enhance, error: enhanceError } = enhanceRes;
    const { data: logs, error: logsError } = logsRes;
    const { data: feedback, error: feedbackError } = feedbackRes;

    if (profileError) console.error("Error fetching Candidate Profile:", profileError);
    if (expError) console.error("Error fetching Experiences:", expError);
    if (enhanceError) console.error("Error fetching Enhance Data:", enhanceError);

    const meta = {
        ...jrCandidate,
        candidate_profile: {
            ...candidateProfile,
            // Map photo to photo_url if UI expects it (keeping compatibility)
            photo_url: candidateProfile?.photo,
            experiences: experiences || [],
            enhancement: enhance ? {
                about: enhance.about_summary,
                education_summary: enhance.education_summary,
                languages: enhance.languages,
                skills: enhance.skills_list,
                alt_email: enhance.email,
                country: enhance.country,
                full_address: enhance.full_address
            } : null
        }
    };

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
                updated_by: updatedBy,
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

export async function updateActivityLog(logId: number, status: string, note: string | null = null, updatedBy?: string) {
    const supabase = adminAuthClient;

    try {
        const updates: any = {
            status,
            note,
        };

        if (updatedBy) {
            updates.updated_By = updatedBy;
            updates.updated_by = updatedBy;
        }

        const { error } = await (supabase as any)
            .from('status_log')
            .update(updates)
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
