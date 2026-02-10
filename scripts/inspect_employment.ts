
import { adminAuthClient } from '@/lib/supabase/admin';

async function inspect() {
    console.log("Inspecting employment_record...");
    const { data, error } = await adminAuthClient
        .from('employment_record')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error:", error);
    } else {
        if (data && data.length > 0) {
            console.log("Keys:", Object.keys(data[0]));
        } else {
            console.log("No data found in employment_record");
        }
    }
}

inspect();
