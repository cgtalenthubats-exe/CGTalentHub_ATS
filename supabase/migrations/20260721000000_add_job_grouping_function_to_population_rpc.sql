-- Add job_grouping / job_function breakdown + filter dimensions to the
-- Candidate Funnel dashboard tab's population RPC.
--
-- get_candidate_population_data previously had no tracked migration in this
-- repo (it was created directly against the DB) — this file both extends it
-- and establishes the first tracked source of truth for it.

CREATE OR REPLACE FUNCTION public.get_candidate_population_data(
    p_groups text[] DEFAULT '{}'::text[],
    p_industries text[] DEFAULT '{}'::text[],
    p_countries text[] DEFAULT '{}'::text[],
    p_continents text[] DEFAULT '{}'::text[],
    p_position_keywords text[] DEFAULT '{}'::text[],
    p_hotel_chains text[] DEFAULT '{}'::text[],
    p_set_symbols text[] DEFAULT '{}'::text[],
    p_job_groupings text[] DEFAULT '{}'::text[],
    p_job_functions text[] DEFAULT '{}'::text[]
)
RETURNS json
LANGUAGE plpgsql
AS $function$
DECLARE
    result json;
    v_total_db bigint;
    v_skip text[] := ARRAY['Unknown','N/A','Not Found','No Match Found','Undetermined','Unclassified','Wait AI Check','Unassigned','Not found exp',''];
BEGIN
    SET LOCAL work_mem = '64MB';

    SELECT COUNT(*) INTO v_total_db FROM "Candidate Profile";

    WITH set_company_map AS (
        SELECT DISTINCT ON (cm.company_id) cm.company_id, sg.symbol, sg.company_name
        FROM company_master cm
        JOIN company_set_group sg ON LOWER(cm.company_master) = LOWER(sg.company_name)
    ),
    -- NOT materialized: p_countries / p_position_keywords filters (both native,
    -- indexed columns on candidate_experiences) can then be pushed down by the
    -- planner into this join instead of forcing a full unfiltered scan first.
    base AS (
        SELECT
            ce.candidate_id,
            ce.position_keyword,
            ce.company_id,
            ce.country AS work_country,
            ce.note,
            ce.is_current_job,
            COALESCE(
                CASE
                    WHEN ce.start_date ~ '^\d{1,2}-\d{4}$' THEN
                        (split_part(ce.start_date, '-', 2)::int * 100) + split_part(ce.start_date, '-', 1)::int
                    WHEN ce.start_date ~ '^\d{4}-\d{1,2}(-\d{1,2})?$' THEN
                        (split_part(ce.start_date, '-', 1)::int * 100) + split_part(ce.start_date, '-', 2)::int
                    WHEN ce.start_date ~ '^\d{4}$' THEN
                        ce.start_date::int * 100
                    ELSE 0
                END, 0
            ) AS start_sort_key,
            co.continent AS work_continent,
            cm."group" AS cm_group,
            cm.industry AS cm_industry,
            COALESCE(hcm_par.brand_name, hcm.brand_name) AS hcm_chain,
            cp.age,
            cp.nationality,
            cp.job_grouping,
            cp.job_function,
            cpe.country AS profile_country,
            scm.symbol AS set_symbol,
            scm.company_name AS set_company_name
        FROM candidate_experiences ce
        LEFT JOIN country co ON ce.country = co.country
        LEFT JOIN company_master cm ON ce.company_id = cm.company_id
        LEFT JOIN hotel_chain_master hcm ON cm.hotel_chain_id = hcm.brand_id
        LEFT JOIN hotel_chain_master hcm_par ON hcm.parent_id = hcm_par.brand_id
        LEFT JOIN "Candidate Profile" cp ON ce.candidate_id = cp.candidate_id
        LEFT JOIN candidate_profile_enhance cpe ON ce.candidate_id = cpe.candidate_id
        LEFT JOIN set_company_map scm ON ce.company_id = scm.company_id
        WHERE ce.candidate_id IS NOT NULL
          AND cm.industry IS NOT NULL
    ),
    filtered AS MATERIALIZED (
        SELECT b.*
        FROM base b
        WHERE
            (cardinality(p_groups) = 0 OR b.cm_group = ANY(p_groups))
            AND (cardinality(p_industries) = 0 OR b.cm_industry = ANY(p_industries))
            AND (
                (cardinality(p_countries) = 0 AND cardinality(p_continents) = 0)
                OR (cardinality(p_countries) > 0 AND b.work_country = ANY(p_countries))
                OR (cardinality(p_continents) > 0 AND b.work_continent = ANY(p_continents))
            )
            AND (cardinality(p_position_keywords) = 0 OR b.position_keyword = ANY(p_position_keywords))
            AND (cardinality(p_hotel_chains) = 0 OR b.hcm_chain = ANY(p_hotel_chains))
            AND (cardinality(p_set_symbols) = 0 OR b.set_symbol = ANY(p_set_symbols))
            AND (cardinality(p_job_groupings) = 0 OR b.job_grouping = ANY(p_job_groupings))
            AND (cardinality(p_job_functions) = 0 OR b.job_function = ANY(p_job_functions))
    ),
    latest_only AS MATERIALIZED (
        SELECT f.* FROM (
            SELECT f.*,
                ROW_NUMBER() OVER (
                    PARTITION BY f.candidate_id
                    ORDER BY (f.is_current_job = 'Current') DESC, f.start_sort_key DESC
                ) AS rn
            FROM filtered f
        ) f
        WHERE rn = 1
    ),
    location_final AS MATERIALIZED (
        SELECT
            lo.candidate_id,
            CASE
                WHEN lo.work_country IS NOT NULL AND NOT (lo.work_country = ANY(v_skip)) AND lo.note ILIKE '%profile input%'
                    THEN lo.work_country
                WHEN lo.profile_country IS NOT NULL AND NOT (lo.profile_country = ANY(v_skip))
                    THEN lo.profile_country
                ELSE NULL
            END AS location,
            CASE
                WHEN lo.work_country IS NOT NULL AND NOT (lo.work_country = ANY(v_skip)) AND lo.note ILIKE '%profile input%'
                    THEN lo.work_continent
                ELSE NULL
            END AS work_side_continent,
            lo.profile_country
        FROM latest_only lo
    ),
    location_with_continent AS MATERIALIZED (
        SELECT
            lf.candidate_id,
            lf.location,
            COALESCE(lf.work_side_continent, co2.continent) AS continent
        FROM location_final lf
        LEFT JOIN country co2 ON co2.country = lf.profile_country AND lf.work_side_continent IS NULL
    ),
    age_bucketed AS MATERIALIZED (
        SELECT
            candidate_id,
            CASE
                WHEN age IS NULL THEN 'Unknown'
                WHEN age < 30 THEN '<30'
                WHEN age < 40 THEN '30–39'
                WHEN age < 50 THEN '40–49'
                WHEN age < 60 THEN '50–59'
                ELSE '60+'
            END AS bucket
        FROM latest_only
    )
    SELECT json_build_object(
        'total_db', v_total_db,
        'total_filtered', (SELECT COUNT(DISTINCT candidate_id) FROM filtered),
        'currently_employed', (SELECT COUNT(DISTINCT candidate_id) FROM filtered WHERE is_current_job = 'Current'),
        'set_experienced', (SELECT COUNT(DISTINCT candidate_id) FROM filtered WHERE set_symbol IS NOT NULL),
        'nationality_unknown_count', (
            SELECT COUNT(DISTINCT candidate_id) FROM latest_only
            WHERE nationality IS NULL OR TRIM(nationality) = '' OR TRIM(nationality) = ANY(v_skip)
        ),
        'by_group', COALESCE((
            SELECT json_agg(row_data) FROM (
                SELECT json_build_object('name', cm_group, 'count', COUNT(DISTINCT candidate_id)) AS row_data
                FROM latest_only
                WHERE cm_group IS NOT NULL AND NOT (cm_group = ANY(v_skip))
                GROUP BY cm_group ORDER BY COUNT(DISTINCT candidate_id) DESC LIMIT 10
            ) t
        ), '[]'::json),
        'by_industry', COALESCE((
            SELECT json_agg(row_data) FROM (
                SELECT json_build_object('name', cm_industry, 'count', COUNT(DISTINCT candidate_id)) AS row_data
                FROM latest_only
                WHERE cm_industry IS NOT NULL AND NOT (cm_industry = ANY(v_skip))
                GROUP BY cm_industry ORDER BY COUNT(DISTINCT candidate_id) DESC LIMIT 15
            ) t
        ), '[]'::json),
        'by_country', COALESCE((
            SELECT json_agg(row_data) FROM (
                SELECT json_build_object('name', location, 'count', COUNT(DISTINCT candidate_id)) AS row_data
                FROM location_with_continent
                WHERE location IS NOT NULL
                GROUP BY location ORDER BY COUNT(DISTINCT candidate_id) DESC LIMIT 15
            ) t
        ), '[]'::json),
        'by_continent', COALESCE((
            SELECT json_agg(row_data) FROM (
                SELECT json_build_object('name', continent, 'count', COUNT(DISTINCT candidate_id)) AS row_data
                FROM location_with_continent
                WHERE continent IS NOT NULL
                GROUP BY continent ORDER BY COUNT(DISTINCT candidate_id) DESC LIMIT 10
            ) t
        ), '[]'::json),
        'by_position_keyword', COALESCE((
            SELECT json_agg(row_data) FROM (
                SELECT json_build_object('name', position_keyword, 'count', COUNT(DISTINCT candidate_id)) AS row_data
                FROM latest_only
                WHERE position_keyword IS NOT NULL
                GROUP BY position_keyword ORDER BY COUNT(DISTINCT candidate_id) DESC LIMIT 15
            ) t
        ), '[]'::json),
        'by_hotel_chain', COALESCE((
            SELECT json_agg(row_data) FROM (
                SELECT json_build_object('name', hcm_chain, 'count', COUNT(DISTINCT candidate_id)) AS row_data
                FROM filtered
                WHERE hcm_chain IS NOT NULL
                GROUP BY hcm_chain ORDER BY COUNT(DISTINCT candidate_id) DESC LIMIT 15
            ) t
        ), '[]'::json),
        'by_set_company', COALESCE((
            SELECT json_agg(row_data) FROM (
                SELECT json_build_object('symbol', set_symbol, 'name', set_company_name, 'count', COUNT(DISTINCT candidate_id)) AS row_data
                FROM filtered
                WHERE set_symbol IS NOT NULL
                GROUP BY set_symbol, set_company_name ORDER BY COUNT(DISTINCT candidate_id) DESC LIMIT 15
            ) t
        ), '[]'::json),
        'by_age_range', COALESCE((
            SELECT json_agg(row_data) FROM (
                SELECT json_build_object('name', bucket, 'count', COUNT(DISTINCT candidate_id)) AS row_data
                FROM age_bucketed
                GROUP BY bucket
            ) t
        ), '[]'::json),
        'by_nationality', COALESCE((
            SELECT json_agg(row_data) FROM (
                SELECT json_build_object('name', nationality, 'count', COUNT(DISTINCT candidate_id)) AS row_data
                FROM latest_only
                WHERE nationality IS NOT NULL AND TRIM(nationality) <> '' AND NOT (TRIM(nationality) = ANY(v_skip))
                GROUP BY nationality ORDER BY COUNT(DISTINCT candidate_id) DESC LIMIT 15
            ) t
        ), '[]'::json),
        'by_job_grouping', COALESCE((
            SELECT json_agg(row_data) FROM (
                SELECT json_build_object('name', job_grouping, 'count', COUNT(DISTINCT candidate_id)) AS row_data
                FROM latest_only
                WHERE job_grouping IS NOT NULL AND NOT (job_grouping = ANY(v_skip))
                GROUP BY job_grouping ORDER BY COUNT(DISTINCT candidate_id) DESC LIMIT 15
            ) t
        ), '[]'::json),
        'by_job_function', COALESCE((
            SELECT json_agg(row_data) FROM (
                SELECT json_build_object('name', job_function, 'count', COUNT(DISTINCT candidate_id)) AS row_data
                FROM latest_only
                WHERE job_function IS NOT NULL AND NOT (job_function = ANY(v_skip))
                GROUP BY job_function ORDER BY COUNT(DISTINCT candidate_id) DESC LIMIT 15
            ) t
        ), '[]'::json)
    ) INTO result;

    RETURN result;
END;
$function$
