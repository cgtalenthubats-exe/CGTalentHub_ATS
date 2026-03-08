"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function getEmploymentRecords(status: 'Active' | 'Resigned') {
    const supabase = adminAuthClient;
    const { data, error } = await supabase
        .from('employment_record')
        .select('*')
        .eq('hiring_status', status)
        .order('er_number', { ascending: false });

    if (error) {
        console.error(`Error fetching ${status} employment records:`, error);
        return [];
    }

    // Manual fetch of DOBs for candidates
    const records = data || [];
    if (records.length > 0) {
        const candidateIds = records.map((r: any) => r.candidate_id).filter(Boolean);

        if (candidateIds.length > 0) {
            const { data: profiles, error: profileError } = await supabase
                .from('Candidate Profile')
                .select('candidate_id, date_of_birth')
                .in('candidate_id', candidateIds);

            if (!profileError && profiles) {
                const dobMap = new Map(profiles.map((p: any) => [p.candidate_id, p.date_of_birth]));
                // Merge DOB into records
                records.forEach((r: any) => {
                    if (r.candidate_id) {
                        r.date_of_birth = dobMap.get(r.candidate_id) || null;
                    }
                });
            }
        }
    }

    return records;
}

export async function markAsResigned(id: string, resignData: {
    resign_date: string;
    resign_note: string;
    resignation_reason?: string
}) {
    const supabase = adminAuthClient;
    const { error } = await (supabase
        .from('employment_record' as any) as any)
        .update({
            hiring_status: 'Resigned',
            resign_date: resignData.resign_date,
            resign_note: resignData.resign_note,
            // use resignation_reason column
            resignation_reason: resignData.resignation_reason
        })
        .eq('employment_record_id', id);

    if (error) {
        console.error('Error marking as resigned:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/requisitions/placements');
    revalidatePath('/requisitions/resignations');
    return { success: true };
}

export async function updateEmploymentRecord(id: string, data: any) {
    const supabase = adminAuthClient;

    // Calculate annual if base is changed
    const annual_salary = data.base_salary ? data.base_salary * 12 : undefined;
    const outsource_fee = annual_salary ? annual_salary * 0.20 : undefined;

    // Prepare update payload
    const updatePayload: any = {
        ...data
    };

    if (annual_salary !== undefined) {
        updatePayload.annual_salary = annual_salary;
        updatePayload.outsource_fee_20_percent = outsource_fee;
    }

    // Clean up undefined/nulls if needed, but Supabase handles partial updates well

    const { error } = await (supabase
        .from('employment_record' as any) as any)
        .update(updatePayload)
        .eq('employment_record_id', id);

    if (error) {
        console.error('Error updating employment record:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/requisitions/placements');
    return { success: true };
}

export async function getResignationReasons() {
    const supabase = adminAuthClient as any;
    const { data, error } = await supabase
        .from('resignation_reason_master')
        .select('reason')
        .order('reason', { ascending: true });

    if (error) {
        console.error('Error fetching resignation reasons:', error);
        return [];
    }

    return data.map((r: any) => r.reason);
}

export async function addResignationReason(reason: string) {
    const supabase = adminAuthClient as any;
    const { error } = await supabase
        .from('resignation_reason_master')
        .insert([{ reason }]);

    if (error) {
        console.error('Error adding resignation reason:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

export async function updateCandidateDOB(candidateId: string, dob: string | null) {
    const supabase = adminAuthClient;
    const { error } = await (supabase
        .from('Candidate Profile') as any)
        .update({ date_of_birth: dob })
        .eq('candidate_id', candidateId);

    if (error) {
        console.error('Error updating candidate DOB:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/requisitions/placements');
    return { success: true };
}

export async function getEmploymentCounts() {
    const supabase = adminAuthClient;

    const { count: activeCount, error: activeError } = await supabase
        .from('employment_record')
        .select('*', { count: 'exact', head: true })
        .eq('hiring_status', 'Active');

    const { count: resignedCount, error: resignedError } = await supabase
        .from('employment_record')
        .select('*', { count: 'exact', head: true })
        .eq('hiring_status', 'Resigned');

    if (activeError || resignedError) {
        console.error('Error fetching employment counts:', activeError || resignedError);
        return { active: 0, resigned: 0 };
    }

    return {
        active: activeCount || 0,
        resigned: resignedCount || 0
    };
}
