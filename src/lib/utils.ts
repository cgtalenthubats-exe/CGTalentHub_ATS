import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Formats a number or string into a comma-separated string (e.g., 400000 -> 400,000)
 */
export function formatNumberWithCommas(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === "") return "";
    
    // Remove existing commas and non-numeric chars except dot
    const cleanValue = value.toString().replace(/,/g, "");
    const number = parseFloat(cleanValue);
    
    if (isNaN(number)) return value.toString();
    
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(number);
}

/**
 * Strips everything except digits and decimal point
 */
export function parseNumberFromCommas(value: string): string {
    return value.replace(/[^0-9.]/g, "");
}

/**
 * Initials for an avatar fallback, e.g. "Sumeth Preechawuttiwong" -> "SP", "Somchai" -> "SO"
 */
export function getInitials(name: string | null | undefined): string {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * JR aging in days: request_date -> closed_date (if the JR is closed) or now.
 * Once closed_date is set, aging is frozen at that point instead of continuing to grow.
 * Counted in calendar days, not elapsed 24h blocks: request_date is a bare date while "now" carries a
 * time of day, so elapsed time reads one day short during the hours the local date is ahead of UTC.
 */
export function getJRAgingDays(requestDate: string | null | undefined, closedDate?: string | null): number | null {
    if (!requestDate) return null;
    const start = new Date(requestDate).getTime();
    if (isNaN(start)) return null;

    const endCandidate = closedDate ? new Date(closedDate).getTime() : NaN;
    const end = closedDate && !isNaN(endCandidate) ? endCandidate : Date.now();

    const calendarDay = (ms: number) => {
        const d = new Date(ms);
        return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    };
    return Math.max(0, Math.round((calendarDay(end) - calendarDay(start)) / (1000 * 3600 * 24)));
}
