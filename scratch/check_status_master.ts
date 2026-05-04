
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStatusMaster() {
    const { data: masters, error } = await supabase.from('status_master').select('status').order('order_index');
    if (error) {
        console.error('Error fetching status_master:', error);
    } else {
        console.log('Status Master:', masters?.map(m => m.status));
    }
}

checkStatusMaster();
