
/**
 * Utility for robust date handling and dynamic age calculation.
 * Handles inconsistent formats like M/D/YYYY, YYYY-MM-DD, and full dates.
 */

/**
 * Parses a date string in various formats (M/D/YYYY, YYYY-MM-DD).
 */
export function parseAnyDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;

    // Handle ISO or YYYY-MM-DD
    if (dateStr.includes('-')) {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    }

    // Handle M/D/YYYY or D/M/YYYY
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            // Check if first part is month or day. Higher chance of M/D in legacy Excel data.
            // But let's try standard JS parsing first which often handles slash separated.
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) return d;

            // Manual fallback for specific M/D/YYYY parts
            const [m, dPart, y] = parts.map(p => parseInt(p));
            if (!isNaN(m) && !isNaN(dPart) && !isNaN(y)) {
                // Note: Month is 0-indexed in JS Date
                return new Date(y, m - 1, dPart);
            }
        }
    }

    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Safely extracts a year from a string that might be a year only or a full date.
 */
export function extractYear(val: string | number | null | undefined): number | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    if (typeof val !== 'string') return null;

    const trimmed = val.trim();
    if (!trimmed) return null;

    // Is it just a 4-digit year?
    if (/^\d{4}$/.test(trimmed)) {
        return parseInt(trimmed);
    }

    // Try to parse as date and get year
    const d = parseAnyDate(trimmed);
    if (d) return d.getFullYear();

    // Last resort: find any 4-digit number
    const match = trimmed.match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0]) : null;
}

/**
 * Calculates current age accurately based on DOB and Fallback Year.
 * Logic: Priority DOB > Bachelor Year (+22)
 */
export function getEffectiveAge(dob: string | null | undefined, gradValue: string | number | null | undefined): string {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();

    // 1. Try DOB (Accurate calculation)
    const birthDate = parseAnyDate(dob);
    if (birthDate) {
        let age = currentYear - birthDate.getFullYear();
        const m = currentMonth - birthDate.getMonth();
        if (m < 0 || (m === 0 && currentDate < birthDate.getDate())) {
            age--;
        }
        return age.toString();
    }

    // 2. Fallback to Bachelor Year
    const gradYear = extractYear(gradValue);
    if (gradYear) {
        // Standard formula: current_year - grad_year + 22
        const age = (currentYear - gradYear) + 22;
        return age.toString();
    }

    return "";
}

/**
 * Formats a date string or Date object for HTML5 date inputs (YYYY-MM-DD).
 */
export function formatDateForInput(date: string | Date | null | undefined): string {
    if (!date) return "";

    let d: Date | null = null;
    if (date instanceof Date) {
        d = date;
    } else {
        d = parseAnyDate(date);
    }

    if (!d || isNaN(d.getTime())) return "";

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Formats date for display (e.g. 25 Mar 1964).
 */
export function formatDateForDisplay(date: string | Date | null | undefined): string {
    const d = date instanceof Date ? date : parseAnyDate(date as string);
    if (!d || isNaN(d.getTime())) return "N/A";

    return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}
