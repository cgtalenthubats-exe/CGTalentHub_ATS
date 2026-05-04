const XLSX = require('xlsx');
const fs = require('fs');

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
            const brand = String(row['Hotel Brand']).trim();
            const star = row['Star'] ? String(row['Star']).trim() : '';
            if (star) {
                expectedRatings[brand] = star;
            }
        }
    }
    
    for (const row of data2) {
        if (row['3 Star Hotels']) {
            const brand = String(row['3 Star Hotels']).trim();
            expectedRatings[brand] = '3 Star';
        }
    }
    
    fs.writeFileSync('expected_ratings.json', JSON.stringify(expectedRatings, null, 2));
    console.log("Written expected_ratings.json");
}

main();
