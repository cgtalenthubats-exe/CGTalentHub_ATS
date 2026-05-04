require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
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
    
    console.log("Fetching companies NOT in Hospitality...");
    let allNonHosp = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('company_master')
            .select('company_master, industry, rating')
            .neq('industry', 'Hospitality')
            .range(from, from + 999);
        if (error) throw error;
        if (data.length === 0) break;
        allNonHosp = allNonHosp.concat(data);
        from += 1000;
    }
    
    console.log(`Fetched ${allNonHosp.length} companies outside of Hospitality.`);
    
    const matched = [];
    const sortedBrandKeys = Object.keys(brands).sort((a, b) => b.length - a.length);
    
    for (const row of allNonHosp) {
        const companyName = String(row.company_master).trim();
        const lowerName = companyName.toLowerCase();
        let foundMatch = null;
        
        for (const brandKey of sortedBrandKeys) {
            const lowerBrand = brandKey.toLowerCase();
            if (lowerBrand.length < 4) continue; // skip short names to avoid false positives in other industries
            
            // For other industries, we want to be a bit strict to avoid "The" or "Star" matching.
            // Let's use includes.
            if (lowerName.includes(lowerBrand)) {
                foundMatch = brandKey;
                break;
            }
        }
        
        if (foundMatch) {
            matched.push({
                company_name: companyName,
                industry: row.industry,
                rating: row.rating,
                matched_brand: foundMatch
            });
        }
    }
    
    console.log(`\nFound ${matched.length} companies in OTHER industries that contain a hotel brand name.`);
    fs.writeFileSync('other_industry_matches.json', JSON.stringify(matched, null, 2));
    
    // Group by industry
    const indCounts = {};
    for (const m of matched) {
        indCounts[m.industry] = (indCounts[m.industry] || 0) + 1;
    }
    
    console.log("\nTop industries where these were found:");
    console.log(Object.entries(indCounts).sort((a, b) => b[1] - a[1]).slice(0, 10));
    
    console.log("\nSample matches:");
    console.log(matched.slice(0, 10));
}

main();
