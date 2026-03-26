-- Migration: Convert Salary/Compensation columns to NUMERIC
-- Date: 2026-03-26

-- 1. Clean existing data (Remove commas and non-numeric characters)
-- We use regexp_replace to keep only digits and decimal points.
-- Empty results are converted to NULL.
UPDATE "Candidate Profile"
SET 
  gross_salary_base_b_mth = NULLIF(regexp_replace(gross_salary_base_b_mth, '[^0-9.]', '', 'g'), ''),
  other_income = NULLIF(regexp_replace(other_income, '[^0-9.]', '', 'g'), ''),
  car_allowance_b_mth = NULLIF(regexp_replace(car_allowance_b_mth, '[^0-9.]', '', 'g'), ''),
  gasoline_b_mth = NULLIF(regexp_replace(gasoline_b_mth, '[^0-9.]', '', 'g'), ''),
  phone_b_mth = NULLIF(regexp_replace(phone_b_mth, '[^0-9.]', '', 'g'), ''),
  medical_b_annual = NULLIF(regexp_replace(medical_b_annual, '[^0-9.]', '', 'g'), ''),
  medical_b_mth = NULLIF(regexp_replace(medical_b_mth, '[^0-9.]', '', 'g'), ''),
  housing_for_expat_b_mth = NULLIF(regexp_replace(housing_for_expat_b_mth, '[^0-9.]', '', 'g'), '');

-- 2. Alter column types to NUMERIC
ALTER TABLE "Candidate Profile" 
  ALTER COLUMN gross_salary_base_b_mth TYPE NUMERIC USING gross_salary_base_b_mth::NUMERIC,
  ALTER COLUMN other_income TYPE NUMERIC USING other_income::NUMERIC,
  ALTER COLUMN car_allowance_b_mth TYPE NUMERIC USING car_allowance_b_mth::NUMERIC,
  ALTER COLUMN gasoline_b_mth TYPE NUMERIC USING gasoline_b_mth::NUMERIC,
  ALTER COLUMN phone_b_mth TYPE NUMERIC USING phone_b_mth::NUMERIC,
  ALTER COLUMN medical_b_annual TYPE NUMERIC USING medical_b_annual::NUMERIC,
  ALTER COLUMN medical_b_mth TYPE NUMERIC USING medical_b_mth::NUMERIC,
  ALTER COLUMN housing_for_expat_b_mth TYPE NUMERIC USING housing_for_expat_b_mth::NUMERIC;
