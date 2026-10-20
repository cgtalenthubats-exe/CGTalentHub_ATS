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

// PostgREST silently truncates any single select at 1000 rows with no error, so page with
// .range() until a page comes back short. orderBy must be a unique column so the pages are
// stable across round trips (otherwise a row can fall between two pages).
const SUPABASE_PAGE_SIZE = 1000;
async function fetchAllRows(table: string, select: string, orderBy: string): Promise<any[]> {
    const rows: any[] = [];
    for (let offset = 0; ; offset += SUPABASE_PAGE_SIZE) {
        const { data, error } = await (adminAuthClient as any)
            .from(table)
            .select(select)
            .order(orderBy, { ascending: true })
            .range(offset, offset + SUPABASE_PAGE_SIZE - 1);
        if (error) {
            console.error(`Error fetching ${table} at offset ${offset}:`, error);
            break;
        }
        if (!data?.length) break;
        rows.push(...data);
        if (data.length < SUPABASE_PAGE_SIZE) break;
    }
    return rows;
}

// Fetch ALL raw data once — filtering done client-side for instant response
export async function getRawPlacementData(): Promise<RawPlacementData> {
    const supabase = adminAuthClient;

    const [rawPlacements, rawJrs] = await Promise.all([
        fetchAllRows(
            'employment_record',
            'employment_record_id, jr_id, candidate_id, position, bu, sub_bu, candidate_name, hire_date, hiring_status, outsource_fee_20_percent, job_grade, annual_salary',
            'employment_record_id',
        ),
        fetchAllRows('job_requisitions', 'jr_id, bu, sub_bu, request_date', 'jr_id'),
    ]);

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

    const jrs: JRRecord[] = rawJrs.map((r: any) => ({ ...r }));

    return { placements, jrs };
}
