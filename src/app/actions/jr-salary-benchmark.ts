"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import {
    buildSalaryHistogram,
    buildSalaryStats,
    percentileRank,
    statsByGroup,
    type SalaryStats,
} from "@/lib/salary-stats";

/**
 * Salary benchmark for a single JR — scoped to the candidates in that JR's pool.
 *
 * An earlier version widened the comparison to every candidate in the database whose current role
 * matched the JR's position keywords. That answers "what does this job pay in general", which is a
 * different question from the one this tab exists for: how does our budget compare with the people
 * we have actually shortlisted? It also produced figures for star ratings nobody in the JR held,
 * which read as if they came from the pool. The whole-database view belongs in a dashboard with
 * its own filters, not here.
 *
 * All figures are MONTHLY BASIC salary in THB — the unit stored in
 * `Candidate Profile.gross_salary_base_b_mth`. Bonus is a number of months (`bonus_mth`) and is
 * reported beside it, never folded in.
 */

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
}

export type SegmentStats = SalaryStats & { key: string };

export type { SalaryStats };

export interface JRSalaryBenchmark {
    jrId: string;
    positionTitle: string;
    budget: { min: number | null; max: number | null; note: string | null } | null;
    /** Null when there is no budget, or nobody in the pool has a salary to compare it with. */
    budgetPercentile: number | null;
    budgetVsMedianPct: number | null;
    /** Stats across the JR's own candidates. Null when none of them has a salary on file. */
    pool: SalaryStats | null;
    histogram: { start: number; end: number; count: number }[];
    byHotelRating: SegmentStats[];
    byIndustry: SegmentStats[];
    byRegion: SegmentStats[];
    /** Everyone in the JR, including candidates with no salary — the table shows who is missing. */
    pipelineRows: SalaryRow[];
    dataQuality: {
        pipelineTotal: number;
        pipelineWithSalary: number;
        budgetColumnsMissing: boolean;
    };
}

const CHUNK_SIZE = 150;

function chunk<T>(arr: T[], size = CHUNK_SIZE): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function toNumber(value: unknown): number {
    if (typeof value === "number") return isFinite(value) ? value : 0;
    if (typeof value !== "string") return 0;
    const n = parseFloat(value.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : n;
}

/**
 * Segment breakdowns only appear once a group has enough people to mean something. With a pool of
 * twenty or thirty, a "median" built from one person would look like a benchmark and isn't one.
 */
const MIN_SEGMENT_SAMPLE = 3;

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
        const candidateIds = Array.from(jrCandidateIdByCandidate.keys());

        const emptyResult: JRSalaryBenchmark = {
            jrId, positionTitle, budget, budgetPercentile: null, budgetVsMedianPct: null,
            pool: null, histogram: [], byHotelRating: [], byIndustry: [], byRegion: [],
            pipelineRows: [],
            dataQuality: { pipelineTotal: candidateIds.length, pipelineWithSalary: 0, budgetColumnsMissing },
        };
        if (candidateIds.length === 0) return emptyResult;

        const [profileChunks, expChunks, countryRes] = await Promise.all([
            Promise.all(chunk(candidateIds).map(ids =>
                (supabase as any)
                    .from("Candidate Profile")
                    .select("candidate_id, name, photo, gross_salary_base_b_mth, bonus_mth")
                    .in("candidate_id", ids)
            )),
            Promise.all(chunk(candidateIds).map(ids =>
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

        const pipelineRows: SalaryRow[] = (profiles as any[]).map(p => {
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
            };
        });

        const withSalary = pipelineRows.filter(r => r.monthlyBase > 0);
        const values = withSalary.map(r => r.monthlyBase).sort((a, b) => a - b);
        const pool = buildSalaryStats(values);

        // A range budget is judged at its midpoint — that is the number the offer usually lands on.
        const budgetPoint = budget
            ? (budget.min && budget.max ? (budget.min + budget.max) / 2 : budget.min || budget.max)
            : null;
        const budgetPercentile = budgetPoint && pool ? percentileRank(values, budgetPoint) : null;
        const budgetVsMedianPct = budgetPoint && pool && pool.median > 0
            ? Math.round(((budgetPoint - pool.median) / pool.median) * 100)
            : null;

        return {
            jrId,
            positionTitle,
            budget,
            budgetPercentile,
            budgetVsMedianPct,
            pool,
            histogram: buildSalaryHistogram(values),
            byHotelRating: statsByGroup(withSalary, r => r.hotelRating, r => r.monthlyBase, MIN_SEGMENT_SAMPLE),
            byIndustry: statsByGroup(withSalary, r => r.industry, r => r.monthlyBase, MIN_SEGMENT_SAMPLE),
            byRegion: statsByGroup(withSalary, r => r.region, r => r.monthlyBase, MIN_SEGMENT_SAMPLE),
            pipelineRows: pipelineRows.sort((a, b) => b.monthlyBase - a.monthlyBase),
            dataQuality: {
                pipelineTotal: candidateIds.length,
                pipelineWithSalary: withSalary.length,
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
