import { generateProtectedResourceMetadata, getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";

export const dynamic = "force-dynamic";

// RFC 9728 protected-resource metadata. Served at both
//   /.well-known/oauth-protected-resource
//   /.well-known/oauth-protected-resource/api/mcp   (path-specific form some clients try first)
export function GET(req: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const metadata = generateProtectedResourceMetadata({
        authServerUrls: [`${supabaseUrl}/auth/v1`],
        resourceUrl: `${getPublicOrigin(req)}/api/mcp`,
    });
    return new Response(JSON.stringify(metadata), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "max-age=3600" },
    });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
