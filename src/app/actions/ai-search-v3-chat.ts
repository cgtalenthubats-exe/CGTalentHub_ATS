"use server";

import { supabaseB } from "@/lib/supabase/project-b";
import { getCurrentUserRealName } from "./user-actions";
import { V3_SESSION_ID } from "@/lib/ai-search-v3-constants";

const V3_CHAT_WEBHOOK = "https://n8n.srv1212906.hstgr.cloud/webhook/0777f5b4-867c-499e-b412-d5daecefefb5";

export type ChatHistoryMessage = {
    role: "user" | "ai";
    text: string;
    sender?: string;
    filters?: any;
    sessionId?: string;
};

// Strips an optional "[USER: name]" prefix added by the n8n workflow's Extract Input node.
const HUMAN_PREFIX_RE = /^\[USER:([^\]]+)\]\n?/;

// Mirrors the n8n workflow's own "Parse Output" node: an AI turn's raw stored
// content may still contain either an inline JSON blob (from a tool call
// short-circuit) or a "__FILTERS__ ... __/FILTERS__" block appended by the
// Agent Manager — pull those out so history renders the same as a live turn.
function parseAiContent(raw: string): { text: string; filters: any; sessionId?: string } {
    let text = raw;
    let filters: any = {};
    let sessionId: string | undefined;

    const findJson = (t: string) => {
        let depth = 0, start = -1;
        for (let i = 0; i < t.length; i++) {
            if (t[i] === "{") {
                if (depth === 0) start = i;
                depth++;
            } else if (t[i] === "}") {
                depth--;
                if (depth === 0 && start >= 0) {
                    try {
                        const parsed = JSON.parse(t.slice(start, i + 1));
                        if (parsed.total !== undefined) return parsed;
                    } catch {}
                    start = -1;
                }
            }
        }
        return null;
    };

    const inline = findJson(raw);
    if (inline) {
        if (inline.filters) filters = inline.filters;
        if (inline.session_id) sessionId = inline.session_id;
        const names = (inline.sample ?? []).map((s: any) => s.name).filter((n: string) => n && n !== "N/A").join(", ");
        text = `Found ${inline.total} candidates.` + (names ? `\nSample: ${names}` : "");
    } else {
        const filtersMatch = raw.match(/__FILTERS__([\s\S]*?)__\/FILTERS__/);
        if (filtersMatch) {
            try { filters = JSON.parse(filtersMatch[1].trim()); } catch {}
            text = raw.replace(/__FILTERS__[\s\S]*?__\/FILTERS__/, "").trim();
        }
        const sessionMatch = raw.match(/v2_\d{10,}/);
        if (sessionMatch) sessionId = sessionMatch[0];
    }

    return { text, filters, sessionId };
}

export async function getV3ChatHistory(): Promise<ChatHistoryMessage[]> {
    const { data, error } = await supabaseB
        .from("n8n_chat_histories")
        .select("id, message")
        .eq("session_id", V3_SESSION_ID)
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
            // Skip intermediate "Calling X with input: ..." tool-call turns
            const toolCalls = msg.tool_calls ?? [];
            if (toolCalls.length > 0) continue;
            const raw: string = msg.content ?? "";
            if (!raw.trim()) continue;
            const { text, filters, sessionId } = parseAiContent(raw.trim());
            if (text) {
                messages.push({
                    role: "ai",
                    text,
                    filters: Object.keys(filters).length > 0 ? filters : undefined,
                    sessionId: sessionId?.startsWith("v2_") ? sessionId : undefined,
                });
            }
        }
        // type "tool" (intermediate tool results) — internal only, skipped
    }
    return messages;
}

export async function sendV3ChatMessage(
    message: string,
): Promise<{ answer: string; filters: any; sessionId?: string; sender: string }> {
    const userName = await getCurrentUserRealName();
    const response = await fetch(V3_CHAT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId: V3_SESSION_ID, user_name: userName }),
        signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const rawText = await response.text();
    let content = "";
    let filters: any = {};
    let sessionId: string | undefined;

    try {
        const data = JSON.parse(rawText);
        const first = Array.isArray(data) ? data[0] : data;
        content = first.answer ?? first.output ?? first.text ?? rawText;
        content = content.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"');
        if (first?.filters) filters = first.filters;
        if (typeof first?.session_id === "string" && first.session_id.startsWith("v2_")) {
            sessionId = first.session_id;
        }
    } catch {
        content = rawText;
    }

    return { answer: content || "⚠️ No response", filters, sessionId, sender: userName };
}
