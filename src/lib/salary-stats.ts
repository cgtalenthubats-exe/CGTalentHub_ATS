/**
 * Salary distribution maths, shared by the JR benchmark and the dashboard benchmark.
 *
 * Median and percentiles rather than a mean throughout: salary data here is routinely bimodal
 * (a cluster of juniors and a long tail of GMs), and a mean lands between the two describing
 * nobody.
 */

export interface SalaryStats {
    n: number;
    min: number;
    p25: number;
    median: number;
    p75: number;
    max: number;
    mean: number;
}

/** Linear-interpolated percentile, matching what spreadsheets return for the same series. */
export function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    const pos = (sorted.length - 1) * p;
    const lower = Math.floor(pos);
    const upper = Math.ceil(pos);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}

export function buildSalaryStats(values: number[]): SalaryStats | null {
    const sorted = values.filter(v => v > 0).sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    return {
        n: sorted.length,
        min: sorted[0],
        p25: Math.round(percentile(sorted, 0.25)),
        median: Math.round(percentile(sorted, 0.5)),
        p75: Math.round(percentile(sorted, 0.75)),
        max: sorted[sorted.length - 1],
        mean: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
    };
}

/** Where `value` sits in `sorted`, 0-100. */
export function percentileRank(sorted: number[], value: number): number | null {
    if (sorted.length === 0) return null;
    let below = 0;
    for (const v of sorted) {
        if (v < value) below++;
        else break;
    }
    return Math.round((below / sorted.length) * 100);
}

/**
 * Buckets sized to the spread of the data rather than a fixed step, so the shape reads whether
 * the role pays 40k or 400k. The top 2% is left out of the sizing — one outlier would otherwise
 * squash everything else into the first column — and lands in the final bucket instead.
 */
export function buildSalaryHistogram(values: number[]): { start: number; end: number; count: number }[] {
    const sorted = values.filter(v => v > 0).sort((a, b) => a - b);
    if (sorted.length < 4) return [];

    const cap = percentile(sorted, 0.98);
    const min = sorted[0];
    const span = Math.max(cap - min, 1);
    const targetBuckets = Math.min(12, Math.max(5, Math.round(Math.sqrt(sorted.length))));
    const rawStep = span / targetBuckets;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const step = Math.max(Math.ceil(rawStep / magnitude) * magnitude, 1000);
    const start = Math.floor(min / step) * step;
    const end = Math.max(Math.ceil(cap / step) * step, start + step);

    const buckets: { start: number; end: number; count: number }[] = [];
    for (let s = start; s < end; s += step) buckets.push({ start: s, end: s + step, count: 0 });

    sorted.forEach(v => {
        const idx = Math.min(Math.floor((v - start) / step), buckets.length - 1);
        if (idx >= 0) buckets[idx].count++;
    });
    return buckets;
}

/**
 * Median salary per group. A group needs `minSample` people before it gets a row — a "median"
 * built from one person reads like a benchmark and isn't one.
 */
export function statsByGroup<T>(
    rows: T[],
    key: (row: T) => string | null | undefined,
    amount: (row: T) => number,
    minSample = 3
): (SalaryStats & { key: string })[] {
    const groups = new Map<string, number[]>();
    rows.forEach(r => {
        const k = key(r);
        const v = amount(r);
        if (!k || !(v > 0)) return;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(v);
    });

    return Array.from(groups.entries())
        .map(([k, values]) => {
            const s = buildSalaryStats(values);
            return s ? { key: k, ...s } : null;
        })
        .filter((s): s is SalaryStats & { key: string } => s !== null && s.n >= minSample)
        .sort((a, b) => b.median - a.median);
}
