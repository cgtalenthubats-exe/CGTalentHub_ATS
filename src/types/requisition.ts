export interface JobRequisition {
    id: string; // jr_id
    job_title: string;
    hiring_manager_id: string;
    hiring_manager_name?: string; // Joined
    department: string;
    division: string; // Business Unit
    status: 'Open' | 'Closed' | 'On Hold' | 'Draft';
    headcount_total: number;
    headcount_hired: number;
    opened_date: string;
    target_date?: string;
    is_active: boolean;
    location?: string;
    job_description?: string;
    created_at: string;
    updated_at: string;
    title: string; // Alias for job_title
    jr_type: string; // New or Replacement
    created_by?: string;
}

export interface JRCandidate {
    id: string; // jr_candidate_id
    jr_id: string;
    candidate_id: string;
    status: string; // temp_status
    source: string; // list_type (Top Profile / Long List / Manual)
    list_type?: string;
    rank?: string;
    created_at: string;
    updated_at: string;

    // Joined Fields (for UI)
    candidate_name?: string;
    candidate_email?: string;
    candidate_mobile?: string;
    candidate_current_position?: string; // job_function
    candidate_current_company?: string;
    candidate_image_url?: string; // photo
    candidate_age?: number;
    candidate_gender?: string;
}

export interface JRAnalytics {
    countsByStatus: { status: string; count: number }[];
    agingByStatus: { status: string; avgDays: number }[];
}

export interface StatusLog {
    id: string; // log_id
    jr_candidate_id: string;
    status_from: string;
    status_to: string;
    changed_by: string; // user_id or name
    changed_at: string;
    remark?: string;
}

export interface InterviewFeedback {
    id: string; // feedback_id
    jr_candidate_id: string;
    interviewer_id: string;
    interviewer_name: string;
    round: string; // "1", "2", "Final"
    rating: number; // 1-5 or 1-10
    recommendation: 'Strong Hire' | 'Hire' | 'No Hire' | 'Strong No Hire';
    comments: string; // Rich Text (HTML)
    created_at: string;
    updated_at: string;
}

export interface DashboardStats {
    total_jrs: number;
    active_jrs: number;
    total_candidates: number;
    avg_aging_days: number;
    candidates_by_status: { status: string; count: number }[];
    aging_by_stage: { stage: string; days: number }[];
}
