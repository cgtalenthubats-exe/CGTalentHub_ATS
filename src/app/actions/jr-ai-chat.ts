"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { getCurrentUserRealName } from "./user-actions";

const JR_AI_CHAT_WEBHOOK = "https://n8n.srv1212906.hstgr.cloud/webhook/jr-ai-chat";

export type ChatHistoryMessage = {
    role: "user" | "ai";
    text: string;
    sender?: string;
};

// Strips the "[JR: id — title]" prefix and an optional "[USER: name]" prefix
// added by the n8n workflow's Extract Input node, capturing the sender name.
const HUMAN_PREFIX_RE = /^\[JR:[^\]]+\]\n?(?:\[USER:([^\]]+)\]\n?)?/;

export async function getJrChatHistory(jrId: string): Promise<ChatHistoryMessage[]> {
    const sessionId = `jr_${jrId}`;
    const { data, error } = await adminAuthClient
        .from("n8n_chat_histories")
        .select("id, message")
        .eq("session_id", sessionId)
        .order("id", { ascending: true });

    if (error || !data) return [];

    const messages: ChatHistoryMessage[] = [];
    for (const row of data as any[]) {
        const msg = row.message;
        if (!msg?.type) continue;
        if (msg.type === "human") {
            const content: string = msg.content ?? "";
            const match = content.match(HUMAN_PREFIX_RE);
            const sender = match?.[1]?.trim();
            const text = content.replace(HUMAN_PREFIX_RE, "").trim();
            if (text) messages.push({ role: "user", text, sender });
        } else if (msg.type === "ai") {
            // Skip tool-call messages (AI calling a tool internally)
            const toolCalls = msg.tool_calls ?? [];
            if (toolCalls.length > 0) continue;
            const text: string = msg.content ?? "";
            if (text.trim()) messages.push({ role: "ai", text: text.trim() });
        }
        // Skip type: 'tool' (tool results) — internal only
    }
    return messages;
}

export async function sendJrChatMessage(
    message: string,
    jrId: string,
    jrTitle: string,
): Promise<{ answer: string; sender: string }> {
    const sessionId = `jr_${jrId}`;
    const userName = await getCurrentUserRealName();
    const response = await fetch(JR_AI_CHAT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId, jr_id: jrId, jr_title: jrTitle, user_name: userName }),
        signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
    const data = await response.json();
    return { answer: data.answer ?? data.text ?? "ไม่ได้รับคำตอบ", sender: userName };
}
