"use server";

import PptxGenJS from "pptxgenjs";
import { adminAuthClient } from "@/lib/supabase/admin";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
    indigo:    "6366f1",
    indigo50:  "eef2ff",
    slate900:  "0f172a",
    slate800:  "1e293b",
    slate700:  "334155",
    slate600:  "475569",
    slate500:  "64748b",
    slate400:  "94a3b8",
    slate200:  "e2e8f0",
    slate100:  "f1f5f9",
    white:     "ffffff",
    emerald50: "ecfdf5",
    emerald700:"047857",
    purple50:  "faf5ff",
    purple700: "7e22ce",
    CHART:     ["4f46e5", "7c3aed", "0891b2", "0d9488", "dc2626", "ea580c", "ca8a04", "15803d"],
};

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const MARGIN  = 0.2;

// ── Types ─────────────────────────────────────────────────────────────────────
type PlacementRec = {
    jr_id: string;
    position: string;
    bu: string;
    sub_bu: string;
    candidate_name: string;
    hire_date: string;
    hiring_status: string;
    outsource_fee_20_percent: number;
    job_grade: number | null;
    annual_salary: number;
};

type JRRec = {
    jr_id: string;
    bu: string;
    sub_bu: string;
    request_date: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseYear(dateStr: string | null): number | null {
    if (!dateStr) return null;
    if (dateStr.includes("-") && dateStr.length >= 4) {
        const y = parseInt(dateStr.split("-")[0]);
        return isNaN(y) ? null : y;
    }
    const parts = dateStr.split("/");
    if (parts.length >= 3) {
        const y = parseInt(parts[2]);
        return isNaN(y) ? null : y;
    }
    return null;
}

function fmtMillion(val: number): string {
    if (!val) return "-";
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return val.toString();
}

function fmtDate(dateStr: string | null): string {
    if (!dateStr) return "-";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
        return dateStr;
    }
}

function fmtSalary(val: number): string {
    if (!val) return "-";
    return val.toLocaleString();
}

// ── Slide 1: Overview ─────────────────────────────────────────────────────────
function addPlacementOverviewSlide(
    pptx: PptxGenJS,
    placements: PlacementRec[],
    jrs: JRRec[],
    params: { selectedBU: string[]; selectedYear: string[]; selectedStatus: string }
) {
    const slide = pptx.addSlide();
    slide.background = { color: C.slate100 };

    const dateStr = new Date().toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
    });

    // ── Header bar ─────────────────────────────────────────────────────────────
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.55, fill: { color: C.slate900 } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.1, h: 0.55, fill: { color: C.indigo } });
    slide.addText("SUCCESSFUL PLACEMENT REPORT", {
        x: 0.2, y: 0, w: 9, h: 0.55,
        fontSize: 12, bold: true, color: C.white, valign: "middle", charSpacing: 1,
    });

    const filterParts: string[] = [];
    if (params.selectedBU.length > 0) filterParts.push(`BU: ${params.selectedBU.join(", ")}`);
    if (params.selectedYear.length > 0) filterParts.push(`Year: ${params.selectedYear.join(", ")}`);
    if (params.selectedStatus !== "all") filterParts.push(`Status: ${params.selectedStatus}`);
    const filterLabel = filterParts.length > 0 ? filterParts.join("  ·  ") : "All Data";

    slide.addText(`${filterLabel}   |   Generated ${dateStr}`, {
        x: 0.2, y: 0, w: SLIDE_W - 0.4, h: 0.55,
        fontSize: 7.5, color: C.slate400, valign: "middle", align: "right",
    });

    // ── KPI Cards ─────────────────────────────────────────────────────────────
    const KPI_Y = 0.65;
    const KPI_H = 0.88;
    const KPI_W = (SLIDE_W - MARGIN * 2 - 0.2) / 3;
    const totalSaving = placements.reduce((s, r) => s + r.outsource_fee_20_percent, 0);

    const kpis = [
        { label: "TOTAL SEARCH (JR)", value: String(jrs.length), color: C.indigo, bg: C.indigo50 },
        { label: "SUCCESSFUL PLACEMENT", value: String(placements.length), color: C.emerald700, bg: C.emerald50 },
        { label: "TOTAL COST SAVING", value: fmtMillion(totalSaving), color: C.purple700, bg: C.purple50 },
    ];

    kpis.forEach((kpi, i) => {
        const x = MARGIN + i * (KPI_W + 0.1);
        slide.addShape(pptx.ShapeType.rect, {
            x, y: KPI_Y, w: KPI_W, h: KPI_H,
            fill: { color: kpi.bg },
            line: { color: kpi.color, width: 0.5 },
        });
        slide.addText(kpi.label, {
            x, y: KPI_Y + 0.08, w: KPI_W, h: 0.22,
            fontSize: 7, bold: true, color: kpi.color, align: "center", charSpacing: 0.5,
        });
        slide.addText(kpi.value, {
            x, y: KPI_Y + 0.3, w: KPI_W, h: 0.5,
            fontSize: 28, bold: true, color: kpi.color, align: "center", valign: "middle",
        });
    });

    // ── Layout constants ──────────────────────────────────────────────────────
    const BODY_Y     = KPI_Y + KPI_H + 0.18;
    const BODY_BOTTOM = SLIDE_H - 0.15;
    const LEFT_X     = MARGIN;
    const LEFT_W     = 7.6;
    const RIGHT_X    = LEFT_X + LEFT_W + 0.25;
    const RIGHT_W    = SLIDE_W - RIGHT_X - MARGIN;

    // ── Left: Summary Table ───────────────────────────────────────────────────
    // Build year list
    const yearSet = new Set<number>();
    placements.forEach(r => { const y = parseYear(r.hire_date); if (y) yearSet.add(y); });
    jrs.forEach(r => { const y = parseYear(r.request_date); if (y) yearSet.add(y); });
    const yearList = Array.from(yearSet).sort((a, b) => b - a);

    // Build BU list
    const buSet = new Set<string>();
    placements.forEach(r => r.bu && buSet.add(r.bu));
    jrs.forEach(r => r.bu && buSet.add(r.bu));
    const buList = Array.from(buSet).sort();

    // Per-year totals
    const byYear: Record<number, { search: number; placement: number; saving: number }> = {};
    yearList.forEach(y => { byYear[y] = { search: 0, placement: 0, saving: 0 }; });
    jrs.forEach(r => { const y = parseYear(r.request_date); if (y && byYear[y]) byYear[y].search++; });
    placements.forEach(r => {
        const y = parseYear(r.hire_date);
        if (y && byYear[y]) { byYear[y].placement++; byYear[y].saving += r.outsource_fee_20_percent; }
    });

    slide.addText("SEARCH & PLACEMENT SUMMARY", {
        x: LEFT_X, y: BODY_Y, w: LEFT_W, h: 0.22,
        fontSize: 7.5, bold: true, color: C.slate500, charSpacing: 0.5,
    });

    const TABLE_Y  = BODY_Y + 0.26;
    const ROW_H    = 0.31;
    // Year | Search | Placement | Saving
    const COL_W    = [0.75, 1.2, 1.3, 1.55];
    const TABLE_W  = COL_W.reduce((s, w) => s + w, 0);

    // Header row
    slide.addShape(pptx.ShapeType.rect, { x: LEFT_X, y: TABLE_Y, w: TABLE_W, h: ROW_H, fill: { color: C.slate900 } });
    let colX = LEFT_X;
    ["Year", "Search (JR)", "Placements", "Cost Saving"].forEach((h, i) => {
        slide.addText(h, {
            x: colX, y: TABLE_Y, w: COL_W[i], h: ROW_H,
            fontSize: 7.5, bold: true, color: C.white,
            align: i === 0 ? "left" : "center", valign: "middle", margin: [0, 4, 0, 4],
        });
        colX += COL_W[i];
    });

    // Total row
    let rowY = TABLE_Y + ROW_H;
    slide.addShape(pptx.ShapeType.rect, { x: LEFT_X, y: rowY, w: TABLE_W, h: ROW_H, fill: { color: C.indigo50 } });
    colX = LEFT_X;
    [
        { v: "Total", color: C.slate700 },
        { v: String(jrs.length), color: C.indigo },
        { v: String(placements.length), color: C.emerald700 },
        { v: fmtMillion(totalSaving), color: C.purple700 },
    ].forEach((cell, i) => {
        slide.addText(cell.v, {
            x: colX, y: rowY, w: COL_W[i], h: ROW_H,
            fontSize: 8.5, bold: true, color: cell.color,
            align: i === 0 ? "left" : "center", valign: "middle", margin: [0, 4, 0, 4],
        });
        colX += COL_W[i];
    });

    // Year rows
    yearList.forEach((year, idx) => {
        rowY += ROW_H;
        if (rowY + ROW_H > BODY_BOTTOM) return;
        const s = byYear[year];
        slide.addShape(pptx.ShapeType.rect, {
            x: LEFT_X, y: rowY, w: TABLE_W, h: ROW_H,
            fill: { color: idx % 2 === 0 ? C.white : C.slate100 },
        });
        colX = LEFT_X;
        [
            { v: String(year), color: C.slate700 },
            { v: s.search ? String(s.search) : "-", color: C.slate600 },
            { v: s.placement ? String(s.placement) : "-", color: s.placement ? C.emerald700 : C.slate400 },
            { v: s.saving > 0 ? fmtMillion(s.saving) : "-", color: s.saving > 0 ? C.purple700 : C.slate400 },
        ].forEach((cell, i) => {
            slide.addText(cell.v, {
                x: colX, y: rowY, w: COL_W[i], h: ROW_H,
                fontSize: 8, bold: i === 2 && s.placement > 0, color: cell.color,
                align: i === 0 ? "left" : "center", valign: "middle", margin: [0, 4, 0, 4],
            });
            colX += COL_W[i];
        });
    });

    // BU summary block (below main table, if multiple BUs)
    if (buList.length > 1) {
        const BU_Y = rowY + ROW_H + 0.15;
        if (BU_Y + 0.22 < BODY_BOTTOM) {
            slide.addText("BY BU (Total)", {
                x: LEFT_X, y: BU_Y, w: TABLE_W, h: 0.22,
                fontSize: 7, bold: true, color: C.slate500, charSpacing: 0.3,
            });
            let bY = BU_Y + 0.24;
            const buROW = 0.26;
            buList.forEach((bu, bi) => {
                if (bY + buROW > BODY_BOTTOM) return;
                const cnt = placements.filter(p => p.bu === bu).length;
                const saving = placements.filter(p => p.bu === bu).reduce((s, p) => s + p.outsource_fee_20_percent, 0);
                slide.addShape(pptx.ShapeType.rect, {
                    x: LEFT_X, y: bY, w: TABLE_W, h: buROW,
                    fill: { color: bi % 2 === 0 ? C.white : C.slate100 },
                });
                colX = LEFT_X;
                [
                    { v: bu, w: COL_W[0] + COL_W[1], color: C.slate700, align: "left" as const },
                    { v: String(cnt), w: COL_W[2], color: C.emerald700, align: "center" as const },
                    { v: fmtMillion(saving), w: COL_W[3], color: C.purple700, align: "center" as const },
                ].forEach(cell => {
                    slide.addText(cell.v, {
                        x: colX, y: bY, w: cell.w, h: buROW,
                        fontSize: 7.5, color: cell.color, align: cell.align, valign: "middle", margin: [0, 4, 0, 4],
                    });
                    colX += cell.w;
                });
                bY += buROW;
            });
        }
    }

    // ── Right: Charts ─────────────────────────────────────────────────────────
    const HALF_H   = (BODY_BOTTOM - BODY_Y) / 2 - 0.1;
    const BAR_H    = 0.21;
    const BAR_GAP  = 0.07;
    const LABEL_W  = 1.7;
    const BAR_AREA = RIGHT_W - LABEL_W - 0.45;

    // Chart 1: Placement by BU
    slide.addText("PLACEMENT BY BU", {
        x: RIGHT_X, y: BODY_Y, w: RIGHT_W, h: 0.22,
        fontSize: 7.5, bold: true, color: C.slate500, charSpacing: 0.5,
    });

    const buCounts = buList.map(bu => placements.filter(p => p.bu === bu).length);
    const maxBU = Math.max(...buCounts, 1);
    let barY = BODY_Y + 0.28;

    buList.forEach((bu, i) => {
        if (barY + BAR_H > BODY_Y + HALF_H) return;
        const count = buCounts[i];
        const barW = Math.max((count / maxBU) * BAR_AREA, 0.05);
        const color = C.CHART[i % C.CHART.length];

        slide.addText(bu, {
            x: RIGHT_X, y: barY, w: LABEL_W, h: BAR_H,
            fontSize: 6.5, color: C.slate600, valign: "middle", align: "right",
        });
        slide.addShape(pptx.ShapeType.rect, {
            x: RIGHT_X + LABEL_W + 0.05, y: barY + 0.02, w: barW, h: BAR_H - 0.04,
            fill: { color },
        });
        slide.addText(String(count), {
            x: RIGHT_X + LABEL_W + barW + 0.1, y: barY, w: 0.35, h: BAR_H,
            fontSize: 7, bold: true, color: C.slate600, valign: "middle",
        });
        barY += BAR_H + BAR_GAP;
    });

    // Chart 2: Placement by Job Grade
    const CHART2_Y = BODY_Y + HALF_H + 0.2;
    slide.addText("PLACEMENT BY JOB GRADE", {
        x: RIGHT_X, y: CHART2_Y, w: RIGHT_W, h: 0.22,
        fontSize: 7.5, bold: true, color: C.slate500, charSpacing: 0.5,
    });

    const jgMap: Record<string, number> = {};
    placements.forEach(p => {
        const jg = p.job_grade != null ? `JG ${p.job_grade}` : "N/A";
        jgMap[jg] = (jgMap[jg] || 0) + 1;
    });
    const jgEntries = Object.entries(jgMap).sort(([a], [b]) => a.localeCompare(b));
    const maxJG = Math.max(...jgEntries.map(([, v]) => v), 1);

    barY = CHART2_Y + 0.28;
    jgEntries.forEach(([jg, count], i) => {
        if (barY + BAR_H > BODY_BOTTOM) return;
        const barW = Math.max((count / maxJG) * BAR_AREA, 0.05);
        const color = C.CHART[i % C.CHART.length];

        slide.addText(jg, {
            x: RIGHT_X, y: barY, w: LABEL_W, h: BAR_H,
            fontSize: 6.5, color: C.slate600, valign: "middle", align: "right",
        });
        slide.addShape(pptx.ShapeType.rect, {
            x: RIGHT_X + LABEL_W + 0.05, y: barY + 0.02, w: barW, h: BAR_H - 0.04,
            fill: { color },
        });
        slide.addText(String(count), {
            x: RIGHT_X + LABEL_W + barW + 0.1, y: barY, w: 0.35, h: BAR_H,
            fontSize: 7, bold: true, color: C.slate600, valign: "middle",
        });
        barY += BAR_H + BAR_GAP;
    });
}

// ── Slide 2+: Candidate List ───────────────────────────────────────────────────
const LIST_PAGE_SIZE = 22;

const LIST_COLS = [
    { label: "#",             w: 0.28 },
    { label: "Name",          w: 2.35 },
    { label: "Position",      w: 2.5  },
    { label: "BU",            w: 1.1  },
    { label: "Hire Date",     w: 1.1  },
    { label: "JG",            w: 0.5  },
    { label: "Annual Salary", w: 1.5  },
    { label: "Status",        w: 1.0  },
];

function addCandidateListSlides(pptx: PptxGenJS, placements: PlacementRec[]) {
    if (placements.length === 0) return;

    const sorted = [...placements].sort((a, b) =>
        (b.hire_date || "").localeCompare(a.hire_date || "")
    );

    const totalPages = Math.ceil(sorted.length / LIST_PAGE_SIZE);

    for (let page = 0; page < totalPages; page++) {
        const chunk = sorted.slice(page * LIST_PAGE_SIZE, (page + 1) * LIST_PAGE_SIZE);
        const slide = pptx.addSlide();
        slide.background = { color: C.white };

        // Header
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.5, fill: { color: C.slate900 } });
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.1, h: 0.5, fill: { color: C.indigo } });
        slide.addText("PLACEMENT LIST", {
            x: 0.2, y: 0, w: 10, h: 0.5,
            fontSize: 11, bold: true, color: C.white, valign: "middle", charSpacing: 1,
        });
        slide.addText(`${page + 1} / ${totalPages}`, {
            x: 11, y: 0, w: 2.1, h: 0.5,
            fontSize: 8, color: C.slate400, valign: "middle", align: "right",
        });

        // Table header
        const TABLE_Y = 0.6;
        const ROW_H   = 0.28;
        const TABLE_W = LIST_COLS.reduce((s, c) => s + c.w, 0);

        slide.addShape(pptx.ShapeType.rect, { x: MARGIN, y: TABLE_Y, w: TABLE_W, h: ROW_H, fill: { color: C.slate800 } });
        let colX = MARGIN;
        LIST_COLS.forEach(col => {
            slide.addText(col.label, {
                x: colX, y: TABLE_Y, w: col.w, h: ROW_H,
                fontSize: 7.5, bold: true, color: C.white, align: "center", valign: "middle",
            });
            colX += col.w;
        });

        // Data rows
        chunk.forEach((p, i) => {
            const rowY = TABLE_Y + ROW_H + i * ROW_H;
            slide.addShape(pptx.ShapeType.rect, {
                x: MARGIN, y: rowY, w: TABLE_W, h: ROW_H,
                fill: { color: i % 2 === 0 ? C.white : C.slate100 },
            });

            const num = page * LIST_PAGE_SIZE + i + 1;
            const cells = [
                { v: String(num),                               align: "center" as const },
                { v: p.candidate_name || "-",                   align: "left"   as const },
                { v: p.position || "-",                         align: "left"   as const },
                { v: p.bu || "-",                               align: "left"   as const },
                { v: fmtDate(p.hire_date),                      align: "center" as const },
                { v: p.job_grade != null ? `JG${p.job_grade}` : "-", align: "center" as const },
                { v: fmtSalary(p.annual_salary),                align: "right"  as const },
                { v: p.hiring_status || "-",                    align: "center" as const },
            ];

            colX = MARGIN;
            cells.forEach((cell, ci) => {
                slide.addText(cell.v, {
                    x: colX, y: rowY, w: LIST_COLS[ci].w, h: ROW_H,
                    fontSize: 7.5, color: C.slate700, align: cell.align, valign: "middle",
                    margin: [0, ci <= 1 ? 3 : 0, 0, 0],
                });
                colX += LIST_COLS[ci].w;
            });
        });
    }
}

// ── Main export function ──────────────────────────────────────────────────────
export async function generatePlacementReportPPTX(params: {
    selectedBU: string[];
    selectedSubBU: string[];
    selectedYear: string[];
    selectedStatus: string;
}): Promise<{ base64: string; filename: string }> {
    const { selectedBU, selectedSubBU, selectedYear, selectedStatus } = params;
    const supabase = adminAuthClient;

    const [erRes, jrRes] = await Promise.all([
        supabase
            .from("employment_record")
            .select("jr_id, position, bu, sub_bu, candidate_name, hire_date, hiring_status, outsource_fee_20_percent, job_grade, annual_salary"),
        supabase
            .from("job_requisitions")
            .select("jr_id, bu, sub_bu, request_date"),
    ]);

    const rawPlacements: PlacementRec[] = (erRes.data || []).map((r: any) => ({
        ...r,
        outsource_fee_20_percent: r.outsource_fee_20_percent || 0,
        annual_salary: r.annual_salary || 0,
    }));
    const rawJRs: JRRec[] = (jrRes.data || []);

    // Apply filters (mirrors PlacementTab client logic)
    const filteredPlacements = rawPlacements.filter(r => {
        if (selectedBU.length > 0 && !selectedBU.includes(r.bu)) return false;
        if (selectedSubBU.length > 0 && !selectedSubBU.includes(r.sub_bu)) return false;
        const y = parseYear(r.hire_date);
        if (selectedYear.length > 0 && (!y || !selectedYear.includes(y.toString()))) return false;
        if (selectedStatus !== "all" && r.hiring_status !== selectedStatus) return false;
        return true;
    });

    const filteredJRs = rawJRs.filter(r => {
        if (selectedBU.length > 0 && !selectedBU.includes(r.bu)) return false;
        if (selectedSubBU.length > 0 && !selectedSubBU.includes(r.sub_bu)) return false;
        const y = parseYear(r.request_date);
        if (selectedYear.length > 0 && (!y || !selectedYear.includes(y.toString()))) return false;
        return true;
    });

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.theme  = { headFontFace: "Calibri", bodyFontFace: "Calibri" };

    addPlacementOverviewSlide(pptx, filteredPlacements, filteredJRs, {
        selectedBU, selectedYear, selectedStatus,
    });
    addCandidateListSlides(pptx, filteredPlacements);

    const base64 = await pptx.write({ outputType: "base64" }) as string;

    const yearStr = selectedYear.length > 0 ? `_${selectedYear.join("-")}` : "";
    const buStr   = selectedBU.length   > 0 ? `_${selectedBU.join("-").replace(/\s+/g, "")}` : "";
    const filename = `Placement_Report${yearStr}${buStr}_${new Date().toISOString().slice(0, 10)}.pptx`;

    return { base64, filename };
}
