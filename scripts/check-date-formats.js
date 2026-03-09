
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkActualTypes() {
    const query = `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'employment_record';
  `;

    // Using RPC to execute SQL is often restricted, so we use the search_candidates_robust or similar if it allows raw queries,
    // but usually we can't run raw SQL via the client unless there's a specific RPC.
    // Instead, I'll just try to insert a non-date string to see if it fails, or check common indicators.

    // Actually, I can use the 'list_tables' MCP tool correctly now with the correct project ID if I could, but it failed earlier.
    // I'll try to fetch a few more rows to see if there's any variation in format.

    const { data, error } = await supabase
        .from('employment_record')
        .select('hire_date, resign_date')
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Sample data for hire_date and resign_date:');
    data.forEach((r, i) => {
        console.log(`Row ${i}: hire_date="${r.hire_date}", resign_date="${r.resign_date}"`);
    });
}

checkActualTypes();
