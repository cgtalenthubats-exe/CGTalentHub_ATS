"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
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
        const { data: result, error } = await supabase
            .from('interview_feedback')
            .upsert(payload)
            .select()
            .single();

        if (error) {
            console.error("Submit Feedback Error:", error);
            return { success: false, error: error.message };
        }

        // 3. Trigger n8n Webhook (only if file is attached)
        if (data.feedback_file_url) {
            // Fetch JR ID for context
            const { data: jrCand } = await supabase
                .from('jr_candidates')
                .select('jr_id')
                .eq('jr_candidate_id', data.jr_candidate_id)
                .single();

            const jrId = jrCand?.jr_id || "Unknown";

            // Fetch dynamic URL from config - standardized name
            const { data: config } = await supabase
                .from('n8n_configs')
                .select('url')
                .eq('name', 'Interview Feedback')
                .single();

            if (config?.url) {
                // Get requester email
                const { data: { user } } = await supabase.auth.getUser();
                const requester = user?.email || 'System';

                // Fire webhook with standardized payload
                fetch(config.url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jr_id: jrId,
                        uploadType: "Interview feedback",
                        requester: requester,
                        event: data.feedback_id ? "update" : "create",
                        is_file_updated: true,
                        details: {
                            feedback_id: result.feedback_id,
                            jr_candidate_id: data.jr_candidate_id,
                            candidate_name: data.candidate_name,
                            interview_date: data.interview_date,
                            interview_type: data.interview_type,
                            interviewer_name: data.interviewer_name,
                            rating: data.rating,
                            recommendation: data.recommendation,
                            feedback_text: data.feedback_text,
                            file_url: data.feedback_file_url
                        },
                        timestamp: new Date().toISOString()
                    })
                }).catch((err: any) => console.error("Failed to trigger n8n:", err));
            } else {
                console.warn("n8n config 'Interview Feedback' not found.");
            }
        }

        revalidatePath(`/requisitions/manage/candidate/${data.jr_candidate_id}`);
        return { success: true };
    } catch (error: any) {
        console.error("Submit Feedback Exception:", error);
        return { success: false, error: error.message };
    }
}
