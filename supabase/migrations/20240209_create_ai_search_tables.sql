-- Create search_jobs table
CREATE TABLE IF NOT EXISTS public.search_jobs (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_query TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_email TEXT,
    report JSONB -- AI Summary/Report
);

-- Enable RLS for search_jobs (Optional - adjust policies as needed)
ALTER TABLE public.search_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON public.search_jobs FOR ALL USING (true) WITH CHECK (true);


-- Create ext_candidate_profile table (Clone of candidate_profile)
CREATE TABLE IF NOT EXISTS public.ext_candidate_profile (
    candidate_id TEXT PRIMARY KEY, -- Ext IDs might not be UUIDs initially? Or generate them. Let's assume Text for flexibility as per schema.
    name TEXT NOT NULL,
    photo_url TEXT,
    current_position TEXT,
    email TEXT,
    mobile_phone TEXT,
    linkedin TEXT,
    total_years_experience NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

ALTER TABLE public.ext_candidate_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON public.ext_candidate_profile FOR ALL USING (true) WITH CHECK (true);


-- Create ext_profile_enhance table (Clone of candidate_profile_enhance)
CREATE TABLE IF NOT EXISTS public.ext_profile_enhance (
    candidate_id TEXT PRIMARY KEY REFERENCES public.ext_candidate_profile(candidate_id) ON DELETE CASCADE,
    full_resume_text TEXT,
    skills_analysis JSONB, -- specific skills, soft skills etc
    ai_summary TEXT
);

ALTER TABLE public.ext_profile_enhance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON public.ext_profile_enhance FOR ALL USING (true) WITH CHECK (true);


-- Create ext_candidate_experiences table (Clone of candidate_experiences)
CREATE TABLE IF NOT EXISTS public.ext_candidate_experiences (
    experience_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id TEXT REFERENCES public.ext_candidate_profile(candidate_id) ON DELETE CASCADE,
    company_id TEXT, -- Might not link to internal company_master initially
    company_name_text TEXT NOT NULL,
    position TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT false,
    description TEXT
);

ALTER TABLE public.ext_candidate_experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON public.ext_candidate_experiences FOR ALL USING (true) WITH CHECK (true);


-- Create consolidated_results table
CREATE TABLE IF NOT EXISTS public.consolidated_results (
    result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.search_jobs(session_id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- 'External', 'Internal'
    candidate_id TEXT, -- Nullable, for Internal matches (FK to candidate_profile optionally, but keeping loose for now)
    ext_candidate_id TEXT, -- Nullable, for External matches (FK to ext_candidate_profile)
    name TEXT,
    position TEXT,
    company TEXT,
    company_tag TEXT,
    company_rating TEXT,
    match_score NUMERIC,
    key_highlights TEXT,
    professional_summary TEXT,
    key_skills JSONB,
    reason_for_match TEXT,
    link_url TEXT,
    
    CONSTRAINT fk_ext_candidate FOREIGN KEY (ext_candidate_id) REFERENCES public.ext_candidate_profile(candidate_id) ON DELETE SET NULL
);

ALTER TABLE public.consolidated_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON public.consolidated_results FOR ALL USING (true) WITH CHECK (true);
