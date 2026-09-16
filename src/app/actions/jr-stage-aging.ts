"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { getJRAgingDays } from "@/lib/utils";
import {
    HIDDEN_STATUSES,
    median,
    severityForDays,
    stageKind,
    STAGE_THRESHOLDS,
    type StageKind,
    type StageSeverity,
} from "@/lib/stage-aging";

/**
 * Stage-level view of where a JR is stuck.
 *
 * Two questions live in this data and they must not be averaged together:
 *
 *   "how long has this person been stuck?"  — an unfinished wait, measured to today, growing
 *                                             every day until someone moves them
 *   "how long does this stage usually take?" — a finished duration, known exactly, and only
 *                                             answerable from candidates who already moved on
 *
 * The first version mixed the two into one mean per stage, which on this data (most candidates
 * leave the pool the same day, the rest sit for months) produced a number that described nobody
 * and crept upward while nothing happened. Completed durations now use a median and are reported
 * with their sample size; ongoing waits are reported separately as waits.
 */

export interface StageAgingStage {
    status: string;
    stageOrder: number;
    kind: StageKind;
    ownerRole: string | null;
    /** Candidates whose latest status is this one. */
    currentCount: number;
    /** Longest unfinished wait among them, in days. Zero for exit stages — nobody is waiting. */
    longestWaitDays: number;
    /** How many of them have been here past the delayed threshold. */
    overdueCount: number;
    /** Median of durations that actually finished; null when nobody has left this stage yet. */
    medianCompletedDays: number | null;
    completedCount: number;
    /** False for a stage on the path that nobody has reached — shown greyed out. */
    everVisited: boolean;
    severity: StageSeverity;
}

export interface StageAction {
    status: string;
    kind: StageKind;
    count: number;
    days: number;
    ownerRole: string | null;
}

export interface JRStageAging {
    totalOpenDays: number | null;
    activeCandidates: number;
    exitedCandidates: number;
    /** Active candidates in a work stage past the delayed threshold. */
    overdueCount: number;
    /** How far the search has actually got along the main path. */
    furthest: { status: string; position: number; total: number } | null;
    /** The work stage holding things up longest right now. */
    worst: { status: string; count: number; days: number } | null;
    mainPath: StageAgingStage[];
    exits: StageAgingStage[];
    /** What to deal with, deepest stage first — clearing the one nearest the end is what closes a JR. */
    actions: StageAction[];
    ownerDays: { ownerRole: string; days: number; candidates: number }[];
    ownerRoleConfigured: boolean;
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
        totalOpenDays: null, activeCandidates: 0, exitedCandidates: 0, overdueCount: 0,
        furthest: null, worst: null, mainPath: [], exits: [], actions: [],
        ownerDays: [], ownerRoleConfigured: false,
    };

    try {
        const [{ data: jrRow }, { data: masters }, { data: jrCands }] = await Promise.all([
            (supabase as any).from("job_requisitions").select("request_date, closed_date").eq("jr_id", jrId).maybeSingle(),
            // select('*') so a database without status_master.owner_role still works.
            (supabase as any).from("status_master").select("*").order("stage_order", { ascending: true }),
            supabase.from("jr_candidates").select("jr_candidate_id, candidate_id, temp_status").eq("jr_id", jrId)
                .returns<{ jr_candidate_id: string; candidate_id: string; temp_status: string }[]>(),
        ]);

        const masterRows = ((masters || []) as any[]).filter(m => !HIDDEN_STATUSES.has(m.status));
        const ownerRoleConfigured = masterRows.some(m => m.owner_role);
        const ownerOf = new Map<string, string | null>(masterRows.map(m => [m.status, m.owner_role || null]));

        const totalOpenDays = getJRAgingDays(jrRow?.request_date, jrRow?.closed_date);

        if (!jrCands || jrCands.length === 0) {
            return { ...empty, totalOpenDays, ownerRoleConfigured };
        }

        const jrCandIds = jrCands.map(c => c.jr_candidate_id);
        const logChunks = await Promise.all(chunk(jrCandIds).map(ids =>
            supabase.from("status_log")
                .select("log_id, jr_candidate_id, status, timestamp")
                .in("jr_candidate_id", ids)
                .returns<{ log_id: number; jr_candidate_id: string; status: string; timestamp: string }[]>()
        ));
        const logs = logChunks.flatMap(r => r.data || []);

        const logsByCandidate = new Map<string, typeof logs>();
        logs.forEach(l => {
            if (!logsByCandidate.has(l.jr_candidate_id)) logsByCandidate.set(l.jr_candidate_id, []);
            logsByCandidate.get(l.jr_candidate_id)!.push(l);
        });

        const now = Date.now();
        /** Durations that finished — the only ones we can honestly call "how long it takes". */
        const completedByStatus = new Map<string, number[]>();
        const current: { status: string; agingDays: number; kind: StageKind }[] = [];

        jrCands.forEach(jc => {
            const cLogs = (logsByCandidate.get(jc.jr_candidate_id) || []).slice().sort((a, b) => {
                const ta = new Date(a.timestamp).getTime();
                const tb = new Date(b.timestamp).getTime();
                if (ta !== tb && !isNaN(ta) && !isNaN(tb)) return ta - tb;
                return a.log_id - b.log_id;
            });

            cLogs.forEach((log, i) => {
                if (i === cLogs.length - 1) return; // still in this status — not a finished duration
                const status = log.status || "Unknown";
                const start = new Date(log.timestamp).getTime();
                const end = new Date(cLogs[i + 1].timestamp).getTime();
                if (isNaN(start) || isNaN(end) || end < start) return;
                if (!completedByStatus.has(status)) completedByStatus.set(status, []);
                completedByStatus.get(status)!.push(daysBetween(start, end));
            });

            const last = cLogs[cLogs.length - 1];
            const status = last?.status || jc.temp_status || "Pool Candidate";
            const startedMs = last ? new Date(last.timestamp).getTime() : NaN;
            current.push({
                status,
                agingDays: isNaN(startedMs) ? 0 : daysBetween(startedMs, now),
                kind: stageKind(status),
            });
        });

        const buildStage = (m: any): StageAgingStage => {
            const status = m.status as string;
            const kind = stageKind(status);
            const here = current.filter(c => c.status === status);
            const waiting = kind === "exit" ? [] : here;
            const longestWaitDays = waiting.reduce((max, c) => Math.max(max, c.agingDays), 0);
            const completed = completedByStatus.get(status) || [];
            return {
                status,
                stageOrder: m.stage_order ?? 999,
                kind,
                ownerRole: m.owner_role || null,
                currentCount: here.length,
                longestWaitDays,
                overdueCount: waiting.filter(c => c.agingDays >= STAGE_THRESHOLDS.delayed).length,
                medianCompletedDays: median(completed),
                completedCount: completed.length,
                everVisited: here.length > 0 || completed.length > 0,
                // A holding stage is where names wait to be worked, not where work is stuck.
                severity: kind === "work" && waiting.length > 0 ? severityForDays(longestWaitDays) : "ok",
            };
        };

        const mainPath = masterRows.filter(m => stageKind(m.status) !== "exit").map(buildStage);
        const exits = masterRows.filter(m => stageKind(m.status) === "exit").map(buildStage);

        const activeCandidates = current.filter(c => c.kind !== "exit").length;
        const exitedCandidates = current.length - activeCandidates;
        const overdueCount = current.filter(c => c.kind === "work" && c.agingDays >= STAGE_THRESHOLDS.delayed).length;

        const reached = mainPath.filter(s => s.currentCount > 0);
        const deepest = reached.length > 0 ? reached[reached.length - 1] : null;
        const furthest = deepest
            ? {
                status: deepest.status,
                position: mainPath.findIndex(s => s.status === deepest.status) + 1,
                total: mainPath.length,
            }
            : null;

        const worstStage = mainPath
            .filter(s => s.kind === "work" && s.currentCount > 0)
            .sort((a, b) => b.longestWaitDays - a.longestWaitDays)[0];
        const worst = worstStage
            ? { status: worstStage.status, count: worstStage.currentCount, days: worstStage.longestWaitDays }
            : null;

        // Deepest first: pushing more people into a stage whose exit is blocked doesn't close a JR.
        const actions: StageAction[] = mainPath
            .filter(s => s.kind === "work" && s.currentCount > 0 && s.longestWaitDays >= STAGE_THRESHOLDS.attention)
            .sort((a, b) => b.stageOrder - a.stageOrder)
            .map(s => ({ status: s.status, kind: s.kind, count: s.currentCount, days: s.longestWaitDays, ownerRole: s.ownerRole }));

        mainPath
            .filter(s => s.kind === "holding" && s.currentCount > 0)
            .forEach(s => actions.push({
                status: s.status, kind: s.kind, count: s.currentCount, days: s.longestWaitDays, ownerRole: s.ownerRole,
            }));

        const ownerTotals = new Map<string, { days: number; candidates: number }>();
        current.filter(c => c.kind === "work").forEach(c => {
            const key = ownerOf.get(c.status) || "Unassigned";
            const cur = ownerTotals.get(key) || { days: 0, candidates: 0 };
            cur.days += c.agingDays;
            cur.candidates += 1;
            ownerTotals.set(key, cur);
        });

        return {
            totalOpenDays,
            activeCandidates,
            exitedCandidates,
            overdueCount,
            furthest,
            worst,
            mainPath,
            exits,
            actions,
            ownerDays: Array.from(ownerTotals.entries())
                .map(([ownerRole, v]) => ({ ownerRole, ...v }))
                .sort((a, b) => b.days - a.days),
            ownerRoleConfigured,
        };
    } catch (e) {
        console.error("Error in getJRStageAging:", e);
        return empty;
    }
}
