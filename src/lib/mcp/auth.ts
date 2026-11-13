import { timingSafeEqual } from "node:crypto";
import { adminAuthClient } from "@/lib/supabase/admin";

export type McpAuthResult =
    | { ok: true; who: string }
    | { ok: false; status: 401 | 403; message: string };

function safeEqual(a: string, b: string) {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
}

/** Same whitelist the web app enforces in middleware (user_profiles, matched by email). */
export async function isWhitelisted(email: string): Promise<boolean> {
    const { data, error } = await (adminAuthClient as any)
        .from("user_profiles")
        .select("email")
        .eq("email", email)
        .maybeSingle();
    return !error && !!data;
}

/**
 * Accepts either:
 *  1. the static team token (MCP_API_TOKEN) — for Codex / Claude Code via headers, or
 *  2. a Supabase Auth access token (OAuth 2.1 flow used by ChatGPT / Claude.ai connectors)
 *     belonging to a user that is in user_profiles.
 */
export async function authenticateMcp(req: Request): Promise<McpAuthResult> {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) return { ok: false, status: 401, message: "Missing bearer token" };

    const staticToken = process.env.MCP_API_TOKEN;
    if (staticToken && safeEqual(token, staticToken)) return { ok: true, who: "static-token" };

    const { data, error } = await adminAuthClient.auth.getUser(token);
    const email = data?.user?.email;
    if (error || !email) return { ok: false, status: 401, message: "Invalid or expired token" };

    if (!(await isWhitelisted(email))) return { ok: false, status: 403, message: "User is not authorized" };
    return { ok: true, who: email };
}
