-- JR salary budget + stage ownership
--
-- 1. job_requisitions.budget_*  — the Salary Benchmark tab had no idea what the role is
--    budgeted at, so it could show market data but never answer "are we competitive?".
--    Stored as monthly basic salary in THB to match Candidate Profile.gross_salary_base_b_mth.
--    budget_max is optional: a single figure is entered as budget_min only.
--
-- 2. status_master.owner_role — who is expected to act while a candidate sits in a status.
--    Lets the Stage Aging view split waiting time between the recruiting team, the hiring
--    team and the candidate. Leave NULL for statuses where it doesn't apply; the UI groups
--    those under "Unassigned".

alter table public.job_requisitions
    add column if not exists budget_min  numeric,
    add column if not exists budget_max  numeric,
    add column if not exists budget_note text;

alter table public.status_master
    add column if not exists owner_role text;

comment on column public.job_requisitions.budget_min  is 'Approved monthly basic salary budget (THB). Lower bound, or the single figure.';
comment on column public.job_requisitions.budget_max  is 'Approved monthly basic salary budget (THB), upper bound. NULL when the budget is a single figure.';
comment on column public.job_requisitions.budget_note is 'Free text about the budget (approval reference, package notes).';
comment on column public.status_master.owner_role     is 'Who owns the next action while a candidate sits in this status: TA | Hiring Team | Candidate. NULL = unassigned.';
