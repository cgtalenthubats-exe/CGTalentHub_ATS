
-- Add date_of_birth to candidate_profile
ALTER TABLE "public"."candidate_profile" ADD COLUMN IF NOT EXISTS "date_of_birth" DATE;
