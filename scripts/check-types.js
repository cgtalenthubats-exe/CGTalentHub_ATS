
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    // We can't use information_schema easily with public key usually, 
    // but with service role we might. Let's try a different trick.
    // Just select one record and check the typeof
    const { data: profile, error } = await supabase
        .from('Candidate Profile')
        .select('date_of_birth, year_of_bachelor_education')
        .limit(1);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Sample Data:", profile[0]);
        console.log("DOB Type in JS:", typeof profile[0]?.date_of_birth);
        console.log("Grad Year Type in JS:", typeof profile[0]?.year_of_bachelor_education);
    }
}

checkSchema();
