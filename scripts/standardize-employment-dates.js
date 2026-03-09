const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseAndFormatDate(dateStr) {
    if (!dateStr || dateStr.trim() === "") return null;

    // If already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    // Try M/D/YYYY or D/M/YYYY
    // Note: Based on analysis, legacy is likely M/D/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        let m = parts[0].padStart(2, '0');
        let d = parts[1].padStart(2, '0');
        let y = parts[2];

        // Validate values (basic)
        if (parseInt(m) > 12) {
            // Swap M and D if likely D/M/YYYY
            [m, d] = [d, m];
        }

        return `${y}-${m}-${d}`;
    }

    return null; // Could not parse
}

async function standardizeDates() {
    console.log("Fetching employment records...");
    const { data: records, error } = await supabase
        .from('employment_record')
        .select('employment_record_id, hire_date, resign_date');

    if (error) {
        console.error("Error fetching records:", error);
        process.exit(1);
    }

    console.log(`Processing ${records.length} records...`);
    let updatedCount = 0;

    for (const record of records) {
        const newHireDate = parseAndFormatDate(record.hire_date);
        const newResignDate = parseAndFormatDate(record.resign_date);

        if (newHireDate !== record.hire_date || newResignDate !== record.resign_date) {
            const { error: updateError } = await supabase
                .from('employment_record')
                .update({
                    hire_date: newHireDate,
                    resign_date: newResignDate
                })
                .eq('employment_record_id', record.employment_record_id);

            if (updateError) {
                console.error(`Error updating record ${record.employment_record_id}:`, updateError);
            } else {
                updatedCount++;
            }
        }
    }

    console.log(`Done! Updated ${updatedCount} records.`);
}

standardizeDates();
