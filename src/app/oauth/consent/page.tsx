import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isWhitelisted } from "@/lib/mcp/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function requireUser() {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email || !(await isWhitelisted(email))) redirect("/unauthorized");
    return { supabase, email };
}

async function decide(formData: FormData) {
    "use server";
    const authorizationId = String(formData.get("authorization_id") ?? "");
    const decision = String(formData.get("decision") ?? "");
    if (!authorizationId) redirect("/");

    const { supabase } = await requireUser();
    const { data, error } =
        decision === "approve"
            ? await supabase.auth.oauth.approveAuthorization(authorizationId)
            : await supabase.auth.oauth.denyAuthorization(authorizationId);

    if (error || !data?.redirect_url) {
        redirect(`/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}&error=${encodeURIComponent(error?.message ?? "failed")}`);
    }
    redirect(data.redirect_url);
}

export default async function ConsentPage({
    searchParams,
}: {
    searchParams: Promise<{ authorization_id?: string; error?: string }>;
}) {
    const { authorization_id: authorizationId, error: actionError } = await searchParams;
    if (!authorizationId) return <Shell title="Invalid request">Missing authorization_id.</Shell>;

    const { supabase, email } = await requireUser();
    const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error || !details) {
        return <Shell title="Invalid or expired request">{error?.message ?? "Please start the connection again from your AI app."}</Shell>;
    }

    // Already consented earlier -> go straight back to the client.
    if (!("authorization_id" in details)) redirect((details as any).redirect_url);

    const d = details as any;
    const redirectHost = (() => {
        try { return new URL(d.redirect_uri).host; } catch { return d.redirect_uri; }
    })();

    return (
        <Shell title={`Authorize ${d.client?.name ?? "this app"}`}>
            <p className="text-sm text-muted-foreground">
                Signed in as <strong>{email}</strong>
            </p>
            <div className="rounded-md border p-3 text-sm space-y-1">
                <div><strong>App:</strong> {d.client?.name ?? "Unknown"}</div>
                <div><strong>Returns to:</strong> {redirectHost}</div>
                {d.scope?.trim() && <div><strong>Scopes:</strong> {d.scope}</div>}
            </div>
            <p className="text-sm">
                This app will be able to <strong>read candidate profiles, job requisitions and pipelines</strong> on your behalf,
                including personal data. Only approve apps you started connecting yourself.
            </p>
            {actionError && <p className="text-sm text-red-600">Error: {actionError}</p>}
            <form action={decide} className="flex gap-3">
                <input type="hidden" name="authorization_id" value={authorizationId} />
                <Button type="submit" name="decision" value="approve" className="flex-1">Approve</Button>
                <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">Deny</Button>
            </form>
        </Shell>
    );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>CG Talent Hub ATS</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">{children}</CardContent>
            </Card>
        </div>
    );
}
