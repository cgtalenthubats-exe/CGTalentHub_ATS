-- SQL Reference: Unified Data Cleansing RPC (v1.0)
-- Combines Location Discovery, Company Linkage, and Metadata Sync.
-- For use in n8n or manual execution in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.fn_process_unified_cleansing()
RETURNS void AS $$
BEGIN
    -- ==========================================
    -- PHASE 1: LOCATION ONBOARDING & DISCOVERY
    -- ==========================================

    -- 1. [ONBOARDING] New location names
    INSERT INTO unique_location_name (unique_location, country)
    SELECT DISTINCT ce.work_location, 'Wait AI check'
    FROM candidate_experiences ce
    WHERE ce.work_location IS NOT NULL 
      AND ce.work_location != ''
      AND NOT EXISTS (
        SELECT 1 FROM unique_location_name uln 
        WHERE uln.unique_location = ce.work_location
      )
    ON CONFLICT DO NOTHING;

    -- 2. [ONBOARDING] New company-based location references
    INSERT INTO company_reference_location (company, unique_location)
    SELECT DISTINCT ce.company, 'Wait AI check'
    FROM candidate_experiences ce
    WHERE ce.company IS NOT NULL
      AND ce.company != ''
      AND (ce.work_location IS NULL OR ce.work_location = '')
      AND ce.country IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM company_reference_location crl 
        WHERE crl.company = ce.company
      )
    ON CONFLICT DO NOTHING;

    -- 3. [SMART DISCOVERY] Resolve countries via substring match
    UPDATE unique_location_name uln
    SET country = sub.found_country
    FROM (
        SELECT uln_inner.id, MAX(c.country) as found_country
        FROM unique_location_name uln_inner
        JOIN country c ON uln_inner.unique_location ILIKE '%' || c.country || '%'
        WHERE uln_inner.country = 'Wait AI check'
        GROUP BY uln_inner.id
        HAVING COUNT(DISTINCT c.country) = 1
    ) sub
    WHERE uln.id = sub.id;

    -- 4. [SMART DISCOVERY] Resolve HQ locations via company name match
    UPDATE company_reference_location crl
    SET unique_location = sub.found_country
    FROM (
        SELECT crl_inner.id, MAX(c.country) as found_country
        FROM company_reference_location crl_inner
        JOIN country c ON crl_inner.company ILIKE '%' || c.country || '%'
        WHERE crl_inner.unique_location = 'Wait AI check'
        GROUP BY crl_inner.id
        HAVING COUNT(DISTINCT c.country) = 1
    ) sub
    WHERE crl.id = sub.id;

    -- ==========================================
    -- PHASE 2: DATA SYNC TO EXPERIENCES
    -- ==========================================

    -- 5. [SYNC] Push countries from Location Input
    UPDATE candidate_experiences ce
    SET 
      country = uln.country,
      note = trim(concat(COALESCE(ce.note, ''), E'\n', 'Location from profile input by candidate'))
    FROM unique_location_name uln
    WHERE ce.work_location = uln.unique_location
      AND (ce.country IS NULL OR ce.country = '')
      AND uln.country IS NOT NULL 
      AND uln.country != 'Wait AI check';

    -- 6. [SYNC] Push countries from HQ Reference
    UPDATE candidate_experiences ce
    SET 
      country = crl.unique_location,
      note = trim(concat(COALESCE(ce.note, ''), E'\n', 'Location from HQ location'))
    FROM company_reference_location crl
    WHERE ce.company = crl.company
      AND (ce.country IS NULL OR ce.country = '')
      AND (ce.work_location IS NULL OR ce.work_location = '')
      AND crl.unique_location IS NOT NULL 
      AND crl.unique_location != 'Wait AI check';

    -- ==========================================
    -- PHASE 3: COMPANY ID & METADATA SYNC
    -- ==========================================

    -- 7. [SYNC] Link Company ID via Variations (Aggressive Normalization)
    UPDATE candidate_experiences ce
    SET company_id = cv.company_id::bigint -- Assignment must match column type (bigint)
    FROM company_variation cv
    WHERE LOWER(regexp_replace(ce.company, '[^a-z0-9ก-๙]', '', 'g')) = LOWER(regexp_replace(cv.variation_name, '[^a-z0-9ก-๙]', '', 'g'))
    AND (ce.company_id IS NULL OR ce.company_id::text != cv.company_id::text); -- Comparison is safer as text

    -- 8. [SYNC] Enrich Metadata (Industry & Group) from Master
    UPDATE candidate_experiences ce
    SET 
      company_industry = cm.industry,
      company_group = cm.group
    FROM company_master cm
    WHERE ce.company_id::text = cm.company_id::text -- Join comparison as text for safety
      AND (ce.company_industry IS DISTINCT FROM cm.industry OR ce.company_group IS DISTINCT FROM cm.group);

END;
$$ LANGUAGE plpgsql;
