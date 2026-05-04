require('dotenv').config({ path: '../.env.local' });
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // 1. Parse hotel list.xlsx
    const workbook1 = XLSX.readFile('C:\\Users\\HP\\Downloads\\hotel list.xlsx');
    const sheet1 = workbook1.Sheets[workbook1.SheetNames[0]]; // Assuming first sheet is correct here
    const data1 = XLSX.utils.sheet_to_json(sheet1);
    
    // 2. Parse 3 Star Hotel List.xlsx using 'Revised' sheet
    const workbook2 = XLSX.readFile('C:\\Users\\HP\\Downloads\\3 Star Hotel List.xlsx');
    const sheet2 = workbook2.Sheets['Revised'];
    const data2 = XLSX.utils.sheet_to_json(sheet2);
    
    const expectedRatings = {};
    for (const row of data1) {
        if (row['Hotel Brand']) {
            const brand = String(row['Hotel Brand']).trim();
            const star = row['Star'] ? String(row['Star']).trim() : '';
            if (star) {
                expectedRatings[brand] = star;
            }
        }
    }
    
    // In Revised sheet, the column is 'Hotel Brand'
    let threeStarCount = 0;
    for (const row of data2) {
        const brandRaw = row['Hotel brand'] || row['Hotel Brand'] || row['3 Star Hotels'];
        if (brandRaw) {
            const brand = String(brandRaw).trim();
            expectedRatings[brand] = '3 Star';
            threeStarCount++;
        }
    }
    
    console.log(`Loaded ${Object.keys(expectedRatings).length} unique hotel brands from Excel. (${threeStarCount} from Revised sheet)`);
    
    const brands = Object.keys(expectedRatings);
    
    console.log("Fetching all company_master data...");
    const { count } = await supabase.from('company_master').select('*', { count: 'exact', head: true });
    
    const limit = 1000;
    const pages = Math.ceil(count / limit);
    const promises = [];
    
    for (let i = 0; i < pages; i++) {
        promises.push(
            supabase.from('company_master').select('company_master, rating').range(i * limit, (i + 1) * limit - 1)
        );
    }
    
    const results = await Promise.all(promises);
    let allData = [];
    for (const res of results) {
        if (!res.error) allData = allData.concat(res.data);
    }
    
    const dbMap = {};
    for (const row of allData) {
        if (row.company_master) {
            dbMap[String(row.company_master).trim().toLowerCase()] = row;
        }
    }
    
    const missingInDB = [];
    const missingRating = [];
    const incorrectRating = [];
    
    for (const [brand, rating] of Object.entries(expectedRatings)) {
        const lowerBrand = brand.toLowerCase();
        
        if (!dbMap[lowerBrand]) {
            missingInDB.push({ brand, expected: rating });
        } else {
            const dbRow = dbMap[lowerBrand];
            const dbRating = dbRow.rating ? String(dbRow.rating).trim() : '';
            
            if (!dbRating || dbRating === 'Wait AI Check' || dbRating === '0' || dbRating === '-' || dbRating.toLowerCase() === 'n/a') {
                missingRating.push({ brand, expected: rating, current: dbRating || 'Empty' });
            } else if (dbRating !== rating && !dbRating.includes(rating.replace(' Star', ''))) {
                const dbRatingNum = dbRating.replace(/[^0-9.]/g, '');
                const expRatingNum = rating.replace(/[^0-9.]/g, '');
                if (dbRatingNum !== expRatingNum) {
                    incorrectRating.push({ brand, expected: rating, current: dbRating });
                }
            }
        }
    }
    
    console.log("\n=== SUMMARY ===");
    console.log(`Brands missing in DB: ${missingInDB.length}`);
    console.log(`Brands exist but missing rating: ${missingRating.length}`);
    console.log(`Brands exist but mismatch: ${incorrectRating.length}`);
    
    fs.writeFileSync('missing_in_db.json', JSON.stringify(missingInDB, null, 2));
    fs.writeFileSync('incorrect_rating.json', JSON.stringify(incorrectRating, null, 2));
    
    console.log("\nMismatched ratings details:");
    console.log(incorrectRating);
}

main();
