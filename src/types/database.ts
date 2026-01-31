export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            candidate_profile: {
                Row: {
                    candidate_id: string
                    name: string
                    photo_url?: string | null
                    current_position?: string | null
                    email: string | null
                    mobile_phone: string | null
                    linkedin?: string | null
                    total_years_experience?: number | null
                    created_at: string
                    updated_at?: string | null
                }
            }
            candidate_profile_enhance: {
                Row: {
                    candidate_id: string
                    full_resume_text?: string | null
                    skills_analysis?: Json | null
                    ai_summary?: string | null
                }
            }
            pre_screen_log: {
                Row: {
                    log_id: string
                    candidate_id: string
                    note: string
                    created_by: string
                    created_at: string
                }
            }
            company_master: {
                Row: {
                    company_id: string
                    company_name: string
                    industry: string | null
                    group: string | null
                    logo_url?: string | null
                }
            }
            company_variation: {
                Row: {
                    variation_id: string
                    company_id: string
                    variation_name: string
                }
            }
            candidate_experiences: {
                Row: {
                    experience_id: string
                    candidate_id: string
                    company_id?: string | null
                    company_name_text: string
                    position: string
                    start_date: string | null
                    end_date: string | null
                    is_current: boolean
                    description?: string | null
                }
            }
            job_requisitions: {
                Row: {
                    jr_id: string
                    position_title: string
                    department: string | null
                    status: string // Open, Closed, On Hold
                    target_hire_date?: string | null
                    created_at: string
                }
            }
            jr_candidates: {
                Row: {
                    jr_candidate_id: string
                    jr_id: string
                    candidate_id: string
                    pipeline_status: string // e.g., 'Applied', 'Screening', 'Interview'
                    rank?: number | null
                    list_type?: string | null
                    created_at: string
                }
            }
            status_master: {
                Row: {
                    status: string
                    stage_order: number
                    color_code?: string | null
                }
            }
            status_log: {
                Row: {
                    log_id: string
                    jr_candidate_id: string
                    previous_status: string | null
                    new_status: string
                    changed_by: string
                    timestamp: string
                }
            }
            interview_feedback: {
                Row: {
                    feedback_id: string
                    jr_candidate_id: string
                    interviewer_id: string
                    rating: number
                    comments: string
                    created_at: string
                }
            }
        }
    }
}
