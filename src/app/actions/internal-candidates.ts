"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface InternalCandidate {
    candidate_id: string;
    name: string;
    photo: string | null;
    candidate_status: string[] | null;
    // employment_record fields
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
    // linkedin
    linkedin: string | null;
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
        .select('candidate_id, name, photo, candidate_status, linkedin')
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

    // Fetch employment_records
    const { data: ers } = await supabase
        .from('employment_record')
        .select('employment_record_id, candidate_id, employee_id, position, bu, sub_bu, job_grade, hire_date, hiring_status, resign_date, resignation_reason, jr_id, note, linkedIn')
        .in('candidate_id', candidateIds);

    const erMap = new Map<string, any>();
    (ers || []).forEach((er: any) => {
        // keep most recent (by er_number or hire_date)
        if (!erMap.has(er.candidate_id) || (er.hire_date > (erMap.get(er.candidate_id)?.hire_date || ''))) {
            erMap.set(er.candidate_id, er);
        }
    });

    let results: InternalCandidate[] = filtered.map((p: any) => {
        const er = erMap.get(p.candidate_id);
        return {
            candidate_id: p.candidate_id,
            name: p.name,
            photo: p.photo,
            candidate_status: p.candidate_status,
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
        };
    });

    // Filter by hiring_status
    if (filters?.hiring_status && filters.hiring_status !== 'All') {
        if (filters.hiring_status === 'Active') {
            results = results.filter(r => r.hiring_status === 'Active' || (!r.hiring_status && r.candidate_status?.includes('Internal Candidate')));
        } else {
            results = results.filter(r => r.hiring_status === 'Resigned' || (!r.hiring_status && r.candidate_status?.includes('Ex-Central')));
        }
    }

    // Filter by BU/Sub-BU/JG
    if (filters?.bu) results = results.filter(r => r.bu === filters.bu);
    if (filters?.sub_bu) results = results.filter(r => r.sub_bu === filters.sub_bu);
    if (filters?.job_grade) results = results.filter(r => r.job_grade === filters.job_grade);

    return results;
}

export async function getInternalFilterOptions(): Promise<InternalFilterOptions> {
    const supabase = adminAuthClient;
    const { data } = await supabase
        .from('employment_record')
        .select('bu, sub_bu, job_grade')
        .order('bu', { ascending: true });

    const bus = [...new Set((data || []).map((r: any) => r.bu).filter(Boolean))].sort() as string[];
    const sub_bus = [...new Set((data || []).map((r: any) => r.sub_bu).filter(Boolean))].sort() as string[];
    const job_grades = [...new Set((data || []).map((r: any) => r.job_grade).filter(Boolean))].sort((a, b) => a - b) as number[];

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
