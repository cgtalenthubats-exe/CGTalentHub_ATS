import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: profile, error: pe } = await supabase
        .from('Candidate Profile')
        .select('*')
        .ilike('candidate_id', '%C02375%');

    if (pe) console.error("Profile error:", pe);
    console.log("Profile Data Keys:", profile && profile.length > 0 ? Object.keys(profile[0]) : "No profile");
    console.log("Profile Data:", profile);

    const { data: er, error: ee } = await supabase
        .from('employment_record')
        .select('*')
        .ilike('candidate_id', '%C02375%');

    if (ee) console.error("ER error:", ee);
}

check();
