import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { JobRequisition } from "@/types/requisition";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export function useJobRequisitionRealtime(
    jrId: string | undefined,
    onUpdate: (data: JobRequisition) => void
) {
    useEffect(() => {
        if (!jrId) return;

        console.log(`Subscribing to realtime updates for JR: ${jrId}`);

        const channel = supabase
            .channel(`jr-updates-${jrId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "job_requisitions",
                    filter: `jr_id=eq.${jrId}`,
                },
                (payload) => {
                    console.log("Realtime Update Received:", payload.new);
                    const updated = payload.new as any;
                    
                    // Map database columns to JobRequisition type
                    const mappedJR: JobRequisition = {
                        id: updated.jr_id,
                        job_title: updated.position_jr,
                        division: updated.bu,
                        department: updated.sub_bu,
                        jr_type: updated.jr_type,
                        headcount_total: updated.headcount_total || 0,
                        headcount_hired: updated.headcount_hired || 0,
                        opened_date: updated.request_date,
                        job_description: updated.job_description,
                        is_active: updated.is_active,
                        status: updated.status || "Open",
                        original_jr_id: updated.original_jr_id,
                        feedback_file: updated.feedback_file,
                        hiring_manager_id: updated.hiring_manager_id || "",
                        created_by: updated.create_by,
                        created_at: updated.created_at || new Date().toISOString(),
                        updated_at: updated.updated_at || new Date().toISOString(),
                        title: updated.position_jr
                    };
                    
                    onUpdate(mappedJR);
                }
            )
            .subscribe((status) => {
                console.log(`Realtime Subscription for ${jrId}: ${status}`);
            });

        return () => {
            console.log(`Unsubscribing from JR: ${jrId}`);
            supabase.removeChannel(channel);
        };
    }, [jrId, onUpdate]);
}
