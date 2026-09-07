"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export interface KPIDetailExperience {
    id: number;
    position: string;
    company: string;
    country: string;
    start_date: string;
    end_date: string;
    is_current_job: string;
    company_industry?: string;
}

export interface KPIDetailCandidate {
    candidate_id: string;
    created_date: string;
    name: string;
    job_grouping?: string;
    job_function?: string;
    photo?: string;
    nationality?: string;
    age?: number | null;
    gender?: string;
    candidate_status?: string[] | null;
    experiences: KPIDetailExperience[];
}

export interface KPIDetailPreScreen {
    candidate_id: string;
    screening_date: string;
    first_name: string;
    last_name: string;
}

export interface KPIDetailInterview {
    jr_candidate_id: number;
    interview_date: string;
    candidate_first_name: string;
    candidate_last_name: string;
    candidate_id: string;
    jr_title: string;
    jr_id: string;
}

export interface KPIDetailJR {
    jr_id: string;
    position_jr: string;
    status_jr: string;
    created_at: string;
}

export interface KPIDetailResult {
    sourcing: KPIDetailCandidate[];
    prescreens: KPIDetailPreScreen[];
    interviews: KPIDetailInterview[];
    jrs: KPIDetailJR[];
}

export async function getRecruiterKPIDetails(targetRecruiterName: string, fys?: number[]): Promise<KPIDetailResult> {
    const supabase = adminAuthClient;

    // 1. Build Alias Map
    const { data: profiles } = await (supabase as any).from('user_profiles').select('email, real_name') as { data: { email: string; real_name: string }[] | null };
    const profileMap = new Map<string, string>();
    if (profiles) {
        profiles.forEach(p => {
            if (p.email) profileMap.set(p.email.toLowerCase().trim(), p.real_name);
            if (p.real_name) profileMap.set(p.real_name.toLowerCase().trim(), p.real_name);
        });
    }

    const customAliases: Record<string, string> = {
        "system import": "Admin2",
        "admin@cgtalent.com": "Admin2",
        "admin2": "Admin2"
    };

    const resolveRecruiterName = (identifier: string | null) => {
        const safeIdentifier = identifier || "Unknown";
        const rawStr = safeIdentifier.toLowerCase().trim();
        if (customAliases[rawStr]) return customAliases[rawStr];
        let displayName = profileMap.get(rawStr) || safeIdentifier;
        if (!displayName.includes('@') && displayName !== "Unknown") {
            displayName = displayName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }
        return displayName;
    };

    const isMatch = (identifier: string | null) => resolveRecruiterName(identifier) === targetRecruiterName;

    // 2. Paginated fetch helper
    async function fetchAll(table: string, columns: string) {
        let allData: any[] = [];
        let start = 0;
        const PAGE_SIZE = 1000;
        while (true) {
            const { data, error } = await (supabase.from(table as any) as any)
                .select(columns)
                .range(start, start + PAGE_SIZE - 1);
            if (error) break;
            if (data) allData = [...allData, ...data];
            if (!data || data.length < PAGE_SIZE) break;
            start += PAGE_SIZE;
        }
        return allData;
    }

    const inFY = (dateStr: string | null) => {
        if (!fys?.length || !dateStr) return true;
        const d = new Date(dateStr);
        return !isNaN(d.getTime()) && fys.includes(d.getFullYear());
    };

    // 3. Fetch base tables
    const [allCandidateProfiles, allPreScreens, allInterviews, allJRs] = await Promise.all([
        fetchAll('Candidate Profile', 'candidate_id, created_by, created_date, name, job_function, job_grouping, photo, nationality, age, gender, candidate_status'),
        fetchAll('pre_screen_log', 'candidate_id, "screener_Name", screening_date'),
        fetchAll('interview_feedback', 'jr_candidate_id, "Interviewer_name", interview_date, "Interviewer_type"'),
        fetchAll('job_requisitions', 'jr_id, create_by, status_jr, created_at, position_jr'),
    ]);

    // Build JR lookup map
    const jrMap = new Map<string, any>();
    allJRs.forEach(j => jrMap.set(String(j.jr_id).trim(), j));

    // 4. Filter per recruiter + FY
    const mySourcing = allCandidateProfiles.filter(p => isMatch(p.created_by) && inFY(p.created_date));
    const myPreScreens = allPreScreens.filter(p => isMatch(p.screener_Name) && inFY(p.screening_date));
    const myInterviews = allInterviews.filter(i => i.Interviewer_type === 'Recruiter' && isMatch(i.Interviewer_name) && inFY(i.interview_date));
    const myJRs = allJRs.filter(j => isMatch(j.create_by) && inFY(j.created_at));

    // 5. Fetch experiences for sourced candidates (targeted)
    const sourcingIds = mySourcing.map(p => p.candidate_id);
    const expMap = new Map<string, KPIDetailExperience[]>();
    if (sourcingIds.length > 0) {
        // Fetch in batches of 500 to avoid URL limits
        for (let i = 0; i < sourcingIds.length; i += 500) {
            const batch = sourcingIds.slice(i, i + 500);
            const { data: exps } = await (supabase as any)
                .from('candidate_experiences')
                .select('id, candidate_id, position, company, country, start_date, end_date, is_current_job, company_industry')
                .in('candidate_id', batch) as { data: any[] | null };
            if (exps) {
                exps.forEach((e: any) => {
                    if (!expMap.has(e.candidate_id)) expMap.set(e.candidate_id, []);
                    expMap.get(e.candidate_id)!.push({
                        id: e.id,
                        position: e.position || '',
                        company: e.company || '',
                        country: e.country || '',
                        start_date: e.start_date || '',
                        end_date: e.end_date || '',
                        is_current_job: e.is_current_job || '',
                        company_industry: e.company_industry,
                    });
                });
            }
        }
    }

    // 6. Enrich interviews with jr_candidates → JR details + candidate name
    const myInterviewJrcIds = myInterviews.map(i => i.jr_candidate_id);
    const jrCandidateMap = new Map<number, { jr_candidate_id: number; jr_id: string; candidate_id: string }>();

    if (myInterviewJrcIds.length > 0) {
        const { data: jrcs } = await (supabase as any)
            .from('jr_candidates')
            .select('jr_candidate_id, jr_id, candidate_id')
            .in('jr_candidate_id', myInterviewJrcIds) as { data: any[] | null };

        if (jrcs) {
            jrcs.forEach((j: any) => jrCandidateMap.set(j.jr_candidate_id, j));

            // Fetch JR details for these specific jr_ids (avoids allJRs miss on type mismatch)
            const neededJrIds = [...new Set(jrcs.map((j: any) => String(j.jr_id).trim()))];
            if (neededJrIds.length > 0) {
                const { data: jrDetails } = await (supabase as any)
                    .from('job_requisitions')
                    .select('jr_id, position_jr')
                    .in('jr_id', neededJrIds) as { data: any[] | null };
                if (jrDetails) {
                    jrDetails.forEach((j: any) => jrMap.set(String(j.jr_id).trim(), j));
                }
            }
        }
    }

    // Build candidate name map for interview enrichment
    const candidateNameMap = new Map<string, string>();
    allCandidateProfiles.forEach(p => candidateNameMap.set(p.candidate_id, p.name || 'Unknown'));

    // 7. Assemble results
    const sourcingResult: KPIDetailCandidate[] = mySourcing.map(p => ({
        candidate_id: p.candidate_id,
        created_date: p.created_date,
        name: p.name || '',
        job_grouping: p.job_grouping || undefined,
        job_function: p.job_function || undefined,
        photo: p.photo || undefined,
        nationality: p.nationality || undefined,
        age: p.age ?? null,
        gender: p.gender || undefined,
        candidate_status: Array.isArray(p.candidate_status) ? p.candidate_status : (p.candidate_status ? [p.candidate_status] : null),
        experiences: expMap.get(p.candidate_id) || [],
    }));

    const prescreenResult: KPIDetailPreScreen[] = myPreScreens.map(p => {
        const name = candidateNameMap.get(p.candidate_id) || 'Unknown';
        const parts = name.split(' ');
        return {
            candidate_id: p.candidate_id,
            screening_date: p.screening_date,
            first_name: parts[0] || 'Unknown',
            last_name: parts.slice(1).join(' ') || '',
        };
    });

    const interviewResult: KPIDetailInterview[] = myInterviews.map(i => {
        const jrc = jrCandidateMap.get(i.jr_candidate_id);
        const candidateName = jrc ? (candidateNameMap.get(jrc.candidate_id) || 'Unknown') : 'Unknown';
        const parts = candidateName.split(' ');
        const jr = jrc ? jrMap.get(String(jrc.jr_id).trim()) : null;
        return {
            jr_candidate_id: i.jr_candidate_id,
            interview_date: i.interview_date,
            candidate_first_name: parts[0] || 'Unknown',
            candidate_last_name: parts.slice(1).join(' ') || '',
            candidate_id: jrc?.candidate_id || '',
            jr_title: jr?.position_jr || 'Unknown Position',
            jr_id: jrc?.jr_id || '',
        };
    });

    return {
        sourcing: sourcingResult,
        prescreens: prescreenResult,
        interviews: interviewResult,
        jrs: myJRs.map(j => ({
            jr_id: j.jr_id,
            position_jr: j.position_jr || 'Unknown Position',
            status_jr: j.status_jr,
            created_at: j.created_at,
        })),
    };
}
