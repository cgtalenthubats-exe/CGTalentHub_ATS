import { createMcpHandler, getPublicOrigin } from "mcp-handler";
import { tools } from "@/lib/mcp/tools";
import { authenticateMcp } from "@/lib/mcp/auth";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const INSTRUCTIONS =
    "CG Talent Hub ATS (hospitality recruitment). Read-only tools. " +
    "Start with search_candidates (needs >=1 filter; returns total + one page) and list_jrs; page with offset while has_more is true. " +
    "Only call get_candidate_profile / get_jr for specific items you need, not in bulk. " +
    "Search results include photo URLs and LinkedIn links. Candidate data is confidential PII.";

const mcp = createMcpHandler(
    (server: any) => {
        for (const t of tools) {
            server.registerTool(
                t.name,
                { ...(t.config as any), annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
                t.handler as any,
            );
        }
    },
    { instructions: INSTRUCTIONS, serverInfo: { name: "cgats", version: "0.2.0" } } as any,
);

async function logToolCall(req: Request, who: string) {
    try {
        if (req.method !== "POST") return;
        const body = await req.clone().json();
        const calls = Array.isArray(body) ? body : [body];
        for (const c of calls) {
            if (c?.method === "tools/call") console.log(`[mcp] ${who} -> ${c.params?.name}`);
        }
    } catch {
        // logging must never break a request
    }
}

async function handler(req: Request) {
    const auth = await authenticateMcp(req);
    if (!auth.ok) {
        // Per the MCP auth spec: point clients at the protected-resource metadata so they can start OAuth.
        const metadata = `${getPublicOrigin(req)}/.well-known/oauth-protected-resource`;
        return new Response(auth.message, {
            status: auth.status,
            headers: { "WWW-Authenticate": `Bearer resource_metadata="${metadata}"` },
        });
    }
    await logToolCall(req, auth.who);
    return mcp(req);
}

export { handler as GET, handler as POST, handler as DELETE };
