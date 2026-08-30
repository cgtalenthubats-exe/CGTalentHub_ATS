import { createClient } from '@supabase/supabase-js'

const supabaseBUrl = process.env.NEXT_PUBLIC_SUPABASE_B_URL
const supabaseBAnonKey = process.env.NEXT_PUBLIC_SUPABASE_B_ANON_KEY

if (!supabaseBUrl || !supabaseBAnonKey) {
    throw new Error('Missing Supabase Project B credentials')
}

// "Supabase B" (fkjwftcarqdukkqiogjo) — separate project used by the
// "New Chat bot - by path" n8n workflow for vector search + its own
// Postgres Memory node. RLS is disabled on n8n_chat_histories there
// (same as project A), so the anon key is sufficient for read access.
export const supabaseB = createClient(supabaseBUrl, supabaseBAnonKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
})
