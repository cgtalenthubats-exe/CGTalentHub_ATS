// Single shared thread for the whole team — this page has no per-record scope
// (unlike JR chat, which is scoped per JR), so everyone reads/writes one session.
// Lives in Supabase Project B (fkjwftcarqdukkqiogjo) — that's where the n8n
// workflow's own Postgres Memory node persists this specific webhook's history.
export const V3_SESSION_ID = "ai-search-v3";
