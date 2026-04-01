"use server";

import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from 'uuid';
import { getN8nUrl } from "./admin-actions";
import { getCheckedStatus } from "@/lib/candidate-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- 1. Submit Search ---
export async function submitSearch(query: string, userEmail: string = "sumethwork@gmail.com") {
    try {
        const sessionId = uuidv4();
        // 1. Create a Search Job entry
        const { data: job, error: jobError } = await supabase
            .from('search_jobs')
            .insert([
                {
                    session_id: sessionId,
                    original_query: query,
                    user_email: userEmail,
                    status: 'processing'
                }
            ])
            .select()
            .single();

        if (jobError) throw jobError;
        // sessionId is already defined above and matched by the select result

        // 2. Get n8n Webhook URL
        const config = await getN8nUrl('Candidate Search');
        if (!config) {
            await supabase.from('search_jobs').update({ status: 'failed', report: { error: 'Missing n8n config' } }).eq('session_id', sessionId);
            return { success: false, error: "Configuration 'Candidate Search' not found in Admin Panel." };
        }

        // 3. Trigger n8n Webhook
        const url = new URL(config.url);
        // Ensure params are passed correctly depending on method
        const payload = {
            session_id: sessionId,
            query: query,
            user_email: userEmail,
            timestamp: new Date().toISOString()
        };

        let response;
        if (config.method === 'GET') {
            url.searchParams.append("session_id", sessionId);
            url.searchParams.append("query", query);
            url.searchParams.append("user_email", userEmail);
            response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
        } else {
            response = await fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                cache: 'no-store'
            });
        }

        if (!response.ok) {
            await supabase.from('search_jobs').update({ status: 'failed', report: { error: `Webhook Error: ${response.statusText}` } }).eq('session_id', sessionId);
            return { success: false, error: `Failed to trigger n8n: ${response.statusText}` };
        }

        // 4. Initialize Status Rows for Pipeline
        const sources = ['Internal_db', 'external_db'];
        const statusRows = sources.map(src => ({
            session_id: sessionId,
            source: src,
            summary_agent_1: 'Waiting...'
        }));
        await supabase.from('search_job_status').insert(statusRows);

        return { success: true, sessionId };

    } catch (error: any) {
        console.error("Submit Search Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 2. Get Search History ---
export async function getSearchHistory() {
    try {
        const { data, error } = await supabase
            .from('search_jobs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(50);

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        console.error("Get History Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 3. Get Search Results ---
export async function getSearchResults(sessionId: string) {
    try {
        const { data: results, error } = await supabase
            .from('consolidated_results')
            .select('*')
            .eq('session_id', sessionId)
            .order('final_total_score', { ascending: false })
            .order('candidate_ref_id', { ascending: true }); // Secondary sort for stability

        if (error) throw error;

        // Enrich with Photos
        const enrichedResults = await Promise.all(results.map(async (result) => {
            const source = result.source?.toLowerCase();
            let photoUrl = null;
            if (source === 'external_db') {
                const { data: profile } = await supabase
                    .from('ext_candidate_profile')
                    .select('photo_url, linkedin')
                    .eq('candidate_id', result.candidate_ref_id)
                    .maybeSingle();
                if (profile) {
                    photoUrl = profile.photo_url;
                    // Check if already onboarded by LinkedIn
                    if (profile.linkedin) {
                        const { data: existing } = await supabase
                            .from('Candidate Profile')
                            .select('candidate_id')
                            .eq('linkedin', profile.linkedin)
                            .maybeSingle();
                        if (existing) {
                            return { ...result, photo_url: photoUrl, onboarded_id: existing.candidate_id };
                        }
                    }
                }
            } else if (source === 'internal_db') {
                // Use 'Candidate Profile' table and 'photo' column as per user instruction & jr-candidates.ts
                const { data: profile } = await supabase
                    .from('Candidate Profile')
                    .select('photo')
                    .eq('candidate_id', result.candidate_ref_id)
                    .maybeSingle();
                if (profile) photoUrl = profile.photo;
            }
            return { ...result, photo_url: photoUrl };
        }));

        return { success: true, data: enrichedResults };
    } catch (error: any) {
        console.error("Get Results Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 3.1 Get Internal Candidate Details ---
export async function getInternalCandidateDetails(candidateId: string) {
    try {
        // Fetch Profile from 'Candidate Profile'
        const { data: profile, error: profileError } = await supabase
            .from('Candidate Profile')
            .select('*')
            .eq('candidate_id', candidateId)
            .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) return { success: false, error: "Internal candidate not found" };

        // Fetch Experiences
        // Try 'candidate_experiences' first. Use aliases if needed to match standardized fields
        const { data: experiences, error: expError } = await supabase
            .from('candidate_experiences')
            .select('*')
            .eq('candidate_id', candidateId)
            .order('id', { ascending: true });


        if (expError) throw expError;

        // Initialize Internal Profile Enhance (if exists) or structure
        const { data: enhance, error: enhanceError } = await supabase
            .from('candidate_profile_enhance')
            .select('*')
            .eq('candidate_id', candidateId)
            .maybeSingle();

        // Map profile data to match expected interface (photo -> photo_url)
        const mappedProfile = {
            ...profile,
            photo_url: profile.photo || profile.photo_url // Map photo to photo_url
        };

        return {
            success: true,
            data: {
                ...mappedProfile,
                ...(enhance || {}),
                experiences: (experiences || []).map((e: any) => ({
                    ...e,
                    company: e.company || e.company_name || e.company_name_text || 'Unknown Company',
                    start_date: e.start_date,
                    end_date: e.end_date,
                    is_current: e.is_current_job === 'Current',
                    description: e.description,
                    position: e.position
                }))
            }
        };

    } catch (error: any) {
        console.error("Get Internal Details Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 4. Get Search Job Details (Status/Report) ---
export async function getSearchJob(sessionId: string) {
    try {
        const { data, error } = await supabase
            .from('search_jobs')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        console.error("Get Job Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 5. Get External Candidate Details ---
export async function getExternalCandidateDetails(extCandidateId: string) {
    try {
        // Fetch Profile
        const { data: profile, error: profileError } = await supabase
            .from('ext_candidate_profile')
            .select('*')
            .eq('candidate_id', extCandidateId)
            .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) return { success: false, error: "Candidate profile not found" };

        // Fetch Enhance (AI Summary)
        const { data: enhance, error: enhanceError } = await supabase
            .from('ext_profile_enhance')
            .select('*')
            .eq('candidate_id', extCandidateId)
            .maybeSingle();

        // Warning: enhance might be null if not yet generated, which is fine.
        if (enhanceError && enhanceError.code !== 'PGRST116') {
            console.warn("Enhance fetch warning:", enhanceError.message);
        }

        // Fetch Experiences
        const { data: experiences, error: expError } = await supabase
            .from('ext_candidate_experiences')
            .select('*')
            .eq('candidate_id', extCandidateId)
            .order('experience_id', { ascending: true });


        return {
            success: true,
            data: {
                ...profile,
                ...(enhance || {}), // Spread enhance if exists, otherwise empty
                experiences: (experiences || []).map((e: any) => ({
                    company: e.company || e.company_name || e.company_name_text || 'Unknown Company',
                    start_date: e.start_date,
                    end_date: e.end_date,
                    is_current: e.is_current_job === 'Current',
                    description: e.description,
                    position: e.position
                }))
            }
        };

    } catch (error: any) {
        console.error("Get Ext Candidate Error:", error);
        return { success: false, error: error.message };
    }
}
// Helper to auto-complete job if Agent 4 is done
async function checkAndCompleteJob(sessionId: string) {
    try {
        // 1. Check if Agent 4 is completed (in ANY row for this session, though usually 1 per source, we check if any completed)
        // Actually, we should check if ALL required rows are completed, but user said "if summart_agent_4 of session_id = Completed"
        // Let's check if there is AT LEAST ONE row with summart_agent_4 = 'Completed' (or if all?)
        // User said: "Check summart_agent_4 of both Internal and External. If = Completed... update search_jobs status"
        // It implies if the PROCESS is done. Usually we wait for both. 
        // Let's assume if ANY record has Agent 4 completed, it might be enough to mark job as completed?
        // OR better: Check if ALL sources are completed?
        // Re-reading user: "adminAuthClient ... summart_agent_4 ... = Completed ... update search_jobs"
        // Let's query all statuses for this session.

        const { data: statuses } = await supabase
            .from('search_job_status')
            .select('summart_agent_4')
            .eq('session_id', sessionId);

        if (!statuses || statuses.length === 0) return;

        // Logic: If ALL rows that exist have Agent 4 completed? Or just one?
        // Usually we have 2 rows (Internal, External). 
        // If both are completed, then job is completed.
        const allCompleted = statuses.every(s => s.summart_agent_4 === 'Completed');

        if (allCompleted) {
            // Check current job status
            const { data: job } = await supabase
                .from('search_jobs')
                .select('status')
                .eq('session_id', sessionId)
                .single();

            if (job && job.status !== 'completed') {
                await supabase
                    .from('search_jobs')
                    .update({ status: 'completed' })
                    .eq('session_id', sessionId);
            }
        }
    } catch (e) {
        console.error("Auto-complete job error:", e);
    }
}

// --- 6. Get Search Job Statuses ---
export async function getSearchJobStatuses(sessionId: string) {
    try {
        // Trigger background check (no await to not block UI? or await to ensure UI gets fresh status?)
        // Await is safer to ensure UI sees 'completed' immediately if it just happened.
        await checkAndCompleteJob(sessionId);

        const { data, error } = await supabase
            .from('search_job_status')
            .select('*')
            .eq('session_id', sessionId)
            .order('source', { ascending: true });

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        console.error("Get Statuses Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 7. Onboard External Candidate ---
export async function onboardExternalCandidate(extRefId: string, userEmail: string) {
    try {
        // 1. Fetch External Data
        const { data: extProfile, error: profError } = await supabase
            .from('ext_candidate_profile')
            .select('*')
            .eq('candidate_id', extRefId)
            .single();

        if (profError || !extProfile) throw new Error("External profile not found: " + extRefId);

        // Check if already onboarded by LinkedIn URL to avoid duplicates
        if (extProfile.linkedin) {
            const { data: existing } = await supabase
                .from('Candidate Profile')
                .select('candidate_id')
                .eq('linkedin', extProfile.linkedin)
                .maybeSingle();

            if (existing) {
                console.log(`Candidate ${extProfile.name} already onboarded as ${existing.candidate_id}`);
                return { success: true, candidateId: existing.candidate_id, alreadyExisted: true };
            }
        }

        const { data: extExperiences } = await supabase
            .from('ext_candidate_experiences')
            .select('*')
            .eq('candidate_id', extRefId);

        const { data: extEnhance } = await supabase
            .from('ext_profile_enhance')
            .select('*')
            .eq('candidate_id', extRefId)
            .maybeSingle();

        // 2. Reserve Internal candidate_id
        const { data: idRange, error: rpcError } = await supabase
            .rpc('reserve_candidate_ids', { batch_size: 1 });

        if (rpcError || !idRange || idRange.length === 0) {
            throw new Error("Failed to reserve candidate ID: " + rpcError?.message);
        }

        const numericId = idRange[0].start_id;
        const internalId = `C${numericId.toString().padStart(5, '0')}`;

        // 3. Create Internal Profile
        const { error: insertProfError } = await supabase
            .from('Candidate Profile')
            .insert({
                candidate_id: internalId,
                name: extProfile.name,
                photo: extProfile.photo_url || null,
                linkedin: extProfile.linkedin || null,
                email: extProfile.email || null,
                mobile_phone: extProfile.mobile_phone || null,
                checked: getCheckedStatus(extProfile.linkedin),
                created_by: userEmail,
                created_date: new Date().toISOString(),
                modify_date: new Date().toISOString()
            });

        if (insertProfError) throw insertProfError;

        // 4. Create Internal Experiences
        if (extExperiences && extExperiences.length > 0) {
            const internalExps = extExperiences.map(exp => ({
                candidate_id: internalId,
                company: exp.company_name_text,
                position: exp.position,
                start_date: exp.start_date,
                end_date: exp.end_date,
                is_current_job: (exp.is_current === 'true' || exp.is_current === true || exp.is_current === 'True') ? 'Current' : 'Past',
                work_location: exp.work_location,
                country: exp.country,
                company_industry: exp.industry,
                company_group: exp.group
            }));

            const { error: insertExpError } = await supabase
                .from('candidate_experiences')
                .insert(internalExps);

            if (insertExpError) console.error("Error inserting internal experiences:", insertExpError);
        }

        // 5. Create Internal Profile Enhance
        if (extEnhance) {
            const { error: insertEnhError } = await supabase
                .from('candidate_profile_enhance')
                .insert({
                    candidate_id: internalId,
                    gap_analysis: extEnhance.gap_analysis,
                    highlight_project: extEnhance.highlight_project,
                    vision_strategy: extEnhance.vision_strategy,
                    inferred_insights: extEnhance.inferred_insights,
                    executive_summary: extEnhance.executive_summary
                });

            if (insertEnhError) console.error("Error inserting internal profile enhance:", insertEnhError);
        }

        return { success: true, candidateId: internalId, alreadyExisted: false };
    } catch (error: any) {
        console.error("Onboard External Candidate Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 8. Bulk Onboard External Candidates ---
export async function bulkOnboardExternalCandidates(extRefIds: string[], userEmail: string) {
    try {
        if (extRefIds.length === 0) return { success: true, onboarded: 0 };

        // 1. Fetch External Data for all
        const { data: extProfiles, error: profError } = await supabase
            .from('ext_candidate_profile')
            .select('*')
            .in('candidate_id', extRefIds);

        if (profError || !extProfiles) throw new Error("External profiles not found");

        const onboardedResults: { extId: string, internalId: string, alreadyExisted: boolean }[] = [];
        const toOnboard: any[] = [];

        // 2. Separate already onboarded (by LinkedIn)
        for (const extProfile of extProfiles) {
            if (extProfile.linkedin) {
                const { data: existing } = await supabase
                    .from('Candidate Profile')
                    .select('candidate_id')
                    .eq('linkedin', extProfile.linkedin)
                    .maybeSingle();

                if (existing) {
                    onboardedResults.push({ extId: extProfile.candidate_id, internalId: existing.candidate_id, alreadyExisted: true });
                    continue;
                }
            }
            toOnboard.push(extProfile);
        }

        if (toOnboard.length === 0) {
            return { success: true, data: onboardedResults, onboarded: onboardedResults.length };
        }

        // 3. Reserve IDs in batch
        const { data: idRange, error: rpcError } = await supabase
            .rpc('reserve_candidate_ids', { batch_size: toOnboard.length });

        if (rpcError || !idRange || idRange.length === 0) {
            throw new Error("Failed to reserve candidate IDs: " + rpcError?.message);
        }

        // Note: rpc returns array of {start_id: X, end_id: Y} - but our RPC returns an array of rows if handled that way?
        // Actually, looking at fix-candidate-rpc-robust.sql: it returns 'SETOF id_range' which is normally 1 row with start/end.
        // Wait, let's re-verify the RPC return.
        // It returns: RETURN NEXT (SELECT min(start_id) FROM batch_ids, max(end_id) FROM batch_ids);
        // So it's 1 row.
        const startId = idRange[0].start_id;
        
        // 4. Prepare and Insert Profiles
        const profileInserts = toOnboard.map((profile, index) => {
            const internalId = `C${(startId + index).toString().padStart(5, '0')}`;
            onboardedResults.push({ extId: profile.candidate_id, internalId, alreadyExisted: false });
            return {
                candidate_id: internalId,
                name: profile.name,
                photo: profile.photo_url || null,
                linkedin: profile.linkedin || null,
                email: profile.email || null,
                mobile_phone: profile.mobile_phone || null,
                checked: getCheckedStatus(profile.linkedin),
                created_by: userEmail,
                created_date: new Date().toISOString(),
                modify_date: new Date().toISOString()
            };
        });

        const { error: insertProfError } = await supabase
            .from('Candidate Profile')
            .insert(profileInserts);

        if (insertProfError) throw insertProfError;

        // 5. Migrate Experiences and Enhance in backgrounds/sequentially
        for (const profile of toOnboard) {
            const result = onboardedResults.find(r => r.extId === profile.candidate_id);
            if (!result || result.alreadyExisted) continue;
            
            const internalId = result.internalId;

            // Fetch Experience and Enhance
            const [exps, enh] = await Promise.all([
                supabase.from('ext_candidate_experiences').select('*').eq('candidate_id', profile.candidate_id),
                supabase.from('ext_profile_enhance').select('*').eq('candidate_id', profile.candidate_id).maybeSingle()
            ]);

            // Insert Experiences
            if (exps.data && exps.data.length > 0) {
                const internalExps = exps.data.map(exp => ({
                    candidate_id: internalId,
                    company: exp.company_name_text,
                    position: exp.position,
                    start_date: exp.start_date,
                    end_date: exp.end_date,
                    is_current_job: (exp.is_current === 'true' || exp.is_current === true || exp.is_current === 'True') ? 'Current' : 'Past',
                    work_location: exp.work_location,
                    country: exp.country,
                    company_industry: exp.industry,
                    company_group: exp.group
                }));
                await supabase.from('candidate_experiences').insert(internalExps);
            }

            // Insert Enhance
            if (enh.data) {
                await supabase.from('candidate_profile_enhance').insert({
                    candidate_id: internalId,
                    gap_analysis: enh.data.gap_analysis,
                    highlight_project: enh.data.highlight_project,
                    vision_strategy: enh.data.vision_strategy,
                    inferred_insights: enh.data.inferred_insights,
                    executive_summary: enh.data.executive_summary
                });
            }
        }

        return { success: true, data: onboardedResults, onboarded: onboardedResults.length };

    } catch (error: any) {
        console.error("Bulk Onboard Error:", error);
        return { success: false, error: error.message };
    }
}

// --- 9. Delete Search Session ---
export async function deleteSearchSession(sessionId: string) {
    try {
        // 1. Delete Results (session-specific)
        const { error: resError } = await supabase
            .from('consolidated_results')
            .delete()
            .eq('session_id', sessionId);
        
        if (resError) throw resError;

        // 2. Delete Statuses (session-specific)
        const { error: statusError } = await supabase
            .from('search_job_status')
            .delete()
            .eq('session_id', sessionId);

        if (statusError) throw statusError;

        // 3. Delete Search Job (The history entry)
        const { error: jobError } = await supabase
            .from('search_jobs')
            .delete()
            .eq('session_id', sessionId);

        if (jobError) throw jobError;

        return { success: true };
    } catch (error: any) {
        console.error("Delete Search Session Error:", error);
        return { success: false, error: error.message };
    }
}
