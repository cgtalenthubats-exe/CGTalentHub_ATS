-- ============================================================
-- BACKUP: Core Search RPCs — snapshot 2026-06-22
-- ทีมแก้ไข RPC และเกิดปัญหา — เก็บ current state ไว้เป็น reference
-- ก่อนทำ fix ใดๆ ให้อ่านไฟล์นี้ก่อน
-- ============================================================

-- ============================================================
-- 1. search_candidate_ids
-- ============================================================
-- NOTE: ปัญหาที่พบ (2026-06-22)
--   Case 1: p_position_keywords=[3 KW] + p_position_search=[995 titles] → 0 candidates
--   Case 2: p_position_keywords=[3 KW] only                             → 1517 candidates ✓
--   Case 3: p_position_search=[995 titles] only                         → 0 candidates
--   Case 4/5: ~60 filters mixed/ILIKE                                   → correct results
--   Suspected: ILIKE ANY(995 patterns) กับ 51,039 rows → timeout
--   Also noted: get_search_summary uses r.company = ANY(p_companies) (exact match)
--               แต่ search_candidate_ids ใช้ ILIKE → inconsistency

CREATE OR REPLACE FUNCTION search_candidate_ids(
    p_position_keywords  text[]  DEFAULT '{}',
    p_position_levels    text[]  DEFAULT '{}',
    p_positions          text[]  DEFAULT '{}',
    p_companies          text[]  DEFAULT '{}',
    p_countries          text[]  DEFAULT '{}',
    p_based_in_countries text[]  DEFAULT '{}',
    p_regions            text[]  DEFAULT '{}',
    p_hotel_ratings      text[]  DEFAULT '{}',
    p_hotel_chains       text[]  DEFAULT '{}',
    p_hotel_sub_brands   text[]  DEFAULT '{}',
    p_industry_group     text    DEFAULT NULL,
    p_industries         text[]  DEFAULT '{}',
    p_current_only       boolean DEFAULT false,
    p_job_functions      text[]  DEFAULT '{}',
    p_genders            text[]  DEFAULT '{}',
    p_nationalities      text[]  DEFAULT '{}',
    p_age_min            integer DEFAULT NULL,
    p_age_max            integer DEFAULT NULL,
    p_age_include_unknown boolean DEFAULT false,
    p_current_and_latest boolean DEFAULT true,
    p_position_search    text[]  DEFAULT '{}',
    p_internal_only      boolean DEFAULT false,
    p_exclude_companies  text[]  DEFAULT '{}',
    p_exclude_countries  text[]  DEFAULT '{}',
    p_exclude_keywords   text[]  DEFAULT '{}'
)
RETURNS TABLE(candidate_id text)
LANGUAGE plpgsql
AS $$
BEGIN
    SET LOCAL work_mem = '64MB';

    RETURN QUERY
    WITH ranked AS (
        SELECT
            ce.candidate_id,
            ce.position_keyword,
            ce.position_level,
            ce.position,
            ce.company,
            ce.country,
            ce.note,
            ce.is_current_job,
            ce.company_id,
            co.region,
            cm."group"                                    AS cm_group,
            cm.industry                                   AS cm_industry,
            COALESCE(hcm.rating, cm.rating)              AS cm_rating,
            COALESCE(hcm_par.brand_name, hcm.brand_name) AS hcm_chain,
            hcm.brand_name                               AS hcm_sub_brand,
            cp.job_function,
            cp.gender,
            cp.nationality,
            cp.age,
            cp.candidate_status,
            cpe.country                                  AS profile_country,
            ROW_NUMBER() OVER (
                PARTITION BY ce.candidate_id
                ORDER BY (ce.is_current_job = 'Current') DESC,
                         ce.start_date DESC NULLS LAST
            ) AS rn
        FROM candidate_experiences ce
        LEFT JOIN country                   co      ON ce.country        = co.country
        LEFT JOIN company_master            cm      ON ce.company_id     = cm.company_id
        LEFT JOIN hotel_chain_master        hcm     ON cm.hotel_chain_id = hcm.brand_id
        LEFT JOIN hotel_chain_master        hcm_par ON hcm.parent_id     = hcm_par.brand_id
        LEFT JOIN "Candidate Profile"       cp      ON ce.candidate_id   = cp.candidate_id
        LEFT JOIN candidate_profile_enhance cpe     ON ce.candidate_id   = cpe.candidate_id
        WHERE ce.candidate_id IS NOT NULL
    )
    SELECT DISTINCT r.candidate_id
    FROM ranked r
    WHERE
        (NOT p_current_and_latest OR r.rn = 1)
      AND (NOT p_current_only     OR r.is_current_job = 'Current')
      AND (NOT p_internal_only    OR 'Internal' = ANY(r.candidate_status))
      AND (
          (cardinality(p_position_keywords) = 0 AND cardinality(p_position_search) = 0)
          OR (cardinality(p_position_keywords) > 0 AND r.position_keyword = ANY(p_position_keywords))
          OR (cardinality(p_position_search) > 0 AND (
              r.position_keyword ILIKE ANY(ARRAY(SELECT '%' || t || '%' FROM unnest(p_position_search) AS t))
              OR r.position ILIKE ANY(ARRAY(SELECT '%' || t || '%' FROM unnest(p_position_search) AS t))
          ))
      )
      AND (cardinality(p_position_levels)   = 0 OR r.position_level   = ANY(p_position_levels))
      AND (cardinality(p_positions)         = 0 OR r.position         = ANY(p_positions))
      AND (
          cardinality(p_companies) = 0
          OR r.company ILIKE ANY(ARRAY(SELECT '%' || t || '%' FROM unnest(p_companies) AS t))
      )
      AND (p_industry_group IS NULL              OR r.cm_group         = p_industry_group)
      AND (cardinality(p_industries)        = 0 OR r.cm_industry      = ANY(p_industries))
      AND (cardinality(p_hotel_ratings)     = 0
           OR r.cm_rating = ANY(p_hotel_ratings)
           OR ('Unknown' = ANY(p_hotel_ratings) AND r.cm_rating IS NULL))
      AND (cardinality(p_hotel_chains)      = 0 OR r.hcm_chain     = ANY(p_hotel_chains))
      AND (cardinality(p_hotel_sub_brands)  = 0 OR r.hcm_sub_brand = ANY(p_hotel_sub_brands))
      AND (
          (cardinality(p_countries) = 0 AND cardinality(p_based_in_countries) = 0)
          OR (cardinality(p_countries) > 0 AND r.country = ANY(p_countries) AND (r.note ILIKE '%profile input%' OR r.note IS NULL))
          OR (cardinality(p_based_in_countries) > 0 AND r.profile_country = ANY(p_based_in_countries))
      )
      AND (cardinality(p_regions)           = 0
           OR (r.region = ANY(p_regions) AND (r.note ILIKE '%profile input%' OR r.note IS NULL)))
      AND (cardinality(p_job_functions)     = 0 OR r.job_function   = ANY(p_job_functions))
      AND (cardinality(p_genders)           = 0 OR r.gender         = ANY(p_genders))
      AND (cardinality(p_nationalities)     = 0 OR r.nationality    = ANY(p_nationalities))
      AND (p_age_min IS NULL OR r.age >= p_age_min OR (p_age_include_unknown AND r.age IS NULL))
      AND (p_age_max IS NULL OR r.age <= p_age_max OR (p_age_include_unknown AND r.age IS NULL))
      AND (cardinality(p_exclude_companies) = 0 OR r.company NOT ILIKE ALL(ARRAY(SELECT '%' || t || '%' FROM unnest(p_exclude_companies) AS t)))
      AND (cardinality(p_exclude_countries) = 0 OR r.country          != ALL(p_exclude_countries))
      AND (cardinality(p_exclude_keywords)  = 0 OR r.position_keyword != ALL(p_exclude_keywords));
END;
$$;


-- ============================================================
-- 2. get_search_summary
-- NOTE: company filter ใช้ exact match (= ANY) ไม่ใช่ ILIKE
--       ต่างจาก search_candidate_ids ที่ใช้ ILIKE — inconsistency
-- ============================================================
-- [get_search_summary body omitted for brevity — ดู Supabase โดยตรง]
-- ใช้ exact match: AND (cardinality(p_companies) = 0 OR r.company = ANY(p_companies))


-- ============================================================
-- 3. get_cascading_options
-- NOTE: company filter ใน cascading ใช้ exact match เช่นกัน
--       AND (cardinality(p_companies) = 0 OR b.company = ANY(p_companies))
-- ============================================================
-- [get_cascading_options body omitted for brevity — ดู Supabase โดยตรง]
-- Full body เก็บใน git commit นี้เป็น reference snapshot เท่านั้น
