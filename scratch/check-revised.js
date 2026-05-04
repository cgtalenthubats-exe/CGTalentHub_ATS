const XLSX = require('xlsx');

try {
    const workbook2 = XLSX.readFile('C:\\Users\\HP\\Downloads\\3 Star Hotel List.xlsx');
    const sheet2 = workbook2.Sheets['Revised'];
    const data2 = XLSX.utils.sheet_to_json(sheet2, { header: 1 });
    console.log("Revised sheet headers:", data2[0]);
    
    // Convert to objects
    const objs = XLSX.utils.sheet_to_json(sheet2);
    const brands = objs.map(row => row['Hotel brand'] || row['Hotel Brand'] || row['3 Star Hotels'] || Object.values(row)[0]);
    
    console.log("Found brands in Revised:", brands.slice(0, 10), "...");
    
    // Check our 3 mismatched brands
    const mismatched = ["Marriott International", "Hilton", "ONYX Hospitality Group"];
    for (const m of mismatched) {
        const found = brands.find(b => String(b).toLowerCase() === m.toLowerCase());
        console.log(`Mismatch ${m} present in Revised?`, found ? "Yes" : "No");
    }
} catch (e) {
    console.error(e);
}
