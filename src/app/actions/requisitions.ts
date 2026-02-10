"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { JobRequisition, DashboardStats } from "@/types/requisition";

export async function getJobRequisitions(): Promise<JobRequisition[]> {
    const supabase = adminAuthClient;
    // Query existing table 'job_requisitions' (or whatever the view is)
    // Based on job.ts, it seems to be 'job_requisitions' or similar.
    // I'll assume a standard select for now and map it.

    // Debug: Check table structure if needed, but for now assuming standard fields from job.ts context
    const { data, error } = await supabase
        .from('job_requisitions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching JRs:", error);
        return [];
    }

    return data.map((row: any) => ({
        id: row.jr_id,
        job_title: row.position_jr || "Untitled Position",
        title: row.position_jr || "Untitled Position",
        hiring_manager_id: row.hiring_manager_id || "",
        hiring_manager_name: row.hiring_manager_name || "Unknown",
        department: row.sub_bu || "General",
        division: row.bu || "Corporate",
        status: normalizeStatus(row.is_active),
        headcount_total: row.headcount || 1,
        headcount_hired: row.hired_count || 0,
        opened_date: row.request_date,
        is_active: row.is_active === 'Active' || row.is_active === 'active',
        location: row.location || "Bangkok",
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
        jr_type: row.jr_type || "New",
        created_by: row.create_by || "System",
    }));
}


// Fetch Single JR by ID
export async function getRequisition(id: string): Promise<JobRequisition | null> {
    const supabase = adminAuthClient;
    const { data, error } = await supabase
        .from('job_requisitions')
        .select(`*`)
        .eq('jr_id', id)
        .single();

    if (error || !data) return null;

    const row = data as any;

    return {
        id: row.jr_id,
        job_title: row.position_jr || "Untitled",
        title: row.position_jr || "Untitled",
        hiring_manager_id: row.hiring_manager_id || "",
        hiring_manager_name: row.hiring_manager_name || "Unknown", // Would need join usually
        department: row.sub_bu || "General",
        division: row.bu || "Corporate",
        status: normalizeStatus(row.is_active),
        headcount_total: row.headcount || 1,
        headcount_hired: row.hired_count || 0,
        opened_date: row.request_date,
        is_active: row.is_active === 'Active' || row.is_active === 'active',
        location: row.location,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
        jr_type: row.jr_type || "New",
    };
}


function normalizeStatus(status: string): 'Open' | 'Closed' | 'On Hold' | 'Draft' {
    const s = String(status || "").toLowerCase();
    if (s === 'active') return 'Open';
    if (s === 'inactive' || s === 'closed') return 'Closed';
    return 'Open'; // Default
}

export async function getJRStats(): Promise<DashboardStats> {
    // Mocking stats for now until table structure for candidates/logs is confirmed deep enough
    return {
        total_jrs: 45,
        active_jrs: 32,
        total_candidates: 1250,
        avg_aging_days: 18,
        candidates_by_status: [
            { status: 'Pool', count: 450 },
            { status: 'Screen', count: 320 },
            { status: 'Interview', count: 180 },
            { status: 'Offer', count: 50 },
            { status: 'Hired', count: 220 },
            { status: 'Rejected', count: 30 },
        ],
        aging_by_stage: [
            { stage: 'Pool', days: 5 },
            { stage: 'Screen', days: 3 },
            { stage: 'Interview', days: 12 },
            { stage: 'Offer', days: 4 },
        ]
    };
}

// Fetch Distinct Values for Dropdowns
export async function getDistinctFieldValues(field: string): Promise<string[]> {
    const supabase = adminAuthClient;
    // Helper to get distinct values from existing records
    const { data, error } = await supabase
        .from('job_requisitions')
        .select(field)
        .order(field, { ascending: true });

    if (error) {
        console.error(`Error fetching distinct ${field}:`, error);
        return [];
    }

    if (!data) return [];

    // Extract, Filter Nulls/Duplicates
    const values = data.map((row: any) => row[field]).filter((v: any) => v).map((v: any) => String(v));
    return [...new Set(values)];
}

export async function createJobRequisition(data: any): Promise<JobRequisition | null> {
    const supabase = adminAuthClient;

    try {
        // 1. Generate Running ID using `jr_number` integer column
        // Find max jr_number
        const { data: maxResult, error: maxError } = await supabase
            .from('job_requisitions')
            .select('jr_number')
            .order('jr_number', { ascending: false })
            .limit(1)
            .single();

        let nextNum = 1;
        const maxRow = maxResult as any;
        if (maxRow && maxRow.jr_number) {
            nextNum = maxRow.jr_number + 1;
        }

        // Format: JRxxxxxx (e.g., JR000014)
        const nextId = `JR${nextNum.toString().padStart(6, '0')}`;

        // 2. Insert Data
        // Mapping form data to DB schema
        const insertPayload = {
            jr_id: nextId,           // Key
            jr_number: nextNum,      // Helper for ordering/generation

            // Core Fields
            position_jr: data.position_jr,
            bu: data.bu,
            sub_bu: data.sub_bu,
            jr_type: data.jr_type,   // 'New' or 'Replacement'
            original_jr_id: data.original_jr_id || null, // If Replacement

            // Other Fields
            request_date: data.request_date, // User selected date
            job_description: data.job_description,
            feedback_file: data.feedback_file,
            create_by: data.create_by || "System",

            // Defaults
            is_active: 'Active',
            created_at: new Date().toISOString()
        };

        const { data: inserted, error: insertError } = await supabase
            .from('job_requisitions')
            .insert(insertPayload as any)
            .select()
            .single();

        if (insertError) {
            console.error("Error inserting JR:", insertError);
            throw insertError;
        }

        const insertedData = inserted as any;

        // Return mapped object for UI
        return {
            id: insertedData.jr_id,
            job_title: insertedData.position_jr,
            title: insertedData.position_jr,
            hiring_manager_id: "",
            hiring_manager_name: insertedData.create_by, // Use create_by as owner context
            department: insertedData.sub_bu,
            division: insertedData.bu,
            status: 'Open',
            headcount_total: 1, // Default to 1 as per user implication
            headcount_hired: 0,
            opened_date: insertedData.request_date,
            is_active: true,
            location: "Bangkok",
            created_at: insertedData.created_at,
            updated_at: insertedData.created_at,
            jr_type: insertedData.jr_type || "New",
        };

    } catch (e) {
        console.error("Create JR Failed", e);
        return null;
    }
}

// New helper to fetch ALL candidate statuses for client-side aggregation
// Returns just key fields to minimize payload
// New helper to fetch ALL candidate statuses for client-side aggregation
// Returns just key fields to minimize payload
// New helper to fetch ALL candidate statuses and logs for client-side aggregation
export async function getAllCandidatesSummary(): Promise<{
    jr_id: string;
    jr_candidate_id: string;
    status: string;
    logs: { status: string; timestamp: string; log_id: number }[]
}[]> {
    const supabase = adminAuthClient;
    try {
        // 1. Fetch all JR Candidates
        let candidateMap: Record<string, string> = {}; // jr_candidate_id -> jr_id
        let from = 0;
        const step = 1000;
        let more = true;

        while (more) {
            const { data, error } = await supabase
                .from('jr_candidates')
                .select('jr_candidate_id, jr_id')
                .range(from, from + step - 1);

            if (error) break;

            if (data && data.length > 0) {
                data.forEach((d: any) => {
                    if (d.jr_candidate_id) candidateMap[String(d.jr_candidate_id)] = d.jr_id;
                });
                if (data.length < step) more = false;
                else from += step;
            } else more = false;
        }

        // 2. Fetch ALL Status Logs
        let logsMap: Record<string, { status: string; timestamp: string; log_id: number }[]> = {};
        from = 0;
        more = true;

        while (more) {
            const { data, error } = await supabase
                .from('status_log')
                .select('jr_candidate_id, status, log_id, timestamp')
                .range(from, from + step - 1);

            if (error) break;

            if (data && data.length > 0) {
                const logs = data as any[];
                for (const log of logs) {
                    const cid = String(log.jr_candidate_id);
                    if (!logsMap[cid]) logsMap[cid] = [];
                    logsMap[cid].push({
                        status: log.status,
                        timestamp: log.timestamp,
                        log_id: typeof log.log_id === 'number' ? log.log_id : parseInt(log.log_id)
                    });
                }
                if (data.length < step) more = false;
                else from += step;
            } else more = false;
        }

        // 3. Merge & Result
        const results: any[] = [];
        Object.keys(candidateMap).forEach(cid => {
            const jr_id = candidateMap[cid];
            const cLogs = logsMap[cid] || [];

            // Sort logs by log_id or timestamp to find current status
            const sortedLogs = [...cLogs].sort((a, b) => a.log_id - b.log_id);
            const currentStatus = sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1].status : "Pool Candidate";

            if (jr_id) {
                results.push({
                    jr_id,
                    jr_candidate_id: cid,
                    status: currentStatus,
                    logs: sortedLogs
                });
            }
        });

        return results;

    } catch (e) {
        console.error("Get Candidates Summary Failed", e);
        return [];
    }
}

export async function getUserProfiles(): Promise<{ email: string; real_name: string }[]> {
    const supabase = adminAuthClient;
    const { data, error } = await supabase
        .from('user_profiles')
        .select('email, real_name');

    if (error) {
        console.error("Fetch Profiles Error:", error);
        return [];
    }
    return data || [];
}


export async function getAgingSummary(): Promise<number> {
    const supabase = adminAuthClient;
    const { data: activeJrDates } = await supabase
        .from('job_requisitions')
        .select('request_date')
        .ilike('is_active', 'active');

    let avgAging = 0;
    if (activeJrDates && activeJrDates.length > 0) {
        const dates = activeJrDates as any[];
        const now = new Date().getTime();
        const totalDays = dates.reduce((acc, curr) => {
            const d = new Date(curr.request_date).getTime();
            return acc + (isNaN(d) ? 0 : (now - d));
        }, 0);
        avgAging = Math.round((totalDays / dates.length) / (1000 * 3600 * 24));
    }
    return avgAging;
}


export async function copyJobRequisition(sourceJrId: string, newJrData: Partial<JobRequisition>): Promise<{ success: boolean; newJrId?: string; error?: string }> {
    const supabase = adminAuthClient;

    try {
        // A. Create New JR
        // 1. Get Next JR ID
        const { data: maxResult } = await supabase
            .from('job_requisitions')
            .select('jr_number')
            .order('jr_number', { ascending: false })
            .limit(1)
            .single();

        let nextNum = 1;
        if (maxResult && (maxResult as any).jr_number) {
            nextNum = (maxResult as any).jr_number + 1;
        }
        const newJrId = `JR${nextNum.toString().padStart(6, '0')}`;

        // 3. Insert New JR
        const insertPayload = {
            jr_id: newJrId,
            jr_number: nextNum,
            position_jr: newJrData.job_title,
            bu: newJrData.division,
            sub_bu: newJrData.department,
            jr_type: 'New',
            request_date: new Date().toISOString().split('T')[0],
            create_by: "System (Copy)",
            is_active: 'Active',
            created_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
            .from('job_requisitions')
            .insert(insertPayload as any);

        if (insertError) throw insertError;

        // B. Copy Candidates
        const { data: sourceCandidates } = await supabase
            .from('jr_candidates')
            .select('candidate_id')
            .eq('jr_id', sourceJrId);

        if (sourceCandidates && sourceCandidates.length > 0) {
            // Get Max IDs
            const { data: maxJrc } = await supabase
                .from('jr_candidates')
                .select('jr_candidate_id')
                .order('jr_candidate_id', { ascending: false })
                .limit(1)
                .maybeSingle();

            let nextJrcId = 1;
            if (maxJrc && (maxJrc as any).jr_candidate_id) nextJrcId = parseInt((maxJrc as any).jr_candidate_id) + 1;

            const { data: maxLog } = await supabase
                .from('status_log')
                .select('log_id')
                .order('log_id', { ascending: false })
                .limit(1)
                .maybeSingle();

            let nextLogId = 1;
            if (maxLog && (maxLog as any).log_id) nextLogId = parseInt((maxLog as any).log_id) + 1;

            const now = new Date();
            const timestampStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

            const jrcInserts: any[] = [];
            const logInserts: any[] = [];
            const cands = sourceCandidates as any[];

            for (const cand of cands) {
                jrcInserts.push({
                    jr_candidate_id: nextJrcId,
                    jr_id: newJrId,
                    candidate_id: cand.candidate_id,
                    temp_status: 'Pool Candidate',
                    list_type: 'Longlist',
                    time_stamp: now.toISOString()
                });

                logInserts.push({
                    log_id: nextLogId,
                    jr_candidate_id: nextJrcId,
                    status: 'Pool Candidate',
                    updated_By: 'System (Copy)',
                    timestamp: timestampStr
                });

                nextJrcId++;
                nextLogId++;
            }

            const chunkSize = 100;
            for (let i = 0; i < jrcInserts.length; i += chunkSize) {
                const chunk = jrcInserts.slice(i, i + chunkSize);
                const { error: e1 } = await supabase.from('jr_candidates').insert(chunk as any);
                if (e1) console.error("Error copy candidates chunk", e1);
            }

            for (let i = 0; i < logInserts.length; i += chunkSize) {
                const chunk = logInserts.slice(i, i + chunkSize);
                const { error: e2 } = await supabase.from('status_log').insert(chunk as any);
                if (e2) console.error("Error copy logs chunk", e2);
            }
        }

        return { success: true, newJrId };

    } catch (e: any) {
        console.error("Copy JR Failed:", e);
        return { success: false, error: e.message };
    }
}
