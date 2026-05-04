require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const expectedRatings = JSON.parse(fs.readFileSync('expected_ratings.json', 'utf8'));
    // Since we re-ran with Revised sheet, let's just use the keys from expected_ratings.json 
    // Wait, expected_ratings.json hasn't been updated with the 45 brands. 
    // Let me just parse the JSON from earlier, but first I need the latest list.
    // I can just re-parse the files to be absolutely sure.
    const XLSX = require('xlsx');
    const workbook1 = XLSX.readFile('C:\\Users\\HP\\Downloads\\hotel list.xlsx');
    const data1 = XLSX.utils.sheet_to_json(workbook1.Sheets[workbook1.SheetNames[0]]);
    const workbook2 = XLSX.readFile('C:\\Users\\HP\\Downloads\\3 Star Hotel List.xlsx');
    const data2 = XLSX.utils.sheet_to_json(workbook2.Sheets['Revised']);
    
    const brands = {};
    for (const row of data1) {
        if (row['Hotel Brand']) {
            brands[String(row['Hotel Brand']).trim()] = String(row['Star'] || '').trim();
        }
    }
    for (const row of data2) {
        const brandRaw = row['Hotel brand'] || row['Hotel Brand'] || row['3 Star Hotels'];
        if (brandRaw) {
            brands[String(brandRaw).trim()] = '3 Star';
        }
    }
    
    console.log(`Loaded ${Object.keys(brands).length} brands for partial matching.`);
    
    // Fetch the 1330 companies
    console.log("Fetching empty rating companies...");
    let allEmpty = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('company_master')
            .select('company_master')
            .eq('industry', 'Hospitality')
            .is('rating', null)
            .range(from, from + 999);
        if (error) throw error;
        if (data.length === 0) break;
        allEmpty = allEmpty.concat(data);
        from += 1000;
    }
    
    console.log(`Fetched ${allEmpty.length} companies with empty ratings.`);
    
    // Perform partial match
    // A company_master name might contain the brand name
    // e.g. "Sheraton Grande Sukhumvit" includes "Sheraton"
    const matched = [];
    const unmatched = [];
    
    // Sort brands by length descending so we match the most specific brand first (e.g. "Holiday Inn Express" before "Holiday Inn")
    const sortedBrandKeys = Object.keys(brands).sort((a, b) => b.length - a.length);
    
    for (const row of allEmpty) {
        const companyName = String(row.company_master).trim();
        const lowerName = companyName.toLowerCase();
        let foundMatch = null;
        
        for (const brandKey of sortedBrandKeys) {
            const lowerBrand = brandKey.toLowerCase();
            // Partial match: word boundary check is safer, but let's just do simple includes for now, 
            // or regex with word boundaries to avoid matching "Mandarin" inside some unrelated word (less likely for these names).
            // Let's do simple includes but ensure it's not just a tiny generic word.
            if (lowerBrand.length < 3) continue; // skip very short brands like "W" to avoid false positives? Actually "W" is a brand ("W Hotels"). Let's handle "W" separately or just allow includes.
            
            // To be safer, regex with boundaries:
            const regex = new RegExp(`\\b${lowerBrand.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`);
            if (regex.test(lowerName) || lowerName.includes(lowerBrand)) {
                // simple includes is okay for most. Let's use includes.
                // Wait, includes(' w ') might be better for single letter.
                if (lowerBrand === 'w' || lowerBrand === '1') {
                    if (lowerName.includes(` ${lowerBrand} `) || lowerName.startsWith(`${lowerBrand} `)) {
                        foundMatch = brandKey;
                        break;
                    }
                } else if (lowerName.includes(lowerBrand)) {
                    foundMatch = brandKey;
                    break;
                }
            }
        }
        
        if (foundMatch) {
            matched.push({ company_name: companyName, matched_brand: foundMatch, proposed_rating: brands[foundMatch] });
        } else {
            unmatched.push(companyName);
        }
    }
    
    console.log(`\nFound potential partial matches for ${matched.length} out of ${allEmpty.length} companies.`);
    
    fs.writeFileSync('partial_matches.json', JSON.stringify(matched, null, 2));
    
    console.log("Sample matches:");
    console.log(matched.slice(0, 10));
    
    // Group by brand
    const brandCounts = {};
    for (const m of matched) {
        brandCounts[m.matched_brand] = (brandCounts[m.matched_brand] || 0) + 1;
    }
    const topBrands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log("\nTop matched brands in these empty rows:");
    console.log(topBrands);
}

main();
