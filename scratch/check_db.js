require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const expectedRatings = JSON.parse(fs.readFileSync('expected_ratings.json', 'utf8'));
    const brands = Object.keys(expectedRatings);
    
    console.log(`Checking ${brands.length} brands...`);
    
    // We will do a case-insensitive check. Supabase `ilike` is for pattern matching. `in` is case-sensitive.
    // Let's fetch all rows where company_master is in the list case-insensitively using `ilike` in a loop, OR
    // just fetch everything and filter locally. Since fetching 13k rows takes 14 requests, let's just do that but with Promise.all
    
    console.log("Fetching all company_master data...");
    
    // Count first
    const { count } = await supabase.from('company_master').select('*', { count: 'exact', head: true });
    console.log(`Total rows in company_master: ${count}`);
    
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
        if (res.error) {
            console.error(res.error);
        } else {
            allData = allData.concat(res.data);
        }
    }
    
    console.log(`Fetched ${allData.length} records.`);
    
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
    console.log(`Brands missing in company_master entirely (exact match failed): ${missingInDB.length}`);
    console.log(`Brands that exist but rating is empty/missing: ${missingRating.length}`);
    console.log(`Brands that exist but rating mismatches: ${incorrectRating.length}`);
    console.log(`Brands that are correct: ${brands.length - missingInDB.length - missingRating.length - incorrectRating.length}`);
    
    fs.writeFileSync('missing_in_db.json', JSON.stringify(missingInDB, null, 2));
    fs.writeFileSync('missing_rating.json', JSON.stringify(missingRating, null, 2));
    fs.writeFileSync('incorrect_rating.json', JSON.stringify(incorrectRating, null, 2));
    
    console.log("\nSample missing rating:");
    console.log(missingRating.slice(0, 5));
    
    console.log("\nSample incorrect rating:");
    console.log(incorrectRating.slice(0, 5));
}

main();
