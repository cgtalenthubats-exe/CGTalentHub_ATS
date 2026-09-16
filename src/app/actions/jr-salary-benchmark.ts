"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

/**
 * Salary benchmark for a single JR.
 *
 * There is no external survey feed (Mercer/Hays) in this system, so "market" here means our own
 * data: the monthly basic salary recorded on candidate profiles, for candidates whose current
 * role matches the JR's position. That is a narrower claim than a published survey, but it is
 * real hospitality data for this region and it is the data we actually act on.
 *
 * All figures are MONTHLY BASIC salary in THB — the unit stored in
 * `Candidate Profile.gross_salary_base_b_mth` and the unit recruiters quote. Bonus is stored
 * separately as a number of months (`bonus_mth`) and is reported alongside, never folded into
 * the basic figure.
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

export interface SalaryRow {
    candidateId: string;
    /** Needed to open the candidate sheet from the table, same as the list view does. */
    jrCandidateId: string | null;
    name: string;
    photo: string | null;
    monthlyBase: number;
    bonusMonths: number;
    company: string | null;
    position: string | null;
    hotelRating: string | null;
    industry: string | null;
    region: string | null;
    country: string | null;
    inPipeline: boolean;
}

export interface SegmentStats extends SalaryStats {
    key: string;
}

export interface JRSalaryBenchmark {
    jrId: string;
    positionTitle: string;
    budget: { min: number | null; max: number | null; note: string | null } | null;
    /** Null when there is no budget, or too little market data to place it. */
    budgetPercentile: number | null;
    budgetVsMedianPct: number | null;
    /** Keywords the cohort was matched on, so the user can see what "market" means here. */
    cohortKeywords: string[];
    market: SalaryStats | null;
    pipeline: SalaryStats | null;
    histogram: { start: number; end: number; count: number }[];
    byHotelRating: SegmentStats[];
    /** Fallback breakdown for roles outside hospitality, where a star rating means nothing. */
    byIndustry: SegmentStats[];
    byRegion: SegmentStats[];
    pipelineRows: SalaryRow[];
    dataQuality: {
        pipelineTotal: number;
        pipelineWithSalary: number;
        marketSampleSize: number;
        budgetColumnsMissing: boolean;
    };
}

const MARKET_CANDIDATE_CAP = 3000;
const CHUNK_SIZE = 150;

function chunk<T>(arr: T[], size = CHUNK_SIZE): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function toNumber(value: unknown): number {
    if (typeof value === "number") return isFinite(value) ? value : 0;
    if (typeof value !== "string") return 0;
    const cleaned = value.replace(/[^0-9.]/g, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

/** Linear-interpolated percentile, matching what spreadsheets return for the same series. */
function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    const pos = (sorted.length - 1) * p;
    const lower = Math.floor(pos);
    const upper = Math.ceil(pos);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}

function buildStats(values: number[]): SalaryStats | null {
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
function percentileRank(sorted: number[], value: number): number | null {
    if (sorted.length === 0) return null;
    let below = 0;
    for (const v of sorted) {
        if (v < value) below++;
        else break;
    }
    return Math.round((below / sorted.length) * 100);
}

/**
 * Buckets sized to the spread of the data rather than a fixed step, so the shape stays readable
 * whether the role pays 40k or 400k.
 */
function buildHistogram(values: number[]): { start: number; end: number; count: number }[] {
    const sorted = values.filter(v => v > 0).sort((a, b) => a - b);
    if (sorted.length < 4) return [];

    // Ignore the extreme tail when sizing buckets — one 900k outlier would otherwise flatten
    // everything else into the first column.
    const cap = percentile(sorted, 0.98);
    const min = sorted[0];
    const span = Math.max(cap - min, 1);
    const targetBuckets = Math.min(12, Math.max(6, Math.round(Math.sqrt(sorted.length))));
    const rawStep = span / targetBuckets;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const step = Math.max(Math.ceil(rawStep / magnitude) * magnitude, 1000);
    const start = Math.floor(min / step) * step;
    const end = Math.max(Math.ceil(cap / step) * step, start + step);

    const buckets: { start: number; end: number; count: number }[] = [];
    for (let s = start; s < end; s += step) buckets.push({ start: s, end: s + step, count: 0 });

    sorted.forEach(v => {
        // Everything above the cap lands in the final bucket instead of being dropped.
        const idx = Math.min(Math.floor((v - start) / step), buckets.length - 1);
        if (idx >= 0) buckets[idx].count++;
    });
    return buckets;
}

function statsBySegment(rows: SalaryRow[], key: (r: SalaryRow) => string | null, minSample = 3): SegmentStats[] {
    const groups = new Map<string, number[]>();
    rows.forEach(r => {
        const k = key(r);
        if (!k || r.monthlyBase <= 0) return;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(r.monthlyBase);
    });

    return Array.from(groups.entries())
        .map(([k, values]) => {
            const s = buildStats(values);
            return s ? { key: k, ...s } : null;
        })
        .filter((s): s is SegmentStats => s !== null && s.n >= minSample)
        .sort((a, b) => b.median - a.median);
}

/**
 * Turns the JR's free-text position into vocabulary keywords, so the cohort is defined by terms
 * the rest of the system already uses instead of a substring match on job titles.
 */
async function resolveCohortKeywords(positionTitle: string): Promise<string[]> {
    if (!positionTitle?.trim()) return [];
    const title = positionTitle.toLowerCase();

    const { data: vocab } = await (adminAuthClient as any)
        .from("position_keyword_vocab")
        .select("keyword, aliases");

    const matched = new Set<string>();
    ((vocab || []) as { keyword: string; aliases: string | null }[]).forEach(row => {
        if (!row.keyword) return;
        const terms = [row.keyword, ...(row.aliases || "").split(/[,;|]/)]
            .map(t => t.trim().toLowerCase())
            .filter(t => t.length >= 3);
        if (terms.some(t => title.includes(t))) matched.add(row.keyword);
    });

    return Array.from(matched);
}

export async function getJRSalaryBenchmark(jrId: string): Promise<JRSalaryBenchmark | null> {
    const supabase = adminAuthClient;

    try {
        // `select('*')` on purpose: the budget columns arrive in a migration, and this action has
        // to keep working (without a budget) on a database where it has not been applied yet.
        const { data: jrRow } = await (supabase as any)
            .from("job_requisitions")
            .select("*")
            .eq("jr_id", jrId)
            .maybeSingle();

        if (!jrRow) return null;

        const positionTitle: string = jrRow.position_jr || "";
        const budgetColumnsMissing = !("budget_min" in jrRow);
        const budgetMin = toNumber(jrRow.budget_min) || null;
        const budgetMax = toNumber(jrRow.budget_max) || null;
        const budget = budgetMin || budgetMax
            ? { min: budgetMin, max: budgetMax, note: jrRow.budget_note || null }
            : null;

        const cohortKeywords = await resolveCohortKeywords(positionTitle);

        // --- pipeline (candidates attached to this JR) ---
        const { data: jrCands } = await supabase
            .from("jr_candidates")
            .select("jr_candidate_id, candidate_id")
            .eq("jr_id", jrId);

        const jrCandidateIdByCandidate = new Map<string, string>();
        ((jrCands || []) as any[]).forEach(c => {
            if (c.candidate_id && !jrCandidateIdByCandidate.has(c.candidate_id)) {
                jrCandidateIdByCandidate.set(c.candidate_id, c.jr_candidate_id);
            }
        });
        const pipelineIds = Array.from(jrCandidateIdByCandidate.keys());

        // --- market cohort (same position keyword, current role) ---
        let marketIds: string[] = [];
        if (cohortKeywords.length > 0) {
            const { data: matchedExp } = await (supabase as any)
                .from("candidate_experiences")
                .select("candidate_id")
                .in("position_keyword", cohortKeywords)
                .eq("is_current_job", "Current")
                .limit(MARKET_CANDIDATE_CAP);
            marketIds = Array.from(
                new Set(((matchedExp || []) as any[]).map(r => r.candidate_id).filter(Boolean))
            ) as string[];
        }

        const allIds = Array.from(new Set([...pipelineIds, ...marketIds]));
        if (allIds.length === 0) {
            return {
                jrId, positionTitle, budget, budgetPercentile: null, budgetVsMedianPct: null,
                cohortKeywords, market: null, pipeline: null, histogram: [],
                byHotelRating: [], byIndustry: [], byRegion: [], pipelineRows: [],
                dataQuality: { pipelineTotal: 0, pipelineWithSalary: 0, marketSampleSize: 0, budgetColumnsMissing },
            };
        }

        const [profileChunks, expChunks, countryRes] = await Promise.all([
            Promise.all(chunk(allIds).map(ids =>
                (supabase as any)
                    .from("Candidate Profile")
                    .select("candidate_id, name, photo, gross_salary_base_b_mth, bonus_mth")
                    .in("candidate_id", ids)
            )),
            Promise.all(chunk(allIds).map(ids =>
                (supabase as any)
                    .from("candidate_experiences")
                    .select("candidate_id, company, company_id, position, is_current_job, start_date, country, company_industry")
                    .in("candidate_id", ids)
            )),
            (supabase as any).from("country").select("country, region"),
        ]);

        const profiles = profileChunks.flatMap((r: any) => r.data || []);
        const experiences = expChunks.flatMap((r: any) => r.data || []);
        const countryRegion = new Map<string, string>(
            (((countryRes as any).data || []) as any[]).map(r => [r.country, r.region])
        );

        // Current role per candidate: prefer the one flagged Current, else the most recent start.
        const currentExp = new Map<string, any>();
        (experiences as any[]).forEach(e => {
            const prev = currentExp.get(e.candidate_id);
            if (!prev) { currentExp.set(e.candidate_id, e); return; }
            const score = (x: any) => (x.is_current_job === "Current" ? 1 : 0);
            if (score(e) !== score(prev)) {
                if (score(e) > score(prev)) currentExp.set(e.candidate_id, e);
                return;
            }
            if (new Date(e.start_date).getTime() > new Date(prev.start_date).getTime()) {
                currentExp.set(e.candidate_id, e);
            }
        });

        const companyIds = Array.from(
            new Set(Array.from(currentExp.values()).map(e => e.company_id).filter(Boolean))
        ) as string[];
        const ratingByCompany = new Map<string, string | null>();
        const industryByCompany = new Map<string, string | null>();
        if (companyIds.length > 0) {
            const companyChunks = await Promise.all(chunk(companyIds).map(ids =>
                (supabase as any).from("company_master").select("company_id, rating, industry").in("company_id", ids)
            ));
            companyChunks.flatMap((r: any) => r.data || []).forEach((c: any) => {
                ratingByCompany.set(String(c.company_id), c.rating || null);
                industryByCompany.set(String(c.company_id), c.industry || null);
            });
        }

        const pipelineSet = new Set(pipelineIds);
        const rows: SalaryRow[] = (profiles as any[]).map(p => {
            const exp = currentExp.get(p.candidate_id);
            const country = exp?.country || null;
            return {
                candidateId: p.candidate_id,
                jrCandidateId: jrCandidateIdByCandidate.get(p.candidate_id) || null,
                name: p.name || "Unknown",
                photo: p.photo || null,
                monthlyBase: toNumber(p.gross_salary_base_b_mth),
                bonusMonths: toNumber(p.bonus_mth),
                company: exp?.company || null,
                position: exp?.position || null,
                hotelRating: exp?.company_id ? ratingByCompany.get(String(exp.company_id)) || null : null,
                industry: exp?.company_industry || (exp?.company_id ? industryByCompany.get(String(exp.company_id)) || null : null),
                region: country ? countryRegion.get(country) || null : null,
                country,
                inPipeline: pipelineSet.has(p.candidate_id),
            };
        });

        const marketRows = rows.filter(r => r.monthlyBase > 0);
        const marketValues = marketRows.map(r => r.monthlyBase).sort((a, b) => a - b);
        const market = buildStats(marketValues);

        const pipelineRows = rows.filter(r => r.inPipeline);
        const pipeline = buildStats(pipelineRows.map(r => r.monthlyBase));

        // A range budget is judged at its midpoint — that is the number the offer usually lands on.
        const budgetPoint = budget
            ? (budget.min && budget.max ? (budget.min + budget.max) / 2 : budget.min || budget.max)
            : null;
        const budgetPercentile = budgetPoint && market ? percentileRank(marketValues, budgetPoint) : null;
        const budgetVsMedianPct = budgetPoint && market && market.median > 0
            ? Math.round(((budgetPoint - market.median) / market.median) * 100)
            : null;

        return {
            jrId,
            positionTitle,
            budget,
            budgetPercentile,
            budgetVsMedianPct,
            cohortKeywords,
            market,
            pipeline,
            histogram: buildHistogram(marketValues),
            byHotelRating: statsBySegment(marketRows, r => r.hotelRating),
            byIndustry: statsBySegment(marketRows, r => r.industry),
            byRegion: statsBySegment(marketRows, r => r.region),
            pipelineRows: pipelineRows.sort((a, b) => b.monthlyBase - a.monthlyBase),
            dataQuality: {
                pipelineTotal: pipelineIds.length,
                pipelineWithSalary: pipelineRows.filter(r => r.monthlyBase > 0).length,
                marketSampleSize: marketValues.length,
                budgetColumnsMissing,
            },
        };
    } catch (e) {
        console.error("Error in getJRSalaryBenchmark:", e);
        return null;
    }
}

export async function updateJRBudget(
    jrId: string,
    budget: { min: number | null; max: number | null; note: string | null }
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await (adminAuthClient as any)
            .from("job_requisitions")
            .update({
                budget_min: budget.min,
                budget_max: budget.max,
                budget_note: budget.note,
            })
            .eq("jr_id", jrId);

        if (error) {
            // The most likely failure is the migration not having been applied yet — say so
            // rather than surfacing a raw PostgREST message.
            const missingColumn = /column .* does not exist|budget_min/i.test(error.message || "");
            return {
                success: false,
                error: missingColumn
                    ? "Budget columns are not in the database yet. Apply migration 20260916000000_add_jr_budget_and_stage_owner.sql first."
                    : error.message,
            };
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
