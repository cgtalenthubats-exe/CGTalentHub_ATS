import { timingSafeEqual } from "node:crypto";
import { createMcpHandler } from "mcp-handler";
import { tools } from "@/lib/mcp/tools";

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
    { instructions: INSTRUCTIONS, serverInfo: { name: "cgats", version: "0.1.0" } } as any,
);

function authorized(req: Request): boolean | null {
    const expected = process.env.MCP_API_TOKEN;
    if (!expected) return null; // not configured -> endpoint disabled
    const header = req.headers.get("authorization") ?? "";
    const given = header.startsWith("Bearer ") ? header.slice(7) : "";
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

async function handler(req: Request) {
    const auth = authorized(req);
    if (auth === null) return new Response("MCP endpoint disabled", { status: 503 });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
    return mcp(req);
}

export { handler as GET, handler as POST, handler as DELETE };
