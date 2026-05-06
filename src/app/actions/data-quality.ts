"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export async function fillPositionKeywords(candidateId?: string) {
    const { data, error } = await (adminAuthClient as any).rpc(
        "fill_position_keywords",
        candidateId ? { p_candidate_id: candidateId } : {}
    );

    if (error) throw new Error(error.message);

    const result = (data as { filled: number; remaining_null: number; still_empty: number }[])[0];
    return result;
}
