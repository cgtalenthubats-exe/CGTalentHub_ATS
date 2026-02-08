"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type PlacementData = {
    jr_candidate_id: string;
    hire_date: string | null;
    base_salary: number;
    job_grade?: string;
    employee_id?: string;
    hiring_manager?: string;
    note?: string;
    position?: string;
    bu?: string;
    sub_bu?: string;
};

export async function confirmPlacement(data: PlacementData) {
    const supabase = adminAuthClient;

    try {
        // 1. Fetch JR Candidate Details (to get candidate_id and jr_id)
        const { data: jrCand, error: jrCandError } = await (supabase
            .from('jr_candidates' as any)
            .select('candidate_id, jr_id')
            .eq('jr_candidate_id', data.jr_candidate_id)
            .single() as any);

        if (jrCandError || !jrCand) {
            throw new Error("JR Candidate not found: " + jrCandError?.message);
        }

        // 2. Fetch Candidate Profile (for name)
        const { data: profile, error: profileError } = await (supabase
            .from('Candidate Profile' as any)
            .select('name')
            .eq('candidate_id', jrCand.candidate_id)
            .single() as any);

        const candidateName = profile?.name || "Unknown";

        // Use provided values or fallback
        const position = data.position || "Unknown";
        const bu = data.bu || "Unknown";
        const sub_bu = data.sub_bu || "Unknown";

        // 3. Generate Employment Record ID
        const { data: maxResult } = await (supabase
            .from('employment_record' as any)
            .select('employment_record_id')
            .order('employment_record_id', { ascending: false })
            .limit(1)
            .maybeSingle() as any);

        let nextIdNum = 1;
        if (maxResult && (maxResult as any).employment_record_id) {
            const currentId = (maxResult as any).employment_record_id;
            // Expect format ERxxxxxx
            const numPart = currentId.replace(/^ER/, '');
            const parsed = parseInt(numPart);
            if (!isNaN(parsed)) {
                nextIdNum = parsed + 1;
            }
        }
        const nextErId = 'ER' + nextIdNum.toString().padStart(6, '0');

        // 4. Calculations
        const annual_salary = data.base_salary ? data.base_salary * 12 : 0;
        const outsource_fee = annual_salary * 0.20;

        // 5. Update JR Candidate Status
        const { error: updateError } = await (supabase
            .from('jr_candidates' as any)
            .update({
                temp_status: 'Successful Placement',
                time_stamp: new Date().toISOString()
            })
            .eq('jr_candidate_id', data.jr_candidate_id) as any);

        if (updateError) {
            // Fallback: try 'status' if pipeline_status/temp_status fails?
            // But treating 'temp_status' as the source of truth for now.
            throw new Error("Failed to update candidate status: " + updateError.message);
        }

        // 6. Update Job Requisition Status -> Inactive
        const { error: jrUpdateError } = await (supabase
            .from('job_requisitions' as any)
            .update({
                is_active: 'Inactive',
                updated_at: new Date().toISOString()
            })
            .eq('jr_id', jrCand.jr_id) as any);

        if (jrUpdateError) console.error("Failed to deactivate JR:", jrUpdateError);

        // 7. Create Employment Record
        const { error: insertError } = await (supabase
            .from('employment_record' as any)
            .insert({
                employment_record_id: nextErId,
                jr_id: jrCand.jr_id,
                candidate_id: jrCand.candidate_id,
                candidate_name: candidateName,
                position: position,
                bu: bu,
                sub_bu: sub_bu,
                hire_date: data.hire_date || null,
                base_salary: data.base_salary || null,
                annual_salary: annual_salary || null,
                outsource_fee_20_percent: outsource_fee || null,
                hiring_status: 'Active',
                job_grade: data.job_grade || null,
                employee_id: data.employee_id || null,
                hiring_manager: data.hiring_manager || null,
                note: data.note || null,
                create_by: 'System'
            }) as any);

        if (insertError) {
            console.error("Insert Employment Error", insertError);
            throw new Error("Failed to create employment record: " + insertError.message);
        }

        // 8. Create Log
        await (supabase.from('status_log' as any).insert({
            jr_candidate_id: data.jr_candidate_id,
            status: 'Successful Placement', // 'status' col in log
            updated_By: 'System', // 'updated_By' in log
            timestamp: new Date().toISOString()
        }) as any);

        revalidatePath('/requisitions/placements');
        revalidatePath(`/requisitions/manage`);

        return { success: true };

    } catch (error: any) {
        console.error("Confirm Placement Error:", error);
        return { success: false, error: error.message };
    }
}
