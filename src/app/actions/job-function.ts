"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface JobGroupingOption {
    label: string;
    functions: string[];
}

export async function getJobFunctionOptions(): Promise<JobGroupingOption[]> {
    const { data, error } = await (adminAuthClient as any)
        .from("job_function_master")
        .select("grouping_name, grouping_code, function_name, function_code")
        .order("grouping_name")
        .order("function_name");

    if (error) throw new Error(error.message);

    const byGrouping = new Map<string, JobGroupingOption>();
    for (const row of (data as any[]) ?? []) {
        const label = `${row.grouping_name} (${row.grouping_code})`;
        if (!byGrouping.has(label)) byGrouping.set(label, { label, functions: [] });
        byGrouping.get(label)!.functions.push(`${row.function_name} (${row.function_code})`);
    }
    return [...byGrouping.values()].sort((a, b) => a.label.localeCompare(b.label));
}

async function resolveActorName(): Promise<string> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) return "System";
        const { data } = await adminAuthClient
            .from("user_profiles")
            .select("real_name")
            .eq("email", user.email)
            .single();
        return (data as any)?.real_name || user.email;
    } catch {
        return "System";
    }
}

export async function addJobFunctionOption(groupingLabel: string, rawFunctionName: string): Promise<string> {
    const match = groupingLabel.match(/^(.*) \(([A-Za-z0-9]+)\)$/);
    if (!match) throw new Error("Invalid job grouping");
    const [, grouping_name, grouping_code] = match;

    const function_name = rawFunctionName.trim();
    if (!function_name) throw new Error("Function name is required");

    const { data: existing } = await (adminAuthClient as any)
        .from("job_function_master")
        .select("function_code")
        .eq("grouping_code", grouping_code);

    const usedCodes = new Set(((existing as any[]) ?? []).map(r => r.function_code));
    let functionCode = "";
    for (let i = 0; i < 26; i++) {
        const letter = String.fromCharCode(65 + i);
        const candidate = `${grouping_code}-${letter}`;
        if (!usedCodes.has(candidate) && !usedCodes.has(letter)) { functionCode = candidate; break; }
    }
    if (!functionCode) functionCode = `${grouping_code}-${Date.now().toString(36).toUpperCase()}`;

    const created_by = await resolveActorName();

    const { error } = await (adminAuthClient as any).from("job_function_master").insert({
        grouping_name,
        grouping_code,
        function_name,
        function_code: functionCode,
        created_by,
    });

    if (error) {
        if ((error as any).code === "23505") throw new Error("This job function already exists");
        throw new Error(error.message);
    }

    return `${function_name} (${functionCode})`;
}
