"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { JRCandidate, JRAnalytics } from "@/types/requisition";
import { getCandidateIdsByExperienceFilters } from "@/lib/candidate-service";

// Internal type for DB row structure
interface DBJRCandidate {
    jr_candidate_id: string;
    jr_id: string;
    candidate_id: string;
    temp_status: string;
    list_type: string;
    rank: string;
    time_stamp: string;
    candidate?: {
        name: string | null;
        email: string | null;
        mobile_phone: string | null;
        job_function: string | null;
        photo: string | null;
        age: number | null;
        gender: string | null;
        candidate_projects: any; // Fallback for company?
    };
}

// Helper to identify latest status
function getLatestStatus(logs: any[], jrCandidateId: string, defaultStatus: string): string {
    if (!logs || logs.length === 0) return defaultStatus;

    // Filter logs for this candidate (Ensure String comparison)
    const candidateLogs = logs.filter(l => String(l.jr_candidate_id) === String(jrCandidateId));

    if (candidateLogs.length === 0) return defaultStatus;

    // Sort by timestamp (desc) then log_id (desc) to find latest
    // Assuming timestamp is in "M/D/YYYY" format which is tricky to sort as string.
    // If log_id is reliable sequence, prefer log_id.
    candidateLogs.sort((a, b) => {
        // Try parsing date if standard format
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        if (dateA !== dateB && !isNaN(dateA) && !isNaN(dateB)) {
            return dateB - dateA; // Descending
        }
        // Fallback to log_id if dates equal or invalid
        return b.log_id - a.log_id;
    });

    return candidateLogs[0].status;
}

export async function getJRCandidates(jrId: string): Promise<JRCandidate[]> {
    const supabase = adminAuthClient;

    // 1. Fetch Candidates (Raw)
    const { data: candidates, error } = await supabase
        .from('jr_candidates')
        .select('*')
        .eq('jr_id', jrId)
        .returns<DBJRCandidate[]>();

    if (error || !candidates) {
        console.error("Error fetching JR Candidates:", error);
        return [];
    }

    // Sort by: Top profile first, then rank
    candidates.sort((a, b) => {
        const isTopA = a.list_type === 'Top profile';
        const isTopB = b.list_type === 'Top profile';
        if (isTopA && !isTopB) return -1;
        if (!isTopA && isTopB) return 1;

        const rankA = parseInt(a.rank || "9999");
        const rankB = parseInt(b.rank || "9999");
        return rankA - rankB;
    });

    // 2. Fetch Profiles Separately (Application-Side Join)
    const candidateIds = candidates.map(c => c.candidate_id).filter(Boolean);
    const { data: profiles } = await (supabase
        .from('Candidate Profile' as any) // Explicit table name
        .select('candidate_id, name, email, mobile_phone, job_function, photo, age, gender, candidate_projects')
        .in('candidate_id', candidateIds) as any);

    const profileMap = new Map((profiles as any)?.map((p: any) => [p.candidate_id, p]));

    // 3. Fetch Status Logs
    const jrCandIds = candidates.map(c => c.jr_candidate_id);
    const { data: logs } = await supabase
        .from('status_log')
        .select('log_id, jr_candidate_id, status, timestamp')
        .in('jr_candidate_id', jrCandIds)
        .returns<{ log_id: number; jr_candidate_id: string; status: string; timestamp: string }[]>();

    return candidates.map((row) => {
        // Resolve Profile
        const profile = profileMap.get(row.candidate_id) as any;

        // Determine status from logs
        const realStatus = getLatestStatus(logs || [], row.jr_candidate_id, row.temp_status || "Pool Candidate");

        return {
            id: row.jr_candidate_id,
            jr_id: row.jr_id,
            candidate_id: row.candidate_id,
            status: realStatus,
            source: row.list_type || "N/A",
            list_type: row.list_type,
            rank: row.rank,
            created_at: row.time_stamp || new Date().toISOString(),
            updated_at: row.time_stamp || new Date().toISOString(),

            // Joined Fields
            candidate_name: profile?.name || "Unknown",
            candidate_email: profile?.email || undefined,
            candidate_mobile: profile?.mobile_phone || undefined,
            candidate_current_position: profile?.job_function || undefined,
            candidate_current_company: "N/A",
            candidate_image_url: profile?.photo || undefined,
            candidate_age: profile?.age || undefined,
            candidate_gender: profile?.gender || undefined,
        };
    });
}

export async function getJRAnalytics(jrId: string): Promise<JRAnalytics> {
    const supabase = adminAuthClient;

    // 0. Fetch Master & Candidates
    const [{ data: masters }, { data: jrCands }] = await Promise.all([
        supabase.from('status_master').select('status, stage_order').order('stage_order', { ascending: true }),
        supabase.from('jr_candidates').select('jr_candidate_id, temp_status').eq('jr_id', jrId).returns<{ jr_candidate_id: string; temp_status: string }[]>()
    ]);

    const allStatuses: string[] = (masters as any)?.map((m: any) => m.status) || ["Pool Candidate", "Phone Screen", "Interview", "Offer", "Hired"];

    if (!jrCands || jrCands.length === 0) return { countsByStatus: [], agingByStatus: [] };

    // 1. Fetch Logs to resolve REAL status
    const jrCandIds = jrCands.map(c => c.jr_candidate_id);
    const { data: logs } = await supabase
        .from('status_log')
        .select('log_id, jr_candidate_id, status, timestamp')
        .in('jr_candidate_id', jrCandIds)
        .returns<{ log_id: number; jr_candidate_id: string; status: string; timestamp: string }[]>();

    // 2. Compute Counts & Aging
    const countMap: Record<string, number> = {};
    const agingMap: Record<string, { totalDays: number, count: number }> = {};

    // Initialize counts
    allStatuses.forEach(s => countMap[s] = 0);
    const now = new Date();

    jrCands.forEach(c => {
        // Resolve Status
        const status = getLatestStatus(logs || [], c.jr_candidate_id, c.temp_status || "Pool Candidate");

        // Count
        if (countMap[status] !== undefined) countMap[status]++;
        else {
            const k = "Unknown";
            countMap[k] = (countMap[k] || 0) + 1;
        }

        // Aging
        // Find When they entered this status (First log of this status? Or just latest log?)
        // User said: "Check timestamp... Logic: timestamp of log"
        // Aging usually means "Time since they entered the CURRENT stage".
        // So we need the timestamp of the LATEST log found.
        if (logs) {
            const cLogs = logs.filter(l => l.jr_candidate_id === c.jr_candidate_id);
            // Re-sort same way
            cLogs.sort((a, b) => {
                const dateA = new Date(a.timestamp).getTime();
                const dateB = new Date(b.timestamp).getTime();
                if (dateA !== dateB && !isNaN(dateA) && !isNaN(dateB)) return dateB - dateA;
                return b.log_id - a.log_id;
            });
            const latestLog = cLogs[0];

            if (latestLog) {
                const days = Math.floor((now.getTime() - new Date(latestLog.timestamp).getTime()) / (1000 * 3600 * 24));
                if (!agingMap[status]) agingMap[status] = { totalDays: 0, count: 0 };
                agingMap[status].totalDays += days;
                agingMap[status].count++;
            }
        }
    });

    const countsByStatus = Object.keys(countMap).map(k => ({ status: k, count: countMap[k] }));
    const agingByStatus = Object.keys(agingMap).map(s => ({
        status: s,
        avgDays: Math.round(agingMap[s].totalDays / agingMap[s].count)
    }));

    return { countsByStatus, agingByStatus };
}

export async function addCandidatesToJR(
    jrId: string,
    candidateIds: string[],
    listType: string = 'Longlist'
): Promise<{ success: boolean; error?: string }> {
    const supabase = adminAuthClient;

    try {
        // 1. Get current max ID for jr_candidate_id (numeric)
        const { data: maxResult } = await supabase
            .from('jr_candidates')
            .select('jr_candidate_id')
            .order('jr_candidate_id', { ascending: false })
            .limit(1)
            .maybeSingle();

        let nextJrCandId = 1;
        if (maxResult && (maxResult as any).jr_candidate_id) {
            nextJrCandId = parseInt((maxResult as any).jr_candidate_id) + 1;
        }

        // 2. Get current max ID for log_id (numeric)
        const { data: maxLogResult } = await supabase
            .from('status_log')
            .select('log_id')
            .order('log_id', { ascending: false })
            .limit(1)
            .maybeSingle();

        let nextLogId = 1;
        if (maxLogResult && (maxLogResult as any).log_id) {
            nextLogId = parseInt((maxLogResult as any).log_id) + 1;
        }

        // 3. Prepare Inserts
        const jrCandidatesInsert = [];
        const statusLogsInsert = [];

        // Date format: M/D/YYYY
        const now = new Date();
        const timestampStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

        for (const candidateId of candidateIds) {
            const jrCandidateId = nextJrCandId;

            jrCandidatesInsert.push({
                jr_candidate_id: jrCandidateId,
                jr_id: jrId,
                candidate_id: candidateId,
                temp_status: null, // As per user: "ไม่ต้องใส่ temp_status ก็ได้"
                list_type: listType,
                rank: null, // As per user: "Recruiter จะเป็นคนใส่เอง"
                time_stamp: new Date().toISOString()
            });

            statusLogsInsert.push({
                log_id: nextLogId,
                jr_candidate_id: jrCandidateId,
                status: 'Pool Candidate',
                updated_By: 'System',
                timestamp: timestampStr,
                note: null
            });

            nextJrCandId++;
            nextLogId++;
        }

        // 4. Batch Insert
        const { error: candError } = await supabase.from('jr_candidates').insert(jrCandidatesInsert as any);
        if (candError) throw candError;

        const { error: logError } = await supabase.from('status_log').insert(statusLogsInsert as any);
        if (logError) throw logError;

        return { success: true };
    } catch (e: any) {
        console.error("Error adding candidates to JR:", e);
        return { success: false, error: e.message };
    }
}

export async function bulkAddCandidatesToJR(
    jrId: string,
    candidates: { id: string, name: string }[],
    listType: string = 'Longlist'
): Promise<{ success: boolean; added: number; duplicates: string[]; blacklisted: string[]; error?: string }> {
    const supabase = adminAuthClient;

    try {
        if (candidates.length === 0) return { success: true, added: 0, duplicates: [], blacklisted: [] };

        // 0. Check for Blacklisted Candidates
        const candidateIdsToCheck = candidates.map(c => c.id);
        const { data: blacklistData, error: blError } = await supabase
            .from('Candidate Profile')
            .select('candidate_id, blacklist_note')
            .in('candidate_id', candidateIdsToCheck)
            .not('blacklist_note', 'is', null);

        if (blError) throw blError;

        const blacklistedIds = new Set(blacklistData?.map((b: any) => b.candidate_id));
        const blacklistedNames: string[] = [];

        // Filter out blacklisted
        const candidatesSafe = candidates.filter(c => {
            if (blacklistedIds.has(c.id)) {
                blacklistedNames.push(c.name);
                return false;
            }
            return true;
        });

        if (candidatesSafe.length === 0) {
            return { success: true, added: 0, duplicates: [], blacklisted: blacklistedNames };
        }

        // 1. Fetch existing candidates in this JR to filter duplicates
        const { data: existing, error: fetchError } = await supabase
            .from('jr_candidates')
            .select('candidate_id')
            .eq('jr_id', jrId);

        if (fetchError) throw fetchError;

        const existingIds = new Set(existing?.map((e: any) => e.candidate_id));
        const toAdd = [];
        const duplicates = [];

        for (const c of candidatesSafe) {
            if (existingIds.has(c.id)) {
                duplicates.push(c.name);
            } else {
                toAdd.push(c.id);
            }
        }

        if (toAdd.length === 0) {
            return { success: true, added: 0, duplicates, blacklisted: blacklistedNames };
        }

        // 2. Reuse efficient logic from addCandidatesToJR (but we need to inline it or call it safely)
        // Since addCandidatesToJR assumes no duplicates or might error, we'll implement the insert logic here carefully.

        // Get Max IDs
        const { data: maxResult } = await supabase
            .from('jr_candidates')
            .select('jr_candidate_id')
            .order('jr_candidate_id', { ascending: false })
            .limit(1)
            .maybeSingle();

        let nextJrCandId = 1;
        if (maxResult && (maxResult as any).jr_candidate_id) {
            nextJrCandId = parseInt((maxResult as any).jr_candidate_id) + 1;
        }

        const { data: maxLogResult } = await supabase
            .from('status_log')
            .select('log_id')
            .order('log_id', { ascending: false })
            .limit(1)
            .maybeSingle();

        let nextLogId = 1;
        if (maxLogResult && (maxLogResult as any).log_id) {
            nextLogId = parseInt((maxLogResult as any).log_id) + 1;
        }

        const jrCandidatesInsert = [];
        const statusLogsInsert = [];
        const now = new Date();
        const timestampStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`; // M/D/YYYY

        for (const candidateId of toAdd) {
            const jrCandidateId = nextJrCandId;

            jrCandidatesInsert.push({
                jr_candidate_id: jrCandidateId,
                jr_id: jrId,
                candidate_id: candidateId,
                temp_status: 'Pool Candidate', // Defaulting to Pool
                list_type: listType,
                time_stamp: new Date().toISOString()
            });

            statusLogsInsert.push({
                log_id: nextLogId,
                jr_candidate_id: jrCandidateId,
                status: 'Pool Candidate',
                updated_By: 'System',
                timestamp: timestampStr
            });

            nextJrCandId++;
            nextLogId++;
        }

        const { error: candError } = await supabase.from('jr_candidates').insert(jrCandidatesInsert as any);
        if (candError) throw candError;

        const { error: logError } = await supabase.from('status_log').insert(statusLogsInsert as any);
        if (logError) throw logError;

        return { success: true, added: toAdd.length, duplicates, blacklisted: blacklistedNames };

    } catch (e: any) {
        console.error("Bulk Add Error:", e);
        return { success: false, added: 0, duplicates: [], blacklisted: [], error: e.message };
    }
}

export async function bulkAddByFilterToJR(
    jrId: string,
    filters: any,
    search: string,
    listType: string = 'Longlist'
) {
    try {
        // Copied logic from candidates/search/route.ts to get ALL matches
        const normalizedFilters = {
            companies: filters?.company || filters?.companies,
            positions: filters?.position || filters?.positions,
            countries: filters?.country || filters?.countries,
            industries: filters?.industry || filters?.industries,
            groups: filters?.group || filters?.groups,
            experienceType: filters?.experienceType
        };

        const expCandidateIds = await getCandidateIdsByExperienceFilters(normalizedFilters);
        const cleanFilter = (val: any) => (Array.isArray(val) && val.length > 0 ? val : null);

        // Call RPC with specialized parameters for "ID fetching" or just use robust search with high limit
        const { data, error } = await (adminAuthClient.rpc as any)('search_candidates_robust', {
            p_search: search || null,
            p_companies: cleanFilter(normalizedFilters.companies),
            p_positions: cleanFilter(normalizedFilters.positions),
            p_countries: cleanFilter(normalizedFilters.countries),
            p_industries: cleanFilter(normalizedFilters.industries),
            p_groups: cleanFilter(normalizedFilters.groups),
            p_exp_type: normalizedFilters.experienceType || 'All',
            p_genders: cleanFilter(filters?.genders || filters?.gender),
            p_statuses: cleanFilter(filters?.statuses || filters?.status),
            p_job_groupings: cleanFilter(filters?.jobGroupings || filters?.jobGrouping),
            p_job_functions: cleanFilter(filters?.jobFunctions || filters?.jobFunction),
            p_age_min: filters?.ageMin ? parseInt(filters.ageMin) : null,
            p_age_max: filters?.ageMax ? parseInt(filters.ageMax) : null,
            p_offset: 0,
            p_limit: 10000 // High limit for bulk action
        });

        if (error) throw error;

        const candidates = (data || []).map((c: any) => ({
            id: c.candidate_id,
            name: c.name
        }));

        return await bulkAddCandidatesToJR(jrId, candidates, listType);

    } catch (error: any) {
        console.error("Bulk Filter Add Error:", error);
        return { success: false, error: error.message };
    }
}

export async function getExistingCandidateIdsForJR(jrId: string): Promise<string[]> {
    const supabase = adminAuthClient;
    const { data, error } = await supabase
        .from('jr_candidates')
        .select('candidate_id')
        .eq('jr_id', jrId);

    if (error) {
        console.error("Error fetching existing candidate IDs:", error);
        return [];
    }

    return data.map((d: any) => d.candidate_id);
}
