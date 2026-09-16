"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { getJRAgingDays } from "@/lib/utils";
import { severityForDays, STAGE_THRESHOLDS, TERMINAL_STATUSES, type StageSeverity } from "@/lib/stage-aging";

/**
 * Stage-level view of where a JR is stuck.
 *
 * The existing "Avg. Aging (Days)" bar chart answers a historical question — how long candidates
 * have typically spent in each status. That is not the question a recruiter opens the JR with.
 * This action answers the live one: which stage is holding the search up right now, who is
 * sitting in it, and for how long.
 *
 * Everything is derived from `status_log`, so a candidate's time in a stage is the interval
 * between consecutive log entries; for the latest entry it runs to now.
 */

export interface StageAgingStage {
    status: string;
    stageOrder: number;
    ownerRole: string | null;
    /** Candidates whose latest status is this one. */
    currentCount: number;
    /** Longest ongoing wait among those candidates, in days. */
    longestWaitDays: number;
    /** Historical: every visit any candidate has ever made to this stage. */
    avgDays: number;
    minDays: number;
    maxDays: number;
    visits: number;
    isTerminal: boolean;
    severity: StageSeverity;
}

export interface StageAgingCandidate {
    jrCandidateId: string;
    candidateId: string;
    name: string;
    status: string;
    stageOrder: number;
    ownerRole: string | null;
    /** ISO date the candidate entered the current status. */
    waitingSince: string | null;
    agingDays: number;
    severity: StageSeverity;
    lastUpdatedBy: string | null;
    isTerminal: boolean;
}

export interface JRStageAging {
    totalOpenDays: number | null;
    stages: StageAgingStage[];
    candidates: StageAgingCandidate[];
    bottleneck: {
        status: string;
        ownerRole: string | null;
        waitingCount: number;
        longestWaitDays: number;
    } | null;
    /** Sum of current waiting days grouped by who owns the next action. */
    ownerDays: { ownerRole: string; days: number; candidates: number }[];
    ownerRoleConfigured: boolean;
    activeCandidates: number;
}

const CHUNK_SIZE = 150;

function chunk<T>(arr: T[], size = CHUNK_SIZE): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function daysBetween(fromMs: number, toMs: number): number {
    return Math.max(0, Math.floor((toMs - fromMs) / (1000 * 3600 * 24)));
}

export async function getJRStageAging(jrId: string): Promise<JRStageAging> {
    const supabase = adminAuthClient;
    const empty: JRStageAging = {
        totalOpenDays: null, stages: [], candidates: [], bottleneck: null,
        ownerDays: [], ownerRoleConfigured: false, activeCandidates: 0,
    };

    try {
        const [{ data: jrRow }, { data: masters }, { data: jrCands }] = await Promise.all([
            (supabase as any).from("job_requisitions").select("request_date, closed_date").eq("jr_id", jrId).maybeSingle(),
            // select('*') so a database without status_master.owner_role still works.
            (supabase as any).from("status_master").select("*").order("stage_order", { ascending: true }),
            supabase.from("jr_candidates").select("jr_candidate_id, candidate_id, temp_status").eq("jr_id", jrId)
                .returns<{ jr_candidate_id: string; candidate_id: string; temp_status: string }[]>(),
        ]);

        const masterRows = (masters || []) as any[];
        const ownerRoleConfigured = masterRows.some(m => m.owner_role);
        const stageOrder = new Map<string, number>(masterRows.map(m => [m.status, m.stage_order ?? 999]));
        const ownerByStatus = new Map<string, string | null>(masterRows.map(m => [m.status, m.owner_role || null]));

        const totalOpenDays = getJRAgingDays(jrRow?.request_date, jrRow?.closed_date);

        if (!jrCands || jrCands.length === 0) {
            return { ...empty, totalOpenDays, ownerRoleConfigured };
        }

        const jrCandIds = jrCands.map(c => c.jr_candidate_id);
        const candidateIds = Array.from(new Set(jrCands.map(c => c.candidate_id).filter(Boolean)));

        const [logChunks, nameChunks] = await Promise.all([
            Promise.all(chunk(jrCandIds).map(ids =>
                supabase.from("status_log")
                    .select("log_id, jr_candidate_id, status, timestamp, updated_by")
                    .in("jr_candidate_id", ids)
                    .returns<{ log_id: number; jr_candidate_id: string; status: string; timestamp: string; updated_by: string | null }[]>()
            )),
            Promise.all(chunk(candidateIds).map(ids =>
                (supabase as any).from("Candidate Profile").select("candidate_id, name").in("candidate_id", ids)
            )),
        ]);

        const logs = logChunks.flatMap(r => r.data || []);
        const nameById = new Map<string, string>(
            nameChunks.flatMap((r: any) => r.data || []).map((p: any) => [p.candidate_id, p.name || "Unknown"])
        );

        const logsByCandidate = new Map<string, typeof logs>();
        logs.forEach(l => {
            if (!logsByCandidate.has(l.jr_candidate_id)) logsByCandidate.set(l.jr_candidate_id, []);
            logsByCandidate.get(l.jr_candidate_id)!.push(l);
        });

        const now = Date.now();
        const history = new Map<string, { total: number; min: number; max: number; visits: number }>();
        const candidates: StageAgingCandidate[] = [];

        jrCands.forEach(jc => {
            const cLogs = (logsByCandidate.get(jc.jr_candidate_id) || []).slice().sort((a, b) => {
                const ta = new Date(a.timestamp).getTime();
                const tb = new Date(b.timestamp).getTime();
                if (ta !== tb && !isNaN(ta) && !isNaN(tb)) return ta - tb;
                return a.log_id - b.log_id;
            });

            cLogs.forEach((log, i) => {
                const status = log.status || "Unknown";
                const start = new Date(log.timestamp).getTime();
                const end = i === cLogs.length - 1 ? now : new Date(cLogs[i + 1].timestamp).getTime();
                if (isNaN(start) || isNaN(end) || end < start) return;
                const days = daysBetween(start, end);
                const h = history.get(status) || { total: 0, min: days, max: days, visits: 0 };
                h.total += days;
                h.min = Math.min(h.min, days);
                h.max = Math.max(h.max, days);
                h.visits += 1;
                history.set(status, h);
            });

            const last = cLogs[cLogs.length - 1];
            const status = last?.status || jc.temp_status || "Pool Candidate";
            const startedMs = last ? new Date(last.timestamp).getTime() : NaN;
            const agingDays = isNaN(startedMs) ? 0 : daysBetween(startedMs, now);
            const isTerminal = TERMINAL_STATUSES.has(status);

            candidates.push({
                jrCandidateId: jc.jr_candidate_id,
                candidateId: jc.candidate_id,
                name: nameById.get(jc.candidate_id) || "Unknown",
                status,
                stageOrder: stageOrder.get(status) ?? 999,
                ownerRole: ownerByStatus.get(status) ?? null,
                waitingSince: last?.timestamp || null,
                agingDays,
                // A finished candidate is not "critical" — they are simply done.
                severity: isTerminal ? "ok" : severityForDays(agingDays),
                lastUpdatedBy: last?.updated_by || null,
                isTerminal,
            });
        });

        const activeCandidates = candidates.filter(c => !c.isTerminal);

        const stages: StageAgingStage[] = masterRows.map(m => {
            const status = m.status as string;
            const here = candidates.filter(c => c.status === status);
            const activeHere = here.filter(c => !c.isTerminal);
            const longestWaitDays = activeHere.reduce((max, c) => Math.max(max, c.agingDays), 0);
            const h = history.get(status);
            const isTerminal = TERMINAL_STATUSES.has(status);
            return {
                status,
                stageOrder: m.stage_order ?? 999,
                ownerRole: m.owner_role || null,
                currentCount: here.length,
                longestWaitDays,
                avgDays: h ? Math.round(h.total / h.visits) : 0,
                minDays: h ? h.min : 0,
                maxDays: h ? h.max : 0,
                visits: h ? h.visits : 0,
                isTerminal,
                severity: isTerminal || activeHere.length === 0 ? "ok" : severityForDays(longestWaitDays),
            };
        });

        const bottleneckStage = stages
            .filter(s => !s.isTerminal && s.longestWaitDays >= STAGE_THRESHOLDS.attention)
            .sort((a, b) => b.longestWaitDays - a.longestWaitDays)[0];

        const ownerTotals = new Map<string, { days: number; candidates: number }>();
        activeCandidates.forEach(c => {
            const key = c.ownerRole || "Unassigned";
            const cur = ownerTotals.get(key) || { days: 0, candidates: 0 };
            cur.days += c.agingDays;
            cur.candidates += 1;
            ownerTotals.set(key, cur);
        });

        return {
            totalOpenDays,
            stages,
            candidates: candidates.sort((a, b) => {
                if (a.isTerminal !== b.isTerminal) return a.isTerminal ? 1 : -1;
                return b.agingDays - a.agingDays;
            }),
            bottleneck: bottleneckStage
                ? {
                    status: bottleneckStage.status,
                    ownerRole: bottleneckStage.ownerRole,
                    waitingCount: activeCandidates.filter(c => c.status === bottleneckStage.status).length,
                    longestWaitDays: bottleneckStage.longestWaitDays,
                }
                : null,
            ownerDays: Array.from(ownerTotals.entries())
                .map(([ownerRole, v]) => ({ ownerRole, ...v }))
                .sort((a, b) => b.days - a.days),
            ownerRoleConfigured,
            activeCandidates: activeCandidates.length,
        };
    } catch (e) {
        console.error("Error in getJRStageAging:", e);
        return empty;
    }
}
