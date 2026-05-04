const XLSX = require('xlsx');

try {
    const workbook1 = XLSX.readFile('C:\\Users\\HP\\Downloads\\hotel list.xlsx');
    console.log("hotel list.xlsx sheets:", workbook1.SheetNames);

    const workbook2 = XLSX.readFile('C:\\Users\\HP\\Downloads\\3 Star Hotel List.xlsx');
    console.log("3 Star Hotel List.xlsx sheets:", workbook2.SheetNames);
} catch (e) {
    console.error(e);
}
