"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function getIndustryGroupOptions(): Promise<{ industry: string; group: string }[]> {
    const { data } = await (adminAuthClient as any)
        .from('industry_group')
        .select('industry, group')
        .order('group')
        .order('industry');
    return data || [];
}

export async function getCompanyAffectedCount(companyId: string): Promise<number> {
    const { count } = await (adminAuthClient as any)
        .from('candidate_experiences')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);
    return count || 0;
}

export async function updateCompanyIndustryGroup(
    companyId: string,
    industry: string,
    group: string,
): Promise<{ success: boolean; affected: number; error?: string }> {
    const supabase = adminAuthClient as any;

    // Update company_master
    const { error: masterError } = await supabase
        .from('company_master')
        .update({ industry, group })
        .eq('company_id', companyId);

    if (masterError) return { success: false, affected: 0, error: masterError.message };

    // Count then cascade to candidate_experiences
    const { count } = await supabase
        .from('candidate_experiences')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

    const { error: expError } = await supabase
        .from('candidate_experiences')
        .update({ company_industry: industry, company_group: group })
        .eq('company_id', companyId);

    if (expError) return { success: false, affected: 0, error: expError.message };

    revalidatePath('/requisitions/manage');

    return { success: true, affected: count || 0 };
}
