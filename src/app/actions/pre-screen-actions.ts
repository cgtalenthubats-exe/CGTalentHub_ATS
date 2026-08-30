"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface PreScreenLogRow {
    pre_screen_id: number;
    candidate_id: string;
    name: string;
    screening_date: string;
    screener_Name: string;
    overall_impression: string;
    rating_score: number;
    feedback_text: string;
    feedback_file: string;
}

// pre_screen_log.name is a snapshot column createPreScreenLog() never writes
// (it only sets screener_Name/date/score/feedback/file) — every row shows
// "Unknown" unless something else backfilled it. Live-join the current name
// from Candidate Profile instead, same fix already applied to placements.
export async function getPreScreenLogs(): Promise<PreScreenLogRow[]> {
    const client = adminAuthClient as any;

    const { data: logs, error } = await client
        .from("pre_screen_log")
        .select("*")
        .order("pre_screen_id", { ascending: false });

    if (error) {
        console.error("getPreScreenLogs error:", error);
        return [];
    }

    const candidateIds = [...new Set((logs || []).map((l: any) => l.candidate_id).filter(Boolean))];
    const nameByCandidateId = new Map<string, string>();
    if (candidateIds.length > 0) {
        const { data: profiles } = await client
            .from("Candidate Profile")
            .select("candidate_id, name")
            .in("candidate_id", candidateIds);
        (profiles || []).forEach((p: any) => { if (p.name) nameByCandidateId.set(p.candidate_id, p.name); });
    }

    return (logs || []).map((l: any) => ({
        ...l,
        name: (l.candidate_id && nameByCandidateId.get(l.candidate_id)) || l.name,
    }));
}

export async function createPreScreenLog(formData: FormData) {
    const candidateId = formData.get("candidate_id") as string;
    const screenerName = formData.get("screener_name") as string;
    const screeningDate = formData.get("screening_date") as string;
    const feedbackText = formData.get("feedback_text") as string;
    const ratingScore = formData.get("rating_score") as string;
    const file = formData.get("file") as File;

    if (!candidateId) return { error: "Missing Candidate ID" };
    if (!screenerName) return { error: "Missing Screener Name" };
    if (!screeningDate) return { error: "Missing Screening Date" };

    const client = adminAuthClient as any;
    let fileUrl = null;

    // 0. Manual ID Increment (Handle lack of auto-increment)
    const { data: maxIdData } = await client
        .from("pre_screen_log")
        .select("pre_screen_id")
        .order("pre_screen_id", { ascending: false })
        .limit(1)
        .maybeSingle();
    
    const nextId = (maxIdData?.pre_screen_id ? parseInt(maxIdData.pre_screen_id) : 0) + 1;

    // 1. Handle File Upload if exists
    if (file && file.size > 0) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${candidateId}_${Date.now()}.${fileExt}`;
            const filePath = `${candidateId}/${fileName}`;

            const { data: uploadData, error: uploadError } = await client.storage
                .from('pre_screen_logs')
                .upload(filePath, file);

            if (uploadError) {
                console.error("File Upload Error:", uploadError);
                // We'll proceed without the file if upload fails, but log it.
            } else if (uploadData) {
                const { data: { publicUrl } } = client.storage
                    .from('pre_screen_logs')
                    .getPublicUrl(filePath);
                fileUrl = publicUrl;
            }
        } catch (err) {
            console.error("Error processing file upload:", err);
        }
    }

    // 2. Insert into Database
    const { error } = await client.from("pre_screen_log").insert({
        pre_screen_id: nextId,
        candidate_id: candidateId,
        screener_Name: screenerName, // Table has 'screener_Name' with capital N
        screening_date: screeningDate,
        feedback_text: feedbackText || "",
        rating_score: ratingScore ? parseInt(ratingScore) : null,
        feedback_file: fileUrl
    });

    if (error) {
        console.error("Create Pre-Screen Log Error:", error);
        return { error: error.message };
    }

    revalidatePath(`/candidates/${candidateId}`);
    return { success: true };
}

export async function deletePreScreenLog(logId: string, candidateId: string) {
    const client = adminAuthClient as any;
    
    // Optional: Delete file from storage if exists
    const { data: log } = await client.from("pre_screen_log").select("feedback_file").eq("pre_screen_id", logId).single();
    if (log?.feedback_file) {
        try {
            const urlParts = log.feedback_file.split('/');
            const fileName = urlParts.pop();
            const folderName = urlParts.pop();
            await client.storage.from('pre_screen_logs').remove([`${folderName}/${fileName}`]);
        } catch (e) {
            console.error("Failed to delete file from storage:", e);
        }
    }

    const { error } = await client
        .from("pre_screen_log")
        .delete()
        .eq("pre_screen_id", logId);

    if (error) {
        return { error: error.message };
    }

    revalidatePath(`/candidates/${candidateId}`);
    return { success: true };
}
export async function updatePreScreenLog(formData: FormData) {
    const logId = formData.get("log_id") as string;
    const candidateId = formData.get("candidate_id") as string;
    const screenerName = formData.get("screener_name") as string;
    const screeningDate = formData.get("screening_date") as string;
    const feedbackText = formData.get("feedback_text") as string;
    const ratingScore = formData.get("rating_score") as string;
    const file = formData.get("file") as File;

    if (!logId) return { error: "Missing Log ID" };
    if (!candidateId) return { error: "Missing Candidate ID" };

    const client = adminAuthClient as any;
    let fileUrl = formData.get("existing_file_url") as string || null;

    // 1. Handle File Upload if a new file is provided
    if (file && file.size > 0) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${candidateId}_${Date.now()}.${fileExt}`;
            const filePath = `${candidateId}/${fileName}`;

            const { data: uploadData, error: uploadError } = await client.storage
                .from('pre_screen_logs')
                .upload(filePath, file);

            if (!uploadError && uploadData) {
                const { data: { publicUrl } } = client.storage
                    .from('pre_screen_logs')
                    .getPublicUrl(filePath);
                fileUrl = publicUrl;
            }
        } catch (err) {
            console.error("Error processing file upload:", err);
        }
    }

    // 2. Update Database
    const { error } = await client
        .from("pre_screen_log")
        .update({
            screener_Name: screenerName,
            screening_date: screeningDate,
            feedback_text: feedbackText || "",
            rating_score: ratingScore ? parseInt(ratingScore) : null,
            feedback_file: fileUrl
        })
        .eq("pre_screen_id", logId);

    if (error) {
        console.error("Update Pre-Screen Log Error:", error);
        return { error: error.message };
    }

    revalidatePath(`/candidates/${candidateId}`);
    return { success: true };
}
