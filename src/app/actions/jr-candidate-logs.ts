"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export async function getJRCandidateDetails(jrCandidateId: string) {
    const supabase = adminAuthClient;

    // 1. Get current JR Candidate Meta
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

    // Fetch position name separately
    const { data: jrInfo } = await (supabase as any)
        .from('job_requisitions')
        .select('position_jr')
        .eq('jr_id', jrCandidate.jr_id)
        .maybeSingle();

    // 2. Fetch all JR associations for this candidate
    const { data: allJRs, error: allJRsError } = await (supabase as any)
        .from('jr_candidates')
        .select('jr_candidate_id, jr_id')
        .eq('candidate_id', candidateId);

    if (allJRsError) console.error("Error fetching all JRs for candidate:", allJRsError);

    const pastJRs = (allJRs || []).filter((jr: any) => String(jr.jr_candidate_id) !== String(jrCandidateId));
    const pastJrIds = pastJRs.map((j: any) => j.jr_id).filter(Boolean);
    const pastJrCandIds = pastJRs.map((j: any) => j.jr_candidate_id).filter(Boolean);

    // 3. Fetch all related data in parallel
    const [
        profileRes,
        experiencesRes,
        enhanceRes,
        allLogsRes,
        allFeedbackRes,
        jrInfoRes
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

        // AI Enhancement
        (supabase as any)
            .from('candidate_profile_enhance')
            .select('*')
            .eq('candidate_id', candidateId)
            .maybeSingle(),

        // Status Logs (All related JRs)
        (supabase as any)
            .from('status_log')
            .select('*')
            .in('jr_candidate_id', allJRs?.map((j: any) => j.jr_candidate_id) || [jrCandidateId])
            .order('log_id', { ascending: false }),

        // Interview Feedback (All related JRs)
        (supabase as any)
            .from('interview_feedback')
            .select('*')
            .in('jr_candidate_id', allJRs?.map((j: any) => j.jr_candidate_id) || [jrCandidateId])
            .order('interview_date', { ascending: false }),

        // JR Position Names (Manual join)
        pastJrIds.length > 0 ? (supabase as any)
            .from('job_requisitions')
            .select('jr_id, position_jr')
            .in('jr_id', pastJrIds) : Promise.resolve({ data: [] })
    ]);

    const { data: candidateProfile } = profileRes;
    const { data: experiences } = experiencesRes;
    const { data: enhance } = enhanceRes;
    const { data: allLogs } = allLogsRes;
    const { data: allFeedback } = allFeedbackRes;
    const { data: pastJrDetails } = jrInfoRes;

    // Build JR position map
    const jrMap: Record<string, string> = {};
    pastJrDetails?.forEach((j: any) => {
        jrMap[j.jr_id] = j.position_jr;
    });

    // Split logs and feedback into current vs history
    const logs = allLogs?.filter((l: any) => String(l.jr_candidate_id) === String(jrCandidateId)) || [];
    const feedback = allFeedback?.filter((f: any) => String(f.jr_candidate_id) === String(jrCandidateId)) || [];

    // Bundle history records with their JR context - NO FILTERING
    const historyRecords = pastJRs.map((jr: any) => ({
        jr_id: jr.jr_id,
        jr_candidate_id: jr.jr_candidate_id,
        position: jrMap[jr.jr_id] || "Unknown Position",
        logs: allLogs?.filter((l: any) => String(l.jr_candidate_id) === String(jr.jr_candidate_id)) || [],
        feedback: allFeedback?.filter((f: any) => String(f.jr_candidate_id) === String(jr.jr_candidate_id)) || []
    }));

    const meta = {
        ...jrCandidate,
        position_jr: jrInfo?.position_jr || "Unknown Position",
        candidate_profile: {
            ...candidateProfile,
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
        },
        history_count: historyRecords.length
    };

    return {
        meta,
        logs,
        feedback,
        history: historyRecords
    };
}

export async function addActivityLog(
    jrCandidateId: string,
    status: string,
    note: string | null = null,
    updatedBy: string = "System",
    customTimestamp?: string
) {
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
        const timestampStr = customTimestamp || now.toISOString().split('T')[0]; // Save as YYYY-MM-DD

        const { error } = await supabase
            .from('status_log')
            .insert({
                log_id: nextId,
                jr_candidate_id: jrCandidateId,
                status,
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

export async function updateActivityLog(logId: number, status: string, note: string | null = null, updatedBy?: string, customTimestamp?: string) {
    const supabase = adminAuthClient;

    try {
        const updates: any = {
            status,
            note,
        };

        if (updatedBy) {
            updates.updated_by = updatedBy;
        }

        if (customTimestamp) {
            updates.timestamp = customTimestamp;
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
