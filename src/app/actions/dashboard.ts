"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export interface GlobalPoolStat {
    country: string;
    continent: string;
    count: number;
    lat?: number;
    long?: number;
    companies?: number;
}

export interface CompanySalaryStat {
    company: string;
    minSalary: number;
    avgSalary: number;
    maxSalary: number;
    headcount: number;
    industry: string;
    group: string;
}

// Logic: Current > Past (Latest by start_date)
function getPrimaryJob(experiences: any[]): any | null {
    if (!experiences || experiences.length === 0) return null;

    // 1. Try to find 'Current' (is_current_job = 'Current')
    const currents = experiences.filter(e => e.is_current_job === 'Current');
    if (currents.length > 0) {
        // Sort by start_date desc
        return currents.sort((a, b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime())[0];
    }

    // 2. If no Current, take 'Past' (Latest by end_date or start_date)
    return experiences.sort((a, b) => new Date(b.end_date || b.start_date || 0).getTime() - new Date(a.end_date || a.start_date || 0).getTime())[0];
}

async function getCandidatesWithPrimaryJobs(client: any) {
    // FETCH ALL with Pagination (Bypassing 1000 limit)
    let allExps: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    // Safety limit: 30 pages (30k rows) just in case
    while (hasMore && page < 50) {
        const { data, error } = await client
            .from("candidate_experiences")
            .select("candidate_id, country, company, is_current_job, start_date, end_date, company_industry, company_group, position")
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error("Fetch Error:", error);
            break;
        }

        if (data && data.length > 0) {
            allExps = allExps.concat(data);
            page++;
            if (data.length < pageSize) hasMore = false;
        } else {
            hasMore = false;
        }
    }

    // Group by Candidate ID
    const grouped: Record<string, any[]> = {};
    allExps.forEach((exp: any) => {
        if (!grouped[exp.candidate_id]) grouped[exp.candidate_id] = [];
        grouped[exp.candidate_id].push(exp);
    });

    // Select Primary Job for each Candidate
    const primaryJobs: any[] = [];
    Object.values(grouped).forEach(exps => {
        const primary = getPrimaryJob(exps);
        if (primary && primary.company) {
            primaryJobs.push(primary);
        }
    });

    return primaryJobs;
}

export async function getGlobalPoolDisplay() {
    const client = adminAuthClient as any;

    // 1. Get Deduplicated Primary Jobs (Full Fetch)
    const currentJobs = await getCandidatesWithPrimaryJobs(client);

    // 2. Aggregate
    const countryAgg: Record<string, { count: Set<string>, companies: Set<string> }> = {};
    const regionAgg: Record<string, Record<string, number>> = {
        "Asia": {},
        "Europe": {},
        "South and North America": {},
        "Africa": {},
        "Oceania": {},
        "Other": {}
    };

    // Helper to normalize country map
    const { data: countryMaster } = await client.from("country").select("country, continent");
    const countryToContinent: Record<string, string> = {};
    if (countryMaster) {
        countryMaster.forEach((c: any) => countryToContinent[c.country] = c.continent);
    }

    const mapContinentToGroup = (rawContinent: string | null): string => {
        if (!rawContinent) return "Other";
        const c = rawContinent.trim();
        if (c === "Asia" || c === "Europe/Asia" || c === "Asia/Europe") return "Asia";
        if (c === "Europe") return "Europe";
        if (c === "Africa") return "Africa";
        if (c.includes("America") || c.includes("Americas")) return "America";
        if (c === "Oceania") return "Oceania";
        return "Other";
    };

    const uniqueCompanies = new Set<string>();

    // For Filters
    const industries = new Set<string>();
    const groups = new Set<string>();
    const positions = new Set<string>();
    const companiesSet = new Set<string>();

    currentJobs.forEach((job: any) => {
        const c = job.country?.trim() || "Unknown";
        if (!countryAgg[c]) countryAgg[c] = { count: new Set(), companies: new Set() };
        countryAgg[c].count.add(job.candidate_id);
        if (job.company) {
            countryAgg[c].companies.add(job.company);
            uniqueCompanies.add(job.company);
        }

        // Region Agg
        const rawCont = countryToContinent[c];
        const group = mapContinentToGroup(rawCont);
        const uiGroupKey = group === "America" ? "South and North America" : group;

        if (!regionAgg[uiGroupKey]) regionAgg[uiGroupKey] = {};
        const compName = job.company || "Unknown";
        regionAgg[uiGroupKey][compName] = (regionAgg[uiGroupKey][compName] || 0) + 1;

        // Filters
        if (job.company_industry) industries.add(job.company_industry);
        if (job.company_group) groups.add(job.company_group);
        if (job.position) positions.add(job.position);
        companiesSet.add(job.company);
    });

    // 3. Format Output for Frontend (Client-side Aggregation)
    const rawJobs = currentJobs.map((j: any) => ({
        country: j.country,
        continent: mapContinentToGroup(countryToContinent[j.country?.trim()]),
        company: j.company,
        industry: j.company_industry,
        group: j.company_group,
        position: j.position
    }));

    // Generate Initial Stats
    const stats: GlobalPoolStat[] = Object.keys(countryAgg).map(c => ({
        country: c,
        continent: mapContinentToGroup(countryToContinent[c]),
        count: countryAgg[c].count.size,
        companies: countryAgg[c].companies.size
    }));

    const regionTables: Record<string, any[]> = {};
    Object.keys(regionAgg).forEach(r => {
        const companies = Object.keys(regionAgg[r]).map(comp => ({
            company: comp,
            count: regionAgg[r][comp]
        }));
        companies.sort((a, b) => b.count - a.count);
        regionTables[r] = companies.slice(0, 50);
    });

    return {
        rawJobs,
        stats: stats.sort((a, b) => b.count - a.count),
        regionTables,
        totalCandidates: currentJobs.length,
        totalCompanies: uniqueCompanies.size,
        totalCountries: Object.keys(countryAgg).length,
        filterOptions: {
            continents: Array.from(new Set(Object.values(countryToContinent).map(mapContinentToGroup).filter(c => c !== "Other"))).sort(),
            industries: Array.from(industries).sort(),
            groups: Array.from(groups).sort(),
            companies: Array.from(companiesSet).sort(),
            positions: Array.from(positions).sort().slice(0, 1000)
        }
    };
}

export async function getMarketSalaryStats() {
    const client = adminAuthClient as any;

    // 1. Get Primary Jobs (Re-use call or optimize)
    // To ensure consistency, we call the same function. 
    // It's expensive to call twice but safer. Ideally we cache or client calls once.
    // For now, simple call.
    const currentJobs = await getCandidatesWithPrimaryJobs(client);
    const expMap: Record<string, any> = {};
    currentJobs.forEach(e => expMap[e.candidate_id] = e);

    // 2. Get Profiles (Pagination needed here too if > 1000!)
    let profiles: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore && page < 50) {
        const { data, error } = await client
            .from("Candidate Profile")
            .select("candidate_id, gross_salary_base_b_mth, name, level")
            .gt("gross_salary_base_b_mth", 0)
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) break;
        if (data && data.length > 0) {
            profiles = profiles.concat(data);
            page++;
            if (data.length < pageSize) hasMore = false;
        } else {
            hasMore = false;
        }
    }

    if (!profiles || profiles.length === 0) return { companyStats: [], details: [], filterOptions: { industries: [], groups: [], companies: [] } };

    const companyAgg: Record<string, { salaries: number[], industry: string, group: string }> = {};
    const details: any[] = [];

    // Filters
    const industries = new Set<string>();
    const groups = new Set<string>();
    const companies = new Set<string>();

    profiles.forEach((p: any) => {
        const exp = expMap[p.candidate_id];
        if (exp && exp.company) {
            const annualSalary = p.gross_salary_base_b_mth * 12;
            const comp = exp.company;

            if (exp.company_industry) industries.add(exp.company_industry);
            if (exp.company_group) groups.add(exp.company_group);
            companies.add(comp);

            if (!companyAgg[comp]) companyAgg[comp] = { salaries: [], industry: exp.company_industry, group: exp.company_group };
            companyAgg[comp].salaries.push(annualSalary);

            details.push({
                name: p.name,
                company: comp,
                position: exp.position,
                level: p.level,
                salary: annualSalary,
                salaryMonthly: p.gross_salary_base_b_mth,
                industry: exp.company_industry,
                group: exp.company_group
            });
        }
    });

    const companyStats: CompanySalaryStat[] = Object.keys(companyAgg).map(comp => {
        const salaries = companyAgg[comp].salaries;
        const sum = salaries.reduce((a, b) => a + b, 0);
        return {
            company: comp,
            minSalary: Math.min(...salaries),
            maxSalary: Math.max(...salaries),
            avgSalary: Math.round(sum / salaries.length),
            headcount: salaries.length,
            industry: companyAgg[comp].industry || "N/A",
            group: companyAgg[comp].group || "N/A"
        };
    }).sort((a, b) => b.avgSalary - a.avgSalary).slice(0, 50);

    return {
        companyStats,
        details,
        filterOptions: {
            industries: Array.from(industries).sort(),
            groups: Array.from(groups).sort(),
            companies: Array.from(companies).sort()
        }
    };
}
