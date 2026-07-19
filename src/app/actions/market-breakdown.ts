"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { groupExperiencesByCandidate, type ExperienceRow } from "@/lib/candidate-experience-utils";

export type MarketBreakdown = {
    totalCandidates: number;
    setCount: number;
    nonSetCount: number;
    industries: { label: string; count: number }[];
    regions: { label: string; count: number }[];
    thailandCount: number;
};

const UNKNOWN_GROUP_LABELS = new Set(["Unknown", "N/A", "Not Found", "Undetermined", "No Match Found"]);

/**
 * Aggregates SET/Non-SET, industry group, and region breakdown for a pool of
 * candidate_ids using each candidate's latest work experience (current job
 * first, else most recent start_date — see candidate-experience-utils).
 */
export async function getPoolMarketBreakdown(candidateIds: string[]): Promise<MarketBreakdown> {
    if (!candidateIds.length) {
        return { totalCandidates: 0, setCount: 0, nonSetCount: 0, industries: [], regions: [], thailandCount: 0 };
    }

    const [expRes, setGroupRes] = await Promise.all([
        adminAuthClient
            .from("candidate_experiences")
            .select("candidate_id, position, company, company_id, start_date, end_date, country, is_current_job")
            .in("candidate_id", candidateIds),
        adminAuthClient.from("company_set_group").select("company_name"),
    ]);

    const experiences = (expRes.data ?? []) as ExperienceRow[];
    const latestByCandidate = groupExperiencesByCandidate(experiences);

    const companyIds = [...new Set(
        [...latestByCandidate.values()].map(list => list[0]?.company_id).filter((id): id is number => id != null)
    )];

    const [companyMasterRes, countryRes] = await Promise.all([
        companyIds.length
            ? adminAuthClient.from("company_master").select("company_id, company_master, group").in("company_id", companyIds)
            : Promise.resolve({ data: [] as any[] }),
        adminAuthClient.from("country").select("country, region"),
    ]);

    const companyMap = new Map((companyMasterRes.data ?? []).map((c: any) => [c.company_id, c]));
    const regionMap = new Map((countryRes.data ?? []).map((c: any) => [c.country, c.region]));
    const setNames = new Set((setGroupRes.data ?? []).map((s: any) => (s.company_name as string)?.toLowerCase().trim()));

    let setCount = 0, nonSetCount = 0, thailandCount = 0;
    const industryCounts = new Map<string, number>();
    const regionCounts = new Map<string, number>();

    for (const cId of candidateIds) {
        const latest = latestByCandidate.get(cId)?.[0];
        if (!latest) continue;

        const company = latest.company_id != null ? companyMap.get(latest.company_id) : null;
        const isSet = company ? setNames.has((company.company_master as string)?.toLowerCase().trim()) : false;
        if (isSet) setCount++; else nonSetCount++;

        const groupLabel = company?.group && !UNKNOWN_GROUP_LABELS.has(company.group) ? company.group : "Other / Unknown";
        industryCounts.set(groupLabel, (industryCounts.get(groupLabel) ?? 0) + 1);

        const country = latest.country ?? null;
        if (country?.toLowerCase() === "thailand") thailandCount++;
        const region = country ? regionMap.get(country) ?? "Other" : "Unknown";
        regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
    }

    const toSortedList = (m: Map<string, number>) =>
        [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

    return {
        totalCandidates: candidateIds.length,
        setCount,
        nonSetCount,
        industries: toSortedList(industryCounts),
        regions: toSortedList(regionCounts),
        thailandCount,
    };
}
