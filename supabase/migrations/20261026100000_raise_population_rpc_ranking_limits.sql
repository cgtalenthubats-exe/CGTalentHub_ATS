-- The Funnel's ranked lists ("By Industry", "By Location", "By Position Keyword", "By Hotel Chain",
-- "By SET Company", "By Nationality", "By Job Function"...) were capped inside the RPC at LIMIT 15
-- (10 for group/continent), so the UI's "View All (N)" could never show more than 15 / 10.
--
-- Raise every such cap to 500 in both population RPCs. Done by rewriting the stored function
-- definition instead of re-pasting the whole body, so nothing else in the functions changes.
-- Rollback: re-run with 'LIMIT 500' -> 'LIMIT 15' (group / continent were 10).

DO $$
DECLARE
    r record;
    def text;
BEGIN
    FOR r IN
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('get_candidate_population_data', 'get_candidate_population_data_v2')
    LOOP
        def := pg_get_functiondef(r.oid);
        def := regexp_replace(def, 'LIMIT (10|15)\y', 'LIMIT 500', 'g');
        EXECUTE def;
    END LOOP;
END $$;
