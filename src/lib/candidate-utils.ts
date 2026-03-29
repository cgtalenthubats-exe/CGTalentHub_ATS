/**
 * Logic for automatically classifying the 'checked' status based on a LinkedIn URL.
 * 
 * Rules:
 * 1. If LinkedIn URL contains "linkedin", status is "LinkedIN profile"
 * 2. If LinkedIn URL is not empty but doesn't contain "linkedin", status is "Individual link"
 * 3. If LinkedIn URL is empty (null/undefined/empty string), status is "No Profile"
 */
export function getCheckedStatus(linkedinUrl: string | null | undefined): string {
    if (!linkedinUrl || linkedinUrl.trim() === '') {
        return 'No Profile';
    }

    const url = linkedinUrl.toLowerCase();
    if (url.includes('linkedin')) {
        return 'LinkedIN profile';
    }

    return 'Individual link';
}

/**
 * Advanced normalization for Names:
 * 1. Trim
 * 2. Unicode NFD Normalization + Remove Non-Spacing Marks (Diacritics/Accents/Thai Tone Marks)
 * 3. Lowercase
 * 4. Standardize Whitespace
 */
export function normalizeName(name: string): string {
    if (!name) return "";
    return name
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, "") // Remove standard diacritics
        .replace(/[\u0E47-\u0E4E]/g, "") // Remove specific Thai marks (Mai Tai Khu, Mai Ek, Mai Tho, Mai Tri, Mai Chattawa) if NFD didn't catch them
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

/**
 * Normalization for Emails:
 * 1. Trim
 * 2. Lowercase
 */
export function normalizeEmail(email: string): string {
    if (!email) return "";
    return email.trim().toLowerCase();
}

/**
 * Normalization for LinkedIn URLs:
 * 1. Trim
 * 2. Remove Query Parameters
 * 3. Lowercase
 */
export function normalizeLinkedIn(url: string | null | undefined): string {
    if (!url) return "";
    try {
        const urlObj = new URL(url.trim());
        urlObj.search = ""; // Remove query params
        return urlObj.toString().toLowerCase();
    } catch (e) {
        return url.trim().toLowerCase();
    }
}
