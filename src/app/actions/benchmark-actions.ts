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
}

export interface RawBenchmarkData {
    candidates: BenchmarkCandidate[];
}

// Fetch ALL raw data once — all filtering done client-side
export async function getRawBenchmarkData(): Promise<RawBenchmarkData> {
    const supabase = adminAuthClient;

    const [cpRes, expRes] = await Promise.all([
        supabase
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
            .neq('gross_salary_base_b_mth', ''),
        supabase
            .from('candidate_experiences')
            .select('candidate_id, company, company_industry, company_group')
            .eq('is_current_job', 'Current'),
    ]);

    if (cpRes.error) console.error('benchmark cp error:', cpRes.error);
    if (expRes.error) console.error('benchmark exp error:', expRes.error);

    // Build lookup: candidate_id → current job
    const currentJobMap: Record<string, { company: string; company_industry: string; company_group: string }> = {};
    (expRes.data || []).forEach((exp: any) => {
        if (!currentJobMap[exp.candidate_id]) {
            currentJobMap[exp.candidate_id] = {
                company: exp.company || '',
                company_industry: exp.company_industry || '',
                company_group: exp.company_group || '',
            };
        }
    });

    const candidates: BenchmarkCandidate[] = (cpRes.data || []).map((cp: any) => {
        const job = currentJobMap[cp.candidate_id] || { company: null, company_industry: null, company_group: null };
        return {
            ...cp,
            company: job.company || null,
            company_industry: job.company_industry || null,
            company_group: job.company_group || null,
        };
    });

    return { candidates };
}
