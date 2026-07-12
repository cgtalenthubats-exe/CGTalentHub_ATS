"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { JRCandidate, JRAnalytics, JRCandidateExperience } from "@/types/requisition";
import { getEffectiveAge } from "@/lib/date-utils";
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
    head_recruit_feedback: string | null;
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
        .select('jr_candidate_id, jr_id, candidate_id, list_type, rank, time_stamp, head_recruit_feedback')
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

    const [profilesChunks, experiencesChunks, logsChunks, historyChunks, countryRegionsRes] = await Promise.all([
        // Query 2: Candidate Profiles
        Promise.all(candidateIdChunks.map(chunk => 
            (supabase
                .from('Candidate Profile' as any)
                .select('candidate_id, name, email, mobile_phone, job_function, photo, age, age_source, year_of_bachelor_education, gender, nationality, candidate_projects, candidate_status, linkedin, checked, gross_salary_base_b_mth, bonus_mth')
                .in('candidate_id', chunk) as any)
        )),

        // Query 3: Candidate Experiences
        Promise.all(candidateIdChunks.map(chunk =>
            (supabase as any)
                .from('candidate_experiences')
                .select('id, candidate_id, company, company_id, position, is_current_job, start_date, end_date, country, note, company_industry, company_group')
                .in('candidate_id', chunk)
        )),

        // Query 4: Status Logs
        Promise.all(jrCandIdChunks.map(chunk => 
            supabase
                .from('status_log')
                .select('log_id, jr_candidate_id, status, timestamp, updated_by')
                .in('jr_candidate_id', chunk)
                .returns<{ log_id: number; jr_candidate_id: string; status: string; timestamp: string; updated_by: string | null }[]>()
        )),

        // Query 5: Other JR History Count (Surgical Add)
        Promise.all(candidateIdChunks.map(chunk =>
            supabase
                .from('jr_candidates')
                .select('candidate_id')
                .neq('jr_id', jrId)
                .in('candidate_id', chunk)
        )),

        // Query 6: Country → Region mapping (small table, no chunking needed)
        supabase.from('country' as any).select('country, region')
    ]);

    // Flatten results
    const profiles = profilesChunks.flatMap(res => res.data || []);
    const experiences = experiencesChunks.flatMap(res => res.data || []);
    const logs = logsChunks.flatMap(res => res.data || []);
    const historyData = historyChunks.flatMap(res => (res as any).data || []);
    const countryRegionMap = new Map<string, string>(
        ((countryRegionsRes as any).data || []).map((r: any) => [r.country, r.region])
    );

    // Build lookup maps
    const historyMap = new Map<string, number>();
    if (historyData) {
        historyData.forEach((row: any) => {
            const cid = row.candidate_id;
            historyMap.set(cid, (historyMap.get(cid) || 0) + 1);
        });
    }

    const profileMap = new Map((profiles as any)?.map((p: any) => [p.candidate_id, p]));

    // Lookup company_master for all unique company_ids from experiences
    const allCompanyIds = [...new Set((experiences as any[]).map((e: any) => e.company_id).filter(Boolean))] as string[];
    let companyMasterMap = new Map<string, { industry: string; rating: string | null }>();
    if (allCompanyIds.length > 0) {
        const { data: compMaster } = await (supabase as any)
            .from('company_master')
            .select('company_id, industry, rating')
            .in('company_id', allCompanyIds);
        if (compMaster) {
            companyMasterMap = new Map((compMaster as any[]).map((r: any) => [
                r.company_id, { industry: r.industry || '', rating: r.rating || null }
            ]));
        }
    }

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

    const expMap = new Map<string, { company: string; company_id: string; position: string; label: string; country: string; region: string; note: string; company_industry: string; company_group: string; industry_master: string; hotel_rating: string | null; }>();
    const fullExpMap = new Map<string, JRCandidateExperience[]>();
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
            const masterData = companyMasterMap.get(best.company_id || '');
            expMap.set(cid, {
                company: best.company || '',
                company_id: best.company_id || '',
                position: best.position || '',
                label: isCurrent ? 'Current' : 'Latest Position',
                country: best.country || '',
                region: countryRegionMap.get(best.country || '') || '',
                note: best.note || '',
                company_industry: best.company_industry || '',
                company_group: best.company_group || '',
                industry_master: masterData?.industry || '',
                hotel_rating: masterData?.rating || null,
            });

            fullExpMap.set(cid, exps.map((e: any) => ({
                id: e.id,
                company: e.company || '',
                position: e.position || '',
                start_date: e.start_date || '',
                end_date: e.end_date || '',
                country: e.country || '',
                company_industry: e.company_industry || '',
                is_current_job: e.is_current_job || '',
            })));
        }
    }

    // Build reviewer map: jr_candidate_id → unique human actors (exclude system accounts)
    const SYSTEM_ACTORS = new Set(['System', 'System (Multi-JR Audit)', 'System (Audit Reconciliation)', 'All Users']);
    const reviewerMap = new Map<string, string[]>();
    for (const log of (logs as any[])) {
        const actor = log.updated_by as string | null;
        if (!actor || SYSTEM_ACTORS.has(actor)) continue;
        const existing = reviewerMap.get(log.jr_candidate_id);
        if (existing) {
            if (!existing.includes(actor)) existing.push(actor);
        } else {
            reviewerMap.set(log.jr_candidate_id, [actor]);
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
            candidate_current_company_id: exp?.company_id || undefined,
            candidate_current_company_industry: exp?.company_industry || undefined,
            candidate_current_company_group: exp?.company_group || undefined,
            candidate_is_current_job: exp ? exp.label : undefined,
            candidate_country: countryDisplay || undefined,
            candidate_image_url: profile?.photo || undefined,
            candidate_age: profile?.age || (profile?.year_of_bachelor_education ? parseInt(getEffectiveAge(null, profile.year_of_bachelor_education)) || undefined : undefined),
            candidate_age_source: profile?.age_source ?? undefined,
            candidate_year_of_bachelor_education: profile?.year_of_bachelor_education ?? undefined,
            candidate_gender: profile?.gender || undefined,
            candidate_status: (profile?.candidate_status as string[] | null | undefined) || undefined,
            candidate_linkedin_url: profile?.linkedin || undefined,
            candidate_checked: profile?.checked || undefined,
            candidate_nationality: profile?.nationality || undefined,
            candidate_region: exp?.region || undefined,
            candidate_industry: exp?.industry_master || undefined,
            candidate_hotel_rating: exp?.hotel_rating || undefined,
            candidate_salary_base: profile?.gross_salary_base_b_mth || undefined,
            candidate_salary_bonus: profile?.bonus_mth || undefined,
            history_count: historyMap.get(row.candidate_id) || 0,
            candidate_reviewers: reviewerMap.get(row.jr_candidate_id) || [],
            candidate_experiences: fullExpMap.get(row.candidate_id) || [],
            head_recruit_feedback: row.head_recruit_feedback || undefined,
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

    try {
        // 0. Fetch Master & Candidates
        const [{ data: masters }, { data: jrCands }] = await Promise.all([
            supabase.from('status_master').select('status, stage_order').order('stage_order', { ascending: true }),
            supabase.from('jr_candidates').select('jr_candidate_id, temp_status').eq('jr_id', jrId).returns<{ jr_candidate_id: string; temp_status: string }[]>()
        ]);

        // Use sorted status list from master
        const allStatuses = (masters as any[])?.map(m => m.status) || [];
        const statusOrderMap = new Map((masters as any[])?.map(m => [m.status, m.stage_order]));

        if (!jrCands || jrCands.length === 0) {
            // Even if no candidates, return all statuses with 0 count to keep graphs visible
            return {
                countsByStatus: allStatuses.map(s => ({ status: s, count: 0 })),
                agingByStatus: allStatuses.map(s => ({ status: s, avgDays: 0 }))
            };
        }

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

        // Initialize with all statuses to ensure they appear in the graph
        allStatuses.forEach(s => {
            countMap[s] = 0;
        });
        
        const now = new Date();

        // Count activity transactions
        if (logs) {
            logs.forEach(log => {
                const status = log.status || "Unknown";
                if (countMap[status] !== undefined) {
                    countMap[status]++;
                } else {
                    countMap[status] = (countMap[status] || 0) + 1;
                }
            });
        }

        // Aging: Time since the LATEST activity in the current status for each candidate
        jrCands.forEach(c => {
            const status = getLatestStatus(logs || [], c.jr_candidate_id, "Pool Candidate");
            
            const cLogs = (logs || []).filter(l => l.jr_candidate_id === c.jr_candidate_id);
            if (cLogs.length > 0) {
                cLogs.sort((a, b) => {
                    const dateA = new Date(a.timestamp).getTime();
                    const dateB = new Date(b.timestamp).getTime();
                    if (dateA !== dateB && !isNaN(dateA) && !isNaN(dateB)) return dateB - dateA;
                    return b.log_id - a.log_id;
                });
                const latestLog = cLogs[0];
                const days = Math.floor((now.getTime() - new Date(latestLog.timestamp).getTime()) / (1000 * 3600 * 24));
                
                if (!agingMap[status]) agingMap[status] = { totalDays: 0, count: 0 };
                agingMap[status].totalDays += days;
                agingMap[status].count++;
            }
        });

        // Prepare result sorted by stage_order
        const sortedStatuses = Object.keys(countMap).sort((a, b) => {
            const orderA = (statusOrderMap.get(a) as number) ?? 999;
            const orderB = (statusOrderMap.get(b) as number) ?? 999;
            return orderA - orderB;
        });

        const countsByStatus = sortedStatuses.map(s => ({ status: s, count: countMap[s] }));
        const agingByStatus = sortedStatuses.map(s => ({
            status: s,
            avgDays: agingMap[s] ? Math.round(agingMap[s].totalDays / agingMap[s].count) : 0
        }));

        return { countsByStatus, agingByStatus };
    } catch (e) {
        console.error("Error in getJRAnalytics:", e);
        return { countsByStatus: [], agingByStatus: [] };
    }
}

/**
 * Per-candidate breakdown for Activity Transaction & Aging CSV export.
 * Activity: which statuses each candidate ever passed through (1/0 per status column).
 * Aging: actual days spent in each status (sum across visits; current status counts until now).
 */
export async function getJRActivityAgingExport(jrId: string): Promise<{
    statuses: string[];
    rows: {
        rank: string | null;
        type: string;
        currentStatus: string;
        candidateId: string;
        name: string;
        company: string;
        position: string;
        visited: Record<string, number>;
        aging: Record<string, number>;
    }[];
}> {
    const supabase = adminAuthClient;

    const [{ data: masters }, { data: jrCands }] = await Promise.all([
        supabase.from('status_master').select('status, stage_order').order('stage_order', { ascending: true }),
        supabase.from('jr_candidates').select('jr_candidate_id, candidate_id, list_type, rank').eq('jr_id', jrId)
            .returns<{ jr_candidate_id: string; candidate_id: string; list_type: string | null; rank: string | null }[]>()
    ]);

    const statuses = (masters as any[])?.map(m => m.status) || [];

    if (!jrCands || jrCands.length === 0) {
        return { statuses, rows: [] };
    }

    const jrCandIds = jrCands.map(c => c.jr_candidate_id);
    const candidateIds = jrCands.map(c => c.candidate_id).filter(Boolean);

    const [{ data: logs }, { data: profiles }, { data: experiences }] = await Promise.all([
        supabase.from('status_log').select('log_id, jr_candidate_id, status, timestamp')
            .in('jr_candidate_id', jrCandIds)
            .returns<{ log_id: number; jr_candidate_id: string; status: string; timestamp: string }[]>(),
        supabase.from('Candidate Profile').select('candidate_id, name').in('candidate_id', candidateIds),
        supabase.from('candidate_experiences').select('candidate_id, company, position, is_current_job, start_date').in('candidate_id', candidateIds)
    ]);

    const nameMap = new Map((profiles as any[] || []).map((p: any) => [p.candidate_id, p.name]));

    // Pick current (or most recent) experience per candidate for company/position
    const expMap = new Map<string, { company: string; position: string }>();
    (experiences as any[] || []).forEach((e: any) => {
        const existing = expMap.get(e.candidate_id);
        const isCurrent = (e.is_current_job || '').toString().trim().toLowerCase() === 'current';
        if (!existing || isCurrent) {
            expMap.set(e.candidate_id, { company: e.company || '', position: e.position || '' });
        }
    });

    const now = Date.now();

    const rows = jrCands.map(jc => {
        const candidateLogs = (logs || []).filter(l => String(l.jr_candidate_id) === String(jc.jr_candidate_id));
        candidateLogs.sort((a, b) => {
            const dateA = new Date(a.timestamp).getTime();
            const dateB = new Date(b.timestamp).getTime();
            if (dateA !== dateB && !isNaN(dateA) && !isNaN(dateB)) return dateA - dateB; // ascending
            return a.log_id - b.log_id;
        });

        const visited: Record<string, number> = {};
        const aging: Record<string, number> = {};

        candidateLogs.forEach((log, i) => {
            visited[log.status] = 1;
            const startTime = new Date(log.timestamp).getTime();
            const endTime = i < candidateLogs.length - 1
                ? new Date(candidateLogs[i + 1].timestamp).getTime()
                : now;
            if (!isNaN(startTime) && !isNaN(endTime) && endTime >= startTime) {
                const days = Math.floor((endTime - startTime) / (1000 * 3600 * 24));
                aging[log.status] = (aging[log.status] || 0) + days;
            }
        });

        const currentStatus = candidateLogs.length > 0 ? candidateLogs[candidateLogs.length - 1].status : "Pool Candidate";
        const exp = expMap.get(jc.candidate_id);

        return {
            rank: jc.rank,
            type: jc.list_type || '',
            currentStatus,
            candidateId: jc.candidate_id,
            name: nameMap.get(jc.candidate_id) || 'Unknown',
            company: exp?.company || '',
            position: exp?.position || '',
            visited,
            aging,
        };
    });

    return { statuses, rows };
}

/**
 * Fetch Salary Benchmark data specifically for candidates within a single JR.
 * Reuses the EXACT logic from getMarketSalaryStats for consistency.
 */
export async function getJRSalaryStats(jrId: string) {
    const { getMarketSalaryStats } = await import("@/app/actions/dashboard");
    
    // 1. Get all candidate IDs in this JR
    const supabase = adminAuthClient;
    const { data: jrCands } = await supabase
        .from('jr_candidates')
        .select('candidate_id')
        .eq('jr_id', jrId);

    if (!jrCands || jrCands.length === 0) return [];
    const candidateIds = jrCands.map(c => c.candidate_id);

    // 2. Use the proven dashboard action with a filter
    // We'll call the dashboard stats but then filter the results to only include these candidates.
    // (Or we can modify getMarketSalaryStats to accept a list of IDs, but for now filtering is safest/fastest)
    const allStats = await getMarketSalaryStats();
    
    // 3. Since getMarketSalaryStats aggregates by Company, we need a slightly more precise approach
    // Let's actually pull the data ourselves using the SAME logic but targeted.
    
    try {
        const { data: profiles } = await (supabase
            .from('Candidate Profile' as any)
            .select('candidate_id, name, gross_salary_base_b_mth, bonus_mth')
            .in('candidate_id', candidateIds) as any);

        const { data: experiences } = await (supabase
            .from('candidate_experiences' as any)
            .select('candidate_id, company, position_keyword, is_current_job, start_date')
            .in('candidate_id', candidateIds) as any);

        const results: any[] = [];
        profiles?.forEach((p: any) => {
            const monthly = parseFloat(p.gross_salary_base_b_mth) || 0;
            const bonus = parseFloat((p.bonus_mth || "0").toString().replace(/[^0-9.]/g, '')) || 0;
            const annual = (monthly * 12) + (monthly * bonus);
            if (annual <= 0) return;

            const candExps = (experiences || []).filter((e: any) => e.candidate_id === p.candidate_id);
            candExps.sort((a, b) => {
                const aCur = a.is_current_job === 'Current' ? 1 : 0;
                const bCur = b.is_current_job === 'Current' ? 1 : 0;
                if (aCur !== bCur) return bCur - aCur;
                return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
            });

            const exp = candExps[0];
            if (!exp) return;

            results.push({
                company: exp.company || "Unknown Company",
                position: exp.position_keyword || "Unknown Position",
                salary: annual / 1000000
            });
        });

        // Group by Company
        const companyGroup: Record<string, any> = {};
        results.forEach(r => {
            if (!companyGroup[r.company]) {
                companyGroup[r.company] = { company: r.company };
            }
            companyGroup[r.company][r.position] = r.salary;
        });

        return Object.values(companyGroup);
    } catch (e) {
        console.error("Error in getJRSalaryStats:", e);
        return [];
    }
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
            .contains('candidate_status', ['Blacklist']) as any);
        
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
                updated_by: addedBy,
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
    addedByOverride?: string,
    forceIncludeBlacklisted: boolean = false
): Promise<{
    success: boolean;
    added: number;
    duplicates: string[];
    blacklisted: { id: string; name: string; statuses: string[] }[];
    needsBlacklistConfirm?: boolean;
    error?: string;
}> {
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
            .contains('candidate_status', ['Blacklist']) as any);

        if (blError) throw blError;

        const blacklistedMap = new Map<string, string[]>(
            (blacklistData ?? []).map((b: any) => [b.candidate_id, b.candidate_status ?? []])
        );

        const blacklistedDetails: { id: string; name: string; statuses: string[] }[] = [];
        const candidatesSafe = processedCandidates.filter(c => {
            if (blacklistedMap.has(c.id)) {
                blacklistedDetails.push({ id: c.id, name: c.name, statuses: blacklistedMap.get(c.id)! });
                return false;
            }
            return true;
        });

        // If blacklisted found and not forced → return for confirmation
        if (blacklistedDetails.length > 0 && !forceIncludeBlacklisted) {
            return { success: false, added: 0, duplicates: [], blacklisted: blacklistedDetails, needsBlacklistConfirm: true };
        }

        // If forced, include blacklisted in the add list
        const candidatesToAdd = forceIncludeBlacklisted ? processedCandidates : candidatesSafe;

        if (candidatesToAdd.length === 0) {
            return { success: true, added: 0, duplicates: [], blacklisted: blacklistedDetails };
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

        for (const c of candidatesToAdd) {
            if (existingIds.has(c.id)) {
                duplicates.push(c.name);
            } else {
                toAdd.push(c.id);
            }
        }

        if (toAdd.length === 0) {
            return { success: true, added: 0, duplicates, blacklisted: blacklistedDetails };
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

        return { success: true, added: toAdd.length, duplicates, blacklisted: blacklistedDetails };

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
