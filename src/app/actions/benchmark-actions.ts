"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export interface BenchmarkCandidate {
    candidate_id: string;
    name: string;
    gross_salary_base_b_mth: string | null;
    other_income: string | null;
    bonus_mth: string | null;
    car_allowance_b_mth: string | null;
    gasoline_b_mth: string | null;
    phone_b_mth: string | null;
    provident_fund_pct: string | null;
    medical_b_annual: string | null;
    medical_b_mth: string | null;
    insurance: string | null;
    housing_for_expat_b_mth: string | null;
    others_benefit: string | null;
    job_grouping: string | null;
    job_function: string | null;
    company: string | null;
    company_industry: string | null;
    company_group: string | null;
    position: string | null;
}

export interface RawBenchmarkData {
    candidates: BenchmarkCandidate[];
}

// Fetch ALL raw data once — all filtering done client-side
export async function getRawBenchmarkData(): Promise<RawBenchmarkData> {
    const supabase = adminAuthClient;

    const cpRes = await supabase
        .from('Candidate Profile')
        .select(`
                candidate_id, name,
                gross_salary_base_b_mth, other_income, bonus_mth,
                car_allowance_b_mth, gasoline_b_mth, phone_b_mth,
                provident_fund_pct, medical_b_annual, medical_b_mth,
                insurance, housing_for_expat_b_mth, others_benefit,
                job_grouping, job_function
            `)
        .not('gross_salary_base_b_mth', 'is', null)
        .gt('gross_salary_base_b_mth', 0); // Correct way to filter numeric salary

    if (cpRes.error) {
        console.error('benchmark cp error:', cpRes.error);
        return { candidates: [] };
    }

    const candidatesWithSalary = cpRes.data || [];
    if (candidatesWithSalary.length === 0) return { candidates: [] };

    const candidateIds = candidatesWithSalary.map(c => c.candidate_id);

    // Fetch experiences ONLY for these candidates
    const { data: expData, error: expError } = await supabase
        .from('candidate_experiences')
        .select('candidate_id, company, position, company_industry, company_group, is_current_job, start_date')
        .in('candidate_id', candidateIds)
        .order('start_date', { ascending: false }); // Better to sort in SQL

    if (expError) console.error('benchmark exp error:', expError);

    // Build experience map: prefer is_current_job='Current', else take latest by start_date
    const expMap = new Map<string, any>();
    const experiences = expData || [];

    // Sort all experiences: Current first, then start_date desc
    experiences.sort((a: any, b: any) => {
        const aIsCurrent = (a.is_current_job || '').toString().trim().toLowerCase() === 'current';
        const bIsCurrent = (b.is_current_job || '').toString().trim().toLowerCase() === 'current';
        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;

        // Try to parse dates robustly
        const parseDate = (d: any) => {
            if (!d) return 0;
            const parts = d.toString().split('/');
            if (parts.length === 3) {
                // Assume M/D/YYYY from DB screenshot
                const [m, day, y] = parts.map((p: string) => parseInt(p));
                return new Date(y, m - 1, day).getTime();
            }
            const date = new Date(d).getTime();
            return isNaN(date) ? 0 : date;
        };

        const dateA = parseDate(a.start_date);
        const dateB = parseDate(b.start_date);
        return dateB - dateA;
    });

    experiences.forEach((exp: any) => {
        if (!expMap.has(exp.candidate_id)) {
            expMap.set(exp.candidate_id, {
                company: exp.company || '',
                position: exp.position || '',
                company_industry: exp.company_industry || '',
                company_group: exp.company_group || '',
            });
        }
    });

    const candidates: BenchmarkCandidate[] = candidatesWithSalary.map((cp: any) => {
        const job = expMap.get(cp.candidate_id) || { company: null, position: null, company_industry: null, company_group: null };
        return {
            ...cp,
            company: job.company || null,
            position: job.position || null,
            company_industry: job.company_industry || null,
            company_group: job.company_group || null,
        };
    });

    return { candidates };
}
