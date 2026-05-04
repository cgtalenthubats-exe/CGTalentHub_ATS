
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStageOrder() {
    const { data, error } = await supabase
        .from('status_master')
        .select('status, stage_order')
        .order('stage_order', { ascending: true });
    
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Status Master with Order:', data);
    }
}

checkStageOrder();
