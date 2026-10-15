alter table candidate_experiences
  add column is_primary_current boolean not null default false;

-- guarantee at most one primary per candidate at the DB level
create unique index candidate_experiences_one_primary_current_idx
  on candidate_experiences (candidate_id)
  where is_primary_current = true;

comment on column candidate_experiences.is_primary_current is
  'Single chosen "current" experience per candidate, for display/consumption sites that need exactly one value. Independent from is_current_job/end_date=Present, which stay factual and can be true on multiple rows (genuinely concurrent jobs). Not yet backfilled or read anywhere in the app as of this migration.';
