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
