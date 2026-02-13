-- Create search_job_status table
CREATE TABLE IF NOT EXISTS public.search_job_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL REFERENCES public.search_jobs(session_id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- 'Internal_db', 'external_db', 'linkedin_db'
    summary_agent_1 TEXT, -- e.g. "ค้นหาจาก 84 บริษัท"
    summary_agent_2 TEXT,
    summary_agent_3 TEXT,
    summary_agent_4 TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure source is unique per session
    CONSTRAINT unique_session_source UNIQUE (session_id, source)
);

-- Enable RLS
ALTER TABLE public.search_job_status ENABLE ROW LEVEL SECURITY;

-- Policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'search_job_status' AND policyname = 'Enable all access for authenticated users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users" ON public.search_job_status FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;
