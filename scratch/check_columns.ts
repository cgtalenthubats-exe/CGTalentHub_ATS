
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    const { data, error } = await supabase.from('status_master').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Columns:', Object.keys(data?.[0] || {}));
    }
}

checkColumns();
