import type { JobGroupingOption } from "@/app/actions/job-function";

/**
 * Trial period: the UI works with Job Function only and hides Job Grouping (dropdown
 * dependency, filters, columns, charts). The data model is unchanged — Candidate Profile
 * still stores job_grouping, and it's auto-derived from the chosen function so the DB stays
 * complete. Flip to true to bring every Job Grouping UI back; nothing else needs to change.
 */
export const SHOW_JOB_GROUPING = false;

/** Every function across all groupings, flat and sorted (function names are unique in job_function_master). */
export function allFunctionOptions(options: JobGroupingOption[]): string[] {
    return options.flatMap(g => g.functions).sort((a, b) => a.localeCompare(b));
}

/** The grouping label a function belongs to, or "" if the function isn't in the master list. */
export function groupingForFunction(options: JobGroupingOption[], functionLabel: string): string {
    return options.find(g => g.functions.includes(functionLabel))?.label ?? "";
}
