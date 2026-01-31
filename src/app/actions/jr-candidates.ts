"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { JRCandidate, JRAnalytics } from "@/types/requisition";

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
        .order('rank', { ascending: true })
        .returns<DBJRCandidate[]>();

    if (error || !candidates) {
        console.error("Error fetching JR Candidates:", error);
        return [];
    }

    // 2. Fetch Profiles Separately (Application-Side Join)
    const candidateIds = candidates.map(c => c.candidate_id).filter(Boolean);
    const { data: profiles } = await supabase
        .from('Candidate Profile') // Explicit table name
        .select('candidate_id, name, email, mobile_phone, job_function, photo, age, gender, candidate_projects')
        .in('candidate_id', candidateIds);

    const profileMap = new Map(profiles?.map(p => [p.candidate_id, p]));

    // 3. Fetch Status Logs
    const jrCandIds = candidates.map(c => c.jr_candidate_id);
    const { data: logs } = await supabase
        .from('status_log')
        .select('log_id, jr_candidate_id, status, timestamp')
        .in('jr_candidate_id', jrCandIds)
        .returns<{ log_id: number; jr_candidate_id: string; status: string; timestamp: string }[]>();

    return candidates.map((row) => {
        // Resolve Profile
        const profile = profileMap.get(row.candidate_id);

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

    const allStatuses: string[] = masters?.map(m => m.status) || ["Pool Candidate", "Phone Screen", "Interview", "Offer", "Hired"];

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
