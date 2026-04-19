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
/**
 * REVISED SELECTION LOGIC:
 * 1. Find is_current_job = 'Current'
 * 2. If multiple, take latest start_date
 * 3. If no 'Current', take latest start_date across all experiences
 */
function getPrimaryJob(experiences: any[]): any | null {
    if (!experiences || experiences.length === 0) return null;

    const currents = experiences.filter(e => e.is_current_job === 'Current');
    if (currents.length > 0) {
        return currents.sort((a, b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime())[0];
    }

    return experiences.sort((a, b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime())[0];
}

export async function getGlobalPoolDisplay() {
    const client = adminAuthClient as any;

    console.log("Starting Global Pool Data Fetch...");

    // 1. Fetch ALL Candidate Profiles (Base: 7,134)
    let profiles: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore && page < 50) {
        const { data, error } = await client.from("Candidate Profile").select("candidate_id, name, age, gender").range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) break;
        if (data && data.length > 0) {
            profiles = profiles.concat(data);
            page++;
            if (data.length < pageSize) hasMore = false;
        } else { hasMore = false; }
    }

    // 2. Fetch ALL Experiences
    let allExps: any[] = [];
    page = 0;
    hasMore = true;
    while (hasMore && page < 100) {
        const { data, error } = await client.from("candidate_experiences").select("*").range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) break;
        if (data && data.length > 0) {
            allExps = allExps.concat(data);
            page++;
            if (data.length < pageSize) hasMore = false;
        } else { hasMore = false; }
    }

    // 3. Fetch Company Master for metadata (Rating, Set)
    const { data: companyMaster } = await client.from("company_master").select("*");
    const companyLookup: Record<number, any> = {};
    if (companyMaster) {
        companyMaster.forEach((c: any) => companyLookup[c.company_id] = c);
    }

    // 4. Fetch country to continent mapping
    const { data: countryMaster } = await client.from("country").select("country, continent");
    const countryToContinent: Record<string, string> = {};
    if (countryMaster) countryMaster.forEach((c: any) => countryToContinent[c.country?.trim()] = c.continent);

    // 5. Fetch JR mapping & JR details
    let jrCandidates: any[] = [];
    page = 0;
    hasMore = true;
    while (hasMore && page < 20) {
        const { data, error } = await client.from("jr_candidates").select("candidate_id, jr_id, list_type").range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) break;
        if (data && data.length > 0) {
            jrCandidates = jrCandidates.concat(data);
            page++;
            if (data.length < pageSize) hasMore = false;
        } else { hasMore = false; }
    }

    const { data: jrDetails } = await client.from("job_requisitions").select("jr_id, position_jr, bu, sub_bu");
    
    const jrMap: Record<string, any> = {};
    if (jrDetails) jrDetails.forEach((jr: any) => jrMap[jr.jr_id] = jr);

    const candToJRs: Record<string, { jr_id: string, jr_name: string, bu: string, sub_bu: string, list_type: string }[]> = {};
    if (jrCandidates) {
        jrCandidates.forEach((jrc: any) => {
            const detail = jrMap[jrc.jr_id];
            if (!candToJRs[jrc.candidate_id]) candToJRs[jrc.candidate_id] = [];
            
            // Format JR Name as "JR_ID - Position" for better clarity
            const formattedName = detail?.position_jr 
                ? `${jrc.jr_id} - ${detail.position_jr}`
                : jrc.jr_id;

            candToJRs[jrc.candidate_id].push({
                jr_id: jrc.jr_id,
                jr_name: formattedName,
                bu: detail?.bu || "N/A",
                sub_bu: detail?.sub_bu || "N/A",
                list_type: jrc.list_type
            });
        });
    }

    // --- Processing Logic ---
    const groupedExps: Record<string, any[]> = {};
    allExps.forEach((exp: any) => {
        if (!groupedExps[exp.candidate_id]) groupedExps[exp.candidate_id] = [];
        groupedExps[exp.candidate_id].push(exp);
    });

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

    // Build the Final Raw Jobs Object (One per profile)
    const rawJobs = profiles.map((p: any) => {
        const exps = groupedExps[p.candidate_id] || [];
        const primary = getPrimaryJob(exps);
        const masterComp = primary?.company_id ? companyLookup[primary.company_id] : null;
        
        const candidateJRs = candToJRs[p.candidate_id] || [];
        const isTopProfile = candidateJRs.some(j => j.list_type === 'Top profile');

        return {
            candidate_id: p.candidate_id,
            name: p.name,
            age: p.age || 0,
            gender: p.gender || "Unknown",
            // Geography
            country: primary?.country?.trim() || "Unknown",
            continent: mapContinentToGroup(countryToContinent[primary?.country?.trim()]),
            // Company info
            company: masterComp?.company_master || primary?.company || "Unknown",
            company_id: primary?.company_id || null,
            industry: masterComp?.industry || primary?.company_industry || "Unknown",
            group: masterComp?.group || primary?.company_group || "Unknown",
            rating: masterComp?.rating || "N/A",
            set: masterComp?.set || "N/A",
            // JRs
            jrs: candidateJRs, // Array of JR objects for complex filtering
            jr_names: candidateJRs.map(j => j.jr_name),
            bus: candidateJRs.map(j => j.bu),
            sub_bus: candidateJRs.map(j => j.sub_bu),
            list_types: candidateJRs.map(j => j.list_type),
            is_top_profile: isTopProfile
        };
    });

    // Build a complete list of all JRs for the frontend cascading filter
    const allJRs = Object.values(jrMap).map(jr => ({
        jr_id: jr.jr_id,
        jr_name: jr.position_jr ? `${jr.jr_id} - ${jr.position_jr}` : jr.jr_id,
        bu: jr.bu || "N/A",
        sub_bu: jr.sub_bu || "N/A"
    }));

    return {
        rawJobs,
        allJRs, // Send full list to frontend
        totalCandidates: rawJobs.length,
        // Pre-calculated filter options for initial load
        filterOptions: {
            jr_names: Array.from(new Set([
                ...rawJobs.flatMap(j => j.jr_names),
                ...Object.values(jrMap).map(jr => jr.position_jr ? `${jr.jr_id} - ${jr.position_jr}` : jr.jr_id)
            ])).sort(),
            bus: Array.from(new Set([
                ...rawJobs.flatMap(j => j.bus),
                ...Object.values(jrMap).map(jr => jr.bu || "N/A")
            ])).sort(),
            sub_bus: Array.from(new Set([
                ...rawJobs.flatMap(j => j.sub_bus),
                ...Object.values(jrMap).map(jr => jr.sub_bu || "N/A")
            ])).sort(),
            ratings: Array.from(new Set(rawJobs.map(j => j.rating.toString()))).sort(),
            sets: Array.from(new Set(rawJobs.map(j => j.set))).sort(),
            industries: Array.from(new Set(rawJobs.map(j => j.industry))).sort(),
            groups: Array.from(new Set(rawJobs.map(j => j.group))).sort(),
            companies: Array.from(new Set(rawJobs.map(j => j.company))).sort(),
            continents: ["Asia", "Europe", "America", "Africa", "Oceania"]
        }
    };
}


export async function getMarketSalaryStats() {
    const client = adminAuthClient as any;

    // 1. Get Experience Data for primary jobs
    let allExps: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore && page < 50) {
        const { data, error } = await client.from("candidate_experiences").select("*").range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) break;
        if (data && data.length > 0) {
            allExps = allExps.concat(data);
            page++;
            if (data.length < pageSize) hasMore = false;
        } else { hasMore = false; }
    }

    const groupedExps: Record<string, any[]> = {};
    allExps.forEach((exp: any) => {
        if (!groupedExps[exp.candidate_id]) groupedExps[exp.candidate_id] = [];
        groupedExps[exp.candidate_id].push(exp);
    });

    const expMap: Record<string, any> = {};
    Object.keys(groupedExps).forEach(cid => {
        const primary = getPrimaryJob(groupedExps[cid]);
        if (primary) expMap[cid] = primary;
    });

    // 2. Get Profiles with salary data
    let profiles: any[] = [];
    page = 0;
    hasMore = true;
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
        } else { hasMore = false; }
    }

    if (!profiles || profiles.length === 0) return { companyStats: [], details: [], filterOptions: { industries: [], groups: [], companies: [] } };

    const companyAgg: Record<string, { salaries: number[], industry: string, group: string }> = {};
    const details: any[] = [];

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

export async function getOrgChartVerificationAlerts() {
    const client = adminAuthClient as any;

    // 1. Fetch all OrgChart uploads
    const { data: uploads, error: uploadErr } = await client
        .from('org_chart_uploads')
        .select('upload_id, company_name, status, created_at')
        .order('created_at', { ascending: false });

    if (uploadErr) {
        console.error('Error fetching org chart uploads for alerts:', uploadErr);
        return [];
    }

    if (!uploads || uploads.length === 0) return [];

    // 2. Fetch all nodes with verification status for these uploads
    const { data: nodes, error: nodeErr } = await client
        .from('all_org_nodes')
        .select('upload_id, is_verified')
        .in('upload_id', uploads.map((u: any) => u.upload_id));

    if (nodeErr) {
        console.error('Error fetching org nodes for alerts:', nodeErr);
        return [];
    }

    // 3. Aggregate results
    const alertData = uploads.map((u: any) => {
        const uploadNodes = nodes?.filter((n: any) => n.upload_id === u.upload_id) || [];
        const totalNodes = uploadNodes.length;
        const verifiedNodes = uploadNodes.filter((n: any) => n.is_verified === 'TRUE' || n.is_verified === true || n.is_verified === 'true').length;
        const pendingNodes = totalNodes - verifiedNodes;
        
        return {
            upload_id: u.upload_id,
            company_name: u.company_name,
            total_nodes: totalNodes,
            verified_nodes: verifiedNodes,
            pending_nodes: pendingNodes,
            progress: totalNodes > 0 ? Math.round((verifiedNodes / totalNodes) * 100) : 0,
            status: u.status,
            created_at: u.created_at
        };
    });

    // 4. Return only those with pending nodes or recently completed (optional: user asked for items with verify items)
    // We'll return everything and let the UI filter if needed, 
    // but typically we only want those that aren't 100% finished or those that are newly finished.
    return alertData.filter(a => a.pending_nodes > 0 || a.total_nodes === 0);
}
