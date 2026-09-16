/**
 * Shared constants for the JR stage-aging view. Kept out of the server action file because a
 * "use server" module may only export async functions.
 */

export type StageSeverity = "ok" | "attention" | "delayed" | "critical";

/** Days a candidate may sit in one stage before the UI starts flagging it. */
export const STAGE_THRESHOLDS = { attention: 7, delayed: 14, critical: 21 } as const;

/**
 * End states: a candidate isn't waiting for anything here, so days spent in them are not a
 * bottleneck. Mirrors TERMINAL_STATUSES in candidate-activity-log.tsx.
 */
export const TERMINAL_STATUSES = new Set([
    "Successful Placement",
    "Rejected",
    "Not fit",
    "Not Open",
    "Not Pass Interview",
    "Candidate Withdraw",
    "Offer Declined",
]);

/** Roles a status can be waiting on, offered in Settings → Status Master. */
export const STATUS_OWNER_ROLES = ["TA", "Hiring Team", "Candidate"] as const;

/**
 * Statuses that are a waiting room rather than work in progress. A name sitting in the longlist
 * for weeks is normal — counting it as the bottleneck buries the stages where someone actually
 * owes an action, which is what the first version of this view did.
 */
export const HOLDING_STATUSES = new Set(["Pool Candidate"]);

/**
 * Statuses kept out of the stage flow and the activity charts. These duplicate the "Interview
 * Completed" steps in practice and only add empty cards.
 */
export const HIDDEN_STATUSES = new Set([
    "Interview Scheduled - Hiring Manager",
    "Interview Scheduled - Recruiter",
]);

export type StageKind = "holding" | "work" | "exit";

export function stageKind(status: string): StageKind {
    if (TERMINAL_STATUSES.has(status)) return "exit";
    if (HOLDING_STATUSES.has(status)) return "holding";
    return "work";
}

/** Middle value of a set of durations — robust to the split between same-day and stuck-for-weeks. */
export function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
        : sorted[mid];
}

export function severityForDays(days: number): StageSeverity {
    if (days >= STAGE_THRESHOLDS.critical) return "critical";
    if (days >= STAGE_THRESHOLDS.delayed) return "delayed";
    if (days >= STAGE_THRESHOLDS.attention) return "attention";
    return "ok";
}

export const SEVERITY_LABEL: Record<StageSeverity, string> = {
    ok: "On Track",
    attention: "Attention",
    delayed: "Delayed",
    critical: "Critical",
};
