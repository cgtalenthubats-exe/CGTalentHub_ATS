-- Search-suggestion lookups use `ilike '%term%'`, and a leading wildcard makes a btree
-- index unusable, so both of these were sequential scans:
--
--   "Candidate Profile" name/email/candidate_id : 336 ms, 11,851 rows discarded
--   company_variation.variation_name            : 390 ms, 26,495 rows discarded
--
-- candidate_experiences.position already has a trigram index and the same lookup there
-- runs in 148 ms. These bring the other two in line.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_candidate_profile_name_trgm
    ON "Candidate Profile" USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_candidate_profile_email_trgm
    ON "Candidate Profile" USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_company_variation_name_trgm
    ON company_variation USING gin (variation_name gin_trgm_ops);
