-- Add summary columns to search_jobs
ALTER TABLE public.search_jobs
ADD COLUMN IF NOT EXISTS internal_db_summary TEXT,
ADD COLUMN IF NOT EXISTS external_db_summary TEXT;

-- Update consolidated_results table
ALTER TABLE public.consolidated_results
DROP COLUMN IF EXISTS match_score,
DROP COLUMN IF EXISTS scoring_breakdown,
DROP COLUMN IF EXISTS red_flags,
ADD COLUMN IF NOT EXISTS final_total_score NUMERIC,
ADD COLUMN IF NOT EXISTS score_part_a NUMERIC, -- Profile Score
ADD COLUMN IF NOT EXISTS score_part_b NUMERIC, -- Criteria Score
ADD COLUMN IF NOT EXISTS gap_analysis TEXT,
ADD COLUMN IF NOT EXISTS highlight_project TEXT,
ADD COLUMN IF NOT EXISTS vision_strategy TEXT;
