"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export interface PlacementRecord {
    jr_id: string;
    candidate_id: string;
    position: string;
    bu: string;
    sub_bu: string;
    candidate_name: string;
    hire_date: string;
    hiring_status: string;
    outsource_fee_20_percent: number;
    job_grade: number | null;
    annual_salary: number;
}

export interface JRRecord {
    jr_id: string;
    bu: string;
    sub_bu: string;
    request_date: string;
}

export interface RawPlacementData {
    placements: PlacementRecord[];
    jrs: JRRecord[];
}

// Fetch ALL raw data once — filtering done client-side for instant response
export async function getRawPlacementData(): Promise<RawPlacementData> {
    const supabase = adminAuthClient;

    const [erRes, jrRes] = await Promise.all([
        supabase
            .from('employment_record')
            .select('jr_id, candidate_id, position, bu, sub_bu, candidate_name, hire_date, hiring_status, outsource_fee_20_percent, job_grade, annual_salary'),
        supabase
            .from('job_requisitions')
            .select('jr_id, bu, sub_bu, request_date'),
    ]);

    const rawPlacements = erRes.data || [];

    // Live-join candidate_name from Candidate Profile — same fix already applied
    // to getEmploymentRecords() (requisitions/placements): name should always
    // reflect the current profile, not whatever was captured when this
    // employment_record row was written. Position/BU/salary stay as stored —
    // those are historical facts about this specific placement.
    const candidateIds = [...new Set(rawPlacements.map((r: any) => r.candidate_id).filter(Boolean))];
    const nameByCandidateId = new Map<string, string>();
    if (candidateIds.length > 0) {
        const { data: profiles } = await supabase
            .from('Candidate Profile')
            .select('candidate_id, name')
            .in('candidate_id', candidateIds);
        (profiles || []).forEach((p: any) => { if (p.name) nameByCandidateId.set(p.candidate_id, p.name); });
    }

    const placements: PlacementRecord[] = rawPlacements.map((r: any) => ({
        ...r,
        candidate_name: (r.candidate_id && nameByCandidateId.get(r.candidate_id)) || r.candidate_name,
        outsource_fee_20_percent: r.outsource_fee_20_percent || 0,
        annual_salary: r.annual_salary || 0,
    }));

    const jrs: JRRecord[] = (jrRes.data || []).map((r: any) => ({ ...r }));

    return { placements, jrs };
}
