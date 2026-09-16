-- Compensation & benefits: new fields + a way to say "has it, amount unknown"
--
-- Columns are numeric here even though the existing compensation columns on Candidate Profile
-- are text: the old ones carry values imported from CSV that were never cleaned, while these
-- start empty, so there is nothing to be lenient about.
--
-- dental_b_mth is a NEW column rather than a rename of medical_b_mth. Renaming would silently
-- reinterpret every monthly medical figure already entered as a dental figure. medical_b_mth
-- keeps its data and drops out of the entry form.
--
-- benefit_provided answers "does this person get it?" separately from "how much?". Without it,
-- "we know there is a provident fund but not the rate" and "there is no provident fund" both
-- look like an empty box, which is what made benefit coverage impossible to count.

alter table public."Candidate Profile"
    add column if not exists service_charge_b_mth       numeric,
    add column if not exists meal_allowance_b_mth       numeric,
    add column if not exists dental_b_mth               numeric,
    add column if not exists ipd_b_annual               numeric,
    add column if not exists opd_b_annual               numeric,
    add column if not exists annual_leave_days          integer,
    add column if not exists education_support_children integer,
    add column if not exists education_support_b_annual numeric,
    add column if not exists benefit_provided           jsonb;

comment on column public."Candidate Profile".service_charge_b_mth       is 'Hotel service charge, THB per month.';
comment on column public."Candidate Profile".meal_allowance_b_mth       is 'Meal allowance, THB per month.';
comment on column public."Candidate Profile".dental_b_mth               is 'Dental benefit, THB per month. Replaces medical_b_mth in the entry form.';
comment on column public."Candidate Profile".ipd_b_annual               is 'In-patient (IPD) cover, THB per year.';
comment on column public."Candidate Profile".opd_b_annual               is 'Out-patient (OPD) cover, THB per year.';
comment on column public."Candidate Profile".annual_leave_days          is 'Annual leave entitlement in days per year.';
comment on column public."Candidate Profile".education_support_children is 'Number of children the candidate would claim education support for.';
comment on column public."Candidate Profile".education_support_b_annual is 'Education support budget, THB per year (total, not per child).';
comment on column public."Candidate Profile".benefit_provided           is
    'Per-benefit tri-state keyed by field name: true = provided (amount may be unknown), false = confirmed none, key absent = not asked. The amount column holds the figure when it is known.';
