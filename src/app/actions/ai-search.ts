"use server";

import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from 'uuid';
import { getN8nUrl } from "./admin-actions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- 1. Submit Search ---
export async function submitSearch(query: string, userEmail: string = "sumethwork@gmail.com") {
    try {
        const sessionId = uuidv4();
        // 1. Create a Search Job entry
        const { data: job, error: jobError } = await supabase
            .from('search_jobs')
            .insert([
                {
                    session_id: sessionId,
                    original_query: query,
                    user_email: userEmail,
                    status: 'processing'
                }
            ])
            .select()
            .single();

        if (jobError) throw jobError;
        // sessionId is already defined above and matched by the select result

        // 2. Get n8n Webhook URL
        const config = await getN8nUrl('Candidate Search');
        if (!config) {
            await supabase.from('search_jobs').update({ status: 'failed', report: { error: 'Missing n8n config' } }).eq('session_id', sessionId);
            return { success: false, error: "Configuration 'Candidate Search' not found in Admin Panel." };
        }

        // 3. Trigger n8n Webhook
        const url = new URL(config.url);
        // Ensure params are passed correctly depending on method
        const payload = {
            session_id: sessionId,
            query: query,
            user_email: userEmail,
            timestamp: new Date().toISOString()
        };

        let response;
        if (config.method === 'GET') {
            url.searchParams.append("session_id", sessionId);
            url.searchParams.append("query", query);
            url.searchParams.append("user_email", userEmail);
            response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
        } else {
            response = await fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                cache: 'no-store'
            });
        }

        if (!response.ok) {
            await supabase.from('search_jobs').update({ status: 'failed', report: { error: `Webhook Error: ${response.statusText}` } }).eq('session_id', sessionId);
            return { success: false, error: `Failed to trigger n8n: ${response.statusText}` };
        }

        // 4. Initialize Status Rows for Pipeline
        const sources = ['Internal_db', 'external_db', 'linkedin_db'];
        const statusRows = sources.map(src => ({
            session_id: sessionId,
            source: src,
            summary_agent_1: 'Waiting...'
        }));
        await supabase.from('search_job_status').insert(statusRows);

        return { success: true, sessionId };

    } catch (error: any) {
        console.error("Submit Search Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 2. Get Search History ---
export async function getSearchHistory() {
    try {
        const { data, error } = await supabase
            .from('search_jobs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(50);

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        console.error("Get History Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 3. Get Search Results ---
export async function getSearchResults(sessionId: string) {
    try {
        const { data, error } = await supabase
            .from('consolidated_results')
            .select('*')
            .eq('session_id', sessionId)
            .order('match_score', { ascending: false });

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        console.error("Get Results Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 4. Get Search Job Details (Status/Report) ---
export async function getSearchJob(sessionId: string) {
    try {
        const { data, error } = await supabase
            .from('search_jobs')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        console.error("Get Job Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 5. Get External Candidate Details ---
export async function getExternalCandidateDetails(extCandidateId: string) {
    try {
        // Fetch Profile
        const { data: profile, error: profileError } = await supabase
            .from('ext_candidate_profile')
            .select('*')
            .eq('candidate_id', extCandidateId)
            .single();

        if (profileError) throw profileError;

        // Fetch Enhance (AI Summary)
        const { data: enhance, error: enhanceError } = await supabase
            .from('ext_profile_enhance')
            .select('*')
            .eq('candidate_id', extCandidateId)
            .single();

        // Fetch Experiences
        const { data: experiences, error: expError } = await supabase
            .from('ext_candidate_experiences')
            .select('*')
            .eq('candidate_id', extCandidateId)
            .order('start_date', { ascending: false });

        return {
            success: true,
            data: {
                ...profile,
                ...enhance,
                experiences: experiences || []
            }
        };

    } catch (error: any) {
        console.error("Get Ext Candidate Error:", error);
        return { success: false, error: error.message };
    }
}
// --- 6. Get Search Job Statuses ---
export async function getSearchJobStatuses(sessionId: string) {
    try {
        const { data, error } = await supabase
            .from('search_job_status')
            .select('*')
            .eq('session_id', sessionId)
            .order('source', { ascending: true });

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        console.error("Get Statuses Error:", error);
        return { success: false, error: error.message };
    }
}
