import { getJRSalaryStats } from "./src/app/actions/jr-candidates";

async function debug() {
    console.log("Testing getJRSalaryStats for JR000186...");
    const data = await getJRSalaryStats("JR000186");
    console.log("Result Length:", data.length);
    console.log("Sample Data:", JSON.stringify(data.slice(0, 2), null, 2));
}

debug();
