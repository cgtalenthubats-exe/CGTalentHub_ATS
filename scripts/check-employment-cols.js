
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmploymentColumns() {
    const { data, error } = await supabase
        .from('employment_record')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns in employment_record:', Object.keys(data[0]));
        console.log('Sample row:', data[0]);
    } else {
        console.log('No data in employment_record');
        // Try to get schema via an RPC or query if possible, or just list columns from a different way
        const { data: cols, error: colError } = await supabase.rpc('get_table_columns', { table_name: 'employment_record' });
        if (colError) {
            console.log('Could not get columns via RPC. Trying raw SQL...');
        } else {
            console.log('Columns via RPC:', cols);
        }
    }
}

checkEmploymentColumns();
