"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// --- Helper: Get current user email ---
async function getCurrentUserEmail(): Promise<string | null> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        console.log("Current User Email:", user?.email);
        return user?.email || null;
    } catch (e) {
        console.error("Auth Error:", e);
        return null; // Fallback to null to trigger "Not authenticated" error in actions
    }
}

// --- 1. Get Session History List ---
export async function getAssistantSessions() {
    try {
        const email = await getCurrentUserEmail();
        if (!email) return { success: false, error: "Not authenticated" };

        const supabase = await createClient();
        const { data, error } = await (supabase
            .from('assistant_sessions' as any) as any)
            .select('*')
            .eq('user_email', email)
            .order('created_at', { ascending: false });

        if (error) throw error;
        console.log(`Fetched ${data?.length || 0} sessions for ${email}`);
        return { success: true, data };
    } catch (error: any) {
        console.error("getAssistantSessions Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 2. Create/Update Session Mapping ---
export async function saveAssistantSession(sessionId: string, title: string) {
    try {
        const email = await getCurrentUserEmail();
        // If not authenticated, we can't save history securely. 
        // For local development, you might want to bypass this, 
        // but for safety we return error.
        if (!email) {
            console.warn("Save Session failed: No user email found.");
            return { success: false, error: "Not authenticated" };
        }

        const supabase = await createClient();
        
        // Check if session already exists
        const { data: existing } = await (supabase
            .from('assistant_sessions' as any) as any)
            .select('session_id')
            .eq('session_id', sessionId)
            .maybeSingle();

        if (existing) {
            // Update title if it's the first real message or needs update
            await (supabase
                .from('assistant_sessions' as any) as any)
                .update({ title } as any)
                .eq('session_id', sessionId);
            console.log(`Updated title for existing session ${sessionId}`);
        } else {
            // Create new mapping
            const { error } = await (supabase
                .from('assistant_sessions' as any) as any)
                .insert([{
                    session_id: sessionId,
                    user_email: email,
                    title: title || "New Chat"
                }] as any);
            if (error) throw error;
            console.log(`Created new session mapping: ${sessionId} for ${email}`);
        }

        revalidatePath('/assistant');
        return { success: true };
    } catch (error: any) {
        console.error("saveAssistantSession Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 3. Delete Session ---
export async function deleteAssistantSession(sessionId: string) {
    try {
        const supabase = await createClient();
        const { error } = await (supabase
            .from('assistant_sessions' as any) as any)
            .delete()
            .eq('session_id', sessionId);

        if (error) throw error;
        
        await (supabase
            .from('n8n_chat_histories' as any) as any)
            .delete()
            .eq('session_id', sessionId);

        revalidatePath('/assistant');
        return { success: true };
    } catch (error: any) {
        console.error("deleteAssistantSession Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 4. Get Message Metadata (Fast) ---
export async function getAssistantMessageMetadata(sessionId: string, limit: number = 30) {
    try {
        const supabase = await createClient();
        const { data, error } = await (supabase
            .from('n8n_chat_histories' as any) as any)
            .select('id')
            .eq('session_id', sessionId)
            .order('id', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return { success: true, data: (data || []).map((d: any) => d.id.toString()) };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// --- 5. Get Batch Message Content (Granular) ---
export async function getAssistantMessagesByIds(ids: string[]) {
    try {
        if (!ids.length) return { success: true, data: [] };
        const supabase = await createClient();
        const { data, error } = await (supabase
            .from('n8n_chat_histories' as any) as any)
            .select('id, message')
            .in('id', ids)
        console.log(`[DEBUG] Batch Content: Found ${data?.length || 0} rows for IDs: ${ids.slice(0, 3).join(", ")}...`);

        const messages = (data || []).map((row: any) => {
            let raw = row.message;
            
            // Handle stringified JSON if Supabase didn't parse it
            if (typeof raw === 'string') {
                try { raw = JSON.parse(raw); } catch { /* ignore */ }
            }
            
            if (!raw || typeof raw !== 'object') {
                return {
                    id: row.id.toString(),
                    role: "assistant",
                    content: typeof raw === 'string' ? raw : "Empty message",
                    timestamp: new Date() // Fallback since created_at is missing in this table
                };
            }

            // n8n/LangChain versions use 'content' or 'text'
            let content = raw.content || raw.text || "";
            
            // Truncate huge payloads for safety
            if (typeof content === 'string' && content.length > 20000) {
                content = content.slice(0, 20000) + "... [Truncated]";
            }
            
            // Standardize role
            const type = raw.type?.toLowerCase();
            const role = (type === "human" || type === "user") ? "user" : "assistant";

            return {
                id: row.id.toString(),
                role: role,
                content: content,
                timestamp: new Date() // Fallback since created_at is missing in this table
            };
        });

        if (messages.length > 0) {
            console.log(`[DEBUG] Sample Parsed Msg: role=${messages[0].role}, contentLen=${messages[0].content.length}`);
        }

        // Maintain the order of the original IDs if possible, or just return sorted
        return { success: true, data: messages.reverse() };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// Keep legacy for compatibility but redirect to split logic
export async function getAssistantMessages(sessionId: string, limit: number = 20) {
    const meta = await getAssistantMessageMetadata(sessionId, limit);
    if (!meta.success) return meta;
    return getAssistantMessagesByIds(meta.data as string[]);
}
