"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { groupExperiencesByCandidate, type ExperienceRow } from "@/lib/candidate-experience-utils";

export type MarketBreakdown = {
    totalCandidates: number;
    setCount: number;
    nonSetCount: number;
    thailandCount: number;
    companyGroups: { label: string; count: number }[];
    industries: { label: string; count: number }[];
    continents: { label: string; count: number }[];
    countries: { label: string; count: number }[];
    companies: { label: string; count: number }[];
    positionKeywords: { label: string; count: number }[];
    ageRanges: { label: string; count: number }[];
};

const UNKNOWN_GROUP_LABELS = new Set(["Unknown", "N/A", "Not Found", "Undetermined", "No Match Found"]);
const AGE_BUCKET_ORDER = ["<30", "30–39", "40–49", "50–59", "60+", "Unknown"];

function ageBucket(age: number | null): string {
    if (age == null) return "Unknown";
    if (age < 30) return "<30";
    if (age < 40) return "30–39";
    if (age < 50) return "40–49";
    if (age < 60) return "50–59";
    return "60+";
}

/**
 * Aggregates the "Market" dashboard breakdowns for a pool of candidate_ids,
 * using each candidate's latest work experience (current job first, else
 * most recent start_date — see candidate-experience-utils).
 */
export async function getPoolMarketBreakdown(candidateIds: string[]): Promise<MarketBreakdown> {
    const empty: MarketBreakdown = {
        totalCandidates: 0, setCount: 0, nonSetCount: 0, thailandCount: 0,
        companyGroups: [], industries: [], continents: [], countries: [], companies: [],
        positionKeywords: [], ageRanges: [],
    };
    if (!candidateIds.length) return empty;

    const [expRes, setGroupRes, profileRes] = await Promise.all([
        adminAuthClient
            .from("candidate_experiences")
            .select("candidate_id, position, position_keyword, company, company_id, start_date, end_date, country, is_current_job")
            .in("candidate_id", candidateIds),
        adminAuthClient.from("company_set_group").select("company_name"),
        adminAuthClient.from("Candidate Profile").select("candidate_id, age").in("candidate_id", candidateIds),
    ]);

    const experiences = (expRes.data ?? []) as ExperienceRow[];
    const latestByCandidate = groupExperiencesByCandidate(experiences);
    const ageMap = new Map((profileRes.data ?? []).map((p: any) => [p.candidate_id, p.age as number | null]));

    const companyIds = [...new Set(
        [...latestByCandidate.values()].map(list => list[0]?.company_id).filter((id): id is number => id != null)
    )];

    const [companyMasterRes, countryRes] = await Promise.all([
        companyIds.length
            ? adminAuthClient.from("company_master").select("company_id, company_master, group, industry").in("company_id", companyIds)
            : Promise.resolve({ data: [] as any[] }),
        adminAuthClient.from("country").select("country, continent"),
    ]);

    const companyMap = new Map((companyMasterRes.data ?? []).map((c: any) => [c.company_id, c]));
    const continentMap = new Map((countryRes.data ?? []).map((c: any) => [c.country, c.continent]));
    const setNames = new Set((setGroupRes.data ?? []).map((s: any) => (s.company_name as string)?.toLowerCase().trim()));

    let setCount = 0, nonSetCount = 0, thailandCount = 0;
    const groupCounts = new Map<string, number>();
    const industryCounts = new Map<string, number>();
    const continentCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();
    const companyCounts = new Map<string, number>();
    const keywordCounts = new Map<string, number>();
    const ageCounts = new Map<string, number>();

    for (const cId of candidateIds) {
        const latest = latestByCandidate.get(cId)?.[0];
        if (!latest) continue;

        const company = latest.company_id != null ? companyMap.get(latest.company_id) : null;
        const isSet = company ? setNames.has((company.company_master as string)?.toLowerCase().trim()) : false;
        if (isSet) setCount++; else nonSetCount++;

        const groupLabel = company?.group && !UNKNOWN_GROUP_LABELS.has(company.group) ? company.group : "Other / Unknown";
        groupCounts.set(groupLabel, (groupCounts.get(groupLabel) ?? 0) + 1);

        const industryLabel = company?.industry && !UNKNOWN_GROUP_LABELS.has(company.industry) ? company.industry : "Other / Unknown";
        industryCounts.set(industryLabel, (industryCounts.get(industryLabel) ?? 0) + 1);

        if (company?.company_master) {
            companyCounts.set(company.company_master, (companyCounts.get(company.company_master) ?? 0) + 1);
        }

        const country = latest.country ?? null;
        if (country?.toLowerCase() === "thailand") thailandCount++;
        if (country && !UNKNOWN_GROUP_LABELS.has(country)) {
            countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
        }
        const continent = country ? continentMap.get(country) ?? "Other" : "Unknown";
        continentCounts.set(continent, (continentCounts.get(continent) ?? 0) + 1);

        const keyword = (latest as any).position_keyword;
        if (keyword) keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);

        const bucket = ageBucket(ageMap.get(cId) ?? null);
        ageCounts.set(bucket, (ageCounts.get(bucket) ?? 0) + 1);
    }

    const toSortedList = (m: Map<string, number>) =>
        [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

    return {
        totalCandidates: candidateIds.length,
        setCount,
        nonSetCount,
        thailandCount,
        companyGroups: toSortedList(groupCounts),
        industries: toSortedList(industryCounts),
        continents: toSortedList(continentCounts),
        countries: toSortedList(countryCounts),
        companies: toSortedList(companyCounts),
        positionKeywords: toSortedList(keywordCounts),
        ageRanges: AGE_BUCKET_ORDER
            .map(label => ({ label, count: ageCounts.get(label) ?? 0 }))
            .filter(b => b.count > 0),
    };
}
