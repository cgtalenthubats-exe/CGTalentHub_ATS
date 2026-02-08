export interface SearchJob {
    session_id: string;
    original_query: string;
    status: 'processing' | 'completed' | 'failed';
    timestamp: string;
    user_email: string;
    report?: any;
}

export interface ConsolidatedResult {
    result_id: string;
    session_id: string;
    source: 'External' | 'Internal';
    candidate_id?: string;
    ext_candidate_id?: string;
    name: string;
    position: string;
    company: string;
    company_tag?: string;
    company_rating?: string;
    match_score: number;
    key_highlights?: string;
    professional_summary?: string;
    key_skills?: any;
    reason_for_match?: string;
    link_url?: string;
}

export interface ExternalCandidateDetail {
    candidate_id: string;
    name: string;
    photo_url?: string;
    current_position?: string;
    email?: string;
    mobile_phone?: string;
    linkedin?: string;
    total_years_experience?: number;
    full_resume_text?: string;
    skills_analysis?: any;
    ai_summary?: string;
    experiences: ExternalExperience[];
}

export interface ExternalExperience {
    experience_id: string;
    candidate_id: string;
    company_name_text: string;
    position: string;
    start_date?: string;
    end_date?: string;
    is_current: boolean;
    description?: string;
}
