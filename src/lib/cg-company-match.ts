const STOPWORDS = new Set(['in', 'at', 'the', 'and', 'of', 'for', 'co', 'ltd', 'limited', 'public', 'company', 'group', 'corp', 'inc']);

function tokenize(s: string): string[] {
    return s.toLowerCase()
        .replace(/\(.*?\)/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !STOPWORDS.has(w));
}

// Word-overlap matching: strips parens + stopwords, counts shared words.
// "Central Retail Vietnam (incl. Tops...)" ↔ "Central Retail in Vietnam" → match
export function cgCompanyMatch(a: string, b: string): boolean {
    const wa = new Set(tokenize(a));
    const wb = new Set(tokenize(b));
    if (wa.size === 0 || wb.size === 0) return false;
    let overlap = 0;
    for (const w of wa) if (wb.has(w)) overlap++;
    const minLen = Math.min(wa.size, wb.size);
    return overlap >= Math.min(2, minLen) && overlap >= minLen * 0.6;
}
