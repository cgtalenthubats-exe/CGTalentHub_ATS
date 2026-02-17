"use server";

import { createClient } from "@supabase/supabase-js";
import { getN8nUrl } from "./admin-actions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function triggerReport(jrId: string, requester: string) {
    try {
        // 1. Log the attempt in jr_reports as 'pending'
        const { data: log, error: logError } = await supabase
            .from('jr_reports')
            .insert([
                {
                    jr_id: jrId,
                    requester: requester,
                    status: 'pending'
                }
            ])
            .select()
            .single();

        if (logError) throw logError;

        // 2. Fetch Config & Call n8n
        const config = await getN8nUrl('JR Report');
        if (!config) {
            // If no config, fail gracefully but keep log as error
            await supabase.from('jr_reports').update({ status: 'error', note: 'Missing n8n config' }).eq('id', log.id);
            return { success: false, error: "n8n Configuration 'JR Report' not found" };
        }

        const url = new URL(config.url);

        // Add params based on method, or just query params for simplicity + flexibility
        if (config.method === 'GET') {
            url.searchParams.append("jr_id", jrId);
            url.searchParams.append("requester", requester);
            url.searchParams.append("log_id", log.id.toString());
        }

        const fullUrl = url.toString();

        console.log(`Triggering n8n Webhook (${config.method}):`, fullUrl);

        const fetchOptions: RequestInit = {
            method: config.method,
            cache: 'no-store'
        };

        if (config.method === 'POST') {
            fetchOptions.headers = { 'Content-Type': 'application/json' };
            fetchOptions.body = JSON.stringify({
                jr_id: jrId,
                requester: requester,
                log_id: log.id
            });
        }

        const response = await fetch(fullUrl, fetchOptions);

        if (!response.ok) {
            // Update status to error if webhook fails to trigger
            await supabase
                .from('jr_reports')
                .update({ status: 'error' })
                .eq('id', log.id);

            return { success: false, error: "Failed to trigger n8n Flow" };
        }

        return { success: true, logId: log.id };
    } catch (error: any) {
        console.error("Trigger Report Error:", error);
        return { success: false, error: error.message };
    }
}

export async function getReportsByJR(jrId: string) {
    try {
        const { data, error } = await supabase
            .from('jr_reports')
            .select('*')
            .eq('jr_id', jrId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        console.error("Get Reports Error:", error);
        return { success: false, error: error.message };
    }
}

export async function getAllReports() {
    try {
        const { data, error } = await supabase
            .from('jr_reports')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        console.error("Get All Reports Error:", error);
        return { success: false, error: error.message };
    }
}

// --- New: Candidate Data Refresh ---

export async function triggerCandidateRefresh(candidateIds: string[], requester: string) {
    try {
        // 1. Fetch Config
        const config = await getN8nUrl('Candidate Refresh');
        if (!config) {
            return { success: false, error: "n8n Configuration 'Candidate Refresh' not found" };
        }

        const url = new URL(config.url);
        const requestDate = new Date().toISOString();

        // 2. Prepare Payload
        const payload = {
            candidate_ids: candidateIds,
            requester: requester,
            request_date: requestDate
        };

        console.log(`Triggering n8n Candidate Refresh (${config.method}):`, config.url);

        const fetchOptions: RequestInit = {
            method: config.method,
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' }
        };

        if (config.method === 'POST') {
            fetchOptions.body = JSON.stringify(payload);
        } else {
            // For GET, we might hit URL length limits with many IDs, but let's support it basic
            url.searchParams.append("requester", requester);
            url.searchParams.append("request_date", requestDate);
            url.searchParams.append("candidate_ids", candidateIds.join(','));
        }

        const fullUrl = config.method === 'GET' ? url.toString() : config.url;

        const response = await fetch(fullUrl, fetchOptions);

        if (!response.ok) {
            return { success: false, error: `n8n failed with status: ${response.status}` };
        }

        return { success: true, count: candidateIds.length };
    } catch (error: any) {
        console.error("Trigger Candidate Refresh Error:", error);
        return { success: false, error: error.message };
    }
}
