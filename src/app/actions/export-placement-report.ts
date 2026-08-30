"use server";

import PptxGenJS from "pptxgenjs";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import JSZip from "jszip";
import { adminAuthClient } from "@/lib/supabase/admin";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
    indigo800: "3730a3",
    indigo700: "4338ca",
    indigo:    "6366f1",
    indigo50:  "eef2ff",
    slate900:  "0f172a",
    slate800:  "1e293b",
    slate700:  "334155",
    slate600:  "475569",
    slate500:  "64748b",
    slate400:  "94a3b8",
    slate100:  "f1f5f9",
    slate50:   "f8fafc",
    white:     "ffffff",
    green700:  "047857",
    green50:   "ecfdf5",
    purple700: "7e22ce",
    purple50:  "faf5ff",
    CHART: ["4f46e5", "7c3aed", "0891b2", "0d9488", "dc2626", "ea580c", "ca8a04", "15803d"],
};

const SLIDE_W = 13.33;
const MARGIN  = 0.20;

// ── Types ─────────────────────────────────────────────────────────────────────
type PlacementRec = {
    jr_id: string;
    candidate_id: string;
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
type BuLogo = { data: string; aspect: number };

async function loadBuLogo(bu: string): Promise<BuLogo | null> {
    const base = bu.toLowerCase().replace(/\s+/g, "");
    for (const ext of ["png", "jpg"]) {
        const filePath = path.join(process.cwd(), "public", "images", "bu-logos", `${base}.${ext}`);
        try {
            if (fs.existsSync(filePath)) {
                const buf = fs.readFileSync(filePath);
                const meta = await sharp(buf).metadata();
                const aspect = (meta.width || 1) / (meta.height || 1);
                const mime = ext === "jpg" ? "jpeg" : ext;
                return { data: `data:image/${mime};base64,${buf.toString("base64")}`, aspect };
            }
        } catch { /* no logo */ }
    }
    return null;
}

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
    } catch { return dateStr; }
}

function fmtSalary(val: number): string {
    if (!val) return "-";
    return val.toLocaleString();
}

// pptxgenjs only exposes a single uniform `dataLabelColor`/`dataLabelBkgrdColors`
// for a whole chart, and even `dataLabelBkgrdColors` is a no-op for pie/doughnut
// charts specifically — its per-point <c:dLbl> generator always emits an empty
// <c:spPr/> regardless of that option (see its chart-gen source). So the pie
// labels render as plain black text with no fill, unlike the dashboard where
// each label is a box colored to match its slice. Post-process the generated
// chart XML to turn each label into that same colored box: solid fill = the
// slice's own color, black border, white text.
//
// Read each slice's ACTUAL rendered fill from its <c:dPt> rather than
// recomputing from the `chartColors` array we passed in: when a chart has
// more data points than colors, pptxgenjs picks a RANDOM palette color for
// the overflow slices (see its chart-gen source, the `_dataIndex + 1 >
// chartColors.length` branch) — so the only reliable source of truth for
// "what color is this slice" is the XML pptxgenjs already wrote.
function escapeXml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// `labels`, when given, replaces the native showCatName/showPercent text with
// our own "Name (XX%)" string per point (via <c:tx>, the OOXML mechanism for
// custom per-label text) — matching the dashboard's label format exactly
// instead of PowerPoint's own two-line "Name / XX%" rendering.
//
// Deliberately does NOT add <c:dLblPos> here: pptxgenjs's own chart-gen code
// only ever emits dLblPos for CHART_TYPE.PIE, never DOUGHNUT — forcing it in
// (even "ctr", nominally the one doughnut supports) produced a file
// PowerPoint flagged as corrupted and offered to repair, so leave position
// unset and let PowerPoint apply its own default for doughnut, same as
// pptxgenjs does when you don't pass dataLabelPosition.
function recolorDoughnutLabels(xml: string, labels?: string[]): string {
    const dPtColors = new Map<number, string>();
    const dPtRe = /<c:dPt>\s*<c:idx val="(\d+)"\/>[\s\S]*?srgbClr val="([0-9A-Fa-f]{6})"/g;
    let dm: RegExpExecArray | null;
    while ((dm = dPtRe.exec(xml)) !== null) dPtColors.set(parseInt(dm[1], 10), dm[2]);
    if (dPtColors.size === 0) return xml;

    return xml.replace(
        /<c:dLbl>\s*<c:idx val="(\d+)"\/>([\s\S]*?)<\/c:dLbl>/g,
        (_whole, idxStr: string, inner: string) => {
            const idx = parseInt(idxStr, 10);
            const color = dPtColors.get(idx);
            if (!color) return `<c:dLbl><c:idx val="${idxStr}"/>${inner}</c:dLbl>`;
            const boxed = inner
                .replace(
                    "<c:spPr/>",
                    `<c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></c:spPr>`
                )
                .replace(/srgbClr val="000000"\/><\/a:solidFill>(\s*)<a:latin/, 'srgbClr val="FFFFFF"/></a:solidFill>$1<a:latin');
            const labelText = labels?.[idx];
            const tx = labelText
                ? `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="0"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:r><a:rPr lang="en-US" sz="900" b="0"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${escapeXml(labelText)}</a:t></a:r></a:p></c:rich></c:tx>`
                : "";
            return `<c:dLbl><c:idx val="${idxStr}"/>${tx}${boxed}</c:dLbl>`;
        }
    );
}

async function recolorChartLabelsInPptx(buffer: Buffer, chartLabelSets: string[][]): Promise<Buffer> {
    const zip = await JSZip.loadAsync(buffer);
    const chartFiles = Object.keys(zip.files)
        .filter(f => /^ppt\/charts\/chart\d+\.xml$/.test(f))
        .sort((a, b) => parseInt(a.match(/\d+/)![0], 10) - parseInt(b.match(/\d+/)![0], 10));
    for (let i = 0; i < chartFiles.length; i++) {
        const file = chartFiles[i];
        const xml = await zip.file(file)!.async("string");
        zip.file(file, recolorDoughnutLabels(xml, chartLabelSets[i]));
    }
    return zip.generateAsync({ type: "nodebuffer" });
}

// ── Slide 1: Overview ─────────────────────────────────────────────────────────
async function addPlacementOverviewSlide(
    pptx: PptxGenJS,
    placements: PlacementRec[],
    jrs: JRRec[],
    params: { selectedBU: string[]; selectedYear: string[]; selectedStatus: string }
): Promise<string[][]> {
    // Label text per doughnut chart, in the same order charts get added below —
    // consumed by recolorChartLabelsInPptx() to override each slice's label
    // text to match the dashboard's "Name (XX%)" format.
    const chartLabelSets: string[][] = [];

    const slide = pptx.addSlide();
    slide.background = { color: C.slate50 };

    const dateStr = new Date().toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
    });

    // ── Header ────────────────────────────────────────────────────────────────
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.50, fill: { color: C.slate900 } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.10, h: 0.50, fill: { color: C.indigo } });
    slide.addText("SEARCH & PLACEMENT REPORT", {
        x: 0.22, y: 0, w: 8.5, h: 0.50,
        fontSize: 12, bold: true, color: C.white, valign: "middle", charSpacing: 1,
    });

    const filterParts: string[] = [];
    if (params.selectedBU.length > 0) filterParts.push(`BU: ${params.selectedBU.join(", ")}`);
    if (params.selectedYear.length > 0) filterParts.push(`Year: ${params.selectedYear.join(", ")}`);
    if (params.selectedStatus !== "all") filterParts.push(`Status: ${params.selectedStatus}`);
    const filterLabel = filterParts.length > 0 ? filterParts.join("  ·  ") : "All Data";
    slide.addText(`${filterLabel}   |   ${dateStr}`, {
        x: 0.2, y: 0, w: SLIDE_W - 0.3, h: 0.50,
        fontSize: 7.5, color: C.slate400, valign: "middle", align: "right",
    });

    // ── KPI Cards ─────────────────────────────────────────────────────────────
    const KPI_Y   = 0.60;
    const KPI_H   = 0.90;
    const KPI_GAP = 0.08;
    const KPI_W   = (SLIDE_W - MARGIN * 2 - KPI_GAP * 2) / 3; // ≈ 4.27"
    const totalSaving = placements.reduce((s, r) => s + r.outsource_fee_20_percent, 0);

    const kpis = [
        { label: "Total Search (JR)", value: String(jrs.length), bg: C.indigo700, circle: "4f46e5" },
        { label: "Successful Placement", value: String(placements.length), bg: C.green700, circle: "059669" },
        { label: "Total Cost Saving", value: fmtMillion(totalSaving), bg: C.purple700, circle: "9333ea" },
    ];

    kpis.forEach((kpi, i) => {
        const x = MARGIN + i * (KPI_W + KPI_GAP);
        slide.addShape(pptx.ShapeType.rect, { x, y: KPI_Y, w: KPI_W, h: KPI_H, fill: { color: kpi.bg } });
        // Icon area
        slide.addShape(pptx.ShapeType.ellipse, {
            x: x + 0.14, y: KPI_Y + 0.18, w: 0.55, h: 0.55,
            fill: { color: C.white, transparency: 80 },
            line: { color: C.white, width: 0 },
        });
        // Label
        slide.addText(kpi.label.toUpperCase(), {
            x: x + 0.82, y: KPI_Y + 0.12, w: KPI_W - 0.94, h: 0.20,
            fontSize: 7, color: C.white, charSpacing: 0.4,
        });
        // Value
        slide.addText(kpi.value, {
            x: x + 0.82, y: KPI_Y + 0.30, w: KPI_W - 0.94, h: 0.52,
            fontSize: 30, bold: true, color: C.white, valign: "top",
        });
    });

    // ── Data prep ─────────────────────────────────────────────────────────────
    const yearSet = new Set<number>();
    placements.forEach(r => { const y = parseYear(r.hire_date); if (y) yearSet.add(y); });
    jrs.forEach(r => { const y = parseYear(r.request_date); if (y) yearSet.add(y); });
    const yearList = Array.from(yearSet).sort((a, b) => b - a);

    const buSet = new Set<string>();
    placements.forEach(r => r.bu && buSet.add(r.bu));
    jrs.forEach(r => r.bu && buSet.add(r.bu));
    let buList = Array.from(buSet).sort();

    // Limit to top 6 BUs by activity score
    const MAX_BUS = 6;
    if (buList.length > MAX_BUS) {
        buList = buList
            .map(bu => ({
                bu,
                score: placements.filter(p => p.bu === bu).length * 10 + jrs.filter(j => j.bu === bu).length,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_BUS)
            .map(x => x.bu)
            .sort();
    }

    // Build aggregated stats
    type Stat = { search: number; placement: number; saving: number };
    const TOTAL_KEY = "__ALL__";
    const totalByBU: Record<string, Stat> = {};
    const byYear: Record<number, Record<string, Stat>> = {};
    const allKeys = [TOTAL_KEY, ...buList];

    allKeys.forEach(k => { totalByBU[k] = { search: 0, placement: 0, saving: 0 }; });
    yearList.forEach(y => {
        byYear[y] = {};
        allKeys.forEach(k => { byYear[y][k] = { search: 0, placement: 0, saving: 0 }; });
    });

    jrs.forEach(r => {
        const y = parseYear(r.request_date);
        totalByBU[TOTAL_KEY].search++;
        if (r.bu && totalByBU[r.bu]) totalByBU[r.bu].search++;
        if (y && byYear[y]) {
            byYear[y][TOTAL_KEY].search++;
            if (r.bu && byYear[y][r.bu]) byYear[y][r.bu].search++;
        }
    });

    placements.forEach(r => {
        const y = parseYear(r.hire_date);
        totalByBU[TOTAL_KEY].placement++;
        totalByBU[TOTAL_KEY].saving += r.outsource_fee_20_percent;
        if (r.bu && totalByBU[r.bu]) {
            totalByBU[r.bu].placement++;
            totalByBU[r.bu].saving += r.outsource_fee_20_percent;
        }
        if (y && byYear[y]) {
            byYear[y][TOTAL_KEY].placement++;
            byYear[y][TOTAL_KEY].saving += r.outsource_fee_20_percent;
            if (r.bu && byYear[y][r.bu]) {
                byYear[y][r.bu].placement++;
                byYear[y][r.bu].saving += r.outsource_fee_20_percent;
            }
        }
    });

    // ── Table column layout ───────────────────────────────────────────────────
    // Year | [All BU: S / P / V] | [BU1: S / P / V] | [BU2: S / P / V] | ...
    const YEAR_W = 0.55;
    // All BU sub-col widths: Search, Placement, Saving
    const AW = [0.64, 0.72, 0.88]; // total = 2.24"
    // Per-BU sub-col widths
    const BW = [0.52, 0.62, 0.55]; // total = 1.69" per BU
    const ALL_BU_W = AW.reduce((s, w) => s + w, 0);
    const BU_W     = BW.reduce((s, w) => s + w, 0);

    const TABLE_X = MARGIN;

    function colX(buIdx: number, subIdx: number): number {
        let x = TABLE_X + YEAR_W;
        if (buIdx < 0) return x + AW.slice(0, subIdx).reduce((s, w) => s + w, 0);
        return x + ALL_BU_W + buIdx * BU_W + BW.slice(0, subIdx).reduce((s, w) => s + w, 0);
    }
    function colW(buIdx: number, subIdx: number): number {
        return buIdx < 0 ? AW[subIdx] : BW[subIdx];
    }

    // Pre-load BU logos (with aspect ratio)
    const buLogos: Record<string, BuLogo | null> = {};
    await Promise.all(buList.map(async bu => { buLogos[bu] = await loadBuLogo(bu); }));

    // Fixed vertical zones
    const TABLE_Y    = KPI_Y + KPI_H + 0.18;
    const BU_HDR_H   = 0.52; // taller to fit logo + label
    const SUB_HDR_H  = 0.24;
    const TOTAL_ROW_H = 0.30;
    const ROW_H      = 0.27;
    const MAX_YEAR_ROWS = 5;
    const CHART_START_Y = TABLE_Y + BU_HDR_H + SUB_HDR_H + TOTAL_ROW_H + MAX_YEAR_ROWS * ROW_H + 0.18;
    const CHART_H    = 7.35 - CHART_START_Y;
    const CHART_W    = (SLIDE_W - MARGIN * 2 - 0.15) / 2;

    // ── Table: BU name header row ─────────────────────────────────────────────
    let rowY = TABLE_Y;

    // "YEAR" cell spans both header rows
    slide.addShape(pptx.ShapeType.rect, {
        x: TABLE_X, y: rowY, w: YEAR_W, h: BU_HDR_H + SUB_HDR_H,
        fill: { color: C.slate900 },
    });
    slide.addText("YEAR", {
        x: TABLE_X, y: rowY, w: YEAR_W, h: BU_HDR_H + SUB_HDR_H,
        fontSize: 7.5, bold: true, color: C.slate400, align: "center", valign: "middle",
    });

    // "ALL BU" span header
    slide.addShape(pptx.ShapeType.rect, {
        x: TABLE_X + YEAR_W, y: rowY, w: ALL_BU_W, h: BU_HDR_H,
        fill: { color: C.indigo800 },
    });
    slide.addText("ALL BU", {
        x: TABLE_X + YEAR_W, y: rowY, w: ALL_BU_W, h: BU_HDR_H,
        fontSize: 9, bold: true, color: "c7d2fe", align: "center", valign: "middle",
    });

    // Per-BU span headers (with logo)
    buList.forEach((bu, bi) => {
        const bx = TABLE_X + YEAR_W + ALL_BU_W + bi * BU_W;
        slide.addShape(pptx.ShapeType.rect, {
            x: bx, y: rowY, w: BU_W, h: BU_HDR_H,
            fill: { color: bi % 2 === 0 ? C.slate800 : C.slate900 },
            line: { color: C.slate700, width: 0.5 },
        });

        const logo = buLogos[bu];
        if (logo) {
            // Max bounds for image within the cell (leave room for label at bottom)
            const maxW = BU_W - 0.14;
            const maxH = BU_HDR_H - 0.20; // reserve bottom for label

            // Scale to fit while preserving aspect ratio
            let imgW = maxW;
            let imgH = imgW / logo.aspect;
            if (imgH > maxH) { imgH = maxH; imgW = imgH * logo.aspect; }

            // Center image horizontally, top-aligned with small padding
            const imgX = bx + (BU_W - imgW) / 2;
            const imgY = rowY + 0.05;

            slide.addImage({ data: logo.data, x: imgX, y: imgY, w: imgW, h: imgH });

            // BU abbreviation below logo
            slide.addText(bu, {
                x: bx, y: rowY + BU_HDR_H - 0.16, w: BU_W, h: 0.16,
                fontSize: 6.5, bold: true, color: "94a3b8", align: "center", valign: "middle",
                charSpacing: 1,
            });
        } else {
            // No logo — just text centered
            slide.addText(bu, {
                x: bx, y: rowY, w: BU_W, h: BU_HDR_H,
                fontSize: 7.5, bold: true, color: "cbd5e1", align: "center", valign: "middle",
            });
        }
    });

    // ── Table: sub-column header row (Search / Placement / Saving) ────────────
    rowY += BU_HDR_H;

    [0, 1, 2].forEach(si => {
        const cx = colX(-1, si);
        const cw = colW(-1, si);
        slide.addShape(pptx.ShapeType.rect, { x: cx, y: rowY, w: cw, h: SUB_HDR_H, fill: { color: C.slate800 } });
        slide.addText(["SEARCH", "PLACEMENT", "SAVING"][si], {
            x: cx, y: rowY, w: cw, h: SUB_HDR_H,
            fontSize: 6.5, bold: true, color: "818cf8", align: "center", valign: "middle",
        });
    });

    buList.forEach((_, bi) => {
        [0, 1, 2].forEach(si => {
            const cx = colX(bi, si);
            const cw = colW(bi, si);
            slide.addShape(pptx.ShapeType.rect, {
                x: cx, y: rowY, w: cw, h: SUB_HDR_H,
                fill: { color: C.slate700 },
                line: { color: C.slate600, width: 0.3 },
            });
            slide.addText(["SEARCH", "PLACEMENT", "SAVING"][si], {
                x: cx, y: rowY, w: cw, h: SUB_HDR_H,
                fontSize: 6, color: C.slate400, align: "center", valign: "middle",
            });
        });
    });

    // ── Table: TOTAL row ──────────────────────────────────────────────────────
    rowY += SUB_HDR_H;

    slide.addShape(pptx.ShapeType.rect, { x: TABLE_X, y: rowY, w: YEAR_W, h: TOTAL_ROW_H, fill: { color: C.indigo50 } });
    slide.addText("TOTAL", {
        x: TABLE_X, y: rowY, w: YEAR_W, h: TOTAL_ROW_H,
        fontSize: 7.5, bold: true, color: C.indigo, align: "center", valign: "middle",
    });

    const allTot = totalByBU[TOTAL_KEY];
    [
        { v: String(allTot.search || "-"), color: C.indigo },
        { v: allTot.placement ? String(allTot.placement) : "-", color: C.green700 },
        { v: fmtMillion(allTot.saving), color: C.purple700 },
    ].forEach((cell, si) => {
        const cx = colX(-1, si);
        const cw = colW(-1, si);
        slide.addShape(pptx.ShapeType.rect, { x: cx, y: rowY, w: cw, h: TOTAL_ROW_H, fill: { color: C.indigo50 } });
        slide.addText(cell.v, {
            x: cx, y: rowY, w: cw, h: TOTAL_ROW_H,
            fontSize: 9, bold: true, color: cell.color, align: "center", valign: "middle",
        });
    });

    buList.forEach((bu, bi) => {
        const bt = totalByBU[bu] || { search: 0, placement: 0, saving: 0 };
        [
            { v: bt.search ? String(bt.search) : "-", color: C.slate600 },
            { v: bt.placement ? String(bt.placement) : "-", color: bt.placement > 0 ? C.green700 : C.slate400 },
            { v: bt.saving > 0 ? fmtMillion(bt.saving) : "-", color: bt.saving > 0 ? C.purple700 : C.slate400 },
        ].forEach((cell, si) => {
            const cx = colX(bi, si);
            const cw = colW(bi, si);
            slide.addShape(pptx.ShapeType.rect, { x: cx, y: rowY, w: cw, h: TOTAL_ROW_H, fill: { color: "f1f5f9" } });
            slide.addText(cell.v, {
                x: cx, y: rowY, w: cw, h: TOTAL_ROW_H,
                fontSize: 8.5, bold: true, color: cell.color, align: "center", valign: "middle",
            });
        });
    });

    // ── Table: year rows ──────────────────────────────────────────────────────
    const displayYears = yearList.slice(0, MAX_YEAR_ROWS);

    displayYears.forEach((year, yi) => {
        rowY += TOTAL_ROW_H;
        const bg = yi % 2 === 0 ? C.white : C.slate100;
        const yd = byYear[year] || {};
        const allY = yd[TOTAL_KEY] || { search: 0, placement: 0, saving: 0 };

        slide.addShape(pptx.ShapeType.rect, { x: TABLE_X, y: rowY, w: YEAR_W, h: ROW_H, fill: { color: bg } });
        slide.addText(String(year), {
            x: TABLE_X, y: rowY, w: YEAR_W, h: ROW_H,
            fontSize: 7.5, bold: true, color: C.slate600, align: "center", valign: "middle",
        });

        [
            { v: allY.search ? String(allY.search) : "-", color: C.indigo },
            { v: allY.placement ? String(allY.placement) : "-", color: C.green700 },
            { v: allY.saving > 0 ? fmtMillion(allY.saving) : "-", color: C.purple700 },
        ].forEach((cell, si) => {
            const cx = colX(-1, si);
            const cw = colW(-1, si);
            slide.addShape(pptx.ShapeType.rect, { x: cx, y: rowY, w: cw, h: ROW_H, fill: { color: bg } });
            slide.addText(cell.v, {
                x: cx, y: rowY, w: cw, h: ROW_H,
                fontSize: 8, color: cell.color, align: "center", valign: "middle",
            });
        });

        buList.forEach((bu, bi) => {
            const bd = yd[bu] || { search: 0, placement: 0, saving: 0 };
            [
                { v: bd.search ? String(bd.search) : "-", color: C.slate600 },
                { v: bd.placement ? String(bd.placement) : "-", color: bd.placement > 0 ? C.green700 : C.slate400 },
                { v: bd.saving > 0 ? fmtMillion(bd.saving) : "-", color: bd.saving > 0 ? C.purple700 : C.slate400 },
            ].forEach((cell, si) => {
                const cx = colX(bi, si);
                const cw = colW(bi, si);
                slide.addShape(pptx.ShapeType.rect, { x: cx, y: rowY, w: cw, h: ROW_H, fill: { color: bg } });
                slide.addText(cell.v, {
                    x: cx, y: rowY, w: cw, h: ROW_H,
                    fontSize: 7.5, color: cell.color, align: "center", valign: "middle",
                });
            });
        });
    });

    // ── Charts ────────────────────────────────────────────────────────────────
    const CH_Y = CHART_START_Y;

    // Chart 1: Placement by BU (donut)
    slide.addText("Placement by BU", {
        x: MARGIN, y: CH_Y, w: CHART_W, h: 0.22,
        fontSize: 8, bold: true, color: C.slate800,
    });

    const buActive = buList.filter(bu => (totalByBU[bu]?.placement || 0) > 0);
    const buValues = buActive.map(bu => totalByBU[bu].placement);
    if (buValues.length > 0) {
        const buTotal = buValues.reduce((s, v) => s + v, 0);
        chartLabelSets.push(buActive.map((name, i) => `${name} (${Math.round((buValues[i] / buTotal) * 100)}%)`));
        slide.addChart(pptx.ChartType.doughnut, [{
            name: "Placements",
            labels: buActive,
            values: buValues,
        }], {
            x: MARGIN, y: CH_Y + 0.25, w: CHART_W, h: CHART_H - 0.25,
            chartColors: C.CHART.slice(0, buValues.length),
            holeSize: 55,
            showLabel: true,
            showPercent: true,
            showValue: false,
            dataLabelFontSize: 9,
            showLegend: true,
            legendPos: "r",
            legendFontSize: 9,
        } as any);
    }

    // Chart 2: Placement by Job Grade (donut)
    const CH2_X = MARGIN + CHART_W + 0.15;
    slide.addText("Placement by Job Grade", {
        x: CH2_X, y: CH_Y, w: CHART_W, h: 0.22,
        fontSize: 8, bold: true, color: C.slate800,
    });

    const jgMap: Record<string, number> = {};
    placements.forEach(p => {
        const jg = p.job_grade != null ? `JG ${p.job_grade}` : "N/A";
        jgMap[jg] = (jgMap[jg] || 0) + 1;
    });
    const jgEntries = Object.entries(jgMap).sort(([a], [b]) => a.localeCompare(b));
    if (jgEntries.length > 0) {
        const jgTotal = jgEntries.reduce((s, [, v]) => s + v, 0);
        chartLabelSets.push(jgEntries.map(([name, v]) => `${name} (${Math.round((v / jgTotal) * 100)}%)`));
        slide.addChart(pptx.ChartType.doughnut, [{
            name: "Placements",
            labels: jgEntries.map(([k]) => k),
            values: jgEntries.map(([, v]) => v),
        }], {
            x: CH2_X, y: CH_Y + 0.25, w: CHART_W, h: CHART_H - 0.25,
            chartColors: C.CHART.slice(0, jgEntries.length),
            holeSize: 55,
            showLabel: true,
            showPercent: true,
            showValue: false,
            dataLabelFontSize: 9,
            showLegend: true,
            legendPos: "r",
            legendFontSize: 9,
        } as any);
    }

    return chartLabelSets;
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
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.50, fill: { color: C.slate900 } });
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.10, h: 0.50, fill: { color: C.indigo } });
        slide.addText("PLACEMENT LIST", {
            x: 0.22, y: 0, w: 10, h: 0.50,
            fontSize: 11, bold: true, color: C.white, valign: "middle", charSpacing: 1,
        });
        slide.addText(`${page + 1} / ${totalPages}`, {
            x: 11, y: 0, w: 2.1, h: 0.50,
            fontSize: 8, color: C.slate400, valign: "middle", align: "right",
        });

        // Table header
        const TABLE_Y = 0.60;
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
                { v: String(num),                                    align: "center" as const },
                { v: p.candidate_name || "-",                        align: "left"   as const },
                { v: p.position || "-",                              align: "left"   as const },
                { v: p.bu || "-",                                    align: "left"   as const },
                { v: fmtDate(p.hire_date),                           align: "center" as const },
                { v: p.job_grade != null ? `JG${p.job_grade}` : "-", align: "center" as const },
                { v: fmtSalary(p.annual_salary),                     align: "right"  as const },
                { v: p.hiring_status || "-",                         align: "center" as const },
            ];

            colX = MARGIN;
            cells.forEach((cell, ci) => {
                slide.addText(cell.v, {
                    x: colX, y: rowY, w: LIST_COLS[ci].w, h: ROW_H,
                    fontSize: 7.5, color: C.slate700, align: cell.align, valign: "middle",
                    margin: [0, ci <= 2 ? 3 : 0, 0, 0],
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
            .select("jr_id, candidate_id, position, bu, sub_bu, candidate_name, hire_date, hiring_status, outsource_fee_20_percent, job_grade, annual_salary"),
        supabase
            .from("job_requisitions")
            .select("jr_id, bu, sub_bu, request_date"),
    ]);

    const rawErData = erRes.data || [];

    // Live-join candidate_name from Candidate Profile — same fix as
    // getEmploymentRecords()/getRawPlacementData(); keeps this export in sync
    // with the dashboard tab and with requisitions/placements.
    const candidateIds = [...new Set(rawErData.map((r: any) => r.candidate_id).filter(Boolean))];
    const nameByCandidateId = new Map<string, string>();
    if (candidateIds.length > 0) {
        const { data: profiles } = await supabase
            .from("Candidate Profile")
            .select("candidate_id, name")
            .in("candidate_id", candidateIds);
        (profiles || []).forEach((p: any) => { if (p.name) nameByCandidateId.set(p.candidate_id, p.name); });
    }

    const rawPlacements: PlacementRec[] = rawErData.map((r: any) => ({
        ...r,
        candidate_name: (r.candidate_id && nameByCandidateId.get(r.candidate_id)) || r.candidate_name,
        outsource_fee_20_percent: r.outsource_fee_20_percent || 0,
        annual_salary: r.annual_salary || 0,
    }));
    const rawJRs: JRRec[] = (jrRes.data || []);

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

    const chartLabelSets = await addPlacementOverviewSlide(pptx, filteredPlacements, filteredJRs, {
        selectedBU, selectedYear, selectedStatus,
    });
    addCandidateListSlides(pptx, filteredPlacements);

    const rawBuffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
    const recoloredBuffer = await recolorChartLabelsInPptx(rawBuffer, chartLabelSets);
    const base64 = recoloredBuffer.toString("base64");
    const yearStr = selectedYear.length > 0 ? `_${selectedYear.join("-")}` : "";
    const buStr   = selectedBU.length   > 0 ? `_${selectedBU.join("-").replace(/\s+/g, "")}` : "";
    const filename = `Placement_Report${yearStr}${buStr}_${new Date().toISOString().slice(0, 10)}.pptx`;

    return { base64, filename };
}
