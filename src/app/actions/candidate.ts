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

    if (!candidateId) return { error: "Missing Candidate ID" };
    if (!position) return { error: "Missing Position" };
    if (!companyName) return { error: "Missing Company Name" };

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
        company: companyName,
        company_id: finalCompanyId || null,
        company_industry: finalIndustry || null,
        company_group: finalGroup || null,
        country: country || null,
        start_date: startDate || null,
        end_date: isCurrent ? null : (endDate || null),
        is_current_job: isCurrent ? "Current" : "Past"
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
        .eq("id", experienceId);

    if (error) {
        return { error: error.message };
    }

    revalidatePath(`/candidates/${candidateId}`);
    return { success: true };
}

// Set (or toggle off) the 'Current' job for a candidate.
// Simplified: Just set the selected experience as 'Current'.
export async function setCurrentExperience(experienceId: string, candidateId: string) {
    const client = adminAuthClient as any;

    // 1. Fetch current state to ensure toggle is accurate
    const { data: currentExp } = await client
        .from("candidate_experiences")
        .select("is_current_job")
        .eq("id", experienceId)
        .single();

    const currentlyIsCurrent = currentExp?.is_current_job === 'Current';

    // 2. Toggle logic: Current -> Past, anything else -> Current
    const newStatus = currentlyIsCurrent ? "Past" : "Current";
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const updateData: any = {
        is_current_job: newStatus,
        is_current: newStatus === "Current"
    };

    if (newStatus === "Current") {
        updateData.end_date = null; // null displays as "Present"
    } else {
        updateData.end_date = today; // Set end_date to today when moving to "Past"
    }

    const { error: setError } = await client
        .from("candidate_experiences")
        .update(updateData)
        .eq("id", experienceId);

    if (setError) {
        console.error("setCurrentExperience set error:", setError);
        return { error: setError.message };
    }

    revalidatePath(`/candidates/${candidateId}`);
    return { success: true };
}

export async function updateExperience(experienceId: string, candidateId: string, formData: FormData) {
    const position = formData.get("position") as string;
    const companyName = formData.get("company") as string;
    const companyIdInput = formData.get("company_id") as string;
    const startDate = formData.get("start_date") as string;
    const endDate = formData.get("end_date") as string;
    const isCurrent = formData.get("is_current") === "on";
    const country = formData.get("country") as string;
    const industry = formData.get("industry") as string;
    const group = formData.get("group") as string;

    if (!experienceId) return { error: "Missing Experience ID" };
    if (!candidateId) return { error: "Missing Candidate ID" };
    if (!position) return { error: "Missing Position" };
    if (!companyName) return { error: "Missing Company Name" };

    const client = adminAuthClient as any;

    let finalCompanyId = companyIdInput;

    // Simple company check (similar to addExperience but simplified for update)
    if (!finalCompanyId) {
        const { data: existing } = await client
            .from("company_master")
            .select("company_id")
            .ilike("company_master", companyName)
            .maybeSingle();

        if (existing) {
            finalCompanyId = existing.company_id;
        } else {
            const { data: newComp } = await client
                .from("company_master")
                .insert({ company_master: companyName, industry: industry || null, group: group || null })
                .select("company_id")
                .single();
            if (newComp) finalCompanyId = newComp.company_id;
        }
    }

    const { error } = await client
        .from("candidate_experiences")
        .update({
            position,
            company: companyName,
            company_id: finalCompanyId || null,
            company_industry: industry || null,
            company_group: group || null,
            country: country || null,
            start_date: startDate || null,
            end_date: isCurrent ? null : (endDate || null),
            is_current_job: isCurrent ? "Current" : "Past"
        })
        .eq("id", experienceId);

    if (error) {
        return { error: error.message };
    }

    revalidatePath(`/candidates/${candidateId}`);
    return { success: true };
}


export async function searchCandidates(query: string) {
    if (!query) return [];
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const client = adminAuthClient as any;

    // Search by Name, Email, or Candidate ID
    // Table name is 'Candidate Profile' with space
    const { data, error } = await client
        .from('Candidate Profile' as any)
        .select(`
            candidate_id, 
            name, 
            email, 
            mobile_phone, 
            job_function, 
            photo,
            age,
            gender,
            nationality,
            linkedin_profile
        `)
        .or(`name.ilike.%${trimmedQuery}%,email.ilike.%${trimmedQuery}%,candidate_id.ilike.%${trimmedQuery}%`)
        .limit(20);

    if (error) {
        console.error("Search Candidate Error:", error);
        return [];
    }

    return data;
}

export async function getIndustryGroupMaster() {
    const client = adminAuthClient as any;
    const { data, error } = await client
        .from("industry_group")
        .select("industry, group")
        .order("industry", { ascending: true });

    if (error) {
        console.error("Error fetching industry_group master:", error);
        return [];
    }
    return data;
}

export async function getCountryMaster() {
    const client = adminAuthClient as any;
    const { data, error } = await client
        .from("country")
        .select("country")
        .order("country", { ascending: true });

    if (error) {
        console.error("Error fetching country master:", error);
        return [];
    }
    return data.map((c: any) => c.country).filter(Boolean);
}
