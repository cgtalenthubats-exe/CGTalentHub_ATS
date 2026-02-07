

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Normalization Helpers ---

export function normalizeName(name: string): string {
    if (!name) return "";
    // 1. Trim
    // 2. Remove accents/diacritics (NFD -> Remove non-spacing marks)
    // 3. Lowercase
    // 4. Replace multiple spaces with single space
    return name
        .trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

export function normalizeLinkedIn(url: string): string {
    if (!url) return "";
    try {
        // Remove query params by parsing URL
        const urlObj = new URL(url.trim());
        urlObj.search = "";
        return urlObj.toString().toLowerCase(); // Ensure lowercase
    } catch (e) {
        // If not a valid URL, just trim and lower
        return url.trim().toLowerCase();
    }
}

// --- Duplicate Check Logic ---

export interface DuplicateCheckResult {
    isDuplicate: boolean;
    candidateId: string | null;
    reason?: string; // 'name' or 'linkedin'
}

export async function checkDuplicateCandidate(name: string, linkedin: string): Promise<DuplicateCheckResult> {
    const normName = normalizeName(name);
    const normLinkedIn = normalizeLinkedIn(linkedin);

    if (!normName && !normLinkedIn) {
        return { isDuplicate: false, candidateId: null };
    }

    // specific query to find potential matches
    // We fetch a batch of candidates to check in memory or use OR logic.
    // For performance on large DBs, specific indexes/columns for normalized values are better,
    // but for now we'll select relevant fields and check in JS or use ILIKE if possible.
    // Using Supabase/Postgrest 'or' syntax is efficient enough for medium datasets.

    // Note: To be strict, we really should have normalized columns in DB. 
    // But since we can't change DB structure too much right now, we will fetch candidates that "might" match
    // ideally we would fetch ALL id, name, linkedin and check in memory if list is small (<10k),
    // or use a smart search.
    // Let's try to match exactly on refined queries.

    // However, since `name` matching usually requires fuzzy logic or exact normalized match, 
    // and we don't have normalized columns, we might need to iterate.
    // Given the previous `csv-actions.ts` did: `existingCandidates.find(...)` on ALL candidates,
    // we should probably follow that pattern if dataset isn't huge, OR optimize.
    // Let's optimize slightly: fetch rows where name ILIKE name OR linkedin ILIKE linkedin
    // This is not perfect for 'Accent Removal' check on DB side without correct collation, 
    // so we might still miss some if we rely ONLY on SQL.
    // BUT user asked for Accent Removal logic which is JS based.

    // Safer approach for now (Developer note): Fetch candidates and check in JS 
    // IF the count is reasonable. If not, we rely on SQL.
    // Let's stick to the pattern in `csv-actions` which seemed to fetch specific fields.
    // Actually `csv-actions` fetched ALL. We will verify how many rows there are.
    // For now, let's trust the user's scale isn't millions yet.

    const { data: candidates, error } = await supabase
        .from('Candidate Profile')
        .select('candidate_id, name, linkedin');

    if (error || !candidates) {
        console.error("Duplicate Check Error:", error);
        return { isDuplicate: false, candidateId: null };
    }

    const found = candidates.find(c => {
        const dbName = normalizeName(c.name || "");
        const dbLinkedIn = normalizeLinkedIn(c.linkedin || "");

        // Check Name
        if (normName && dbName === normName) return true;

        // Check LinkedIn (Only if input has linkedin and it looks valid)
        if (normLinkedIn && normLinkedIn.includes("linkedin.com") && dbLinkedIn === normLinkedIn) return true;

        return false;
    });

    if (found) {
        return {
            isDuplicate: true,
            candidateId: found.candidate_id,
            reason: normalizeName(found.name || "") === normName ? 'name' : 'linkedin'
        };
    }

    return { isDuplicate: false, candidateId: null };
}
