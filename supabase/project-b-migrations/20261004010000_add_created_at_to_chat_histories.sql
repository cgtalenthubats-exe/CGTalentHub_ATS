-- Run this against Supabase PROJECT B (fkjwftcarqdukkqiogjo) — NOT the main
-- project this repo's supabase/migrations folder targets. Kept in a separate
-- folder so it doesn't get picked up alongside project A's migrations.
--
-- n8n_chat_histories is the standard table n8n's Postgres Chat Memory node
-- writes to (id, session_id, message jsonb) — it has no timestamp column at
-- all. AI Search V3's shared team chat reads this table back on page load
-- (getV3ChatHistory in src/app/actions/ai-search-v3-chat.ts) and had nothing
-- to show a date separator / time for history rows, so only messages typed
-- in the current browser session ever showed a time — gone again on refresh.
alter table public.n8n_chat_histories
    add column if not exists created_at timestamptz not null default now();

comment on column public.n8n_chat_histories.created_at is
    'When the row was inserted. Existing rows backfilled to migration-run time (no real historical timestamp exists to recover); every row inserted from here on gets a real one automatically via the default — no n8n workflow change needed, since its insert lists columns explicitly.';
