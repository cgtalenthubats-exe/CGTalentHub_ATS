require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const matched = JSON.parse(fs.readFileSync('other_industry_matches.json', 'utf8'));
    
    // We want to filter out false positives.
    // A match is likely genuine if:
    // 1. The brand is matched as a whole word.
    // 2. OR the company name has hotel keywords like 'hotel', 'resort', 'villa', 'lodge'
    
    const hotelKeywords = ['hotel', 'resort', 'villa', 'lodge', 'suites', 'inn', 'hospitality', 'residences', 'apartments', 'retreat'];
    const genuineMatches = [];
    
    for (const m of matched) {
        const name = m.company_name.toLowerCase();
        const brand = m.matched_brand.toLowerCase();
        
        // Skip short brands that are common words if they don't have hotel keywords
        const isShortCommon = ['cape', 'element', 'spark', 'quest', 'omo', 'fave', 'w', '1'].includes(brand);
        
        const hasHotelKeyword = hotelKeywords.some(kw => name.includes(kw));
        
        // Use word boundary to check if the brand is a standalone word
        const regex = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`);
        const isStandalone = regex.test(name);
        
        if (isStandalone) {
            if (isShortCommon && !hasHotelKeyword) {
                // skip
            } else {
                genuineMatches.push(m);
            }
        } else if (hasHotelKeyword && name.includes(brand)) {
            // Even if not standalone, if it has a hotel keyword and includes the brand (e.g. "AmariResort")
            if (!isShortCommon) {
                genuineMatches.push(m);
            }
        }
    }
    
    console.log(`Filtered down to ${genuineMatches.length} genuine miscategorized companies.`);
    console.log(genuineMatches);
    
    // Let's update them in Supabase
    console.log("Updating their industry to 'Hospitality' and setting rating...");
    let successCount = 0;
    
    // Get expected ratings again
    const XLSX = require('xlsx');
    const workbook1 = XLSX.readFile('C:\\Users\\HP\\Downloads\\hotel list.xlsx');
    const data1 = XLSX.utils.sheet_to_json(workbook1.Sheets[workbook1.SheetNames[0]]);
    const workbook2 = XLSX.readFile('C:\\Users\\HP\\Downloads\\3 Star Hotel List.xlsx');
    const data2 = XLSX.utils.sheet_to_json(workbook2.Sheets['Revised']);
    
    const brandsMap = {};
    for (const row of data1) {
        if (row['Hotel Brand']) {
            brandsMap[String(row['Hotel Brand']).trim().toLowerCase()] = String(row['Star'] || '').trim();
        }
    }
    for (const row of data2) {
        const brandRaw = row['Hotel brand'] || row['Hotel Brand'] || row['3 Star Hotels'];
        if (brandRaw) {
            brandsMap[String(brandRaw).trim().toLowerCase()] = '3 Star';
        }
    }

    for (const m of genuineMatches) {
        const expectedRating = brandsMap[m.matched_brand.toLowerCase()] || 'Wait AI Check';
        
        const { error } = await supabase
            .from('company_master')
            .update({ 
                industry: 'Hospitality',
                rating: expectedRating
            })
            .eq('company_master', m.company_name);
            
        if (error) {
            console.error(`Error updating ${m.company_name}:`, error);
        } else {
            successCount++;
        }
    }
    
    console.log(`Successfully updated ${successCount} companies.`);
}

main();
