export interface SearchJob {
    session_id: string;
    original_query: string;
    status: 'processing' | 'completed' | 'failed';
    timestamp: string;
    user_email: string;
    report?: any;
}

export interface ConsolidatedResult {
    id: string;
    session_id: string;
    source: 'internal_db' | 'external_db' | 'linkedin_db';
    candidate_ref_id: string;
    name: string;
    position: string;
    company: string;
    link_url?: string;
    source_url?: string;
    company_tier?: string;
    business_model?: string;
    match_score: number;
    scoring_breakdown?: {
        leadership?: number;
        scale?: number;
        innovation?: number;
        culture?: number;
        resilience?: number;
        [key: string]: any;
    };
    demographic_tag?: string;
    inferred_insights?: any;
    executive_summary?: string;
    red_flags?: string;
    created_at: string;
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
