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
    return data || [];
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
            // the schema had resignation_reason_test, check if it exists or use resignation_reason
            resignation_reason_test: resignData.resignation_reason
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
