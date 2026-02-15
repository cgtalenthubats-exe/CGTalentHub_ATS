export interface SearchJob {
    session_id: string;
    original_query: string;
    status: 'processing' | 'completed' | 'failed';
    timestamp: string;
    user_email: string;
    report?: any;
    internal_db_summary?: string;
    external_db_summary?: string;
}

export interface ConsolidatedResult {
    id: string;
    session_id: string;
    source: 'internal_db' | 'external_db';
    candidate_ref_id: string;
    name: string;
    position: string;
    company: string;
    link_url?: string;
    source_url?: string;
    company_tier?: string;
    business_model?: string;
    photo_url?: string;

    // New Score Structure
    final_total_score: number;
    match_score?: number; // Legacy support
    score_part_a: number;
    score_part_b: number;

    // New Analysis Fields
    gap_analysis?: string;
    highlight_project?: string;
    vision_strategy?: string;

    demographic_tag?: string;
    inferred_insights?: any; // Keeping for backward compatibility or generic bags
    executive_summary?: string;
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
    reference_link?: string;
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
