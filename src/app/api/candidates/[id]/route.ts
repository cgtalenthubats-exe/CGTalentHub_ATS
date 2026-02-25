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

            const jobMap: Record<string, any> = {};
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
            const statusMap: Record<string, any> = {};
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
                        if (tA !== tB) return tB - tA; // Primary: Timestamp Descending

                        // Tie-breaker: Log ID (highest = latest)
                        return (parseInt(b.log_id) || 0) - (parseInt(a.log_id) || 0);
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

        // 6. Documents (Resume + Placeholder for others)
        const documents: any[] = [];

        // Add Main Resume if exists from Profile
        if ((profile as any)?.resume_url) {
            const url = (profile as any).resume_url;
            const fileName = url.split('/').pop() || "Resume.pdf";
            documents.push({
                document_name: "Main Resume (" + (fileName.length > 20 ? fileName.substring(0, 17) + "..." : fileName) + ")",
                file_url: url,
                type: "resume",
                created_at: (profile as any).modify_date || (profile as any).created_date
            });
        }

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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const candidateId = (await params).id;
    if (!candidateId) {
        return NextResponse.json({ error: "Candidate ID is required" }, { status: 400 });
    }

    try {
        const body = await req.json();
        const { candidate_status, resume_url, name, email, mobile_phone, linkedin, ...otherFields } = body;

        // Construct update object for 'Candidate Profile'
        const updateData: any = {};
        if (candidate_status !== undefined) updateData.candidate_status = candidate_status;
        if (resume_url !== undefined) updateData.resume_url = resume_url;
        if (body.photo !== undefined) updateData.photo = body.photo;
        if (body.blacklist_note !== undefined) updateData.blacklist_note = body.blacklist_note;

        // Map other fields carefully to match DB columns
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (mobile_phone !== undefined) updateData.mobile_phone = mobile_phone;
        if (linkedin !== undefined) updateData.linkedin = linkedin;

        // Add timestamp if available in schema (modify_date)
        updateData.modify_date = new Date().toISOString();

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ message: "No fields to update" });
        }

        const { error } = await (adminAuthClient
            .from('Candidate Profile') as any)
            .update(updateData)
            .eq('candidate_id', candidateId);

        if (error) {
            console.error("Update Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Candidate updated successfully" });

    } catch (error: any) {
        console.error("PATCH API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const candidateId = (await params).id;
    if (!candidateId) {
        return NextResponse.json({ error: 'Candidate ID is required' }, { status: 400 });
    }

    try {
        // Step 1: Get all jr_candidate_ids for this candidate
        const { data: jrCandidates, error: jrcFetchError } = await adminAuthClient
            .from('jr_candidates')
            .select('jr_candidate_id')
            .eq('candidate_id', candidateId);

        if (jrcFetchError) throw new Error('Failed to fetch jr_candidates: ' + jrcFetchError.message);

        const jrCandidateIds = (jrCandidates || []).map((r: any) => r.jr_candidate_id).filter(Boolean);

        // Step 2: Delete status_log entries for these jr_candidate_ids
        if (jrCandidateIds.length > 0) {
            const { error: statusLogError } = await adminAuthClient
                .from('status_log')
                .delete()
                .in('jr_candidate_id', jrCandidateIds);
            if (statusLogError) throw new Error('Failed to delete status_log: ' + statusLogError.message);
        }

        // Step 3: Delete jr_candidates
        const { error: jrcDeleteError } = await adminAuthClient
            .from('jr_candidates')
            .delete()
            .eq('candidate_id', candidateId);
        if (jrcDeleteError) throw new Error('Failed to delete jr_candidates: ' + jrcDeleteError.message);

        // Step 4: Delete candidate_experiences
        const { error: expDeleteError } = await adminAuthClient
            .from('candidate_experiences')
            .delete()
            .eq('candidate_id', candidateId);
        if (expDeleteError) throw new Error('Failed to delete candidate_experiences: ' + expDeleteError.message);

        // Step 5: Delete candidate_profile_enhance
        const { error: enhDeleteError } = await adminAuthClient
            .from('candidate_profile_enhance')
            .delete()
            .eq('candidate_id', candidateId);
        if (enhDeleteError) throw new Error('Failed to delete candidate_profile_enhance: ' + enhDeleteError.message);

        // Step 6: Delete pre_screen_log
        const { error: preScreenDeleteError } = await adminAuthClient
            .from('pre_screen_log')
            .delete()
            .eq('candidate_id', candidateId);
        if (preScreenDeleteError) throw new Error('Failed to delete pre_screen_log: ' + preScreenDeleteError.message);

        // Step 7: Delete Candidate Profile (last)
        const { error: profileDeleteError } = await adminAuthClient
            .from('Candidate Profile')
            .delete()
            .eq('candidate_id', candidateId);
        if (profileDeleteError) throw new Error('Failed to delete Candidate Profile: ' + profileDeleteError.message);

        console.log(`[API] Cascade deleted candidate ${candidateId}: ${jrCandidateIds.length} jr_candidates, status_logs, experiences, enhance, pre_screen_log`);
        return NextResponse.json({ success: true, message: 'Candidate and all related data deleted successfully' });

    } catch (error: any) {
        console.error('[API] DELETE Candidate Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
