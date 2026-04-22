import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CSV_DIR = 'C:/gmhotel';
const BATCH_SIZE = 100;

async function consolidateAndUpload() {
  console.log('--- Starting GM Hotel Consolidation ---');
  
  const files = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'));
  console.log(`Found ${files.length} CSV files.`);

  let allRecords: any[] = [];
  let totalRows = 0;

  for (const file of files) {
    const filePath = path.join(CSV_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`Parsed ${file}: ${records.length} records.`);
    
    const mapped = records.map((r: any) => ({
      first_name: r['First Name'] || '',
      last_name: r['Last Name'] || '',
      full_name: `${r['First Name'] || ''} ${r['Last Name'] || ''}`.trim(),
      headline: r['Headline'] || '',
      location: r['Location'] || '',
      current_title: r['Current Title'] || '',
      current_company: r['Current Company'] || '',
      email_address: r['Email Address'] || '',
      phone_number: r['Phone Number'] || '',
      profile_url: r['Profile URL'] || '',
      active_project: r['Active Project'] || '',
      notes: r['Notes'] || '',
      feedback: r['Feedback'] || '',
      source_file: file,
      import_status: 'Pending'
    }));

    allRecords = allRecords.concat(mapped);
    totalRows += records.length;
  }

  console.log(`Total records to upload: ${allRecords.length}`);

  // Upload in batches
  for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
    const batch = allRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('import_gm_hotel_list')
      .insert(batch);

    if (error) {
      console.error(`Error uploading batch ${i / BATCH_SIZE}:`, error.message);
    } else {
      console.log(`Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} rows)`);
    }
  }

  console.log('--- Consolidation Complete ---');
}

consolidateAndUpload().catch(err => console.error(err));
