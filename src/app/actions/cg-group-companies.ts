"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface CgGroupCompany {
    id: number;
    bu_abbr: string;
    bu_name: string;
    sub_bu_abbr: string | null;
    sub_bu_name: string | null;
    is_active: boolean;
}

export interface CgBuTree {
    bu_abbr: string;
    bu_name: string;
    sub_bus: { sub_bu_abbr: string; sub_bu_name: string | null }[];
}

export interface MappedCompany {
    company_id: number;
    company_name: string;
    bu_abbr: string;
    sub_bu_abbr: string | null;
    sub_bu_name: string | null;
    candidate_count: number;
    cg_company_id: number;
}

export interface PendingCompany {
    company_id: number;
    company_name: string;
    candidate_count: number;
}

// ─── cg_group_companies ───────────────────────────────────────────────────────

export async function getCgGroupCompanies(): Promise<CgGroupCompany[]> {
    const { data } = await (adminAuthClient as any)
        .from('cg_group_companies')
        .select('*')
        .order('bu_abbr')
        .order('sub_bu_abbr');
    return data || [];
}

export async function getCgBuTree(): Promise<CgBuTree[]> {
    const companies = await getCgGroupCompanies();
    const map = new Map<string, CgBuTree>();
    for (const c of companies) {
        if (!map.has(c.bu_abbr)) {
            map.set(c.bu_abbr, { bu_abbr: c.bu_abbr, bu_name: c.bu_name, sub_bus: [] });
        }
        if (c.sub_bu_abbr) {
            map.get(c.bu_abbr)!.sub_bus.push({ sub_bu_abbr: c.sub_bu_abbr, sub_bu_name: c.sub_bu_name });
        }
    }
    return Array.from(map.values());
}

export async function addCgGroupCompany(data: {
    bu_abbr: string;
    bu_name: string;
    sub_bu_abbr?: string;
    sub_bu_name?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
    const { data: row, error } = await (adminAuthClient.from('cg_group_companies') as any).insert({
        bu_abbr: data.bu_abbr,
        bu_name: data.bu_name,
        sub_bu_abbr: data.sub_bu_abbr || null,
        sub_bu_name: data.sub_bu_name || null,
    }).select('id').single();
    if (error) return { success: false, error: error.message };
    revalidatePath('/internal');
    return { success: true, id: row?.id };
}

export async function updateCgGroupCompany(
    id: number,
    data: { sub_bu_name?: string; bu_name?: string; is_active?: boolean }
): Promise<{ success: boolean; error?: string }> {
    const { error } = await (adminAuthClient.from('cg_group_companies') as any)
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) return { success: false, error: error.message };
    revalidatePath('/internal');
    return { success: true };
}

export async function deleteCgGroupCompany(id: number): Promise<{ success: boolean; error?: string }> {
    const supabase = adminAuthClient as any;
    // ตรวจก่อนว่ามี company_cg_mapping ใช้ entry นี้อยู่มั้ย
    const { count } = await supabase
        .from('company_cg_mapping')
        .select('*', { count: 'exact', head: true })
        .eq('cg_company_id', id);
    if (count && count > 0) {
        return { success: false, error: `Cannot delete — used by ${count} company mapping(s). Remove mappings first.` };
    }
    const { error } = await supabase.from('cg_group_companies').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    revalidatePath('/internal');
    return { success: true };
}

// ─── company_cg_mapping ───────────────────────────────────────────────────────

// Map company_id → BU/Sub-BU (cg_company_id)
export async function saveCompanyMapping(
    companyId: number,
    cgCompanyId: number,
    mappedBy?: string
): Promise<{ success: boolean; error?: string }> {
    const { error } = await (adminAuthClient.from('company_cg_mapping') as any).upsert({
        company_id: companyId,
        cg_company_id: cgCompanyId,
        mapped_by: mappedBy || 'admin',
        mapped_at: new Date().toISOString(),
    }, { onConflict: 'company_id' });
    if (error) return { success: false, error: error.message };
    revalidatePath('/internal');
    return { success: true };
}

// นับ candidate ที่จะถูกกระทบถ้า map company_id นี้
export async function getCompanyMappingImpact(companyId: number): Promise<{
    candidate_count: number;
    candidates: { candidate_id: string; name: string }[];
}> {
    const supabase = adminAuthClient as any;

    // หา candidates ที่มี experience กับ company นี้
    const { data: exps } = await supabase
        .from('candidate_experiences')
        .select('candidate_id')
        .eq('company_id', companyId);

    if (!exps?.length) return { candidate_count: 0, candidates: [] };

    const ids = [...new Set(exps.map((e: any) => e.candidate_id))] as string[];

    const { data: profiles } = await supabase
        .from('Candidate Profile')
        .select('candidate_id, name')
        .in('candidate_id', ids)
        .limit(5);

    return {
        candidate_count: ids.length,
        candidates: profiles || [],
    };
}

// company_master ที่ candidate Internal/Ex-Central ใช้อยู่ → แยก Mapped vs Pending
export async function getCompanySetupData(): Promise<{
    mapped: MappedCompany[];
    pending: PendingCompany[];
}> {
    const supabase = adminAuthClient as any;

    // หา candidate IDs ที่เป็น Internal หรือ Ex-Central
    const { data: profiles } = await supabase
        .from('Candidate Profile')
        .select('candidate_id')
        .or('candidate_status.cs.{"Internal Candidate"},candidate_status.cs.{"Ex-Central"}');

    if (!profiles?.length) return { mapped: [], pending: [] };

    const candidateIds = profiles.map((p: any) => p.candidate_id);

    // ดึง company_ids จาก experiences
    const { data: exps } = await supabase
        .from('candidate_experiences')
        .select('company_id, candidate_id')
        .in('candidate_id', candidateIds)
        .not('company_id', 'is', null);

    if (!exps?.length) return { mapped: [], pending: [] };

    // นับ candidates per company
    const companyCountMap = new Map<number, Set<string>>();
    for (const e of exps) {
        if (!companyCountMap.has(e.company_id)) companyCountMap.set(e.company_id, new Set());
        companyCountMap.get(e.company_id)!.add(e.candidate_id);
    }

    const allCompanyIds = [...companyCountMap.keys()];

    // ดึง company names + filter เฉพาะที่ชื่อมี Central/Centara/หรือ brand ที่รู้จัก
    const { data: companies } = await supabase
        .from('company_master')
        .select('company_id, company_master')
        .in('company_id', allCompanyIds)
        .or([
            'company_master.ilike.%central%',
            'company_master.ilike.%centara%',
            'company_master.ilike.%CPN%',
            'company_master.ilike.%robinson%',
            'company_master.ilike.%supersports%',
            'company_master.ilike.%officemate%',
            'company_master.ilike.%power buy%',
            'company_master.ilike.%b2s%',
            'company_master.ilike.%the 1%',
        ].join(','));

    if (!companies?.length) return { mapped: [], pending: [] };

    // ดึง existing mappings
    const relevantIds = companies.map((c: any) => c.company_id);
    const { data: mappings } = await supabase
        .from('company_cg_mapping')
        .select('company_id, cg_company_id, cg_group_companies(bu_abbr, sub_bu_abbr, sub_bu_name)')
        .in('company_id', relevantIds);

    const mappingMap = new Map((mappings || []).map((m: any) => [m.company_id, m]));

    const mapped: MappedCompany[] = [];
    const pending: PendingCompany[] = [];

    for (const c of companies) {
        const count = companyCountMap.get(c.company_id)?.size || 0;
        const mapping = mappingMap.get(c.company_id) as any;
        if (mapping) {
            mapped.push({
                company_id: c.company_id,
                company_name: c.company_master,
                bu_abbr: mapping.cg_group_companies?.bu_abbr,
                sub_bu_abbr: mapping.cg_group_companies?.sub_bu_abbr,
                sub_bu_name: mapping.cg_group_companies?.sub_bu_name,
                candidate_count: count,
                cg_company_id: mapping.cg_company_id,
            });
        } else {
            pending.push({
                company_id: c.company_id,
                company_name: c.company_master,
                candidate_count: count,
            });
        }
    }

    mapped.sort((a, b) => b.candidate_count - a.candidate_count);
    pending.sort((a, b) => b.candidate_count - a.candidate_count);

    return { mapped, pending };
}

// candidate_cg_profile — สำหรับ manual override (no company)
export async function saveCandidateCgProfile(
    candidateId: string,
    buAbbr: string | null,
    subBuAbbr: string | null,
    updatedBy?: string,
    jobGrade?: number | null,
): Promise<{ success: boolean; error?: string }> {
    const { error } = await (adminAuthClient.from('candidate_cg_profile') as any).upsert({
        candidate_id: candidateId,
        bu_abbr: buAbbr,
        sub_bu_abbr: subBuAbbr,
        source: 'manual',
        updated_by: updatedBy || 'admin',
        updated_at: new Date().toISOString(),
        ...(jobGrade !== undefined ? { job_grade: jobGrade } : {}),
    }, { onConflict: 'candidate_id' });
    if (error) return { success: false, error: error.message };
    revalidatePath('/internal');
    return { success: true };
}

// BU/Sub-BU ของ candidate จาก company mapping (Group 2)
export async function getCandidateBuFromMapping(candidateId: string): Promise<{
    bu_abbr: string | null;
    sub_bu_abbr: string | null;
    company_id: number | null;
    company_name: string | null;
    source: 'mapping' | 'profile' | null;
}> {
    const supabase = adminAuthClient as any;

    // ดู current job ก่อน
    const { data: currentExp } = await supabase
        .from('candidate_experiences')
        .select('company_id, company_master(company_id, company_master)')
        .eq('candidate_id', candidateId)
        .eq('is_current_job', 'Current')
        .limit(1)
        .maybeSingle();

    if (currentExp?.company_id) {
        const { data: mapping } = await supabase
            .from('company_cg_mapping')
            .select('cg_company_id, cg_group_companies(bu_abbr, sub_bu_abbr)')
            .eq('company_id', currentExp.company_id)
            .maybeSingle();

        if (mapping) {
            return {
                bu_abbr: mapping.cg_group_companies?.bu_abbr || null,
                sub_bu_abbr: mapping.cg_group_companies?.sub_bu_abbr || null,
                company_id: currentExp.company_id,
                company_name: currentExp.company_master?.company_master || null,
                source: 'mapping',
            };
        }
    }

    // fallback: candidate_cg_profile
    const { data: profile } = await supabase
        .from('candidate_cg_profile')
        .select('bu_abbr, sub_bu_abbr')
        .eq('candidate_id', candidateId)
        .maybeSingle();

    return {
        bu_abbr: profile?.bu_abbr || null,
        sub_bu_abbr: profile?.sub_bu_abbr || null,
        company_id: null,
        company_name: null,
        source: profile ? 'profile' : null,
    };
}
