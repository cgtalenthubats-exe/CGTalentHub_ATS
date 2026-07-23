"use server";

import PptxGenJS from "pptxgenjs";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { adminAuthClient } from "@/lib/supabase/admin";
import { getStage3JobStatus, getJRCandidateRoster, getJRTopProfileShortlist, type Stage3Result, type ShortProfileCandidate } from "@/app/actions/ai-ranking";
import { getSearchJobStatus } from "@/app/actions/ai-search-ranking";
import { getPoolMarketBreakdown, type MarketBreakdown } from "@/app/actions/market-breakdown";

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
    indigo:   "6366f1",
    indigo50: "eef2ff",
    slate900: "0f172a",
    slate700: "334155",
    slate600: "475569",
    slate500: "64748b",
    slate300: "cbd5e1",
    slate200: "e2e8f0",
    slate100: "f1f5f9",
    white:    "ffffff",
    green:    "22c55e",
    green50:  "f0fdf4",
    amber:    "f59e0b",
    amber50:  "fffbeb",
    red:      "ef4444",
    red50:    "fef2f2",
};

// ── 4D dimension definitions ─────────────────────────────────────────────────
type DimDef = {
    key: string;
    label: string;
    chipLabel: string;
    bg: string;
    boxBg: string;
    text: string;
    light: string;
    getScore:   (r: Stage3Result) => number | null;
    getSummary: (r: Stage3Result) => string | null;
};

const DIM: DimDef[] = [
    {
        key: "experience", label: "Experience & Expertise", chipLabel: "EXPERIENCE",
        bg: "d1fae5", boxBg: "ecfdf5", text: "059669", light: "6ee7b7",
        getScore:   r => r.experience_score,
        getSummary: r => r.experience_summary,
    },
    {
        key: "leadership", label: "Strategic Leadership", chipLabel: "LEADERSHIP",
        bg: "ede9fe", boxBg: "f5f3ff", text: "7c3aed", light: "c4b5fd",
        getScore:   r => r.leadership_score,
        getSummary: r => r.leadership_summary,
    },
    {
        key: "market", label: "Market & Networking", chipLabel: "MARKET",
        bg: "e0f2fe", boxBg: "f0f9ff", text: "0284c7", light: "7dd3fc",
        getScore:   r => r.market_score,
        getSummary: r => r.market_summary,
    },
    {
        key: "skills", label: "Skill Set", chipLabel: "SKILLS",
        bg: "ffedd5", boxBg: "fff7ed", text: "ea580c", light: "fdba74",
        getScore:   r => r.skills_score,
        getSummary: r => r.skills_summary,
    },
];

type AvgScores = { overall: number; experience: number; leadership: number; market: number; skills: number };

// ── Helpers ──────────────────────────────────────────────────────────────────
function trunc(s: string | null | undefined, max: number): string {
    if (!s) return "";
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function parseBullets(s: string | null): string[] {
    if (!s) return [];
    return s.split("|").map(b => b.trim()).filter(Boolean);
}

// Candidate photos render at most 1.5" (Top 3 hero) — 500px covers that at
// print-quality 300dpi with headroom. Source photos (LinkedIn CDN etc.) are
// routinely 1-2MB+ at full resolution; a report with ~30 candidate cards was
// pulling in that many uncompressed originals, ballooning the exported file
// to 10MB+ (risking Vercel's serverless response size limit). Re-encoding as
// a resized JPEG here cuts each photo to tens of KB instead.
async function fetchImageBase64(url: string | null): Promise<string | null> {
    if (!url) return null;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        try {
            const resized = await sharp(buf).resize(500, 500, { fit: "cover" }).jpeg({ quality: 78 }).toBuffer();
            return `data:image/jpeg;base64,${resized.toString("base64")}`;
        } catch {
            // Not a decodable raster image (e.g. an SVG avatar) — fall back to the original.
            const mime = res.headers.get("content-type") ?? "image/jpeg";
            return `data:${mime};base64,${buf.toString("base64")}`;
        }
    } catch { return null; }
}

function computeAvgScores(results: Stage3Result[]): AvgScores | null {
    if (!results.length) return null;
    const has4D = results.filter(r => r.experience_score !== null);
    const avg = (arr: number[]) =>
        arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
    return {
        overall:    avg(results.map(r => r.score)),
        experience: avg(has4D.map(r => r.experience_score!)),
        leadership: avg(has4D.map(r => r.leadership_score!)),
        market:     avg(has4D.map(r => r.market_score!)),
        skills:     avg(has4D.map(r => r.skills_score!)),
    };
}

// ── Cover slide ──────────────────────────────────────────────────────────────
function addCoverSlide(pptx: PptxGenJS, jrId: string, jrTitle: string, total: number, dateStr: string) {
    const slide = pptx.addSlide();
    slide.background = { color: C.slate900 };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.1, h: "100%", fill: { color: C.indigo } });

    slide.addText("CG TALENT HUB", {
        x: 0.35, y: 0.3, w: 5, h: 0.35, fontSize: 9, bold: true, color: C.indigo, charSpacing: 4,
    });
    slide.addText("AI Assessment Report", {
        x: 0.35, y: 0.75, w: 12.6, h: 0.45, fontSize: 14, italic: true, color: "94a3b8",
    });
    slide.addText(jrTitle || jrId, {
        x: 0.35, y: 1.4, w: 12.6, h: 2.2, fontSize: 38, bold: true, color: C.white, wrap: true, valign: "top",
    });

    const chips = [
        { x: 0.35, w: 1.5, text: jrId },
        { x: 2.0,  w: 2.4, text: `${total} Candidates Assessed` },
        { x: 4.55, w: 2.1, text: dateStr },
    ];
    for (const chip of chips) {
        slide.addShape(pptx.ShapeType.roundRect, { x: chip.x, y: 4.6, w: chip.w, h: 0.42, fill: { color: "1e293b" }, rectRadius: 0.06 });
        slide.addText(chip.text, { x: chip.x, y: 4.6, w: chip.w, h: 0.42, align: "center", valign: "middle", fontSize: 9, color: "94a3b8" });
    }
}

// ── Section cover (chapter divider) slide ─────────────────────────────────────
// A quiet break between major sections of the report (Funnel/Market data →
// shortlist reveal → AI reasoning → reference tables) — same dark theme as the
// main Cover so it reads as "new chapter", not another data page. `eyebrow` is
// a short index label ("SECTION 02"), `title` the chapter name, `subtitle` one
// line on what the reader is about to see.
function addSectionCoverSlide(pptx: PptxGenJS, eyebrow: string, title: string, subtitle: string) {
    const slide = pptx.addSlide();
    slide.background = { color: C.slate900 };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.1, h: "100%", fill: { color: C.indigo } });

    slide.addText(eyebrow.toUpperCase(), {
        x: 0.9, y: 2.55, w: 11.5, h: 0.35, fontSize: 10, bold: true, color: C.indigo, charSpacing: 4,
    });
    slide.addText(title, {
        x: 0.9, y: 2.95, w: 11.5, h: 1.1, fontSize: 34, bold: true, color: C.white, wrap: true, valign: "top",
    });
    slide.addText(subtitle, {
        x: 0.9, y: 3.95, w: 11.5, h: 0.5, fontSize: 13, italic: true, color: "94a3b8", wrap: true, valign: "top",
    });
}

type FunnelStage = { label: string; value: number };

// ── Page 2 — The Brief ────────────────────────────────────────────────────────
// What we searched for. JR reports show BU/Sub BU/JR Type (from job_requisitions);
// ai-search-v3 has none of those — just the natural-language query — so those
// fields are optional and simply omitted when absent.
type BriefInfo = {
    title: string;
    bu?: string | null;
    subBu?: string | null;
    jrType?: string | null;
    description?: string | null;
};

function addBriefSlide(pptx: PptxGenJS, info: BriefInfo) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });
    slide.addText("THE BRIEF", {
        x: 0.3, y: 0.18, w: 12.75, h: 0.36, fontSize: 10, bold: true, color: C.indigo, charSpacing: 2,
    });

    slide.addText(info.title, {
        x: 0.3, y: 0.65, w: 12.75, h: 0.8, fontSize: 26, bold: true, color: C.slate900, wrap: true, valign: "top",
    });

    const chips = [
        info.bu ? { label: "BU", value: info.bu } : null,
        info.subBu ? { label: "SUB BU", value: info.subBu } : null,
        info.jrType ? { label: "JR TYPE", value: info.jrType } : null,
    ].filter((c): c is { label: string; value: string } => c !== null);

    let curY = 1.55;
    if (chips.length) {
        const CHIP_W = 4.1, CHIP_H = 0.65, GAP = 0.2;
        chips.forEach((c, i) => {
            const cx = 0.3 + i * (CHIP_W + GAP);
            slide.addShape(pptx.ShapeType.roundRect, {
                x: cx, y: curY, w: CHIP_W, h: CHIP_H, fill: { color: C.slate100 }, line: { color: C.slate200, width: 0.5 }, rectRadius: 0.08,
            });
            slide.addText(c.label, { x: cx + 0.18, y: curY + 0.08, w: CHIP_W - 0.36, h: 0.2, fontSize: 7.5, bold: true, color: C.indigo, charSpacing: 1 });
            slide.addText(c.value, { x: cx + 0.18, y: curY + 0.3, w: CHIP_W - 0.36, h: 0.3, fontSize: 12, bold: true, color: C.slate900, wrap: true });
        });
        curY += CHIP_H + 0.35;
    }

    if (info.description) {
        slide.addShape(pptx.ShapeType.line, { x: 0.3, y: curY, w: 12.75, h: 0, line: { color: C.slate200, width: 0.75 } });
        curY += 0.2;
        slide.addText(info.bu ? "JOB DESCRIPTION" : "SEARCH QUERY", {
            x: 0.3, y: curY, w: 12.75, h: 0.24, fontSize: 8, bold: true, color: C.slate500, charSpacing: 1.5,
        });
        curY += 0.3;
        slide.addText(trunc(info.description, 1400), {
            x: 0.3, y: curY, w: 12.75, h: 7.2 - curY, fontSize: 11, color: C.slate700, wrap: true, valign: "top", lineSpacingMultiple: 1.35,
        });
    }
}

// ── Page 3 — The Funnel (narrative, not a dashboard) ──────────────────────────
// The Market page (next) is a "read it yourself" dashboard; this page exists
// to be READ — a short story that walks Total Pool → Market Spread → (JR only)
// Recruiter's Shortlist → AI Suggestion, each step closing with a concrete
// "so what" (the dominant group/company), not just raw counts. Mirrors the
// spirit of the reference n8n template's auto-generated Summary Mapping text,
// but written as connected narrative rather than terse template fragments.
type TextRun = { text: string; options?: any };

function narrativeRuns(parts: (string | { bold: string })[]): TextRun[] {
    return parts.map(p => (typeof p === "string" ? { text: p } : { text: p.bold, options: { bold: true, color: C.indigo } }));
}

const plural = (n: number, singular: string, pluralForm = `${singular}s`) => (n === 1 ? singular : pluralForm);

function poolIntroRuns(b: MarketBreakdown): TextRun[] {
    return narrativeRuns([
        "We searched the market and found ", { bold: `${b.totalCandidates} ${plural(b.totalCandidates, "candidate")}` }, " matching the base criteria for this role.",
    ]);
}

function spreadRuns(b: MarketBreakdown): TextRun[] {
    const parts: (string | { bold: string })[] = [
        "This pool spans ", { bold: `${b.countries.length} ${plural(b.countries.length, "country", "countries")}` }, ", ",
        { bold: `${b.companyGroups.length} industry ${plural(b.companyGroups.length, "group")}` }, ", and ",
        { bold: `${b.companies.length} ${plural(b.companies.length, "company", "companies")}` },
    ];
    if (b.companyGroups[0] && b.totalCandidates) {
        const pct = Math.round((b.companyGroups[0].count / b.totalCandidates) * 100);
        parts.push(" — the largest concentration sitting in ", { bold: b.companyGroups[0].label }, ` (${pct}%).`);
    } else {
        parts.push(".");
    }
    return narrativeRuns(parts);
}

function pickRuns(introVerb: string, b: MarketBreakdown): TextRun[] {
    const parts: (string | { bold: string })[] = [
        introVerb + " ", { bold: `${b.totalCandidates} ${plural(b.totalCandidates, "candidate")}` }, " — drawn from ",
        { bold: `${b.countries.length} ${plural(b.countries.length, "country", "countries")}` }, " and ",
        { bold: `${b.companies.length} ${plural(b.companies.length, "company", "companies")}` },
    ];
    if (b.companies[0]) {
        const p = b.companies[0];
        parts.push(", most frequently from ", { bold: p.label }, ` (${p.count} ${plural(p.count, "person", "people")}).`);
    } else {
        parts.push(".");
    }
    return narrativeRuns(parts);
}

function overlapRuns(overlapCount: number): TextRun[] {
    return overlapCount > 0
        ? narrativeRuns([{ bold: `${overlapCount} of these candidates` }, " also appear on the recruiter's shortlist above — a signal of alignment between human judgment and the algorithm."])
        : narrativeRuns(["None of these overlap with the recruiter's shortlist above — two independent reads on the same market."]);
}

// Compact "Top 3" drill-down line under a layer's headline sentence — concrete
// enough to answer "top 3 of country/industry/company are what" without
// turning the page into a dashboard (that's what The Market page is for).
function topNLabel(items: { label: string; count: number }[], n = 3): string {
    return items.slice(0, n).map(i => `${i.label} (${i.count} ppl)`).join(", ");
}

// One line per section (countries / groups / companies) — used to render as a
// single run of "· "-joined text, which packed all three onto one row and
// forced tiny font/wrapping on wider pools. `breakLine` on the last run of
// each section forces the next section onto its own line instead.
function drillDownRuns(b: MarketBreakdown): TextRun[] {
    const runs: TextRun[] = [];
    const addSection = (label: string, items: { label: string; count: number }[]) => {
        if (!items.length) return;
        runs.push({ text: `${label}: `, options: { bold: true, color: C.slate500 } });
        runs.push({ text: topNLabel(items), options: { color: C.slate600, breakLine: true } });
    };
    addSection("Top countries", b.countries);
    addSection("Top groups", b.companyGroups);
    addSection("Top companies", b.companies);
    return runs;
}

type FunnelStep = { num: string; title: string; runs: TextRun[]; drillRuns?: TextRun[]; extraRuns?: TextRun[] };

function addFunnelSlide(pptx: PptxGenJS, steps: FunnelStep[]) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });
    slide.addText("THE FUNNEL", {
        x: 0.3, y: 0.18, w: 12.75, h: 0.36, fontSize: 10, bold: true, color: C.indigo, charSpacing: 2,
    });

    const startY = 0.75, endY = 7.2, lineX = 0.65;

    // Step height now reflects actual content instead of an even split across
    // however many steps there are — a step with no drill-down (e.g. "TOTAL
    // POOL") doesn't need nearly as much room as one with 3 drill-down lines
    // underneath it, which used to leave a big empty gap before the next dot.
    const TITLE_H = 0.28, SENTENCE_H = 0.42, DRILL_LINE_H = 0.19, EXTRA_H = 0.34, STEP_PAD = 0.3;
    const rawHeights = steps.map(step => {
        let h = TITLE_H + SENTENCE_H + STEP_PAD;
        if (step.drillRuns?.length) h += DRILL_LINE_H * 3 + 0.05;
        if (step.extraRuns) h += EXTRA_H;
        return h;
    });
    const rawTotal = rawHeights.reduce((a, b) => a + b, 0);
    const available = endY - startY;
    // Stretch to fill the available vertical space so the timeline still
    // reaches the bottom of the slide instead of stopping short.
    const scale = rawTotal > 0 ? available / rawTotal : 1;
    const stepHeights = rawHeights.map(h => h * scale);

    slide.addShape(pptx.ShapeType.line, {
        x: lineX, y: startY + 0.25, w: 0, h: available - 0.5, line: { color: C.slate200, width: 1.5 },
    });

    let y = startY;
    steps.forEach((step, i) => {
        const stepH = stepHeights[i];
        slide.addShape(pptx.ShapeType.ellipse, {
            x: lineX - 0.24, y: y + 0.05, w: 0.48, h: 0.48, fill: { color: C.indigo }, line: { color: C.white, width: 2 },
        });
        slide.addText(step.num, {
            x: lineX - 0.24, y: y + 0.05, w: 0.48, h: 0.48, align: "center", valign: "middle", fontSize: 9, bold: true, color: C.white,
        });
        slide.addText(step.title, {
            x: lineX + 0.45, y: y, w: 11.5, h: 0.22, fontSize: 8.5, bold: true, color: C.slate500, charSpacing: 1.2,
        });

        let cy = y + 0.26;
        const sentenceH = Math.min(0.5, stepH * 0.32);
        slide.addText(step.runs, {
            x: lineX + 0.45, y: cy, w: 11.5, h: sentenceH, fontSize: 12.5, color: C.slate900, wrap: true, valign: "top", lineSpacingMultiple: 1.25,
        });
        cy += sentenceH + 0.06;

        if (step.drillRuns?.length) {
            const drillH = Math.min(DRILL_LINE_H * 3 + 0.1, stepH - (cy - y) - (step.extraRuns ? 0.4 : 0.08));
            slide.addText(step.drillRuns, {
                x: lineX + 0.45, y: cy, w: 11.5, h: drillH, fontSize: 9, wrap: true, valign: "top", lineSpacingMultiple: 1.3,
            });
            cy += drillH + 0.04;
        }

        if (step.extraRuns) {
            slide.addText(step.extraRuns, {
                x: lineX + 0.45, y: cy, w: 11.5, h: Math.max(0.3, stepH - (cy - y) - 0.05), fontSize: 10.5, color: C.slate600, wrap: true, valign: "top", lineSpacingMultiple: 1.25, italic: true,
            });
        }

        y += stepH;
    });
}

// ── Page 4 — The Market (dashboard: cardinality drives chart form) ───────────
// Low cardinality (Company Group ~6, Continent ~6) → donut. Ordered (Age Range)
// or high cardinality (Industry, Position Keyword) → ranked horizontal bar,
// capped at top-N + "Other" so it stays readable regardless of pool size.
const GROUP_COLORS: Record<string, string> = {
    "Hospitality & Real Estate": "6366f1",
    "Retail / FMCG / F&B": "059669",
    "Others": "64748b",
    "Financial Services / Banking / Insurance": "0284c7",
    "Consulting Firm / Consulting Services": "7c3aed",
    "Technology / Digital / Telecom": "ea580c",
};
const CONTINENT_COLORS: Record<string, string> = {
    "Asia": "6366f1", "Europe": "059669", "North America": "0284c7",
    "Africa": "ea580c", "Oceania": "7c3aed", "South America": "f59e0b",
};
const FALLBACK_CATEGORY_COLOR = "94a3b8";

function topNWithOther(items: { label: string; count: number }[], n: number): { label: string; count: number }[] {
    const sorted = [...items].sort((a, b) => b.count - a.count);
    const top = sorted.slice(0, n);
    const otherCount = sorted.slice(n).reduce((sum, i) => sum + i.count, 0);
    return otherCount > 0 ? [...top, { label: "Other", count: otherCount }] : top;
}

// Same idea as topNWithOther, but for donut/pie charts specifically: labels in
// ALWAYS_FOLD_LABELS get folded into the overflow slice regardless of rank or
// size, never competing with real categories for pie real estate — either
// because there's genuinely no data ("Unknown"), or because the label is a
// catch-all bucket that's indistinguishable from the synthetic "Other" slice
// once both are on the same chart ("Others" from company_master.group; "Other"
// is this codebase's own fallback in getPoolMarketBreakdown for a country that
// has data but doesn't map to a known continent — see market-breakdown.ts).
// `otherLabel` is caller-supplied precisely to avoid that collision: the
// synthetic bucket needs a name distinct from any of the folded ones.
const ALWAYS_FOLD_LABELS = new Set(["Unknown", "Other", "Others"]);

function topNPieFolding(
    items: { label: string; count: number }[],
    n: number,
    otherLabel: string,
): { chartData: { label: string; count: number }[]; unknownCount: number } {
    const unknownCount = items.find(i => i.label === "Unknown")?.count ?? 0;
    const foldedCount = items.filter(i => ALWAYS_FOLD_LABELS.has(i.label)).reduce((sum, i) => sum + i.count, 0);
    const known = items.filter(i => !ALWAYS_FOLD_LABELS.has(i.label));
    const sorted = [...known].sort((a, b) => b.count - a.count);
    const top = sorted.slice(0, n);
    const overflowCount = sorted.slice(n).reduce((sum, i) => sum + i.count, 0) + foldedCount;
    const chartData = overflowCount > 0 ? [...top, { label: otherLabel, count: overflowCount }] : top;
    return { chartData, unknownCount };
}

// pptxgenjs horizontal bar charts (barDir:'bar') plot array[0] at the BOTTOM of
// the axis — so a descending-sorted array renders biggest-at-bottom. Reverse
// right before charting to get the largest value at the top, as requested.
function forHorizontalBar(items: { label: string; count: number }[]): { label: string; count: number }[] {
    return [...items].sort((a, b) => a.count - b.count);
}

// Card background drawn as a plain shape BEHIND the chart, not via the chart's
// own `chartArea`/`shadow` options — that combination produced a genuinely
// corrupt file (PowerPoint's "found a problem with content" repair prompt).
// Dropped `shadow` entirely (still repro'd with it on plain shapes too) —
// a plain 2pt border reads as "premium" enough without the added risk.
function addChartCard(slide: any, pptx: PptxGenJS, x: number, y: number, w: number, h: number) {
    const pad = 0.08;
    slide.addShape(pptx.ShapeType.roundRect, {
        x: x - pad, y: y - pad, w: w + 2 * pad, h: h + 2 * pad,
        fill: { color: C.white }, line: { color: C.slate300, width: 2 }, rectRadius: 0.08,
    });
}

function addMarketDashboardSlide(pptx: PptxGenJS, breakdown: MarketBreakdown) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });
    slide.addText("THE MARKET — BY CANDIDATE COUNT", {
        x: 0.3, y: 0.18, w: 12.75, h: 0.36, fontSize: 10, bold: true, color: C.indigo, charSpacing: 2,
    });

    const total = breakdown.totalCandidates || 1;
    const overseas = total - breakdown.thailandCount;

    // ── Row 1: stat tiles — SET/Non-SET, Thailand/Overseas (binary, no chart needed) ─
    const tiles = [
        { label: "SET COMPANY", value: breakdown.setCount, accent: "059669" },
        { label: "NON-SET COMPANY", value: breakdown.nonSetCount, accent: C.slate500 },
        { label: "THAILAND-BASED", value: breakdown.thailandCount, accent: C.indigo },
        { label: "OVERSEAS", value: overseas, accent: "0284c7" },
    ];
    const TILE_Y = 0.62, TILE_H = 0.8, TILE_W = 2.95, TILE_GAP = 0.2;
    tiles.forEach((t, i) => {
        const tx = 0.3 + i * (TILE_W + TILE_GAP);
        slide.addShape(pptx.ShapeType.roundRect, {
            x: tx, y: TILE_Y, w: TILE_W, h: TILE_H, fill: { color: C.slate100 }, line: { color: C.slate300, width: 2 }, rectRadius: 0.1,
        });
        slide.addShape(pptx.ShapeType.rect, { x: tx, y: TILE_Y, w: 0.06, h: TILE_H, fill: { color: t.accent } });
        slide.addText(t.label, { x: tx + 0.18, y: TILE_Y + 0.1, w: TILE_W - 0.36, h: 0.22, fontSize: 8, bold: true, color: t.accent, charSpacing: 0.8 });
        slide.addText(`${t.value}`, { x: tx + 0.18, y: TILE_Y + 0.3, w: TILE_W - 0.36, h: 0.42, fontSize: 22, bold: true, color: C.slate900 });
        slide.addText(`${Math.round((t.value / total) * 100)}%`, { x: tx + 2.0, y: TILE_Y + 0.34, w: 0.85, h: 0.32, align: "right", valign: "middle", fontSize: 11, color: C.slate500 });
    });

    // ── Row 2: two donut charts — Company Group | Continent (low cardinality) ─
    const DONUT_Y = 1.65, DONUT_H = 2.55, DONUT_W = 6.1, DONUT_GAP = 0.2;

    const groupX = 0.3;
    addChartCard(slide, pptx, groupX, DONUT_Y, DONUT_W, DONUT_H);
    const { chartData: groupData } = breakdown.companyGroups.length
        ? topNPieFolding(breakdown.companyGroups, 3, "Other groups")
        : { chartData: [{ label: "No data", count: 1 }] };
    slide.addChart(pptx.ChartType.doughnut, [{ name: "Company Group", labels: groupData.map(g => g.label), values: groupData.map(g => g.count) }], {
        x: groupX, y: DONUT_Y, w: DONUT_W, h: DONUT_H,
        chartColors: groupData.map(g => GROUP_COLORS[g.label] ?? FALLBACK_CATEGORY_COLOR),
        showTitle: true, title: `COMPANY GROUP  —  ${total.toLocaleString()} candidates`, titleFontSize: 9, titleColor: C.slate500,
        showLegend: true, legendPos: "r", legendFontSize: 8,
        showLabel: true, showValue: true, dataLabelColor: "000000", dataLabelFontSize: 8.5, holeSize: 55,
    });

    const contX = 0.3 + DONUT_W + DONUT_GAP;
    addChartCard(slide, pptx, contX, DONUT_Y, DONUT_W, DONUT_H);
    const { chartData: continentData, unknownCount } = breakdown.continents.length
        ? topNPieFolding(breakdown.continents, 3, "Other regions")
        : { chartData: [{ label: "No data", count: 1 }], unknownCount: 0 };
    slide.addChart(pptx.ChartType.doughnut, [{ name: "Continent", labels: continentData.map(g => g.label), values: continentData.map(g => g.count) }], {
        x: contX, y: DONUT_Y, w: DONUT_W, h: DONUT_H,
        chartColors: continentData.map(g => CONTINENT_COLORS[g.label] ?? FALLBACK_CATEGORY_COLOR),
        showTitle: true, title: `CONTINENT  —  ${total.toLocaleString()} candidates`, titleFontSize: 9, titleColor: C.slate500,
        showLegend: true, legendPos: "r", legendFontSize: 8,
        showLabel: true, showValue: true, dataLabelColor: "000000", dataLabelFontSize: 8.5, holeSize: 55,
    });
    if (unknownCount > 0) {
        slide.addText(`${unknownCount} with unknown location`, {
            x: contX + 0.12, y: DONUT_Y + 0.12, w: DONUT_W * 0.4, h: 0.28,
            fontSize: 7, italic: true, color: C.slate500,
        });
    }

    // ── Row 3: three ranked bar charts — Industry | Position Keyword | Age Range ─
    const BAR_Y = 4.4, BAR_H = 2.7, BAR_GAP = 0.2;
    const BAR_W = (12.7 - 2 * BAR_GAP) / 3;
    const barOpts = (title: string, x: number) => ({
        x, y: BAR_Y, w: BAR_W, h: BAR_H,
        barDir: "bar" as const, chartColors: [C.indigo],
        showTitle: true, title, titleFontSize: 9, titleColor: C.slate500,
        showLegend: false, showValue: true, dataLabelFontSize: 7, dataLabelColor: C.slate700,
        catAxisLabelFontSize: 7.5, valAxisHidden: true, valGridLine: { style: "none" as const }, barGapWidthPct: 40,
    });

    const industryData = forHorizontalBar(topNWithOther(breakdown.industries, 5));
    if (industryData.length) {
        addChartCard(slide, pptx, 0.3, BAR_Y, BAR_W, BAR_H);
        slide.addChart(pptx.ChartType.bar, [{ name: "Industry", labels: industryData.map(i => i.label), values: industryData.map(i => i.count) }],
            barOpts("INDUSTRY", 0.3));
    }

    const keywordData = forHorizontalBar(topNWithOther(breakdown.positionKeywords, 5));
    if (keywordData.length) {
        addChartCard(slide, pptx, 0.3 + BAR_W + BAR_GAP, BAR_Y, BAR_W, BAR_H);
        slide.addChart(pptx.ChartType.bar, [{ name: "Position Keyword", labels: keywordData.map(i => i.label), values: keywordData.map(i => i.count) }],
            barOpts("POSITION KEYWORD", 0.3 + BAR_W + BAR_GAP));
    }

    const ageData = forHorizontalBar(breakdown.ageRanges);
    if (ageData.length) {
        addChartCard(slide, pptx, 0.3 + 2 * (BAR_W + BAR_GAP), BAR_Y, BAR_W, BAR_H);
        slide.addChart(pptx.ChartType.bar, [{ name: "Age Range", labels: ageData.map(i => i.label), values: ageData.map(i => i.count) }],
            barOpts("AGE RANGE", 0.3 + 2 * (BAR_W + BAR_GAP)));
    }
}

// ── Page 4 — The Verdict (pool/shortlist/top3 tiles → 4D badges → AI text) ───
// Dropped the "Assessed" stage and the value-scaled funnel boxes per feedback —
// Assessed ≈ Total Pool always (AI scores everyone), so it added a 4th box with
// no real signal, and scaling box height by value made some boxes look broken
// small. Kept exactly the two numbers that differ meaningfully: how big the
// pool was, and how many made the cut. Radar chart also swapped for plain
// score badges — a single-series radar with only 4 axes read as "hard to
// parse," not as a profile shape.
function addVerdictSlide(
    pptx: PptxGenJS,
    stages: FunnelStage[],
    avgScores: AvgScores | null,
    summary: { final_recommendation?: string; highlights?: string[] } | null,
) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });
    slide.addText("THE VERDICT", {
        x: 0.3, y: 0.18, w: 12.75, h: 0.36, fontSize: 10, bold: true, color: C.indigo, charSpacing: 2,
    });

    // ── Row 1: flat stat tiles — Total Pool | Shortlisted | Top 3 ────────────
    const keep = stages.filter(s => s.label !== "Assessed");
    const TILE_Y = 0.62, TILE_H = 0.95, TILE_GAP = 0.25;
    const TILE_W = (12.75 - (keep.length - 1) * TILE_GAP) / keep.length;
    keep.forEach((s, i) => {
        const tx = 0.3 + i * (TILE_W + TILE_GAP);
        slide.addShape(pptx.ShapeType.roundRect, {
            x: tx, y: TILE_Y, w: TILE_W, h: TILE_H, fill: { color: C.slate100 }, line: { color: C.slate300, width: 2 }, rectRadius: 0.1,
        });
        slide.addShape(pptx.ShapeType.rect, { x: tx, y: TILE_Y, w: 0.06, h: TILE_H, fill: { color: C.indigo } });
        slide.addText(s.label.toUpperCase(), {
            x: tx + 0.25, y: TILE_Y + 0.16, w: TILE_W - 0.5, h: 0.24, fontSize: 9, bold: true, color: C.indigo, charSpacing: 1,
        });
        slide.addText(`${s.value}`, {
            x: tx + 0.25, y: TILE_Y + 0.4, w: TILE_W - 0.5, h: 0.5, fontSize: 32, bold: true, color: C.slate900,
        });
    });

    // ── Row 2: score badges — Overall + 4D (replaces the radar chart) ─────────
    let curY = TILE_Y + TILE_H + 0.3;
    const has4D = avgScores && (avgScores.experience || avgScores.leadership || avgScores.market || avgScores.skills);
    if (avgScores) {
        const badges = [
            { label: "OVERALL", value: avgScores.overall, max: 100, accent: C.indigo },
            ...(has4D ? [
                { label: "EXPERIENCE", value: avgScores.experience, max: 25, accent: "059669" },
                { label: "LEADERSHIP", value: avgScores.leadership, max: 25, accent: "7c3aed" },
                { label: "MARKET", value: avgScores.market, max: 25, accent: "0284c7" },
                { label: "SKILLS", value: avgScores.skills, max: 25, accent: "ea580c" },
            ] : []),
        ];
        const B_H = 0.95, B_GAP = 0.2;
        const B_W = (12.75 - (badges.length - 1) * B_GAP) / badges.length;
        badges.forEach((b, i) => {
            const bx = 0.3 + i * (B_W + B_GAP);
            slide.addShape(pptx.ShapeType.roundRect, {
                x: bx, y: curY, w: B_W, h: B_H, fill: { color: C.slate100 }, line: { color: C.slate300, width: 2 }, rectRadius: 0.1,
            });
            slide.addShape(pptx.ShapeType.rect, { x: bx, y: curY, w: B_W, h: 0.05, fill: { color: b.accent } });
            slide.addText(b.label, {
                x: bx, y: curY + 0.14, w: B_W, h: 0.22, align: "center", fontSize: 8, bold: true, color: b.accent, charSpacing: 0.8,
            });
            slide.addText(`${b.value}`, {
                x: bx, y: curY + 0.34, w: B_W, h: 0.4, align: "center", fontSize: 24, bold: true, color: C.slate900,
            });
            slide.addText(`/ ${b.max}`, {
                x: bx, y: curY + 0.74, w: B_W, h: 0.18, align: "center", fontSize: 8, color: C.slate500,
            });
        });
        curY += B_H + 0.3;
    }

    // ── AI final recommendation + key insights (full width) ──────────────────
    if (summary?.final_recommendation) {
        const rec = summary.final_recommendation.replace(/^✦\s*/, "").trim();
        const estLines = Math.max(2, Math.ceil(rec.length / 100));
        const recH = Math.min(1.4, estLines * 0.28 + 0.1);
        slide.addShape(pptx.ShapeType.ellipse, { x: 0.3, y: curY + 0.11, w: 0.11, h: 0.11, fill: { color: C.indigo } });
        slide.addText(rec, {
            x: 0.5, y: curY, w: 12.55, h: recH,
            fontSize: 11, color: C.slate900, wrap: true, valign: "top", lineSpacingMultiple: 1.3,
        });
        curY += recH + 0.2;
    }

    if (summary?.highlights?.length) {
        slide.addShape(pptx.ShapeType.line, { x: 0.3, y: curY, w: 12.75, h: 0, line: { color: C.slate200, width: 0.75 } });
        curY += 0.2;
        slide.addText("KEY INSIGHTS", {
            x: 0.3, y: curY, w: 12.75, h: 0.24, fontSize: 7.5, bold: true, color: C.indigo, charSpacing: 1.5,
        });
        curY += 0.3;
        for (const bullet of summary.highlights.slice(0, 5)) {
            const text = bullet.replace(/^[•\-]\s*/, "").trim();
            const estH = Math.min(0.6, Math.max(0.26, Math.ceil(text.length / 130) * 0.24 + 0.05));
            slide.addShape(pptx.ShapeType.ellipse, { x: 0.35, y: curY + 0.09, w: 0.09, h: 0.09, fill: { color: C.indigo } });
            slide.addText(text, {
                x: 0.54, y: curY, w: 12.5, h: estH,
                fontSize: 9.5, color: C.slate700, wrap: true, valign: "top", lineSpacingMultiple: 1.3,
            });
            curY += estH + 0.1;
            if (curY > 7.2) break;
        }
    }
}

// ── Candidate hero slide ─────────────────────────────────────────────────────
// LAYOUT_WIDE = 13.33" × 7.5"
// Left panel (x=0.2, w=1.5): rank badge | photo | overall score box
// Right area (x=2.0 → 12.8): name | position | info chips | 4D chips | 4D 2×2 grid | strengths/gaps
async function addCandidateSlide(pptx: PptxGenJS, r: Stage3Result, photoBase64: string | null, displayRank: number) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });

    const has4Dim = r.experience_score !== null;

    // ── Rank badge ───────────────────────────────────────────────────────────
    const rankColors: Record<number, string> = { 1: C.amber, 2: "94a3b8", 3: "b45309" };
    const rColor = rankColors[displayRank] ?? C.indigo;
    slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.2, y: 0.18, w: 0.58, h: 0.58, fill: { color: rColor }, rectRadius: 0.08,
    });
    slide.addText(`#${displayRank}`, {
        x: 0.2, y: 0.18, w: 0.58, h: 0.58,
        align: "center", valign: "middle", fontSize: 15, bold: true, color: C.white,
    });

    // ── Photo ────────────────────────────────────────────────────────────────
    const photoX = 0.2, photoY = 0.9, photoS = 1.5;
    if (photoBase64) {
        slide.addImage({ data: photoBase64, x: photoX, y: photoY, w: photoS, h: photoS, rounding: true });
    } else {
        slide.addShape(pptx.ShapeType.roundRect, {
            x: photoX, y: photoY, w: photoS, h: photoS, fill: { color: "dde1f0" }, rectRadius: photoS / 2,
        });
        slide.addText(r.name.charAt(0).toUpperCase(), {
            x: photoX, y: photoY, w: photoS, h: photoS,
            align: "center", valign: "middle", fontSize: 40, bold: true, color: C.indigo,
        });
    }

    // ── Overall score box (below photo) ──────────────────────────────────────
    slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.2, y: 2.52, w: 1.5, h: 0.78, fill: { color: C.slate100 }, line: { color: C.slate200, width: 0.75 }, rectRadius: 0.1,
    });
    slide.addShape(pptx.ShapeType.rect, { x: 0.2, y: 2.52, w: 1.5, h: 0.05, fill: { color: C.indigo } });
    slide.addText("OVERALL", {
        x: 0.2, y: 2.6, w: 1.5, h: 0.24,
        align: "center", fontSize: 7, bold: true, color: C.indigo, charSpacing: 1,
    });
    slide.addText(`${r.score}`, {
        x: 0.2, y: 2.8, w: 1.5, h: 0.5,
        align: "center", fontSize: 26, bold: true, color: C.slate900,
    });

    // ── Name ─────────────────────────────────────────────────────────────────
    slide.addText(r.name, {
        x: 2.0, y: 0.18, w: 10.8, h: 0.58, fontSize: 24, bold: true, color: C.slate900,
    });

    // ── Position / Company ───────────────────────────────────────────────────
    const posLine = [r.position, r.company].filter(Boolean).join("   •   ");
    if (posLine) {
        slide.addText(posLine, {
            x: 2.0, y: 0.78, w: 10.8, h: 0.3, fontSize: 11, color: C.slate500,
        });
    }

    // ── Info chips: age | gender | nationality | linkedin | address ──────────
    let chipX = 2.0;
    const INFO_Y = 1.13, INFO_H = 0.3;
    if (r.age != null) {
        const ageLabel = r.age_source === "estimated" ? `~${r.age} yrs (est.)` : `${r.age} yrs`;
        slide.addShape(pptx.ShapeType.roundRect, {
            x: chipX, y: INFO_Y, w: 1.15, h: INFO_H, fill: { color: C.slate100 }, rectRadius: 0.05,
        });
        slide.addText(ageLabel, {
            x: chipX + 0.1, y: INFO_Y, w: 0.95, h: INFO_H, fontSize: 8, color: C.slate600, valign: "middle",
        });
        chipX += 1.25;
    }
    if (r.gender) {
        slide.addShape(pptx.ShapeType.roundRect, {
            x: chipX, y: INFO_Y, w: 0.85, h: INFO_H, fill: { color: C.slate100 }, rectRadius: 0.05,
        });
        slide.addText(trunc(r.gender, 12), {
            x: chipX + 0.1, y: INFO_Y, w: 0.65, h: INFO_H, fontSize: 8, color: C.slate600, valign: "middle",
        });
        chipX += 0.95;
    }
    if (r.nationality) {
        slide.addShape(pptx.ShapeType.roundRect, {
            x: chipX, y: INFO_Y, w: 1.3, h: INFO_H, fill: { color: C.slate100 }, rectRadius: 0.05,
        });
        slide.addText(trunc(r.nationality, 18), {
            x: chipX + 0.1, y: INFO_Y, w: 1.1, h: INFO_H, fontSize: 8, color: C.slate600, valign: "middle",
        });
        chipX += 1.4;
    }
    if (r.linkedin) {
        slide.addShape(pptx.ShapeType.roundRect, {
            x: chipX, y: INFO_Y, w: 1.65, h: INFO_H, fill: { color: C.indigo50 }, rectRadius: 0.05,
        });
        slide.addText("LinkedIn  View Profile", {
            x: chipX + 0.1, y: INFO_Y, w: 1.45, h: INFO_H,
            fontSize: 8, color: C.indigo, valign: "middle",
            hyperlink: { url: r.linkedin },
        });
        chipX += 1.75;
    }
    if (r.address) {
        const remW = Math.max(1.0, Math.min(6.5, 12.8 - chipX));
        slide.addShape(pptx.ShapeType.roundRect, {
            x: chipX, y: INFO_Y, w: remW, h: INFO_H, fill: { color: C.slate100 }, rectRadius: 0.05,
        });
        slide.addText(trunc(r.address, 90), {
            x: chipX + 0.1, y: INFO_Y, w: remW - 0.2, h: INFO_H, fontSize: 8, color: C.slate600, valign: "middle",
        });
    }

    // ── Divider ───────────────────────────────────────────────────────────────
    slide.addShape(pptx.ShapeType.line, {
        x: 1.95, y: 1.55, w: 10.9, h: 0, line: { color: C.slate200, width: 0.5 },
    });

    if (has4Dim) {
        // ── Strengths / Background / Areas to note (3 cols, right under divider) ─
        // Qualitative summary comes first — scoring detail follows below.
        const SUM_Y = 1.65, SUM_H = 1.55;
        const S3_GAP = 0.2, S3_W = (10.8 - 2 * S3_GAP) / 3;
        const S3_X = [2.0, 2.0 + S3_W + S3_GAP, 2.0 + 2 * (S3_W + S3_GAP)];

        if (r.strengths) {
            slide.addShape(pptx.ShapeType.roundRect, {
                x: S3_X[0], y: SUM_Y, w: S3_W, h: SUM_H, fill: { color: C.slate100 }, line: { color: C.slate200, width: 0.5 }, rectRadius: 0.08,
            });
            slide.addShape(pptx.ShapeType.rect, { x: S3_X[0], y: SUM_Y, w: S3_W, h: 0.04, fill: { color: C.green } });
            slide.addText("STRENGTHS", {
                x: S3_X[0] + 0.16, y: SUM_Y + 0.12, w: S3_W - 0.28, h: 0.2,
                fontSize: 7, bold: true, color: C.green, charSpacing: 1,
            });
            slide.addText(trunc(r.strengths, 220), {
                x: S3_X[0] + 0.16, y: SUM_Y + 0.34, w: S3_W - 0.28, h: SUM_H - 0.44,
                fontSize: 8, color: C.slate700, wrap: true, valign: "top", lineSpacingMultiple: 1.2,
            });
        }

        addBackgroundBox(slide, pptx, S3_X[1], SUM_Y, S3_W, SUM_H, r.education, r.experience_history);

        if (r.gaps) {
            slide.addShape(pptx.ShapeType.roundRect, {
                x: S3_X[2], y: SUM_Y, w: S3_W, h: SUM_H, fill: { color: C.slate100 }, line: { color: C.slate200, width: 0.5 }, rectRadius: 0.08,
            });
            slide.addShape(pptx.ShapeType.rect, { x: S3_X[2], y: SUM_Y, w: S3_W, h: 0.04, fill: { color: C.amber } });
            slide.addText("AREAS TO NOTE", {
                x: S3_X[2] + 0.16, y: SUM_Y + 0.12, w: S3_W - 0.28, h: 0.2,
                fontSize: 7, bold: true, color: C.amber, charSpacing: 1,
            });
            slide.addText(trunc(r.gaps, 220), {
                x: S3_X[2] + 0.16, y: SUM_Y + 0.34, w: S3_W - 0.28, h: SUM_H - 0.44,
                fontSize: 8, color: C.slate700, wrap: true, valign: "top", lineSpacingMultiple: 1.2,
            });
        }

        // ── 4D chip row (below the summary) ──────────────────────────────────
        // 4 chips spanning x=2.0→12.8 (10.8" total), equal width with 0.1" gaps
        const CHIP_ROW_Y = SUM_Y + SUM_H + 0.15;
        const CHIP_H     = 0.5;
        const CHIP_W     = (10.8 - 3 * 0.1) / 4; // ≈ 2.625"
        const CHIP_GAP   = 0.1;

        DIM.forEach((d, i) => {
            const cx  = 2.0 + i * (CHIP_W + CHIP_GAP);
            const sc  = d.getScore(r);
            const pct = sc != null ? Math.max(0, Math.min(1, sc / 25)) : 0;

            // Chip background
            slide.addShape(pptx.ShapeType.roundRect, {
                x: cx, y: CHIP_ROW_Y, w: CHIP_W, h: CHIP_H, fill: { color: d.bg }, rectRadius: 0.08,
            });
            // Category label
            slide.addText(d.chipLabel, {
                x: cx + 0.12, y: CHIP_ROW_Y + 0.06, w: CHIP_W - 0.9, h: 0.18,
                fontSize: 6.5, bold: true, color: d.text, charSpacing: 0.5,
            });
            // Score value
            slide.addText(`${sc ?? "-"}`, {
                x: cx + 0.12, y: CHIP_ROW_Y + 0.2, w: CHIP_W - 0.9, h: 0.3,
                fontSize: 18, bold: true, color: d.text,
            });
            // Scale label
            slide.addText("/ 25", {
                x: cx + CHIP_W - 0.65, y: CHIP_ROW_Y + 0.26, w: 0.55, h: 0.2,
                fontSize: 8.5, color: d.text, align: "right",
            });
            // Progress bar at bottom of chip (correctly scaled /25)
            const barY = CHIP_ROW_Y + CHIP_H - 0.1;
            const barW = CHIP_W - 0.24;
            slide.addShape(pptx.ShapeType.rect, {
                x: cx + 0.12, y: barY, w: barW, h: 0.05, fill: { color: "e2e8f0" },
            });
            if (pct > 0) {
                slide.addShape(pptx.ShapeType.rect, {
                    x: cx + 0.12, y: barY, w: barW * pct, h: 0.05, fill: { color: d.text },
                });
            }
        });

        // ── 4D 2×2 grid (below chip row) ──────────────────────────────────────
        // Col 0: x=2.0, w=5.3  |  gap=0.2  |  Col 1: x=7.5, w=5.3
        const GRID_Y     = CHIP_ROW_Y + CHIP_H + 0.1;
        const ROW_GAP    = 0.1;
        const ROW_H      = (7.22 - GRID_Y - ROW_GAP) / 2;
        const COL_X      = [2.0,  7.5 ];
        const COL_W      = [5.3,  5.3 ];

        DIM.forEach((d, i) => {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const bx  = COL_X[col];
            const by  = GRID_Y + row * (ROW_H + ROW_GAP);
            const bw  = COL_W[col];
            const bh  = ROW_H;

            const sc      = d.getScore(r);
            const bullets = parseBullets(d.getSummary(r));

            // Box background — lighter tint than the chip row since these are large blocks
            slide.addShape(pptx.ShapeType.roundRect, {
                x: bx, y: by, w: bw, h: bh, fill: { color: d.boxBg }, line: { color: C.slate200, width: 0.5 }, rectRadius: 0.1,
            });

            // Header: label (left) + score/25 (right)
            slide.addText(d.label.toUpperCase(), {
                x: bx + 0.2, y: by + 0.1, w: bw - 0.9, h: 0.26,
                fontSize: 7.5, bold: true, color: d.text, charSpacing: 0.5,
            });
            if (sc !== null) {
                slide.addText(`${sc} / 25`, {
                    x: bx + bw - 0.8, y: by + 0.1, w: 0.7, h: 0.26,
                    fontSize: 9.5, bold: true, color: d.text, align: "right",
                });
            }

            // Thin separator under header
            slide.addShape(pptx.ShapeType.line, {
                x: bx + 0.15, y: by + 0.4, w: bw - 0.3, h: 0,
                line: { color: d.light, width: 0.5 },
            });

            // Bullet points (split by "|")
            const BULLET_TOP  = by + 0.46;
            const BULLET_AREA = bh - 0.52;
            const maxBullets  = Math.min(bullets.length, 4);
            if (maxBullets > 0) {
                const lineH = Math.min(0.42, BULLET_AREA / maxBullets);
                bullets.slice(0, maxBullets).forEach((b, bi) => {
                    const ly = BULLET_TOP + bi * lineH;
                    slide.addShape(pptx.ShapeType.ellipse, {
                        x: bx + 0.2, y: ly + 0.07, w: 0.09, h: 0.09, fill: { color: d.text },
                    });
                    slide.addText(trunc(b, 105), {
                        x: bx + 0.35, y: ly, w: bw - 0.5, h: lineH,
                        fontSize: 8.5, color: C.slate700, wrap: true, valign: "top",
                        lineSpacingMultiple: 1.2,
                    });
                });
            }
        });

    } else {
        // ── No 4D: strengths / background / gaps (3 cols) + tradeoff below ───
        const divY = 1.62;
        slide.addShape(pptx.ShapeType.line, {
            x: 2.0, y: divY, w: 10.8, h: 0, line: { color: C.slate200, width: 0.75 },
        });

        const N3_Y = divY + 0.15, N3_H = 2.35;
        const N3_GAP = 0.2, N3_W = (10.8 - 2 * N3_GAP) / 3;
        const N3_X = [2.0, 2.0 + N3_W + N3_GAP, 2.0 + 2 * (N3_W + N3_GAP)];

        slide.addText("STRENGTHS", {
            x: N3_X[0], y: N3_Y, w: N3_W, h: 0.25, fontSize: 7.5, bold: true, color: C.green, charSpacing: 1,
        });
        slide.addText(trunc(r.strengths, 340), {
            x: N3_X[0], y: N3_Y + 0.28, w: N3_W, h: N3_H - 0.28, fontSize: 8.5, color: C.slate700, wrap: true, valign: "top", lineSpacingMultiple: 1.25,
        });

        addBackgroundBox(slide, pptx, N3_X[1], N3_Y, N3_W, N3_H, r.education, r.experience_history, true);

        slide.addText("AREAS TO NOTE", {
            x: N3_X[2], y: N3_Y, w: N3_W, h: 0.25, fontSize: 7.5, bold: true, color: C.amber, charSpacing: 1,
        });
        slide.addText(trunc(r.gaps, 340), {
            x: N3_X[2], y: N3_Y + 0.28, w: N3_W, h: N3_H - 0.28, fontSize: 8.5, color: C.slate700, wrap: true, valign: "top", lineSpacingMultiple: 1.25,
        });

        if (r.tradeoff) {
            const trY = divY + 2.65;
            slide.addShape(pptx.ShapeType.line, {
                x: 2.0, y: trY, w: 10.8, h: 0, line: { color: C.slate200, width: 0.75 },
            });
            slide.addText("OVERALL EVALUATION", {
                x: 2.0, y: trY + 0.15, w: 3.5, h: 0.25, fontSize: 7.5, bold: true, color: C.indigo, charSpacing: 1,
            });
            slide.addText(trunc(r.tradeoff, 500), {
                x: 2.0, y: trY + 0.44, w: 10.8, h: 1.5, fontSize: 9, color: C.slate700, wrap: true, valign: "top",
            });
        }
    }
}

// ── Education + Career History box, shared by both candidate-slide layouts ───
function addBackgroundBox(
    slide: any, pptx: PptxGenJS, x: number, y: number, w: number, h: number,
    education: string | null, history: string[], noFill = false,
) {
    if (!noFill) {
        slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill: { color: C.indigo50 }, rectRadius: 0.08 });
    }
    const padX = noFill ? 0 : 0.16;
    const padTop = noFill ? 0.28 : 0.1;
    slide.addText("BACKGROUND", {
        x: x + padX, y: y + (noFill ? 0 : 0.1), w: w - padX * 2, h: 0.2,
        fontSize: noFill ? 7.5 : 7, bold: true, color: C.indigo, charSpacing: 1,
    });

    let curY = y + padTop;
    if (education) {
        slide.addText(trunc(education, 100), {
            x: x + padX, y: curY, w: w - padX * 2, h: 0.3,
            fontSize: 8, bold: true, color: C.slate900, wrap: true, valign: "top",
        });
        curY += 0.32;
    }
    if (history.length) {
        // One text box for the whole history, joined by real newlines — matches the
        // reference n8n template's single-placeholder approach. Rendering each line as
        // its own fixed-height box (previous approach) let long position/company names
        // wrap to 2 lines and overlap the box below it.
        slide.addText(history.map(line => trunc(line, 110)).join("\n"), {
            x: x + padX, y: curY, w: w - padX * 2, h: y + h - curY,
            fontSize: 7.5, color: C.slate600, wrap: true, valign: "top", lineSpacingMultiple: 1.15,
        });
    }
}

// ── LinkedIn icon ──────────────────────────────────────────────────────────────
// Real logo asset (public/linkedin-logo.png), read lazily (only when a PPTX is
// actually generated) and cached as a data URI. Must NOT run at module load —
// this file's exports are pulled in by pages that never touch PPTX export, and
// `public/` assets aren't guaranteed to exist in the serverless function's
// bundled filesystem, so a top-level readFileSync here crashed every page that
// imports this module (e.g. requisitions/manage, ai-search-v3) with ENOENT.
let _linkedinIconUri: string | null = null;
function getLinkedinIconUri(): string | null {
    if (_linkedinIconUri !== null) return _linkedinIconUri;
    try {
        _linkedinIconUri = `data:image/png;base64,${fs.readFileSync(
            path.join(process.cwd(), "public", "linkedin-logo.png")
        ).toString("base64")}`;
    } catch (e) {
        console.error("Failed to load LinkedIn icon asset for PPTX export", e);
        _linkedinIconUri = "";
    }
    return _linkedinIconUri;
}

// ── Short Profile card slides (JR only) ───────────────────────────────────────
// Two sections reuse this same card layout, matching the reference n8n
// template's "Short Profile potential candidates" pages:
//   1. User picks   — recruiter-curated Top Profile shortlist (jr_candidates.list_type),
//                      independent of any AI ranking job.
//   2. AI Suggestion — Top 20 AI-ranked results for this job, same card format,
//                      with a Score/4D badge (AI-only data — not shown for user picks).
// `badge` marks a candidate that appears in BOTH lists (shown only on the AI
// Suggestion cards) rather than de-duplicating — recruiter and AI agreement is
// itself a useful signal, not noise to collapse away.
type ProfileCardItem = {
    candidate_id: string;
    rank: number;
    name: string;
    photo_url: string | null;
    linkedin: string | null;
    age: number | null;
    nationality: string | null;
    position: string | null;
    company: string | null;
    location: string | null;
    education: string | null;
    experience_history: string[];
    rating: string | null;
    latest_status: string | null;
    badge?: string | null;
    score?: number | null;
    dims?: { label: string; score: number | null }[] | null;
};

const SHORT_PROFILE_PAGE_SIZE = 6;
// Rough estimate of characters-per-inch at 7pt — used only to guess how many
// wrapped lines a field will take so the elements below it don't overlap.
// (n8n doesn't truncate these fields either — Google Slides just lets the
// placeholder grow/wrap; pptxgenjs has no auto-shrink, so we estimate instead.)
const CHARS_PER_INCH_7PT = 20;

async function addShortProfileCardsSlides(pptx: PptxGenJS, candidates: ProfileCardItem[], titleBase: string) {
    const totalPages = Math.max(1, Math.ceil(candidates.length / SHORT_PROFILE_PAGE_SIZE));
    const photos = await Promise.all(candidates.map(c => fetchImageBase64(c.photo_url)));

    for (let page = 0; page < totalPages; page++) {
        const pageItems = candidates.slice(page * SHORT_PROFILE_PAGE_SIZE, (page + 1) * SHORT_PROFILE_PAGE_SIZE);
        const photoOffset = page * SHORT_PROFILE_PAGE_SIZE;

        const slide = pptx.addSlide();
        slide.background = { color: C.white };
        const title = totalPages > 1 ? `${titleBase} (${page + 1}/${totalPages})` : titleBase;
        slide.addText(title, { x: 0.3, y: 0.18, w: 12.75, h: 0.45, fontSize: 20, bold: true, color: C.slate900 });

        const GRID_X = 0.3, GRID_Y = 0.78, GAP = 0.2;
        const CARD_W = (12.7 - 2 * GAP) / 3, CARD_H = (6.5 - GAP) / 2;

        pageItems.forEach((c, i) => {
            const col = i % 3, row = Math.floor(i / 3);
            const cx = GRID_X + col * (CARD_W + GAP), cy = GRID_Y + row * (CARD_H + GAP);
            const photo = photos[photoOffset + i];
            const displayRank = page * SHORT_PROFILE_PAGE_SIZE + i + 1;

            slide.addShape(pptx.ShapeType.roundRect, {
                x: cx, y: cy, w: CARD_W, h: CARD_H, fill: { color: C.slate100 }, line: { color: C.slate200, width: 0.5 }, rectRadius: 0.08,
            });

            // Header: rank + name (left, wraps up to 2 lines — not truncated, matches n8n)
            slide.addText(`${displayRank}. ${c.name}`, {
                x: cx + 0.15, y: cy + 0.08, w: CARD_W - 1.6, h: 0.4, fontSize: 12, bold: true, color: C.slate900, wrap: true, valign: "top",
            });

            // Right-side stack: Status → "also on other list" badge
            const rightStack: { text: string; color: string }[] = [];
            if (c.latest_status) {
                const isGray = GRAY_STATUSES.includes(c.latest_status);
                const isRejected = c.latest_status === "Rejected";
                rightStack.push({ text: c.latest_status, color: isRejected ? C.red : isGray ? C.slate500 : C.slate600 });
            }
            if (c.badge) rightStack.push({ text: c.badge, color: C.green });
            rightStack.forEach((item, idx) => {
                slide.addText(item.text, {
                    x: cx + CARD_W - 1.45, y: cy + 0.08 + idx * 0.18, w: 1.3, h: 0.18,
                    fontSize: 6.5, bold: true, color: item.color, align: "right",
                });
            });

            // Photo
            const photoX = cx + 0.15, photoY = cy + 0.5, photoS = 0.85;
            if (photo) {
                slide.addImage({ data: photo, x: photoX, y: photoY, w: photoS, h: photoS, rounding: true });
            } else {
                slide.addShape(pptx.ShapeType.roundRect, { x: photoX, y: photoY, w: photoS, h: photoS, fill: { color: "dde1f0" }, rectRadius: photoS / 2 });
                slide.addText(c.name.charAt(0).toUpperCase(), {
                    x: photoX, y: photoY, w: photoS, h: photoS, align: "center", valign: "middle", fontSize: 22, bold: true, color: C.indigo,
                });
            }

            // Info lines — bold label + value per line, single text box (real line
            // breaks via `breakLine`, not separate boxes) so PowerPoint wraps each
            // value naturally instead of us pre-cutting it with "…".
            const infoW = CARD_W - photoS - 0.45;
            const fields: { label: string; value: string }[] = [
                { label: "Position", value: c.position || "-" },
                { label: "Company", value: c.company || "-" },
                { label: "Nationality", value: c.nationality || "-" },
                { label: "Location", value: c.location || "-" },
                { label: "Age", value: c.age != null ? `${c.age}` : "-" },
                { label: "Education", value: c.education || "-" },
            ];
            const charsPerLine = Math.max(10, Math.floor(infoW * CHARS_PER_INCH_7PT));
            let estLines = 0;
            const infoRuns: { text: string; options: any }[] = [];
            fields.forEach(f => {
                infoRuns.push({ text: `${f.label}: `, options: { bold: true } });
                infoRuns.push({ text: f.value, options: { breakLine: true } });
                estLines += Math.max(1, Math.ceil((f.label.length + 2 + f.value.length) / charsPerLine));
            });
            const infoH = estLines * 0.13;
            slide.addText(infoRuns, {
                x: photoX + photoS + 0.15, y: photoY, w: infoW, h: Math.max(photoS, infoH),
                fontSize: 7, color: C.slate600, wrap: true, valign: "top", lineSpacingMultiple: 1.15,
            });

            // LinkedIn logo + Rating row
            const contentBottom = photoY + Math.max(photoS, infoH);
            const badgeY = contentBottom + 0.1;
            const linkedinIconUri = c.linkedin ? getLinkedinIconUri() : null;
            if (c.linkedin && linkedinIconUri) {
                slide.addImage({ data: linkedinIconUri, x: cx + 0.15, y: badgeY, w: 0.26, h: 0.26, hyperlink: { url: c.linkedin } });
            }
            if (c.rating) {
                const ratingX = cx + (c.linkedin ? 0.48 : 0.15);
                slide.addShape(pptx.ShapeType.roundRect, { x: ratingX, y: badgeY, w: 0.95, h: 0.26, fill: { color: C.amber50 }, rectRadius: 0.05 });
                slide.addText(`★ ${c.rating}`, { x: ratingX, y: badgeY, w: 0.95, h: 0.26, align: "center", valign: "middle", fontSize: 7, bold: true, color: C.amber });
            }

            // Score + 4D footer (AI only) — bottom-left corner, per feedback
            const hasFooter = c.score != null;
            const footerH = hasFooter ? (c.dims?.length ? 0.36 : 0.2) : 0;
            if (hasFooter) {
                const footerY = cy + CARD_H - footerH - 0.06;
                slide.addText(`Score ${c.score}`, {
                    x: cx + 0.15, y: footerY, w: CARD_W - 0.3, h: 0.18, fontSize: 8, bold: true, color: C.indigo,
                });
                if (c.dims?.length) {
                    const dimLine = c.dims.map(d => `${d.label} ${d.score ?? "-"}`).join(" · ");
                    slide.addText(dimLine, {
                        x: cx + 0.15, y: footerY + 0.17, w: CARD_W - 0.3, h: 0.16, fontSize: 6, color: C.slate500,
                    });
                }
            }

            // Experience history — single joined text block, no per-line truncation
            if (c.experience_history.length) {
                const expY = badgeY + 0.34;
                slide.addText("EXPERIENCE", { x: cx + 0.15, y: expY, w: CARD_W - 0.3, h: 0.18, fontSize: 6.5, bold: true, color: C.slate500, charSpacing: 0.5 });
                slide.addText(c.experience_history.slice(0, 3).join("\n"), {
                    x: cx + 0.15, y: expY + 0.2, w: CARD_W - 0.3, h: Math.max(0.3, cy + CARD_H - footerH - 0.1 - (expY + 0.24)),
                    fontSize: 6.5, color: C.slate600, wrap: true, valign: "top", lineSpacingMultiple: 1.15,
                });
            }
        });
    }
}

// ── Top table slide (score + 4D breakdown, used by both JR & Search reports) ──
function addTopTableSlide(pptx: PptxGenJS, results: Stage3Result[], title: string) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });
    slide.addText(title, { x: 0.3, y: 0.18, w: 12.75, h: 0.55, fontSize: 20, bold: true, color: C.slate900 });

    const hOpts = { bold: true, color: C.white, fill: { color: C.indigo }, valign: "middle" as const };
    const headerRow = [
        { text: "#",         options: { ...hOpts, align: "center" as const } },
        { text: "Candidate", options: hOpts },
        { text: "Age",       options: { ...hOpts, align: "center" as const } },
        { text: "Gender",    options: { ...hOpts, align: "center" as const } },
        { text: "Position",  options: hOpts },
        { text: "Company",   options: hOpts },
        { text: "LinkedIn",  options: { ...hOpts, align: "center" as const } },
        { text: "Score",     options: { ...hOpts, align: "center" as const } },
        { text: "Exp",       options: { ...hOpts, align: "center" as const } },
        { text: "Lead",      options: { ...hOpts, align: "center" as const } },
        { text: "Mkt",       options: { ...hOpts, align: "center" as const } },
        { text: "Skill",     options: { ...hOpts, align: "center" as const } },
    ];

    const scoreColor = (v: number | null) => {
        if (v === null) return C.slate300;
        const p = v; // /100 scale
        return p >= 80 ? C.green : p >= 60 ? C.indigo : p >= 40 ? C.amber : C.red;
    };

    // Each 4D column keeps its dimension color regardless of value — consistent with candidate slides
    const DIM_COL_COLORS = ["059669", "7c3aed", "0284c7", "ea580c"] as const;

    const dataRows = results.map((r, idx) => {
        const rowFill = idx % 2 === 0 ? { color: C.white } : { color: C.slate100 };
        const base    = { fill: rowFill, valign: "middle" as const };
        const fmt     = (v: number | null) => v != null ? `${v}` : "-";
        return [
            { text: `${idx + 1}`,                    options: { ...base, align: "center" as const, bold: true, color: C.slate500 } },
            { text: r.name,                           options: { ...base, bold: true, color: C.slate900 } },
            { text: r.age != null ? `${r.age}` : "-", options: { ...base, align: "center" as const, color: C.slate600 } },
            { text: trunc(r.gender, 8) || "-",        options: { ...base, align: "center" as const, color: C.slate600 } },
            { text: trunc(r.position, 32) || "-",     options: { ...base, color: C.slate600 } },
            { text: trunc(r.company, 26) || "-",      options: { ...base, color: C.slate600 } },
            { text: r.linkedin ? "View" : "-",        options: r.linkedin ? { ...base, align: "center" as const, color: C.indigo, hyperlink: { url: r.linkedin } } : { ...base, align: "center" as const, color: C.slate300 } },
            { text: `${r.score}`,                     options: { ...base, align: "center" as const, bold: true, color: scoreColor(r.score) } },
            { text: fmt(r.experience_score),          options: { ...base, align: "center" as const, bold: true, color: DIM_COL_COLORS[0] } },
            { text: fmt(r.leadership_score),          options: { ...base, align: "center" as const, bold: true, color: DIM_COL_COLORS[1] } },
            { text: fmt(r.market_score),              options: { ...base, align: "center" as const, bold: true, color: DIM_COL_COLORS[2] } },
            { text: fmt(r.skills_score),              options: { ...base, align: "center" as const, bold: true, color: DIM_COL_COLORS[3] } },
        ];
    });

    (slide as any).addTable([headerRow, ...dataRows], {
        x: 0.2, y: 0.85, w: 12.9,
        fontSize: 7.5,
        rowH: 0.3,
        border: { type: "solid", pt: 0.5, color: C.slate200 },
        autoPage: true,
        autoPageRepeatHeader: true,
        autoPageHeaderRows: 1,
        autoPageSlideStartY: 0.5,
        newSlideStartY: 0.5,
        colW: [0.35, 2.2, 0.5, 0.65, 2.0, 1.9, 0.8, 0.65, 0.55, 0.55, 0.55, 0.55], // total ≈ 11.25
    });
}

// ── Long List slide (JR only — no scores, Central Group Long List format) ────
// Ordering + row coloring matches the reference n8n Long List workflow:
// Top Profile (by rank) → Standard → Gray-status → Rejected. Manually paginated
// at a fixed 20 rows/slide instead of pptxgenjs's height-based autoPage, so
// every page shows a predictable count.
const LONGLIST_PAGE_SIZE = 20;
const GRAY_STATUSES = ["Not Open", "Not fit", "Too Senior"];
const isTopProfile = (r: Stage3Result) => (r.list_type ?? "").toLowerCase().includes("top");

function bucketLongList(pool: Stage3Result[]): Stage3Result[] {
    const top = pool.filter(isTopProfile).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    const rest = pool.filter(r => !isTopProfile(r));
    const standard = rest.filter(r => !GRAY_STATUSES.includes(r.latest_status ?? "") && r.latest_status !== "Rejected");
    const gray = rest.filter(r => GRAY_STATUSES.includes(r.latest_status ?? ""));
    const rejected = rest.filter(r => r.latest_status === "Rejected");
    return [...top, ...standard, ...gray, ...rejected];
}

function addLongListSlide(pptx: PptxGenJS, results: Stage3Result[], titleBase: string) {
    const totalPages = Math.max(1, Math.ceil(results.length / LONGLIST_PAGE_SIZE));

    for (let page = 0; page < totalPages; page++) {
        const pageResults = results.slice(page * LONGLIST_PAGE_SIZE, (page + 1) * LONGLIST_PAGE_SIZE);
        const rowOffset = page * LONGLIST_PAGE_SIZE;

        const slide = pptx.addSlide();
        slide.background = { color: C.white };
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });
        const title = totalPages > 1 ? `${titleBase} (${page + 1}/${totalPages})` : titleBase;
        slide.addText(title, { x: 0.3, y: 0.18, w: 6.5, h: 0.55, fontSize: 20, bold: true, color: C.slate900 });

        // Legend (matches the reference Central Group template)
        slide.addShape(pptx.ShapeType.rect, { x: 9.5, y: 0.2, w: 0.22, h: 0.16, fill: { color: C.slate200 } });
        slide.addText("= Not Fit, Not Open, Too Senior", { x: 9.78, y: 0.16, w: 3.3, h: 0.24, fontSize: 8, color: C.slate600, valign: "middle" });
        slide.addShape(pptx.ShapeType.rect, { x: 9.5, y: 0.42, w: 0.22, h: 0.16, fill: { color: C.red50 }, line: { color: C.red, width: 0.5 } });
        slide.addText("= Rejected", { x: 9.78, y: 0.38, w: 3.3, h: 0.24, fontSize: 8, color: C.slate600, valign: "middle" });

        const hOpts = { bold: true, color: C.white, fill: { color: C.indigo }, valign: "middle" as const };
        const headerRow = [
            { text: "No",          options: { ...hOpts, align: "center" as const } },
            { text: "Company",     options: hOpts },
            { text: "Name",        options: hOpts },
            { text: "Position",    options: hOpts },
            { text: "Age",         options: { ...hOpts, align: "center" as const } },
            { text: "Gender",      options: { ...hOpts, align: "center" as const } },
            { text: "Location",    options: hOpts },
            { text: "Nationality", options: hOpts },
            { text: "LinkedIn",    options: { ...hOpts, align: "center" as const } },
            { text: "Remark",      options: hOpts },
        ];

        const dataRows = pageResults.map((r, idx) => {
            const isGray = GRAY_STATUSES.includes(r.latest_status ?? "");
            const isRejected = r.latest_status === "Rejected";
            const rowFill = isRejected ? { color: C.red50 } : isGray ? { color: C.slate200 } : idx % 2 === 0 ? { color: C.white } : { color: C.slate100 };
            const base    = { fill: rowFill, valign: "middle" as const };
            return [
                { text: `${rowOffset + idx + 1}`,            options: { ...base, align: "center" as const, bold: true, color: C.slate500 } },
                { text: trunc(r.company, 30) || "-",        options: { ...base, color: C.slate600 } },
                { text: r.name,                              options: { ...base, bold: true, color: C.slate900 } },
                { text: trunc(r.position, 34) || "-",        options: { ...base, color: C.slate600 } },
                { text: r.age != null ? `${r.age}` : "-",    options: { ...base, align: "center" as const, color: C.slate600 } },
                { text: trunc(r.gender, 8) || "-",           options: { ...base, align: "center" as const, color: C.slate600 } },
                { text: trunc(r.location, 20) || "-",        options: { ...base, color: C.slate600 } },
                { text: trunc(r.nationality, 18) || "-",     options: { ...base, color: C.slate600 } },
                { text: r.linkedin ? "View" : "-",           options: r.linkedin ? { ...base, align: "center" as const, color: C.indigo, hyperlink: { url: r.linkedin } } : { ...base, align: "center" as const, color: C.slate300 } },
                { text: r.latest_status ?? "-",              options: { ...base, color: isRejected ? C.red : C.slate600 } },
            ];
        });

        (slide as any).addTable([headerRow, ...dataRows], {
            x: 0.2, y: 0.85, w: 12.9,
            fontSize: 8,
            rowH: 0.3,
            border: { type: "solid", pt: 0.5, color: C.slate200 },
            colW: [0.45, 1.9, 1.8, 2.2, 0.5, 0.65, 1.15, 1.15, 0.7, 1.6], // total ≈ 12.1
        });
    }
}

// ── JR Assessment export ──────────────────────────────────────────────────────
export async function generateAssessmentPPTX(
    jobId: string,
    jrId: string,
    jrTitle: string,
): Promise<{ base64: string; filename: string }> {
    const jobData = await getStage3JobStatus(jobId, jrId);
    if (!jobData || jobData.results.length === 0) throw new Error("ไม่มีผลลัพธ์ AI Assessment");

    const sorted = [...jobData.results].sort((a, b) => b.score - a.score || a.rank - b.rank);
    const top3   = sorted.slice(0, 3);
    const top20  = sorted.slice(0, 20);
    const avgScores = computeAvgScores(sorted);

    const { data: jrRow } = await adminAuthClient
        .from("job_requisitions").select("position_jr, bu, sub_bu, jr_type, job_description").eq("jr_id", jrId).single();
    const jr = jrRow as any;
    const title = jrTitle || jr?.position_jr || jrId;

    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const photos  = await Promise.all(top3.map(r => fetchImageBase64(r.photo_url)));

    const poolCandidateIds = jobData.pool_candidate_ids ?? sorted.map(r => r.candidate_id);
    const marketBreakdown = await getPoolMarketBreakdown(poolCandidateIds);
    const poolTotal = jobData.pool_total ?? sorted.length;
    const shortlisted = jobData.result_count ?? Math.min(20, sorted.length);

    // Recruiter-curated Top Profile shortlist (jr_candidates.list_type) — independent
    // of this AI job. Fetched early: both The Funnel (Layer 3/3.1) and the Short
    // Profile card sections further down need it.
    const shortProfileCandidates = await getJRTopProfileShortlist(jrId);
    const userPickIds = new Set(shortProfileCandidates.map(c => c.candidate_id));
    const [userPickBreakdown, aiBreakdown] = await Promise.all([
        getPoolMarketBreakdown(shortProfileCandidates.map(c => c.candidate_id)),
        getPoolMarketBreakdown(top20.map(r => r.candidate_id)),
    ]);
    const overlapCount = top20.filter(r => userPickIds.has(r.candidate_id)).length;

    const pptx = new PptxGenJS();
    pptx.layout  = "LAYOUT_WIDE";
    pptx.author  = "CG Talent Hub";
    pptx.company = "CG Talent Hub";
    pptx.subject = `AI Assessment — ${title}`;
    pptx.title   = `${jrId} Assessment Report`;

    addCoverSlide(pptx, jrId, title, sorted.length, dateStr);
    addBriefSlide(pptx, { title, bu: jr?.bu, subBu: jr?.sub_bu, jrType: jr?.jr_type, description: jr?.job_description });

    addSectionCoverSlide(pptx, "Section 01", "The Funnel & The Market",
        "How we narrowed the market down to this shortlist.");

    const funnelSteps: FunnelStep[] = [
        { num: "01", title: "TOTAL POOL", runs: poolIntroRuns(marketBreakdown) },
        { num: "02", title: "MARKET SPREAD", runs: spreadRuns(marketBreakdown), drillRuns: drillDownRuns(marketBreakdown) },
    ];
    if (shortProfileCandidates.length > 0) {
        funnelSteps.push({
            num: "03", title: "RECRUITER'S SHORTLIST",
            runs: pickRuns("The team hand-picked", userPickBreakdown), drillRuns: drillDownRuns(userPickBreakdown),
        });
    }
    if (top20.length > 0) {
        const hasUserPick = shortProfileCandidates.length > 0;
        funnelSteps.push({
            num: hasUserPick ? "03.1" : "03", title: "AI SUGGESTION",
            runs: pickRuns(hasUserPick ? "Separately, the AI shortlisted its own" : "The AI shortlisted its own", aiBreakdown),
            drillRuns: drillDownRuns(aiBreakdown),
            extraRuns: hasUserPick ? overlapRuns(overlapCount) : undefined,
        });
    }
    addFunnelSlide(pptx, funnelSteps);

    addMarketDashboardSlide(pptx, marketBreakdown);

    if (shortProfileCandidates.length > 0) {
        addSectionCoverSlide(pptx, "Section 02", "The Recruiter's Shortlist",
            "Candidates hand-picked by the recruiting team.");
        await addShortProfileCardsSlides(
            pptx,
            shortProfileCandidates.map((c): ProfileCardItem => ({ ...c })),
            "Short Profile Potential Candidates",
        );
    }

    // Same card layout, sourced from the AI-ranked Top 20 instead. Candidates that
    // are ALSO on the recruiter's own shortlist above are flagged (not de-duplicated —
    // human/AI agreement is a useful signal, not noise to collapse away).
    if (top20.length > 0) {
        addSectionCoverSlide(pptx, shortProfileCandidates.length > 0 ? "Section 03" : "Section 02",
            "The AI Suggestion & Top 3",
            "The algorithm's own shortlist, and its Top 3 picks.");
        await addShortProfileCardsSlides(
            pptx,
            top20.map((r, i): ProfileCardItem => ({
                candidate_id: r.candidate_id,
                rank: i + 1,
                name: r.name,
                photo_url: r.photo_url,
                linkedin: r.linkedin,
                age: r.age,
                nationality: r.nationality,
                position: r.position,
                company: r.company,
                location: r.location,
                education: r.education,
                experience_history: r.experience_history,
                rating: r.rating,
                latest_status: r.latest_status,
                badge: userPickIds.has(r.candidate_id) ? "✓ User Pick" : null,
                score: r.score,
                dims: r.experience_score !== null ? [
                    { label: "Exp", score: r.experience_score },
                    { label: "Lead", score: r.leadership_score },
                    { label: "Mkt", score: r.market_score },
                    { label: "Skills", score: r.skills_score },
                ] : null,
            })),
            "Short Profile — AI Suggestion",
        );
    }

    for (let i = 0; i < top3.length; i++) {
        await addCandidateSlide(pptx, top3[i], photos[i], i + 1);
    }

    // Verdict comes right after the Top 3 hero pages — it's the closing argument for
    // *why* the AI Suggestion (Top 20 avg scores + summary) landed on these picks, so
    // it reads better once the reader has actually seen who those picks are.
    addVerdictSlide(pptx, [
        { label: "Total Pool", value: poolTotal },
        { label: "Shortlisted", value: shortlisted },
        { label: "Top 3", value: Math.min(3, sorted.length) },
    ], avgScores, jobData.summary);

    addTopTableSlide(pptx, top20, `Top ${top20.length} Summary`);

    // Long List order matches the reference workflow: Top Profile (by rank) →
    // Standard → Gray-status (Not Open / Not fit / Too Senior) → Rejected.
    const roster = await getJRCandidateRoster(jrId);
    const scoredIds = new Set(sorted.map(r => r.candidate_id));
    const pool = [...sorted, ...roster.filter(r => !scoredIds.has(r.candidate_id))];
    const longList = bucketLongList(pool);
    if (longList.length > 0) {
        addSectionCoverSlide(pptx, "Appendix", "The Long List",
            "Every candidate considered for this role.");
        addLongListSlide(pptx, longList, `Long List — ${longList.length} Candidates`);
    }

    const base64 = await pptx.write({ outputType: "base64" }) as string;
    return { base64, filename: `${jrId}_assessment_${new Date().toISOString().slice(0, 10)}.pptx` };
}

// ── AI Search V3 export ───────────────────────────────────────────────────────
export async function generateSearchPPTX(
    jobId: string,
): Promise<{ base64: string; filename: string }> {
    const jobData = await getSearchJobStatus(jobId);
    if (!jobData || jobData.results.length === 0) throw new Error("ไม่มีผลลัพธ์ AI Ranking");

    const sorted    = [...(jobData.results as unknown as Stage3Result[])].sort((a, b) => b.score - a.score || a.rank - b.rank);
    const top3      = sorted.slice(0, 3);
    const top20     = sorted.slice(0, 20);
    const avgScores = computeAvgScores(sorted);

    const queryTitle = jobData.query ? trunc(jobData.query, 80) : "AI Search Results";
    const dateStr    = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const photos     = await Promise.all(top3.map(r => fetchImageBase64(r.photo_url)));

    const poolCandidateIds = jobData.pool_candidate_ids ?? sorted.map(r => r.candidate_id);
    const marketBreakdown = await getPoolMarketBreakdown(poolCandidateIds);
    const aiBreakdown = await getPoolMarketBreakdown(top20.map(r => r.candidate_id));
    const poolTotal = jobData.pool_total ?? sorted.length;
    const shortlisted = jobData.result_count ?? Math.min(20, sorted.length);

    const pptx = new PptxGenJS();
    pptx.layout  = "LAYOUT_WIDE";
    pptx.author  = "CG Talent Hub";
    pptx.company = "CG Talent Hub";
    pptx.subject = `AI Search — ${queryTitle}`;
    pptx.title   = `Search Report — ${jobId}`;

    addCoverSlide(pptx, jobId, queryTitle, sorted.length, dateStr);
    // No BU/Sub BU/JR Type for a search session — just the natural-language query.
    addBriefSlide(pptx, { title: queryTitle, description: jobData.query });

    addSectionCoverSlide(pptx, "Section 01", "The Funnel & The Market",
        "How we narrowed the market down to this shortlist.");

    // No jr_candidates-based user shortlist for a search session, so Layer 3 is
    // just the system's Top 20 — no 03.1 sub-layer, no overlap sentence.
    const funnelSteps: FunnelStep[] = [
        { num: "01", title: "TOTAL POOL", runs: poolIntroRuns(marketBreakdown) },
        { num: "02", title: "MARKET SPREAD", runs: spreadRuns(marketBreakdown), drillRuns: drillDownRuns(marketBreakdown) },
    ];
    if (top20.length > 0) {
        funnelSteps.push({
            num: "03", title: "AI SHORTLIST",
            runs: pickRuns("The algorithm narrowed this down to", aiBreakdown), drillRuns: drillDownRuns(aiBreakdown),
        });
    }
    addFunnelSlide(pptx, funnelSteps);

    addMarketDashboardSlide(pptx, marketBreakdown);

    // Same "Short Profile" card layout as the JR Assessment report — there's no
    // jr_candidates-based user shortlist for a search session, so this is just
    // the AI-ranked Top 20 (no "User Pick" badge, since no such list exists here).
    if (top20.length > 0) {
        addSectionCoverSlide(pptx, "Section 02", "The AI Suggestion & Top 3",
            "The algorithm's own shortlist, and its Top 3 picks.");
        await addShortProfileCardsSlides(
            pptx,
            top20.map((r, i): ProfileCardItem => ({
                candidate_id: r.candidate_id,
                rank: i + 1,
                name: r.name,
                photo_url: r.photo_url,
                linkedin: r.linkedin,
                age: r.age,
                nationality: r.nationality,
                position: r.position,
                company: r.company,
                location: r.location,
                education: r.education,
                experience_history: r.experience_history,
                rating: r.rating,
                latest_status: null,
                score: r.score,
                dims: r.experience_score !== null ? [
                    { label: "Exp", score: r.experience_score },
                    { label: "Lead", score: r.leadership_score },
                    { label: "Mkt", score: r.market_score },
                    { label: "Skills", score: r.skills_score },
                ] : null,
            })),
            "Short Profile — AI Suggestion",
        );
    }

    for (let i = 0; i < top3.length; i++) {
        await addCandidateSlide(pptx, top3[i], photos[i], i + 1);
    }

    // Verdict comes right after the Top 3 hero pages — it's the closing argument for
    // *why* the AI Suggestion (Top 20 avg scores + summary) landed on these picks, so
    // it reads better once the reader has actually seen who those picks are.
    addVerdictSlide(pptx, [
        { label: "Total Pool", value: poolTotal },
        { label: "Shortlisted", value: shortlisted },
        { label: "Top 3", value: Math.min(3, sorted.length) },
    ], avgScores, jobData.summary);

    addTopTableSlide(pptx, top20, `Top ${top20.length} Summary`);
    if (sorted.length > 20) addTopTableSlide(pptx, sorted, `Full Ranking — ${sorted.length} Candidates`);

    const base64  = await pptx.write({ outputType: "base64" }) as string;
    const safeName = jobId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    return { base64, filename: `search_${safeName}_${new Date().toISOString().slice(0, 10)}.pptx` };
}
