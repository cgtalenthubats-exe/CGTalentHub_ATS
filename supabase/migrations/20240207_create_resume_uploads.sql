
-- Create the resume_uploads table if it doesn't exist
CREATE TABLE IF NOT EXISTS resume_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resume_url TEXT,
  file_name TEXT,
  uploader_email TEXT,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, duplicate, failed
  candidate_id TEXT,
  note TEXT
);

-- Policy to allow authenticated uploads (optional, for safety)
-- create policy "Enable read access for all users" on "public"."resume_uploads"
-- as PERMISSIVE for SELECT
-- to public
-- using (true);

-- create policy "Enable insert for authenticated users only" on "public"."resume_uploads"
-- as PERMISSIVE for INSERT
-- to authenticated
-- with check (true);

-- create policy "Enable update for authenticated users only" on "public"."resume_uploads"
-- as PERMISSIVE for UPDATE
-- to authenticated
-- using (true);
