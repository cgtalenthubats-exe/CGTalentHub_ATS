"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { cgCompanyMatch } from "@/lib/cg-company-match";

export interface InternalCandidate {
    candidate_id: string;
    name: string;
    photo: string | null;
    job_function: string | null;
    candidate_status: string[] | null;
    source: 'group1' | 'group2';
    // employment_record fields (Group 1 only)
    employment_record_id: string | null;
    employee_id: string | null;
    position: string | null;
    bu: string | null;
    sub_bu: string | null;
    job_grade: number | null;
    hire_date: string | null;
    hiring_status: string | null;
    resign_date: string | null;
    resignation_reason: string | null;
    jr_id: string | null;
    note: string | null;
    // candidate_cg_profile fields (Group 2 BU/Sub-BU — from mapping or manual)
    cg_bu_abbr: string | null;
    cg_sub_bu_abbr: string | null;
    cg_job_grade: number | null;
    current_company_id: number | null;
    // linkedin
    linkedin: string | null;
    // best experience (Current first, else Latest)
    exp_position: string | null;
    exp_company: string | null;
    exp_label: 'Current' | 'Latest Position' | null;
    // Ex-Central only: บริษัทในประวัติที่อยู่ใน company_cg_mapping
    cg_prev_company: string | null;
    cg_prev_position: string | null;
    // status mismatch detection (Group 2 only)
    status_mismatch: 'should_be_ex_central' | 'should_be_active' | null;
}

export interface InternalFilterOptions {
    bus: string[];
    sub_bus: string[];
    job_grades: number[];
}

export async function getInternalCandidates(filters?: {
    hiring_status?: 'Active' | 'Resigned' | 'All';
    bu?: string;
    sub_bu?: string;
    job_grade?: number;
    search?: string;
}): Promise<InternalCandidate[]> {
    const supabase = adminAuthClient;

    // Base: candidates with Internal Candidate OR Ex-Central status
    const { data: profiles, error: profErr } = await supabase
        .from('Candidate Profile')
        .select('candidate_id, name, photo, job_function, candidate_status, linkedin')
        .or('candidate_status.cs.{"Internal Candidate"},candidate_status.cs.{"Ex-Central"}')
        .order('name', { ascending: true });

    if (profErr || !profiles?.length) return [];

    // Filter by search
    let filtered = profiles as any[];
    if (filters?.search) {
        const q = filters.search.toLowerCase();
        filtered = filtered.filter((p: any) =>
            p.name?.toLowerCase().includes(q) ||
            p.candidate_id?.toLowerCase().includes(q)
        );
    }

    const candidateIds = filtered.map((p: any) => p.candidate_id);

    // Fetch employment_records (Group 1)
    const { data: ers } = await supabase
        .from('employment_record')
        .select('employment_record_id, candidate_id, employee_id, position, bu, sub_bu, job_grade, hire_date, hiring_status, resign_date, resignation_reason, jr_id, note, linkedIn')
        .in('candidate_id', candidateIds);

    const erMap = new Map<string, any>();
    (ers || []).forEach((er: any) => {
        if (!erMap.has(er.candidate_id) || (er.hire_date > (erMap.get(er.candidate_id)?.hire_date || ''))) {
            erMap.set(er.candidate_id, er);
        }
    });

    // Group 2: หา current company_id per candidate
    const group2Ids = filtered.filter((p: any) => !erMap.has(p.candidate_id)).map((p: any) => p.candidate_id);

    // current experiences ของ Group 2
    const { data: currentExps } = group2Ids.length ? await (supabase as any)
        .from('candidate_experiences')
        .select('candidate_id, company_id')
        .in('candidate_id', group2Ids)
        .eq('is_current_job', 'Current') : { data: [] };

    // company_id → candidate_id map (เอาแค่ 1 current company per candidate)
    const currentCompanyMap = new Map<string, number>();
    for (const e of (currentExps || [])) {
        if (!currentCompanyMap.has(e.candidate_id)) currentCompanyMap.set(e.candidate_id, e.company_id);
    }

    // company_cg_mapping: company_id → bu/sub_bu
    const currentCompanyIds = [...new Set(currentCompanyMap.values())];
    const { data: mappings } = currentCompanyIds.length ? await (supabase as any)
        .from('company_cg_mapping')
        .select('company_id, cg_group_companies(bu_abbr, sub_bu_abbr)')
        .in('company_id', currentCompanyIds) : { data: [] };

    const mappingByCompany = new Map<number, { bu_abbr: string | null; sub_bu_abbr: string | null }>(
        (mappings || []).map((m: any) => [m.company_id, m.cg_group_companies])
    );

    // candidate_cg_profile fallback (manual tag, no company)
    const { data: cgProfiles } = group2Ids.length ? await (supabase as any)
        .from('candidate_cg_profile')
        .select('candidate_id, bu_abbr, sub_bu_abbr, job_grade')
        .in('candidate_id', group2Ids) : { data: [] };

    const cgProfileMap = new Map<string, any>((cgProfiles || []).map((c: any) => [c.candidate_id, c]));

    // ── Experiences: ดึงของทุก candidate (ทั้ง group1 + group2) ──────────────
    const { data: allExps } = await (supabase as any)
        .from('candidate_experiences')
        .select('candidate_id, position, company, company_id, is_current_job, start_date')
        .in('candidate_id', candidateIds);

    // Best exp per candidate: Current first → latest start_date
    const bestExpMap = new Map<string, { position: string; company: string; company_id: number | null; label: 'Current' | 'Latest Position' }>();
    const allExpsByCand = new Map<string, any[]>();
    for (const e of (allExps || [])) {
        if (!allExpsByCand.has(e.candidate_id)) allExpsByCand.set(e.candidate_id, []);
        allExpsByCand.get(e.candidate_id)!.push(e);
    }
    for (const [cid, exps] of allExpsByCand) {
        exps.sort((a: any, b: any) => {
            const aCurr = (a.is_current_job || '').toLowerCase() === 'current';
            const bCurr = (b.is_current_job || '').toLowerCase() === 'current';
            if (aCurr !== bCurr) return aCurr ? -1 : 1;
            return (b.start_date || '').localeCompare(a.start_date || '');
        });
        const best = exps[0];
        const isCurr = (best.is_current_job || '').toLowerCase() === 'current';
        bestExpMap.set(cid, {
            position: best.position || '',
            company: best.company || '',
            company_id: best.company_id || null,
            label: isCurr ? 'Current' : 'Latest Position',
        });
    }

    // ── Mismatch detection: load cg sub_bu names for company name matching ──────
    const { data: cgNamesList } = await (supabase as any)
        .from('cg_group_companies')
        .select('sub_bu_name')
        .not('sub_bu_name', 'is', null);

    const cgSubBuNames = (cgNamesList || [])
        .map((c: any) => c.sub_bu_name?.toLowerCase())
        .filter(Boolean) as string[];

    // Which candidates are currently working at a CG company? (ILIKE on company name)
    const currentlyAtCgSet = new Set<string>();
    for (const [cid, exps] of allExpsByCand) {
        const hasCurrentCgJob = exps.some((e: any) => {
            if ((e.is_current_job || '').toLowerCase() !== 'current') return false;
            const compName = (e.company || '') as string;
            if (!compName || compName.length < 3) return false;
            return cgSubBuNames.some(cgName => cgCompanyMatch(cgName, compName));
        });
        if (hasCurrentCgJob) currentlyAtCgSet.add(cid);
    }

    // CG mapping lookup ของทุก company ที่ candidate เคยทำ (สำหรับ Ex-Central history)
    const allCompanyIds = [...new Set((allExps || []).map((e: any) => e.company_id).filter(Boolean))] as number[];
    const { data: allMappings } = allCompanyIds.length ? await (supabase as any)
        .from('company_cg_mapping')
        .select('company_id')
        .in('company_id', allCompanyIds) : { data: [] };
    const cgMappedCompanyIds = new Set<number>((allMappings || []).map((m: any) => m.company_id));

    // สำหรับ Ex-Central: หา CG company ล่าสุดในประวัติ (is_current_job = Current/Past ก็ได้ แต่ต้องอยู่ใน mapping)
    const cgPrevMap = new Map<string, { company: string; position: string }>();
    for (const [cid, exps] of allExpsByCand) {
        const cgExp = exps.find((e: any) => e.company_id && cgMappedCompanyIds.has(e.company_id));
        if (cgExp) cgPrevMap.set(cid, { company: cgExp.company || '', position: cgExp.position || '' });
    }

    let results: InternalCandidate[] = filtered.map((p: any) => {
        const er = erMap.get(p.candidate_id);
        const isGroup1 = !!er;

        let cg_bu_abbr: string | null = null;
        let cg_sub_bu_abbr: string | null = null;
        let current_company_id: number | null = null;

        let cg_job_grade: number | null = null;
        if (!isGroup1) {
            const companyId = currentCompanyMap.get(p.candidate_id) || null;
            current_company_id = companyId;
            const profile = cgProfileMap.get(p.candidate_id);
            // candidate_cg_profile is the primary source for Group 2
            cg_bu_abbr = profile?.bu_abbr || null;
            cg_sub_bu_abbr = profile?.sub_bu_abbr || null;
            cg_job_grade = profile?.job_grade || null;
        }

        // Mismatch detection (Group 2 only — Group 1 uses hiring_status field)
        let status_mismatch: 'should_be_ex_central' | 'should_be_active' | null = null;
        if (!isGroup1) {
            const isCurrentlyAtCg = currentlyAtCgSet.has(p.candidate_id);
            const isInternal = p.candidate_status?.includes('Internal Candidate');
            const isExCentral = p.candidate_status?.includes('Ex-Central');
            if (isInternal && !isCurrentlyAtCg) status_mismatch = 'should_be_ex_central';
            else if (isExCentral && isCurrentlyAtCg) status_mismatch = 'should_be_active';
        }

        return {
            candidate_id: p.candidate_id,
            name: p.name,
            photo: p.photo,
            job_function: p.job_function || null,
            candidate_status: p.candidate_status,
            source: isGroup1 ? 'group1' : 'group2',
            linkedin: er?.linkedIn || p.linkedin || null,
            employment_record_id: er?.employment_record_id || null,
            employee_id: er?.employee_id || null,
            position: er?.position || null,
            bu: er?.bu || null,
            sub_bu: er?.sub_bu || null,
            job_grade: er?.job_grade || null,
            hire_date: er?.hire_date || null,
            hiring_status: er?.hiring_status || null,
            resign_date: er?.resign_date || null,
            resignation_reason: er?.resignation_reason || null,
            jr_id: er?.jr_id || null,
            note: er?.note || null,
            cg_bu_abbr,
            cg_sub_bu_abbr,
            cg_job_grade,
            current_company_id,
            exp_position: bestExpMap.get(p.candidate_id)?.position || null,
            exp_company: bestExpMap.get(p.candidate_id)?.company || null,
            exp_label: bestExpMap.get(p.candidate_id)?.label || null,
            cg_prev_company: cgPrevMap.get(p.candidate_id)?.company || null,
            cg_prev_position: cgPrevMap.get(p.candidate_id)?.position || null,
            status_mismatch,
        };
    });

    // Filter by hiring_status / candidate_status
    if (filters?.hiring_status && filters.hiring_status !== 'All') {
        if (filters.hiring_status === 'Active') {
            results = results.filter(r =>
                r.hiring_status === 'Active' ||
                (!r.hiring_status && r.candidate_status?.includes('Internal Candidate'))
            );
        } else {
            results = results.filter(r =>
                r.hiring_status === 'Resigned' ||
                (!r.hiring_status && r.candidate_status?.includes('Ex-Central'))
            );
        }
    }

    // Filter by BU (Group 1 = er.bu, Group 2 = cg_bu_abbr)
    if (filters?.bu) results = results.filter(r => r.bu === filters.bu || r.cg_bu_abbr === filters.bu);
    if (filters?.sub_bu) results = results.filter(r => r.sub_bu === filters.sub_bu || r.cg_sub_bu_abbr === filters.sub_bu);
    if (filters?.job_grade) results = results.filter(r => r.job_grade === filters.job_grade);

    return results;
}

export async function getInternalFilterOptions(): Promise<InternalFilterOptions> {
    const supabase = adminAuthClient as any;

    const [{ data: erData }, { data: cgData }] = await Promise.all([
        supabase.from('employment_record').select('bu, sub_bu, job_grade'),
        supabase.from('candidate_cg_profile').select('bu_abbr, sub_bu_abbr'),
    ]);

    const bus = [...new Set([
        ...(erData || []).map((r: any) => r.bu),
        ...(cgData || []).map((r: any) => r.bu_abbr),
    ].filter(Boolean))].sort() as string[];

    const sub_bus = [...new Set([
        ...(erData || []).map((r: any) => r.sub_bu),
        ...(cgData || []).map((r: any) => r.sub_bu_abbr),
    ].filter(Boolean))].sort() as string[];

    const job_grades = [...new Set((erData || []).map((r: any) => r.job_grade).filter(Boolean))].sort((a: any, b: any) => a - b) as number[];

    return { bus, sub_bus, job_grades };
}

export async function addInternalCandidate(data: {
    name: string;
    position?: string;
    bu?: string;
    sub_bu?: string;
    job_grade?: number;
    linkedin_url?: string;
    hire_date?: string;
    employee_id?: string;
    note?: string;
}): Promise<{ success: boolean; candidate_id?: string; error?: string }> {
    const supabase = adminAuthClient;

    try {
        // Generate candidate ID
        const { data: maxIdResult } = await supabase
            .from('Candidate Profile')
            .select('candidate_id')
            .like('candidate_id', 'C%')
            .order('candidate_id', { ascending: false })
            .limit(1)
            .maybeSingle();

        const lastNum = maxIdResult ? parseInt((maxIdResult as any).candidate_id.replace('C', '')) : 0;
        const newId = `C${String(lastNum + 1).padStart(5, '0')}`;

        // Create Candidate Profile
        const { error: cpError } = await supabase
            .from('Candidate Profile')
            .insert({
                candidate_id: newId,
                name: data.name,
                linkedin: data.linkedin_url || null,
                candidate_status: ['Internal Candidate'],
            } as any);

        if (cpError) throw cpError;

        // Create employment_record
        const { data: maxErResult } = await supabase
            .from('employment_record')
            .select('er_number')
            .order('er_number', { ascending: false })
            .limit(1)
            .maybeSingle();

        const nextErNum = ((maxErResult as any)?.er_number || 0) + 1;
        const newErId = `ER${String(nextErNum).padStart(5, '0')}`;

        const { error: erError } = await supabase
            .from('employment_record')
            .insert({
                employment_record_id: newErId,
                er_number: nextErNum,
                candidate_id: newId,
                candidate_name: data.name,
                position: data.position || null,
                bu: data.bu || null,
                sub_bu: data.sub_bu || null,
                job_grade: data.job_grade || null,
                hire_date: data.hire_date || null,
                employee_id: data.employee_id || null,
                linkedIn: data.linkedin_url || null,
                hiring_status: 'Active',
                tracking_status: 'pending',
                note: data.note || null,
            } as any);

        if (erError) throw erError;

        revalidatePath('/internal');
        return { success: true, candidate_id: newId };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateInternalEmploymentRecord(
    employment_record_id: string,
    updates: {
        position?: string;
        bu?: string;
        sub_bu?: string;
        job_grade?: number | null;
        hire_date?: string;
        employee_id?: string;
        note?: string;
        linkedIn?: string;
    }
): Promise<{ success: boolean; error?: string }> {
    const supabase = adminAuthClient;
    const { error } = await (supabase.from('employment_record') as any)
        .update(updates)
        .eq('employment_record_id', employment_record_id);

    if (error) return { success: false, error: error.message };
    revalidatePath('/internal');
    return { success: true };
}

// เพิ่ม/ลบ Internal Candidate หรือ Ex-Central status + save BU info
export async function setCandidateInternalStatus(
    candidateId: string,
    action: 'add' | 'remove',
    status: 'Internal Candidate' | 'Ex-Central',
    buAbbr?: string | null,
    subBuAbbr?: string | null,
    triggerCompanyId?: number | null,
): Promise<{ success: boolean; error?: string }> {
    const supabase = adminAuthClient as any;

    // ดึง status ปัจจุบัน
    const { data: profile, error: fetchErr } = await supabase
        .from('Candidate Profile')
        .select('candidate_status')
        .eq('candidate_id', candidateId)
        .single();

    if (fetchErr) return { success: false, error: fetchErr.message };

    const current: string[] = profile?.candidate_status || [];
    let updated: string[];

    if (action === 'add') {
        updated = current.includes(status) ? current : [...current, status];
    } else {
        updated = current.filter((s: string) => s !== status);
    }

    const { error: updateErr } = await supabase
        .from('Candidate Profile')
        .update({ candidate_status: updated })
        .eq('candidate_id', candidateId);

    if (updateErr) return { success: false, error: updateErr.message };

    // ถ้า add → บันทึก BU/Sub-BU ด้วย
    if (action === 'add' && buAbbr) {
        await supabase.from('candidate_cg_profile').upsert({
            candidate_id: candidateId,
            bu_abbr: buAbbr,
            sub_bu_abbr: subBuAbbr || null,
            source: 'manual',
            updated_by: 'recruiter',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'candidate_id' });

        // ถ้ามี trigger company → save mapping ด้วย (ถ้ายังไม่มี)
        if (triggerCompanyId) {
            const { data: existing } = await supabase
                .from('company_cg_mapping')
                .select('company_id')
                .eq('company_id', triggerCompanyId)
                .maybeSingle();

            if (!existing) {
                const { data: cgEntry } = await supabase
                    .from('cg_group_companies')
                    .select('id')
                    .eq('bu_abbr', buAbbr)
                    .eq('sub_bu_abbr', subBuAbbr || '')
                    .maybeSingle();

                if (cgEntry) {
                    await supabase.from('company_cg_mapping').upsert({
                        company_id: triggerCompanyId,
                        cg_company_id: cgEntry.id,
                        mapped_by: 'recruiter',
                        mapped_at: new Date().toISOString(),
                    }, { onConflict: 'company_id' });
                }
            }
        }
    }

    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath('/internal');
    return { success: true };
}

export async function swapCandidateInternalStatus(
    candidateId: string,
    from: 'Internal Candidate' | 'Ex-Central',
    to: 'Internal Candidate' | 'Ex-Central',
): Promise<{ success: boolean; error?: string }> {
    const supabase = adminAuthClient as any;
    const { data: profile, error: fetchErr } = await supabase
        .from('Candidate Profile')
        .select('candidate_status')
        .eq('candidate_id', candidateId)
        .single();
    if (fetchErr) return { success: false, error: fetchErr.message };
    const current: string[] = profile?.candidate_status || [];
    const updated = [...current.filter((s: string) => s !== from), ...(current.includes(to) ? [] : [to])];
    const { error } = await supabase
        .from('Candidate Profile')
        .update({ candidate_status: updated })
        .eq('candidate_id', candidateId);
    if (error) return { success: false, error: error.message };
    revalidatePath('/internal');
    return { success: true };
}

export async function markAsResigned(
    employment_record_id: string,
    resign_date: string,
    resignation_reason?: string,
    resign_note?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = adminAuthClient;
    const { error } = await (supabase.from('employment_record') as any)
        .update({
            hiring_status: 'Resigned',
            resign_date,
            resignation_reason: resignation_reason || null,
            resign_note: resign_note || null,
        })
        .eq('employment_record_id', employment_record_id);

    if (error) return { success: false, error: error.message };
    revalidatePath('/internal');
    return { success: true };
}
