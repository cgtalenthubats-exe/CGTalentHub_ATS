"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type FeedbackData = {
    jr_candidate_id: string;
    interview_type: string;
    interviewer_name: string;
    interview_date: string;
    rating: number;
    recommendation: string;
    feedback_text: string;
    feedback_file_url?: string;
    trigger_extract?: boolean;
    feedback_id?: number;
    candidate_name: string;
};

export async function submitInterviewFeedback(data: FeedbackData) {
    const supabase = adminAuthClient as any;

    try {
        // 1. Prepare Payload
        const payload: any = {
            jr_candidate_id: data.jr_candidate_id,
            Interviewer_type: data.interview_type,
            Interviewer_name: data.interviewer_name,
            interview_date: data.interview_date,
            rating_score: data.rating,
            overall_recommendation: data.recommendation,
            feedback_text: data.feedback_text,
            feedback_file: data.feedback_file_url || null,
        };

        // Handle ID for Upsert
        if (data.feedback_id) {
            payload.feedback_id = data.feedback_id;
        } else {
            payload.feedback_id = Date.now();
        }

        // 2. Perform Upsert
        const { error } = await supabase
            .from('interview_feedback')
            .upsert(payload);

        if (error) {
            console.error("Submit Feedback Error:", error);
            return { success: false, error: error.message };
        }

        // 3. Trigger n8n PDF extraction only if user opted in
        if (data.trigger_extract && data.feedback_file_url) {
            await triggerFeedbackPdfExtract({
                feedback_id: payload.feedback_id,
                jr_candidate_id: data.jr_candidate_id,
                candidate_name: data.candidate_name,
                interview_date: data.interview_date,
                interview_type: data.interview_type,
                interviewer_name: data.interviewer_name,
                rating: data.rating,
                recommendation: data.recommendation,
                feedback_text: data.feedback_text,
                file_url: data.feedback_file_url,
            });
        }

        revalidatePath(`/requisitions/manage/candidate/${data.jr_candidate_id}`);
        return { success: true };
    } catch (error: any) {
        console.error("Submit Feedback Exception:", error);
        return { success: false, error: error.message };
    }
}

export async function triggerFeedbackPdfExtract(params: {
    feedback_id: number;
    jr_candidate_id: string;
    candidate_name: string;
    interview_date: string;
    interview_type: string;
    interviewer_name: string;
    rating: number;
    recommendation: string;
    feedback_text: string;
    file_url: string;
}) {
    try {
        const supabase = adminAuthClient as any;

        // Get jr_id for context
        const { data: jrCand } = await supabase
            .from('jr_candidates')
            .select('jr_id')
            .eq('jr_candidate_id', params.jr_candidate_id)
            .single();

        const jrId = jrCand?.jr_id || "Unknown";

        // Get n8n webhook URL
        const { data: config } = await supabase
            .from('n8n_configs')
            .select('url')
            .eq('name', 'Interview Feedback')
            .single();

        if (!config?.url) {
            return { success: false, error: "n8n config 'Interview Feedback' not found" };
        }

        // Get requester real_name
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();
        let requester = user?.email || 'System';
        if (user?.email) {
            const { data: profile } = await (adminAuthClient as any)
                .from('user_profiles')
                .select('real_name')
                .eq('email', user.email)
                .single() as { data: { real_name: string } | null };
            requester = profile?.real_name || user.email;
        }

        await fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jr_id: jrId,
                uploadType: "Interview feedback",
                requester,
                event: "extract",
                is_file_updated: false,
                details: { ...params },
                timestamp: new Date().toISOString(),
            }),
        });

        return { success: true };
    } catch (error: any) {
        console.error("triggerFeedbackPdfExtract error:", error);
        return { success: false, error: error.message };
    }
}
