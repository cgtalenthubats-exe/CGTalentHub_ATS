"use server";

import * as XLSX from "xlsx";
import { fetchJRReportData, type CandidateForReport } from "./export-jr-report";
import { bucketLongList, isTopProfileCandidate } from "@/lib/jr-longlist";

// Matches the old n8n workflow's "Longlist_<JR_ID>.xlsx" exactly — one sheet,
// Top Profile candidates marked inline via Type/Rank rather than split into a
// separate sheet. Reuses the same bucketing (bucketLongList) the PPTX Long
// List uses so row order matches between the two export formats.
// ("presentationId" from the reference file was always empty — a leftover
// Google Slides id — so it's dropped here.)

function longlistRow(c: CandidateForReport, no: number) {
    const isTop = isTopProfileCandidate(c);
    return {
        No: no,
        Type: isTop ? "Top Profile" : "",
        Rank: isTop ? c.rank : "",
        Company: c.company || "",
        name: c.name,
        Position: c.position || "",
        Age: c.age ?? "",
        Gender: c.gender || "",
        "Work location": c.location || "",
        Nationality: c.nationality || "",
        Website: c.linkedin || "",
        Status: c.latest_status || "",
    };
}

export async function generateJRReportExcel(
    jrId: string,
): Promise<{ base64: string; filename: string }> {
    const data = await fetchJRReportData(jrId);

    const rows = bucketLongList(data.allCandidates, data.statusColors).map((c, i) => longlistRow(c, i + 1));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Long List");

    const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;
    const filename = `${jrId}_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    return { base64, filename };
}
