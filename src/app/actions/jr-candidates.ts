"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { JRCandidate, JRAnalytics } from "@/types/requisition";
import { getCandidateIdsByExperienceFilters } from "@/lib/candidate-service";
import { onboardExternalCandidate } from "./ai-search";

// Get current logged-in user email from session
async function getCurrentUserEmail(): Promise<string> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        return user?.email || 'System';
    } catch {
        return 'System';
    }
}

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

    // 1. Fetch Candidates (Raw) — does NOT read temp_status; status is resolved from status_log only
    const { data: candidates, error } = await supabase
        .from('jr_candidates')
        .select('jr_candidate_id, jr_id, candidate_id, list_type, rank, time_stamp')
        .eq('jr_id', jrId)
        .returns<DBJRCandidate[]>();

    if (error || !candidates) {
        console.error("Error fetching JR Candidates:", error);
        return [];
    }

    // Sort by: Successful Placement first, then Top profile, then rank
    // NOTE: At this point temp_status may be null (status resolved from logs later).
    // We do a pre-sort by list_type/rank only; final Successful Placement sort happens below after resolution.
    candidates.sort((a, b) => {
        const isTopA = a.list_type === 'Top profile';
        const isTopB = b.list_type === 'Top profile';
        if (isTopA && !isTopB) return -1;
        if (!isTopA && isTopB) return 1;

        // Rank ascending (no rank → 9999 → goes to bottom of group)
        const rankA = parseInt(a.rank || "9999");
        const rankB = parseInt(b.rank || "9999");
        return rankA - rankB;
    });

    // 2. Fetch Profiles, Experiences, and Status Logs in PARALLEL with CHUNKING
    // Supabase has URL length limits and max_rows limits (often 1000). 
    // Chunking ensures we never hit these limits for large JRs (e.g. 900+ candidates).
    const jrCandIds = candidates.map(c => c.jr_candidate_id);
    const candidateIds = candidates.map(c => c.candidate_id).filter(Boolean);

    function chunkArray<T>(array: T[], size: number): T[][] {
        const chunked: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunked.push(array.slice(i, i + size));
        }
        return chunked;
    }

    const CHUNK_SIZE = 150;
    const candidateIdChunks = chunkArray(candidateIds, CHUNK_SIZE);
    const jrCandIdChunks = chunkArray(jrCandIds, CHUNK_SIZE);

    const [profilesChunks, experiencesChunks, logsChunks, historyChunks] = await Promise.all([
        // Query 2: Candidate Profiles
        Promise.all(candidateIdChunks.map(chunk => 
            (supabase
                .from('Candidate Profile' as any)
                .select('candidate_id, name, email, mobile_phone, job_function, photo, age, gender, candidate_projects, candidate_status, linkedin')
                .in('candidate_id', chunk) as any)
        )),

        // Query 3: Candidate Experiences
        Promise.all(candidateIdChunks.map(chunk => 
            (supabase as any)
                .from('candidate_experiences')
                .select('candidate_id, company, position, is_current_job, start_date, country, note, company_industry')
                .in('candidate_id', chunk)
        )),

        // Query 4: Status Logs
        Promise.all(jrCandIdChunks.map(chunk => 
            supabase
                .from('status_log')
                .select('log_id, jr_candidate_id, status, timestamp')
                .in('jr_candidate_id', chunk)
                .returns<{ log_id: number; jr_candidate_id: string; status: string; timestamp: string }[]>()
        )),

        // Query 5: Other JR History Count (Surgical Add)
        Promise.all(candidateIdChunks.map(chunk => 
            supabase
                .from('jr_candidates')
                .select('candidate_id')
                .neq('jr_id', jrId)
                .in('candidate_id', chunk)
        ))
    ]);

    // Flatten results
    const profiles = profilesChunks.flatMap(res => res.data || []);
    const experiences = experiencesChunks.flatMap(res => res.data || []);
    const logs = logsChunks.flatMap(res => res.data || []);
    const historyData = historyChunks.flatMap(res => (res as any).data || []);

    // Build lookup maps
    const historyMap = new Map<string, number>();
    if (historyData) {
        historyData.forEach((row: any) => {
            const cid = row.candidate_id;
            historyMap.set(cid, (historyMap.get(cid) || 0) + 1);
        });
    }

    const profileMap = new Map((profiles as any)?.map((p: any) => [p.candidate_id, p]));

    // Build experience map: prefer is_current_job='Current', else most recent by start_date
    const parseExperienceDate = (dateStr: string | null): number => {
        if (!dateStr) return 0;
        const parts = dateStr.trim().split(/[-/]/); // Support both - and /
        if (parts.length === 2) {
            const m = parseInt(parts[0]);
            const y = parseInt(parts[1]);
            // If it's M-YYYY
            if (m <= 12 && y > 1000) return y * 100 + m;
            // If it's YYYY-MM (fallback)
            if (m > 1000) return m * 100 + y;
        } else if (parts.length === 1) {
            const y = parseInt(parts[0]);
            if (!isNaN(y)) return y * 100;
        }
        return 0;
    };

    const expMap = new Map<string, { company: string; position: string; label: string; country: string; note: string; company_industry: string; }>();
    if (experiences && (experiences as any[]).length > 0) {
        // Group by candidate_id
        const groupedExp: Record<string, any[]> = {};
        for (const exp of (experiences as any[])) {
            const cid = exp.candidate_id;
            if (!groupedExp[cid]) groupedExp[cid] = [];
            groupedExp[cid].push(exp);
        }

        for (const [cid, exps] of Object.entries(groupedExp)) {
            exps.sort((a, b) => {
                const aIsCurrent = (a.is_current_job || '').toString().trim().toLowerCase() === 'current';
                const bIsCurrent = (b.is_current_job || '').toString().trim().toLowerCase() === 'current';
                if (aIsCurrent && !bIsCurrent) return -1;
                if (!aIsCurrent && bIsCurrent) return 1;
                
                const valA = parseExperienceDate(a.start_date);
                const valB = parseExperienceDate(b.start_date);
                if (valA !== valB) return valB - valA; // Descending
                return 0;
            });


            const best = exps[0];
            const isCurrent = (best.is_current_job || '').toString().trim().toLowerCase() === 'current';
            expMap.set(cid, {
                company: best.company || '',
                position: best.position || '',
                label: isCurrent ? 'Current' : 'Latest Position',
                country: best.country || '',
                note: best.note || '',
                company_industry: best.company_industry || ''
            });
        }
    }

    const mapped = candidates.map((row) => {
        const profile = profileMap.get(row.candidate_id) as any;
        const exp = expMap.get(row.candidate_id);

        // Resolve real status from status_log only (temp_status is ignored by design)
        const realStatus = getLatestStatus(logs || [], row.jr_candidate_id, "Pool Candidate");

        const countryDisplay = exp
            ? [exp.country, exp.note ? `(${exp.note})` : ''].filter(Boolean).join('')
            : undefined;

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
            candidate_current_position: exp?.position || undefined,
            candidate_current_company: exp?.company || undefined,
            candidate_current_company_industry: exp?.company_industry || undefined,
            candidate_is_current_job: exp ? exp.label : undefined,
            candidate_country: countryDisplay || undefined,
            candidate_image_url: profile?.photo || undefined,
            candidate_age: profile?.age || undefined,
            candidate_gender: profile?.gender || undefined,
            candidate_status: profile?.candidate_status || undefined,
            candidate_linkedin_url: profile?.linkedin || undefined,
            history_count: historyMap.get(row.candidate_id) || 0,
        };
    });

    // Final sort: Successful Placement always on top (using resolved real status)
    mapped.sort((a, b) => {
        const aPlaced = a.status?.toLowerCase().includes('successful placement') ? 0 : 1;
        const bPlaced = b.status?.toLowerCase().includes('successful placement') ? 0 : 1;
        return aPlaced - bPlaced;
    });

    return mapped;
}


export async function getJRAnalytics(jrId: string): Promise<JRAnalytics> {
    const supabase = adminAuthClient;

    // 0. Fetch Master & Candidates
    const [{ data: masters }, { data: jrCands }] = await Promise.all([
        supabase.from('status_master').select('status, stage_order').order('stage_order', { ascending: true }),
        supabase.from('jr_candidates').select('jr_candidate_id, temp_status').eq('jr_id', jrId).returns<{ jr_candidate_id: string; temp_status: string }[]>()
    ]);

    // Use sorted status list from master
    const allStatuses = (masters as any[])?.map(m => m.status) || [];
    const statusOrderMap: Record<string, number> = {};
    (masters as any[])?.forEach(m => statusOrderMap[m.status] = m.stage_order);

    if (!jrCands || jrCands.length === 0) return { countsByStatus: [], agingByStatus: [] };

    // 1. Fetch ALL Logs for these candidates to count transactions
    const jrCandIds = jrCands.map(c => c.jr_candidate_id);
    const { data: logs } = await supabase
        .from('status_log')
        .select('log_id, jr_candidate_id, status, timestamp')
        .in('jr_candidate_id', jrCandIds)
        .returns<{ log_id: number; jr_candidate_id: string; status: string; timestamp: string }[]>();

    // 2. Compute Counts & Aging
    const countMap: Record<string, number> = {};
    const agingMap: Record<string, { totalDays: number, count: number }> = {};

    // Initialize counts with master order
    allStatuses.forEach(s => countMap[s] = 0);
    const now = new Date();

    // Count EVERY log entry as an activity transaction
    if (logs) {
        logs.forEach(log => {
            const status = log.status || "Unknown";
            if (countMap[status] !== undefined) {
                countMap[status]++;
            } else {
                // If status is not in master, add it to the end
                countMap[status] = (countMap[status] || 0) + 1;
            }
        });
    }

    jrCands.forEach(c => {
        const status = getLatestStatus(logs || [], c.jr_candidate_id, "Pool Candidate");

        // Aging: Time since the LATEST activity in the current status
        if (logs) {
            const cLogs = logs.filter(l => l.jr_candidate_id === c.jr_candidate_id);
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

    // Prepare result sorted by stage_order (master order)
    const sortedStatuses = Object.keys(countMap).sort((a, b) => {
        const orderA = statusOrderMap[a] ?? 999;
        const orderB = statusOrderMap[b] ?? 999;
        return orderA - orderB;
    });

    const countsByStatus = sortedStatuses.map(s => ({ status: s, count: countMap[s] }));
    const agingByStatus = sortedStatuses
        .filter(s => agingMap[s]) // Only show aging for statuses that have candidates
        .map(s => ({
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
        // Get current user email for tracking
        const addedBy = await getCurrentUserEmail();

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

        // 3a. Check for Blacklist (NEW)
        const { data: blacklistCheck } = await (supabase
            .from('Candidate Profile' as any)
            .select('candidate_id, name, candidate_status')
            .in('candidate_id', candidateIds)
            .eq('candidate_status', 'Blacklist') as any);
        
        const blacklistedIds = new Set((blacklistCheck as any[])?.map(b => b.candidate_id) || []);
        if (blacklistedIds.size > 0) {
            const blNames = (blacklistCheck as any[])?.map(b => b.name || b.candidate_id).join(', ');
            return { success: false, error: `Cannot add blacklisted candidate(s): ${blNames}` };
        }

        // Date format: M/D/YYYY
        const now = new Date();
        const timestampStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

        for (const candidateId of candidateIds) {
            const jrCandidateId = nextJrCandId;

            jrCandidatesInsert.push({
                jr_candidate_id: jrCandidateId,
                jr_id: jrId,
                candidate_id: candidateId,
                temp_status: 'Pool Candidate', // Fixed from null to match bulk add
                list_type: listType,
                rank: null,
                time_stamp: new Date().toISOString(),
                added_by: addedBy
            });

            statusLogsInsert.push({
                log_id: nextLogId,
                jr_candidate_id: jrCandidateId,
                status: 'Pool Candidate',
                updated_By: addedBy,
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
    candidates: { id: string, name: string, source?: string }[],
    listType: string = 'Longlist',
    addedByOverride?: string
): Promise<{ success: boolean; added: number; duplicates: string[]; blacklisted: string[]; error?: string }> {
    const supabase = adminAuthClient;

    try {
        if (candidates.length === 0) return { success: true, added: 0, duplicates: [], blacklisted: [] };

        // Get current user email for tracking
        const addedBy = addedByOverride || await getCurrentUserEmail();

        // 1. Process Onboarding for External Candidates
        const processedCandidates: { id: string, name: string }[] = [];
        
        for (const cand of candidates) {
            if (cand.source === 'external_db') {
                const onboardResult = await onboardExternalCandidate(cand.id, addedBy);
                if (onboardResult.success && onboardResult.candidateId) {
                    processedCandidates.push({ id: onboardResult.candidateId, name: cand.name });
                } else {
                    console.error(`Failed to onboard ${cand.name} (${cand.id}):`, onboardResult.error);
                    // Skip if onboarding fails? Or throw? For now, we'll skip and continue with others.
                }
            } else {
                processedCandidates.push({ id: cand.id, name: cand.name });
            }
        }

        if (processedCandidates.length === 0) return { success: true, added: 0, duplicates: [], blacklisted: [] };

        // 0. Check for Blacklisted Candidates
        const candidateIdsToCheck = processedCandidates.map(c => c.id);
        const { data: blacklistData, error: blError } = await (supabase
            .from('Candidate Profile' as any)
            .select('candidate_id, candidate_status')
            .in('candidate_id', candidateIdsToCheck)
            .eq('candidate_status', 'Blacklist') as any);

        if (blError) throw blError;

        const blacklistedIds = new Set(blacklistData?.map((b: any) => b.candidate_id));
        const blacklistedNames: string[] = [];

        // Filter out blacklisted
        const candidatesSafe = processedCandidates.filter(c => {
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
                temp_status: 'Pool Candidate',
                list_type: listType,
                time_stamp: new Date().toISOString(),
                added_by: addedBy
            });

            statusLogsInsert.push({
                log_id: nextLogId,
                jr_candidate_id: jrCandidateId,
                status: 'Pool Candidate',
                updated_By: addedBy,
                updated_by: addedBy,
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
export async function getJRHistoryOverview(jrId: string) {
    const supabase = adminAuthClient;

    // 1. Get current candidates
    const currentCandidates = await getJRCandidates(jrId);
    const withHistory = currentCandidates.filter(c => (c.history_count || 0) > 0);

    if (withHistory.length === 0) return [];

    const candidateIds = withHistory.map(c => c.candidate_id);

    // 2. Fetch ALL other JR associations for these candidates
    const { data: others, error: othersError } = await (supabase
        .from('jr_candidates')
        .select('jr_candidate_id, jr_id, candidate_id')
        .neq('jr_id', jrId)
        .in('candidate_id', candidateIds) as any);

    if (othersError || !others) return [];

    const otherJrCandIds = (others as any[]).map(o => o.jr_candidate_id);
    const otherJrIds = [...new Set((others as any[]).map(o => o.jr_id))];

    // 3. Fetch logs and feedback in parallel for these other JRs
    const [logsRes, feedbackRes, jrInfoRes] = await Promise.all([
        supabase
            .from('status_log')
            .select('jr_candidate_id, status, timestamp, log_id')
            .in('jr_candidate_id', otherJrCandIds)
            .order('log_id', { ascending: false }),
        supabase
            .from('interview_feedback')
            .select('jr_candidate_id, rating_score, feedback_text, overall_recommendation, interview_date')
            .in('jr_candidate_id', otherJrCandIds)
            .order('interview_date', { ascending: false }),
        (supabase
            .from('job_requisitions')
            .select('jr_id, position_jr')
            .in('jr_id', otherJrIds) as any)
    ]);

    const logs = (logsRes.data || []) as any[];
    const feedbacks = (feedbackRes.data || []) as any[];
    const jrInfos = (jrInfoRes.data || []) as any[];

    const jrInfoMap = new Map(jrInfos.map(j => [j.jr_id, j.position_jr]));

    // 4. Aggregate per candidate
    return withHistory.map(c => {
        const cOthers = (others as any[]).filter(o => o.candidate_id === c.candidate_id);
        
        const histories = cOthers.map(o => {
            const cLogs = logs.filter(l => String(l.jr_candidate_id) === String(o.jr_candidate_id));
            const cFeedbacks = feedbacks.filter(f => String(f.jr_candidate_id) === String(o.jr_candidate_id));

            // Resolve latest status from logs
            let finalStatus = "N/A";
            if (cLogs.length > 0) {
                // Sort by log_id desc
                cLogs.sort((a, b) => b.log_id - a.log_id);
                finalStatus = cLogs[0].status;
            }

            return {
                jr_id: o.jr_id,
                jr_candidate_id: o.jr_candidate_id,
                position: jrInfoMap.get(o.jr_id) || "Unknown",
                final_status: finalStatus,
                latest_feedback: cFeedbacks[0] || null
            };
        });

        return {
            jr_candidate_id: c.id,
            candidate_id: c.candidate_id,
            name: c.candidate_name,
            photo: c.candidate_image_url,
            current_status: c.status,
            histories
        };
    });
}
