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
};

/**
 * Sort order: current job first, then most recent start_date first.
 * Mirrors the double-sort logic used by the legacy Long List n8n workflow
 * (Master Code3) so "latest experience" stays consistent across every
 * report that derives position/company/country from candidate_experiences.
 */
export function sortExperiences<T extends ExperienceRow>(exps: T[]): T[] {
    const sortValue = (dateStr: string | null) => {
        const d = parseAnyDate(dateStr);
        return d ? d.getFullYear() * 100 + (d.getMonth() + 1) : 0;
    };
    return [...exps].sort((a, b) => {
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

/** Strips "(YYYY - YYYY)" date ranges and takes the first "---"-delimited entry from education_summary. */
export function formatEducationHeadline(educationSummary: string | null | undefined): string {
    if (!educationSummary) return "";
    const first = educationSummary.split("---")[0] ?? "";
    return first
        .replace(/\s*\(\s*\d{0,4}\s*-?\s*\d{0,4}\s*\)/g, "")
        .replace(/\n+/g, " — ")
        .trim();
}
