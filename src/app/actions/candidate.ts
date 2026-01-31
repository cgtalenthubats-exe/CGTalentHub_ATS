"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function addExperience(candidateId: string, formData: FormData) {
    const position = formData.get("position") as string;
    const companyName = formData.get("company") as string;
    const companyIdInput = formData.get("company_id") as string; // Optional
    const startDate = formData.get("start_date") as string;
    const endDate = formData.get("end_date") as string;
    const isCurrent = formData.get("is_current") === "on";
    const country = formData.get("country") as string;
    const industry = formData.get("industry") as string;
    const group = formData.get("group") as string;

    if (!candidateId || !position || !companyName) {
        return { error: "Missing required fields" };
    }

    let finalCompanyId = companyIdInput;
    let finalIndustry = industry;
    let finalGroup = group;

    const client = adminAuthClient as any;

    // 1. Handle Company Logic
    if (finalCompanyId) {
        // If ID provided, ensure industry/group are synced if not provided (optional, but good for consistency)
        // actually, if user selected existing company, the UI might have passed the master industry/group
    } else {
        // New Company or Typed Name
        // Check if exists by name (case insensitive?)
        const { data: existing } = await client
            .from("company_master")
            .select("company_id, industry, group")
            .ilike("company_master", companyName) // Assuming column is 'company_master' for name based on check-db
            .maybeSingle();

        if (existing) {
            finalCompanyId = existing.company_id;
            finalIndustry = existing.industry || finalIndustry; // Use master if available
            finalGroup = existing.group || finalGroup;
        } else {
            // Create new Company
            const { data: newComp, error: createError } = await client
                .from("company_master")
                .insert({
                    company_master: companyName,
                    industry: finalIndustry || null,
                    group: finalGroup || null
                })
                .select("company_id")
                .single();

            if (!createError && newComp) {
                finalCompanyId = newComp.company_id;
            } else {
                console.error("Failed to create company:", createError);
                // Proceed without ID? Or fail? User requested "system go collect info in company_id".
                // We'll proceed but log error.
            }
        }
    }

    const { error } = await client.from("candidate_experiences").insert({
        candidate_id: candidateId,
        position: position,
        company_name_text: companyName, // Keep text valid
        company: companyName, // Also update 'company' column if it exists and is used
        company_id: finalCompanyId || null,
        company_industry: finalIndustry || null,
        company_group: finalGroup || null,
        country: country || null,
        start_date: startDate || null,
        end_date: isCurrent ? null : (endDate || null),
        is_current: isCurrent
    });

    if (error) {
        console.error("Add Experience Error:", error);
        return { error: error.message };
    }

    revalidatePath(`/candidates/${candidateId}`);
    return { success: true };
}

export async function searchCompanies(query: string) {
    if (!query) return [];

    const client = adminAuthClient as any;

    const { data, error } = await client
        .from("company_master")
        .select("company_id, company_master, industry, group")
        .ilike("company_master", `%${query}%`)
        .limit(10);

    if (error) {
        console.error("Search Company Error:", error);
        return [];
    }

    // Map company_master to name for easier UI consumption
    return data.map((c: any) => ({
        id: c.company_id,
        name: c.company_master,
        industry: c.industry,
        group: c.group
    }));
}

export async function getCompanyDetails(companyId: string) {
    const client = adminAuthClient as any;

    // 1. Get Master Details
    const { data: master } = await client
        .from("company_master")
        .select("industry, group")
        .eq("company_id", companyId)
        .single();

    // 2. Get Countries from usage in experiences
    const { data: countries } = await client
        .from("candidate_experiences")
        .select("country")
        .eq("company_id", companyId);

    // Unique countries
    const uniqueCountries = Array.from(new Set(countries?.map((c: any) => c.country).filter(Boolean))) as string[];

    return {
        industry: master?.industry,
        group: master?.group,
        countries: uniqueCountries
    };
}

export async function getFieldSuggestions(field: 'position' | 'industry' | 'group' | 'country', query: string) {
    const client = adminAuthClient as any;
    let table = "";
    let column = "";

    switch (field) {
        case 'position':
            table = "candidate_experiences";
            column = "position";
            break;
        case 'country':
            table = "candidate_experiences";
            column = "country";
            break;
        case 'industry':
            table = "company_master";
            column = "industry"; // or company_industry in experiences? sticking to master
            break;
        case 'group':
            table = "company_master";
            column = "group";
            break;
    }

    if (!table) return [];

    const { data, error } = await client
        .from(table)
        .select(column)
        .ilike(column, `%${query}%`)
        .limit(50);

    if (error) {
        console.error(`Error fetching suggestions for ${field}:`, error);
        return [];
    }

    // Client-side unique dedupe
    const values = data.map((d: any) => d[column]).filter(Boolean);
    return Array.from(new Set(values));
}

export async function deleteExperience(experienceId: string, candidateId: string) {
    const client = adminAuthClient as any;
    const { error } = await client
        .from("candidate_experiences")
        .delete()
        .eq("experience_id", experienceId);

    if (error) {
        return { error: error.message };
    }

    revalidatePath(`/candidates/${candidateId}`);
    return { success: true };
}
