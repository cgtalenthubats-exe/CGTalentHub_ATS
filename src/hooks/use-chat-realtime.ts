import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseA = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const supabaseB = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_B_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_B_ANON_KEY!
);

export type RealtimeChatMessage = {
    role: "user" | "ai";
    text: string;
    sender?: string;
};

// Strips an optional "[JR: ...]" and/or "[USER: name]" prefix that n8n's
// Extract Input node prepends before saving a human turn to memory.
const HUMAN_PREFIX_RE = /^(?:\[JR:[^\]]+\]\n?)?(?:\[USER:([^\]]+)\]\n?)?/;

// Subscribes to new rows inserted into n8n_chat_histories for a given session,
// normalizing them the same way the getXChatHistory server actions do.
// `project` selects which Supabase project the table lives in — JR Manage
// chat lives in project A (main app DB), ai-search-v3 chat lives in project B
// (the separate Supabase project the "New Chat bot - by path" n8n workflow
// writes its Postgres Memory to).
export function useChatRealtime(
    sessionId: string | undefined,
    onInsert: (msg: RealtimeChatMessage) => void,
    project: "A" | "B" = "A"
) {
    useEffect(() => {
        if (!sessionId) return;
        const supabase = project === "B" ? supabaseB : supabaseA;

        const channel = supabase
            .channel(`chat-updates-${project}-${sessionId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "n8n_chat_histories",
                    filter: `session_id=eq.${sessionId}`,
                },
                (payload) => {
                    const msg = (payload.new as any)?.message;
                    if (!msg?.type) return;

                    if (msg.type === "human") {
                        const content: string = msg.content ?? "";
                        const match = content.match(HUMAN_PREFIX_RE);
                        const sender = match?.[1]?.trim();
                        const text = content.replace(HUMAN_PREFIX_RE, "").trim();
                        if (text) onInsert({ role: "user", text, sender });
                    } else if (msg.type === "ai") {
                        const toolCalls = msg.tool_calls ?? [];
                        if (toolCalls.length > 0) return;
                        const text: string = (msg.content ?? "").trim();
                        if (text) onInsert({ role: "ai", text });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sessionId, onInsert, project]);
}
