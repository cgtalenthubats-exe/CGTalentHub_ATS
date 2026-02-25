"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export interface PlacementRecord {
    jr_id: string;
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
    is_active: string;
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
            .select('jr_id, position, bu, sub_bu, candidate_name, hire_date, hiring_status, outsource_fee_20_percent, job_grade, annual_salary'),
        supabase
            .from('job_requisitions')
            .select('jr_id, bu, sub_bu, request_date, is_active'),
    ]);

    const placements: PlacementRecord[] = (erRes.data || []).map((r: any) => ({
        ...r,
        outsource_fee_20_percent: r.outsource_fee_20_percent || 0,
        annual_salary: r.annual_salary || 0,
    }));

    const jrs: JRRecord[] = (jrRes.data || []).map((r: any) => ({ ...r }));

    return { placements, jrs };
}
