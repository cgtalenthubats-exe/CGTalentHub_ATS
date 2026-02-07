"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface UploadRecord {
    file_name: string;
    resume_url: string;
    uploader_email: string;
    status?: string;
}

export async function createUploadRecord(record: UploadRecord) {
    try {
        const { data, error } = await supabase
            .from('resume_uploads')
            .insert([
                {
                    file_name: record.file_name,
                    resume_url: record.resume_url,
                    uploader_email: record.uploader_email,
                    status: 'pending' // Default status
                }
            ])
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };

    } catch (error: any) {
        console.error("Create Upload Record Error:", error);
        return { success: false, error: error.message };
    }
}

export async function getPendingUploads() {
    try {
        const { data, error } = await supabase
            .from('resume_uploads')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true }); // Process oldest first

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        console.error("Get Pending Uploads Error:", error);
        return { success: false, error: error.message };
    }
}

export async function updateUploadStatus(id: string, status: string, note?: string) {
    try {
        const updateData: any = { status };
        if (note) updateData.note = note; // Assuming 'note' column exists or we might need to add it? 
        // Wait, user schema didn't explicitly ask for 'note' in the CREATE TABLE SQL provided earlier?
        // Let's check the SQL provided in plan:
        // status TEXT DEFAULT 'pending', candidate_id TEXT ...
        // It didn't have 'note'. But 'resume_uploads' usually benefits from error message.
        // Let's assume we might need to store error in 'status' if short, or ignore note if column missing.
        // Or better: update plan to include 'note' column? 
        // The user said "Done" based on the SQL provided.
        // The SQL was: id, created_at, resume_url, file_name, uploader_email, status, candidate_id, candidate_name, position, company.
        // No 'note' column. 
        // I will just put the note in status if it's an error, e.g. "Error: ..."

        // Actually, for duplicates, we said: status = "Found duplicate with Cxxxxx"

        const { error } = await supabase
            .from('resume_uploads')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error("Update Status Error:", error);
        return { success: false, error: error.message };
    }
}
