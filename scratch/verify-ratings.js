require('dotenv').config({ path: '../.env.local' });
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getAllCompanies() {
    let allData = [];
    let from = 0;
    const limit = 1000;
    while (true) {
        const { data, error } = await supabase
            .from('company_master')
            .select('company_master, rating')
            .range(from, from + limit - 1);
        if (error) throw error;
        if (data.length === 0) break;
        allData = allData.concat(data);
        from += limit;
    }
    return allData;
}

async function main() {
    const workbook1 = XLSX.readFile('C:\\Users\\HP\\Downloads\\hotel list.xlsx');
    const sheet1 = workbook1.Sheets[workbook1.SheetNames[0]];
    const data1 = XLSX.utils.sheet_to_json(sheet1);
    
    const workbook2 = XLSX.readFile('C:\\Users\\HP\\Downloads\\3 Star Hotel List.xlsx');
    const sheet2 = workbook2.Sheets[workbook2.SheetNames[0]];
    const data2 = XLSX.utils.sheet_to_json(sheet2);
    
    const expectedRatings = {};
    for (const row of data1) {
        if (row['Hotel Brand']) {
            const brand = String(row['Hotel Brand']).trim().toLowerCase();
            const star = row['Star'] ? String(row['Star']).trim() : '';
            if (star) {
                expectedRatings[brand] = { original: String(row['Hotel Brand']).trim(), rating: star };
            }
        }
    }
    
    for (const row of data2) {
        if (row['3 Star Hotels']) {
            const brand = String(row['3 Star Hotels']).trim().toLowerCase();
            expectedRatings[brand] = { original: String(row['3 Star Hotels']).trim(), rating: '3 Star' }; // assume 3 Star
        }
    }
    
    console.log(`Loaded ${Object.keys(expectedRatings).length} unique hotel brands from Excel.`);
    
    const dbCompanies = await getAllCompanies();
    console.log(`Fetched ${dbCompanies.length} records from company_master.`);
    
    const dbMap = {};
    for (const row of dbCompanies) {
        if (row.company_master) {
            const name = String(row.company_master).trim().toLowerCase();
            dbMap[name] = row;
        }
    }
    
    const missingInDB = [];
    const missingRating = [];
    const incorrectRating = [];
    
    for (const [lowerBrand, info] of Object.entries(expectedRatings)) {
        const expectedStar = info.rating;
        const originalBrand = info.original;
        
        if (!dbMap[lowerBrand]) {
            missingInDB.push({ brand: originalBrand, expected: expectedStar });
        } else {
            const dbRow = dbMap[lowerBrand];
            const dbRating = dbRow.rating ? String(dbRow.rating).trim() : '';
            
            if (!dbRating || dbRating === 'Wait AI Check' || dbRating === '0' || dbRating === '-' || dbRating.toLowerCase() === 'n/a') {
                missingRating.push({ brand: originalBrand, expected: expectedStar, current: dbRating || 'Empty' });
            } else if (dbRating !== expectedStar && !dbRating.includes(expectedStar.replace(' Star', ''))) {
                // simple numeric check
                const dbRatingNum = dbRating.replace(/[^0-9.]/g, '');
                const expRatingNum = expectedStar.replace(/[^0-9.]/g, '');
                if (dbRatingNum !== expRatingNum) {
                    incorrectRating.push({ brand: originalBrand, expected: expectedStar, current: dbRating });
                }
            }
        }
    }
    
    console.log("\n=== SUMMARY ===");
    console.log(`Brands missing in company_master entirely (exact match failed): ${missingInDB.length}`);
    console.log(`Brands that exist but rating is empty/missing: ${missingRating.length}`);
    console.log(`Brands that exist but rating mismatches: ${incorrectRating.length}`);
    console.log(`Brands that are correct: ${Object.keys(expectedRatings).length - missingInDB.length - missingRating.length - incorrectRating.length}`);
    
    fs.writeFileSync('missing_in_db.json', JSON.stringify(missingInDB, null, 2));
    fs.writeFileSync('missing_rating.json', JSON.stringify(missingRating, null, 2));
    fs.writeFileSync('incorrect_rating.json', JSON.stringify(incorrectRating, null, 2));
    
    console.log("\nSample exist but missing rating:");
    console.log(missingRating.slice(0, 10));
}

main();
