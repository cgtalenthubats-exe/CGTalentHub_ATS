import { parseAnyDate } from "@/lib/date-utils";

export type ExperienceRow = {
    candidate_id: string;
    position: string | null;
    company: string | null;
    company_id: number | null;
    start_date: string | null;
    end_date: string | null;
    country: string | null;
    is_current_job: string | null;
    // Optional: only present when the caller's .select() fetched it. Undefined is treated
    // the same as "not primary" — see pickPrimaryExperience().
    is_primary_current?: boolean | null;
};

/**
 * Sort order: the is_primary_current pick first (if set), then current job, then most
 * recent start_date. Mirrors the double-sort logic used by the legacy Long List n8n workflow
 * (Master Code3) so "latest experience" stays consistent across every report that derives
 * position/company/country from candidate_experiences — the primary tier is layered on top
 * so wherever a candidate's experiences are listed, the one explicitly chosen as primary
 * always reads first regardless of its own start_date relative to other Concurrent roles.
 */
export function sortExperiences<T extends ExperienceRow>(exps: T[]): T[] {
    const sortValue = (dateStr: string | null) => {
        const d = parseAnyDate(dateStr);
        return d ? d.getFullYear() * 100 + (d.getMonth() + 1) : 0;
    };
    return [...exps].sort((a, b) => {
        const aPrimary = a.is_primary_current === true ? 0 : 1;
        const bPrimary = b.is_primary_current === true ? 0 : 1;
        if (aPrimary !== bPrimary) return aPrimary - bPrimary;

        const aCurrent = a.is_current_job === "Current" || a.end_date === "Present" ? 0 : 1;
        const bCurrent = b.is_current_job === "Current" || b.end_date === "Present" ? 0 : 1;
        if (aCurrent !== bCurrent) return aCurrent - bCurrent;
        return sortValue(b.start_date) - sortValue(a.start_date);
    });
}

/** Groups experiences by candidate_id, each group sorted latest-first. */
export function groupExperiencesByCandidate<T extends ExperienceRow>(exps: T[]): Map<string, T[]> {
    const byCandidate = new Map<string, T[]>();
    for (const e of exps) {
        if (!byCandidate.has(e.candidate_id)) byCandidate.set(e.candidate_id, []);
        byCandidate.get(e.candidate_id)!.push(e);
    }
    for (const [id, list] of byCandidate) byCandidate.set(id, sortExperiences(list));
    return byCandidate;
}

/**
 * Picks the ONE experience to show wherever a single value is needed (JR table cell,
 * profile header, PPTX current-position line, etc). Reads `is_primary_current` first —
 * the explicit, user-settable "this one" flag that's unique per candidate (DB-enforced).
 * Falls back to the old current-first + latest-start_date heuristic when it isn't set yet
 * (not backfilled, or the caller's .select() didn't fetch the column), so nothing regresses
 * before the migration's data is populated.
 *
 * A candidate can legitimately have multiple `is_current_job === 'Current'` rows at once
 * (genuinely concurrent jobs) — that fact stays untouched. This only resolves which ONE to
 * surface where the UI can't show a list.
 */
export function pickPrimaryExperience<T extends ExperienceRow>(exps: T[]): T | undefined {
    if (exps.length === 0) return undefined;
    const primary = exps.find(e => e.is_primary_current === true);
    if (primary) return primary;
    return sortExperiences(exps)[0];
}

const MONTHS: Record<string, string> = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
    "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

/** Formats a messy date string (M/YYYY, YYYY-MM, "Present", etc.) as "Mon YYYY". */
export function formatExperienceDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "";
    const raw = dateStr.toString().trim();
    if (!raw || raw.toLowerCase() === "present") return raw ? "Present" : "";
    const parsed = parseAnyDate(raw);
    if (parsed) return `${MONTHS[String(parsed.getMonth() + 1).padStart(2, "0")]} ${parsed.getFullYear()}`;
    // Fall back to raw MM/YYYY or MM-YYYY parsing (parseAnyDate already covers most, this is a last resort)
    const match = raw.match(/(\d{1,2})[-/](\d{4})/);
    if (match) return `${MONTHS[match[1].padStart(2, "0")] ?? match[1]} ${match[2]}`;
    return raw;
}

/** Formats up to `limit` most recent experiences as "Mon YYYY – Mon YYYY   Position at Company" lines. */
export function formatExperienceHistory<T extends ExperienceRow>(sortedExps: T[], limit = 3): string[] {
    return sortedExps.slice(0, limit).map(e => {
        const start = formatExperienceDate(e.start_date);
        const end = e.is_current_job === "Current" ? "Present" : formatExperienceDate(e.end_date) || "Present";
        const range = start ? `${start} – ${end}` : end;
        const role = [e.position, e.company].filter(Boolean).join(" at ");
        return [range, role].filter(Boolean).join("   ");
    });
}

/**
 * Splits each formatExperienceHistory() line back into its date-range and role
 * halves (they're joined with a 3-space separator there) and returns pptxgenjs
 * rich-text runs with the date range bolded — shared by every Short Profile
 * card slide across the pptx exports (JR report, AI assessment, placement
 * report, org chart) so the bolding stays consistent everywhere.
 */
export function experienceHistoryRuns(lines: string[]): { text: string; options: { bold?: boolean; breakLine?: boolean } }[] {
    const runs: { text: string; options: { bold?: boolean; breakLine?: boolean } }[] = [];
    lines.forEach((line, i) => {
        const isLast = i === lines.length - 1;
        const sepIdx = line.indexOf("   ");
        if (sepIdx === -1) {
            runs.push({ text: line, options: { bold: true, breakLine: !isLast } });
            return;
        }
        runs.push({ text: line.slice(0, sepIdx), options: { bold: true } });
        runs.push({ text: line.slice(sepIdx), options: { breakLine: !isLast } });
    });
    return runs;
}

/**
 * Formats education as "<Institution> — <Degree>" from the most recent entry
 * (the first "---"-delimited chunk). Source rows look like:
 *   "<Institution> (<start> - <end>)\n<Degree>, <Field of study>\nGrade: ...\n\n"
 * Only the first two lines are used — a trailing "Grade:"/"Activities and
 * societies:" line that some imports include is dropped — and only the
 * degree name, not the ", <Field of study>" half, which is usually redundant
 * with the degree and was the main reason this one-line headline ran long
 * enough on Short Profile cards to push the Experience section off the card.
 */
export function formatEducationHeadline(educationSummary: string | null | undefined): string {
    if (!educationSummary) return "";
    const first = educationSummary.split("---")[0] ?? "";
    const lines = first.split("\n").map(l => l.trim()).filter(Boolean);

    // Some rows have the literal string "null" baked in where a field was
    // missing at import time — strip it rather than surfacing it as data.
    const clean = (s: string) => s.replace(/\bnull\b/gi, "").replace(/\s{2,}/g, " ").trim();

    const institution = clean((lines[0] ?? "").replace(/\s*\(\s*\d{0,4}\s*-?\s*\d{0,4}\s*\)/g, ""));
    const degree = clean((lines[1] ?? "").split(",")[0] ?? "");

    return [institution, degree].filter(Boolean).join(" — ");
}
