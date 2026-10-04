-- Which experience the compensation/benefit figures on this candidate were reported for.
--
-- Compensation stays one record per candidate — splitting every benefit field per experience
-- was judged too large a change for the value it adds. This single pointer just answers
-- "which job was this salary/benefit data for", so a recruiter can tell at a glance instead of
-- guessing. Stored as text (not a typed FK) so it tolerates whatever id type
-- candidate_experiences.id actually is without a migration-time cast risk; the app treats it as
-- a plain id lookup, not a constrained relationship.
alter table public."Candidate Profile"
    add column if not exists compensation_experience_id text;

comment on column public."Candidate Profile".compensation_experience_id is
    'candidate_experiences.id this compensation/benefit data was reported for. Null = not yet specified by the recruiter.';
