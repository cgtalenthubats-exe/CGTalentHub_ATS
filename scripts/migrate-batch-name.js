require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
    console.log("Adding batch_name column to csv_upload_logs...");
    
    // 1. Add column if not exists
    const { error: alterError } = await supabase.rpc('execute_sql', {
        sql_query: "ALTER TABLE csv_upload_logs ADD COLUMN IF NOT EXISTS batch_name TEXT;"
    });

    if (alterError) {
        // RPC might not exist or work if not defined. Try direct execute if rpc fails or just skip if we don't have it.
        // In many cases, we can use a standard migration file or try an update.
        console.error("RPC execute_sql failed, trying direct query if possible (or check if column exists)...", alterError.message);
        
        // Alternative: Try to select it. If it fails, we know it's missing.
        const { error: checkError } = await supabase.from('csv_upload_logs').select('batch_name').limit(1);
        if (checkError && checkError.message.includes('column "batch_name" does not exist')) {
            console.log("Column missing. PLEASE RUN THIS SQL IN SUPABASE DASHBOARD:");
            console.log("ALTER TABLE csv_upload_logs ADD COLUMN batch_name TEXT;");
            console.log("UPDATE csv_upload_logs SET batch_name = 'Batch No. ' || substring(batch_id::text from 1 for 8) WHERE batch_name IS NULL;");
            return;
        }
    }

    console.log("Migrating existing data...");
    const { error: updateError } = await supabase.rpc('execute_sql', {
        sql_query: "UPDATE csv_upload_logs SET batch_name = 'Batch No. ' || substring(batch_id::text from 1 for 8) WHERE batch_name IS NULL;"
    });

    if (updateError) {
        console.error("Update failed:", updateError.message);
    } else {
        console.log("Batch Name migration completed.");
    }
}

runMigration();
