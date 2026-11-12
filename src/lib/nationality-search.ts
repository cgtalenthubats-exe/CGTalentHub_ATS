// Shared search behaviour for Nationality pickers/filters.
//
// Rule: names that START with the typed text come first, then names that merely CONTAIN it.
// Anything else is dropped (no fuzzy "t…h somewhere" matches), so typing "th" lists
// Thai/Thailand before e.g. "South Africa" — and never matches Netherlands via loose letters.

/** Score used for ranking: 2 = prefix, 1 = contains, 0 = no match. */
export function nationalityMatchScore(value: string, search: string): number {
    const q = search.trim().toLowerCase();
    if (!q) return 1;
    const v = value.toLowerCase();
    if (v.startsWith(q)) return 2;
    if (v.includes(q)) return 1;
    return 0;
}

/** Filter + order a plain string list (for the checkbox-style multi-select filters). */
export function rankNationalities(options: string[], search: string): string[] {
    if (!search.trim()) return options;
    return options
        .map((o, i) => ({ o, i, s: nationalityMatchScore(o, search) }))
        .filter(x => x.s > 0)
        .sort((a, b) => b.s - a.s || a.i - b.i) // keep original (alphabetical) order within a tier
        .map(x => x.o);
}

/** `filter` prop for cmdk's <Command>. cmdk sorts by the returned score, highest first. */
export const nationalityCmdkFilter = (value: string, search: string): number =>
    nationalityMatchScore(value, search);
