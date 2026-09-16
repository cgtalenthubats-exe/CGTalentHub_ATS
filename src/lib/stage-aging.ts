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
