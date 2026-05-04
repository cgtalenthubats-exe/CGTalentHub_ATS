const XLSX = require('xlsx');

try {
    const workbook1 = XLSX.readFile('C:\\Users\\HP\\Downloads\\hotel list.xlsx');
    const sheet1 = workbook1.Sheets[workbook1.SheetNames[0]];
    const data1 = XLSX.utils.sheet_to_json(sheet1, { header: 1 });
    console.log("hotel list.xlsx headers:", data1[0]);

    const workbook2 = XLSX.readFile('C:\\Users\\HP\\Downloads\\3 Star Hotel List.xlsx');
    const sheet2 = workbook2.Sheets[workbook2.SheetNames[0]];
    const data2 = XLSX.utils.sheet_to_json(sheet2, { header: 1 });
    console.log("3 Star Hotel List.xlsx headers:", data2[0]);
} catch (e) {
    console.error(e);
}
