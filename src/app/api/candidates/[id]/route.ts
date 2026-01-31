import { NextResponse } from 'next/server';
import { adminAuthClient } from '@/lib/supabase/admin';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const candidateId = (await params).id;

    if (!candidateId) {
        return NextResponse.json({ error: "Candidate ID is required" }, { status: 400 });
    }

    console.log(`[API] Fetching candidate: '${candidateId}'`);

    try {
        // Debug: Check if table is accessible at all
        const { count, error: countError } = await adminAuthClient.from('Candidate Profile').select('*', { count: 'exact', head: true });
        console.log(`[API] Table 'Candidate Profile' check - Count: ${count}, Error: ${countError?.message}`);

        // 1. Fetch Basic Profile
        // Correct Table Name: 'Candidate Profile'
        const { data: profile, error: profileError } = await adminAuthClient
            .from('Candidate Profile')
            .select('*')
            .eq('candidate_id', candidateId)
            .maybeSingle();

        console.log(`[API] Profile Fetch Result:`, profile ? "Found" : "Not Found", profileError?.message);

        if (profileError) throw profileError;
        if (!profile) throw new Error(`Candidate Profile '${candidateId}' not found in database (Table Count: ${count})`);

        // 2. Fetch Experiences
        const { data: experiences, error: expError } = await adminAuthClient
            .from('candidate_experiences')
            .select('*')
            .eq('candidate_id', candidateId)
            .order('start_date', { ascending: false });

        if (expError) console.error("Experience Fetch Error:", expError);

        // 3. Fetch Enhancement Data (candidate_profile_enhance)
        const { data: enhanceResult, error: enhanceError } = await adminAuthClient
            .from('candidate_profile_enhance')
            .select('*')
            .eq('candidate_id', candidateId)
            .maybeSingle(); // Changed from single() to allow missing enhance profile

        if (enhanceError && enhanceError.code !== 'PGRST116') {
            console.error("Enhance Profile Fetch Error:", enhanceError);
        }

        // 4. Fetch Job History (jr_candidates)
        let historyWithDetails: any[] = [];
        const { data: jrCandidates, error: jrError } = await adminAuthClient
            .from('jr_candidates')
            .select('*')
            .eq('candidate_id', candidateId);

        if (jrError) console.error("Job History Fetch Error:", jrError);

        if (jrCandidates && jrCandidates.length > 0) {
            // A. Fetch Job Requisition Details Manually (Manual Join)
            const jrIds = jrCandidates.map((j: any) => j.jr_id).filter(Boolean);
            const jrCandidateIds = jrCandidates.map((j: any) => j.jr_candidate_id).filter(Boolean);

            let jobMap: Record<string, any> = {};
            if (jrIds.length > 0) {
                const { data: jobs, error: jobFetchError } = await adminAuthClient
                    .from('job_requisitions')
                    .select('jr_id, position_jr, bu, sub_bu')
                    .in('jr_id', jrIds);

                if (jobFetchError) console.error("JR Details Fetch Error:", jobFetchError);

                if (jobs) {
                    jobs.forEach((job: any) => {
                        jobMap[job.jr_id] = job;
                    });
                }
            }

            // B. Fetch Status Logs Manually
            let statusMap: Record<string, any> = {};
            if (jrCandidateIds.length > 0) {
                const { data: logs, error: statusError } = await adminAuthClient
                    .from('status_log')
                    .select('*')
                    .in('jr_candidate_id', jrCandidateIds);

                if (statusError) console.error("Status Log Fetch Error:", statusError);

                // Sort in JS to handle text timestamp "MM/DD/YYYY" correctly
                if (logs) {
                    logs.sort((a: any, b: any) => {
                        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                        return tB - tA; // Descending
                    });

                    // Group by jr_candidate_id and take first (latest)
                    logs.forEach((log: any) => {
                        if (!statusMap[log.jr_candidate_id]) {
                            statusMap[log.jr_candidate_id] = log;
                        }
                    });
                }
            }

            // C. Combine Data
            historyWithDetails = jrCandidates.map((jrCan: any) => {
                const jobDetails = jobMap[jrCan.jr_id] || {};
                const statusDetails = statusMap[jrCan.jr_candidate_id];

                return {
                    ...jrCan,
                    position_jr: jobDetails.position_jr || "Unknown Position",
                    bu: jobDetails.bu,
                    sub_bu: jobDetails.sub_bu,
                    latest_status: statusDetails?.status || jrCan.temp_status || "Applied",
                    status_date: statusDetails?.timestamp || jrCan.time_stamp,
                    status_note: statusDetails?.note
                };
            });
        }

        // 5. Fetch Pre-Screen Logs (table: pre_screen_log)
        const { data: prescreenLogs, error: logError } = await adminAuthClient
            .from('pre_screen_log')
            .select('*')
            .eq('candidate_id', candidateId)
            .order('pre_screen_id', { ascending: false });

        if (logError && logError.code !== 'PGRST116') console.error("Prescreen Fetch Error:", logError);

        // 6. Fetch Documents (Resume)
        // Note: 'documents' table appears to be a vector store without candidate_id. 
        // Real file storage might be in Storage Buckets.
        // For now, returning empty to prevent errors.
        const documents: any[] = [];
        /*
        try {
            const { data: docs, error: docError } = await adminAuthClient
                .from('documents')
                .select('*')
                // .eq('candidate_id', candidateId) // Column doesn't exist
                // .ilike('document_name', '%resume%')
                // .order('created_at', { ascending: false });
            
            if (docError) {
                console.error("Documents Fetch Error:", docError);
            } else {
                documents = docs || [];
            }
        } catch (e) {
            console.error("Document fetch exception:", e);
        }
        */

        const enhance = enhanceResult as any;
        const profileData = (profile as any) || {};

        // Combine Data
        const responseData = {
            ...profileData,
            // Map keys if necessary (e.g. if UI expects different names)
            // UI expects 'photo', 'name', 'email', 'mobile_phone', 'candidate_status'. These match DB columns exactly.
            // UI also expects 'experiences' array, 'jobHistory', etc.
            experiences: experiences || [],
            jobHistory: historyWithDetails || [],
            prescreenLogs: prescreenLogs || [],
            documents: documents || [],
            enhancement: enhance ? {
                about: enhance.about_summary,
                education_summary: enhance.education_summary,
                languages: enhance.languages,
                skills: enhance.skills_list,
                alt_email: enhance.email
            } : null
        };

        return NextResponse.json({ data: responseData });

    } catch (error: any) {
        console.error("Detail API Error:", error);
        return NextResponse.json({ error: error.message, details: error.toString() }, { status: 500 });
    }
}
