"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export interface KPIDetailCandidate {
    candidate_id: string;
    created_date: string;
    first_name: string;
    last_name: string;
    position: string;
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
    jr_title: string;
    jr_id: string;
    candidate_id: string;
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

export async function getRecruiterKPIDetails(targetRecruiterName: string): Promise<KPIDetailResult> {
    const supabase = adminAuthClient;

    // 1. Build Alias Map (same logic as page.tsx to ensure consistency)
    const { data: profiles } = await supabase.from('user_profiles').select('email, real_name');
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

    const isMatch = (identifier: string | null) => {
        return resolveRecruiterName(identifier) === targetRecruiterName;
    };

    // 2. Fetch all raw data first
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

    // Fetch Base Tables
    const [allProfiles, allPreScreens, allInterviews, allJRs] = await Promise.all([
        fetchAll('Candidate Profile', 'candidate_id, created_by, created_date, name, level'),
        fetchAll('pre_screen_log', 'candidate_id, "screener_Name", screening_date'),
        fetchAll('interview_feedback', 'jr_candidate_id, "Interviewer_name", interview_date, "Interviewer_type"'),
        fetchAll('job_requisitions', 'jr_id, create_by, status_jr, created_at, position_jr'),
    ]);

    // 3. Filter for specific recruiter
    const mySourcing = allProfiles.filter(p => isMatch(p.created_by));
    const myPreScreens = allPreScreens.filter(p => isMatch(p.screener_Name));
    const myInterviews = allInterviews.filter(i => i.Interviewer_type === 'Recruiter' && isMatch(i.Interviewer_name));
    const myJRs = allJRs.filter(j => isMatch(j.create_by));

    // 4. Enrich PreScreens with Candidate Names
    const myPreScreenEnriched: KPIDetailPreScreen[] = myPreScreens.map(p => {
        const candidate = allProfiles.find(c => c.candidate_id === p.candidate_id);
        const nameParts = (candidate?.name || "Unknown").split(' ');
        return {
            candidate_id: p.candidate_id,
            screening_date: p.screening_date,
            first_name: nameParts[0] || "Unknown",
            last_name: nameParts.slice(1).join(' ') || "",
        };
    });

    // 5. Enrich Interviews with JR details and Candidate Names
    // We need jr_candidates to map jr_candidate_id -> jr_id & candidate_id
    const myInterviewJrCandidateIds = myInterviews.map(i => i.jr_candidate_id);
    let jrCandidateMap = new Map<number, any>();
    
    if (myInterviewJrCandidateIds.length > 0) {
        // Fetch in batches to avoid URL limits if too many
        const { data: jrcs } = await supabase
            .from('jr_candidates')
            .select('id, jr_id, candidate_id')
            .in('id', myInterviewJrCandidateIds);
            
        if (jrcs) {
            jrcs.forEach(j => jrCandidateMap.set(j.id, j));
        }
    }

    const myInterviewEnriched: KPIDetailInterview[] = myInterviews.map(i => {
        const jrc = jrCandidateMap.get(i.jr_candidate_id);
        const candidate = jrc ? allProfiles.find(c => c.candidate_id === jrc.candidate_id) : null;
        const jr = jrc ? allJRs.find(j => j.jr_id === jrc.jr_id) : null;
        const nameParts = (candidate?.name || "Unknown").split(' ');
        
        return {
            jr_candidate_id: i.jr_candidate_id,
            interview_date: i.interview_date,
            candidate_first_name: nameParts[0] || "Unknown",
            candidate_last_name: nameParts.slice(1).join(' ') || "",
            jr_title: jr?.position_jr || "Unknown Position",
            jr_id: jrc?.jr_id || "",
            candidate_id: jrc?.candidate_id || "",
        };
    });

    // 6. Return mapped results
    return {
        sourcing: mySourcing.map(p => {
            const nameParts = (p.name || "Unknown").split(' ');
            return {
                candidate_id: p.candidate_id,
                created_date: p.created_date,
                first_name: nameParts[0] || "Unknown",
                last_name: nameParts.slice(1).join(' ') || "",
                position: p.level || "Unknown Position"
            };
        }),
        prescreens: myPreScreenEnriched,
        interviews: myInterviewEnriched,
        jrs: myJRs.map(j => ({
            jr_id: j.jr_id,
            position_jr: j.position_jr || "Unknown Position",
            status_jr: j.status_jr,
            created_at: j.created_at
        }))
    };
}
