import type { CandidateForReport, StatusColorMap } from "@/app/actions/export-jr-report";

// Shared (non-"use server") home for the Long List bucketing logic — a
// "use server" file can only export async functions, so these sync helpers
// live here instead, reused by both the PPTX export (export-jr-report.ts)
// and the Excel export (export-jr-excel.ts) so the row order never drifts
// between the two formats.

export const isTopProfileCandidate = (c: CandidateForReport) => (c.list_type ?? "").toLowerCase().includes("top");

export function bucketLongList(pool: CandidateForReport[], statusColors: StatusColorMap): CandidateForReport[] {
    // Mirrors n8n Prepare Slides1 bucket order:
    //   Top Profile (by rank) → Standard → Not-progressing → Rejected (always last)
    //
    // "Rejected" is explicitly separated to the tail (matches n8n: grayList then rejectedList).
    // "Successful Placement" is row_color_enabled but a positive outcome — keep in Standard.
    const top = pool.filter(isTopProfileCandidate).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    const rest = pool.filter(r => !isTopProfileCandidate(r));

    const isRejected  = (r: CandidateForReport) => r.latest_status === "Rejected";
    const isColored   = (r: CandidateForReport) =>
        (statusColors.get(r.latest_status ?? "")?.row_color_enabled ?? false)
        && !isRejected(r)
        && r.latest_status !== "Successful Placement";

    // Standard: active pipeline (row_color_enabled false) + Successful Placement
    const standard = rest.filter(r => !isColored(r) && !isRejected(r));
    // Not-progressing: colored negative statuses (Not fit, Not Open, Not Pass Interview, Hold, Too Senior…)
    //   sorted by stage_order so statuses appear in a consistent, recognisable order
    const notProgressing = rest
        .filter(isColored)
        .sort((a, b) =>
            (statusColors.get(a.latest_status ?? "")?.stage_order ?? 99) -
            (statusColors.get(b.latest_status ?? "")?.stage_order ?? 99));
    // Rejected always last
    const rejected = rest.filter(isRejected);

    return [...top, ...standard, ...notProgressing, ...rejected];
}
