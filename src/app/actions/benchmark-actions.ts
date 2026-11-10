"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { COMPENSATION_SELECT } from "@/lib/compensation";
import { parseAnyDate } from "@/lib/date-utils";

export interface BenchmarkCandidate {
    candidate_id: string;
    name: string;
    /**
     * Every compensation column plus benefit_provided — indexed rather than listed, so a new
     * benefit added to COMPENSATION_FIELDS flows through without editing this type.
     */
    [compensationColumn: string]: any;
    job_grouping: string | null;
    job_function: string | null;
    company: string | null;
    company_industry: string | null;
    company_group: string | null;
    position: string | null;
    rating: string | null;
    /** Parent hotel chain (e.g. "IHG Hotels & Resorts") of the current/primary company, when mapped. */
    hotel_chain: string | null;
    /** Where the person is: work country of the current/primary role when reliably known, else the country they live in. */
    country: string | null;
    /** Region of that country (country master). */
    region: string | null;
}

export interface RawBenchmarkData {
    candidates: BenchmarkCandidate[];
}

// Fetch ALL raw data once — all filtering done client-side
export async function getRawBenchmarkData(): Promise<RawBenchmarkData> {
    const supabase = adminAuthClient;

    const cpRes = await supabase
        .from('Candidate Profile')
        .select(`candidate_id, name, ${COMPENSATION_SELECT}, job_grouping, job_function`)
        .not('gross_salary_base_b_mth', 'is', null)
        .gt('gross_salary_base_b_mth', 0); // Correct way to filter numeric salary

    if (cpRes.error) {
        console.error('benchmark cp error:', cpRes.error);
        return { candidates: [] };
    }

    const candidatesWithSalary = cpRes.data || [];
    if (candidatesWithSalary.length === 0) return { candidates: [] };

    const candidateIds = candidatesWithSalary.map(c => c.candidate_id);

    // Fetch experiences ONLY for these candidates. Supabase caps a response at 1000 rows and this
    // pool has ~2.6k experience rows, so page through with a stable order — otherwise ~80 of the
    // ~430 salary candidates came back with no company / position / industry / rating at all
    // (and silently dropped out of every filter on those fields). Ordering by start_date is done
    // in JS below; start_date is text ("M-YYYY"), so a SQL sort on it was wrong anyway.
    const PAGE_SIZE = 1000;
    const expData: any[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data: page, error: expError } = await supabase
            .from('candidate_experiences')
            .select('id, candidate_id, company, company_id, position, company_industry, company_group, is_current_job, is_primary_current, start_date, country, note')
            .in('candidate_id', candidateIds)
            .order('id', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
        if (expError) {
            console.error('benchmark exp error:', expError);
            break;
        }
        if (!page || page.length === 0) break;
        expData.push(...page);
        if (page.length < PAGE_SIZE) break;
    }

    // company_master gives the properly-classified rating/industry/group — falls
    // back to the denormalized text on candidate_experiences when a company
    // isn't mapped (same precedence used by getMarketSalaryStats).
    const companyIds = [...new Set((expData || []).map((e: any) => e.company_id).filter((id: any) => id != null))];
    const companyLookup = new Map<number, { rating: string | null; industry: string | null; group: string | null; chain: string | null }>();
    if (companyIds.length > 0) {
        const { data: companies } = await supabase
            .from('company_master')
            .select('company_id, rating, industry, group, hotel_chain_id')
            .in('company_id', companyIds);

        // company_master.hotel_chain_id points at a sub-brand; resolve it to the parent chain's name.
        const { data: chainRows } = await supabase.from('hotel_chain_master').select('brand_id, brand_name, parent_id');
        const chainById = new Map<number, any>(((chainRows as any[]) || []).map(r => [r.brand_id, r]));
        const parentChainName = (brandId: number | null | undefined): string | null => {
            if (brandId == null) return null;
            const row = chainById.get(brandId);
            if (!row) return null;
            return (row.parent_id != null ? chainById.get(row.parent_id)?.brand_name : row.brand_name) ?? null;
        };

        (companies || []).forEach((c: any) => companyLookup.set(c.company_id, {
            rating: c.rating, industry: c.industry, group: c.group, chain: parentChainName(c.hotel_chain_id),
        }));
    }

    // Build experience map: prefer is_primary_current, else is_current_job='Current', else
    // take latest by start_date. Sorted globally (not grouped per candidate_id) — relies on
    // the comparator being consistent per-candidate so each candidate's best experience is
    // always the first of theirs encountered below; "first occurrence wins" per candidate_id
    // then picks it out cheaply without a separate group-by pass.
    const expMap = new Map<string, any>();
    const experiences = expData || [];

    // Location, same rule as the Funnel's "By Location": the work country of the best experience —
    // but only when it came from the candidate's own profile (note "profile input"); countries guessed
    // from the company's HQ are unreliable — otherwise the country they are based in.
    const { data: countryRows } = await (supabase as any).from('country').select('country, region');
    const regionByCountry = new Map<string, string>(((countryRows as any[]) || []).filter(r => r.country && r.region).map(r => [r.country, r.region]));
    // Hong Kong isn't in the country master; give it its region so it still groups with East Asia.
    const REGION_FALLBACK: Record<string, string> = { 'Hong Kong': 'East Asia' };
    const isKnownCountry = (c: string) => regionByCountry.has(c) || c in REGION_FALLBACK;

    const SKIP_COUNTRY = new Set(['unknown', 'n/a', 'not found', 'no match found', 'undetermined', 'unclassified', 'wait ai check', 'unassigned', 'not found exp', 'null', '']);
    // Profile addresses are sometimes stored whole ("Pattaya, Thailand", "Hong Kong SAR"): reduce them to a
    // country we know, and drop anything that still isn't one ("Multi Location") rather than offer junk options.
    const usableCountry = (c: any): string | null => {
        const v = (c ?? '').toString().trim();
        if (!v || SKIP_COUNTRY.has(v.toLowerCase())) return null;
        const candidates = [v, v.replace(/\s+SAR$/i, ''), v.split(',').pop()!.trim().replace(/\s+SAR$/i, '')];
        return candidates.find(isKnownCountry) ?? null;
    };
    const basedInByCandidate = new Map<string, string>();
    for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data: page } = await supabase
            .from('candidate_profile_enhance')
            .select('candidate_id, country')
            .in('candidate_id', candidateIds)
            .order('candidate_id', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
        if (!page || page.length === 0) break;
        (page as any[]).forEach(r => { const c = usableCountry(r.country); if (c) basedInByCandidate.set(r.candidate_id, c); });
        if (page.length < PAGE_SIZE) break;
    }

    // Sort all experiences: primary first, then Current, then start_date desc
    experiences.sort((a: any, b: any) => {
        const aIsPrimary = a.is_primary_current === true;
        const bIsPrimary = b.is_primary_current === true;
        if (aIsPrimary && !bIsPrimary) return -1;
        if (!aIsPrimary && bIsPrimary) return 1;

        const aIsCurrent = (a.is_current_job || '').toString().trim().toLowerCase() === 'current';
        const bIsCurrent = (b.is_current_job || '').toString().trim().toLowerCase() === 'current';
        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;

        // start_date is text ("M-YYYY" mostly); parseAnyDate understands every format in the data.
        const dateA = parseAnyDate(a.start_date)?.getTime() ?? 0;
        const dateB = parseAnyDate(b.start_date)?.getTime() ?? 0;
        return dateB - dateA;
    });

    experiences.forEach((exp: any) => {
        if (!expMap.has(exp.candidate_id)) {
            const master = exp.company_id != null ? companyLookup.get(exp.company_id) : null;
            expMap.set(exp.candidate_id, {
                company: exp.company || '',
                position: exp.position || '',
                company_industry: master?.industry || exp.company_industry || '',
                company_group: master?.group || exp.company_group || '',
                rating: master?.rating || null,
                hotel_chain: master?.chain || null,
                work_country: /profile input/i.test(exp.note || '') ? usableCountry(exp.country) : null,
            });
        }
    });

    const candidates: BenchmarkCandidate[] = candidatesWithSalary.map((cp: any) => {
        const job = expMap.get(cp.candidate_id) || { company: null, position: null, company_industry: null, company_group: null, rating: null, hotel_chain: null, work_country: null };
        const country = job.work_country || basedInByCandidate.get(cp.candidate_id) || null;
        return {
            ...cp,
            company: job.company || null,
            position: job.position || null,
            company_industry: job.company_industry || null,
            company_group: job.company_group || null,
            rating: job.rating || null,
            hotel_chain: job.hotel_chain || null,
            country,
            region: country ? (regionByCountry.get(country) ?? REGION_FALLBACK[country] ?? null) : null,
        };
    });

    return { candidates };
}
