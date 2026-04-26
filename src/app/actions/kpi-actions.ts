"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export interface KPICandidateSource {
    candidate_id: string;
    created_by: string;
    created_date: string;
}

export interface KPIPreScreen {
    candidate_id: string;
    screener_Name: string;
    screening_date: string;
}

export interface KPIInterview {
    jr_candidate_id: number;
    Interviewer_name: string;
    interview_date: string;
    Interviewer_type: string;
}

export interface KPIJobRequisition {
    jr_id: string;
    create_by: string;
    status_jr: string;
    created_at: string;
}

export interface KPIUserProfile {
    email: string;
    real_name: string;
}

export interface KPIRawData {
    sourcing: KPICandidateSource[];
    prescreens: KPIPreScreen[];
    interviews: KPIInterview[];
    jrs: KPIJobRequisition[];
    profiles: KPIUserProfile[];
}

export async function getKPIData(): Promise<KPIRawData> {
    const supabase = adminAuthClient;

    async function fetchAll(table: string, columns: string) {
        let allData: any[] = [];
        let start = 0;
        const PAGE_SIZE = 1000;
        
        while (true) {
            const { data, error } = await (supabase.from(table as any) as any)
                .select(columns)
                .range(start, start + PAGE_SIZE - 1);
                
            if (error) {
                console.error(`Error fetching ${table}:`, error);
                break;
            }
            
            if (data) {
                allData = [...allData, ...data];
            }
            
            if (!data || data.length < PAGE_SIZE) {
                break;
            }
            
            start += PAGE_SIZE;
        }
        
        return allData;
    }

    const [sourceData, preScreenData, interviewData, jrData, profileRes] = await Promise.all([
        fetchAll('Candidate Profile', 'candidate_id, created_by, created_date'),
        fetchAll('pre_screen_log', 'candidate_id, "screener_Name", screening_date'),
        fetchAll('interview_feedback', 'jr_candidate_id, "Interviewer_name", interview_date, "Interviewer_type"'),
        fetchAll('job_requisitions', 'jr_id, create_by, status_jr, created_at'),
        supabase.from('user_profiles').select('email, real_name')
    ]);

    return {
        sourcing: sourceData as KPICandidateSource[],
        prescreens: preScreenData as KPIPreScreen[],
        interviews: interviewData as KPIInterview[],
        jrs: jrData as KPIJobRequisition[],
        profiles: (profileRes.data || []) as KPIUserProfile[],
    };
}
