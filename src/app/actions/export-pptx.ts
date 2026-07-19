"use server";

import PptxGenJS from "pptxgenjs";
import { adminAuthClient } from "@/lib/supabase/admin";
import { getStage3JobStatus, getJRCandidateRoster, type Stage3Result } from "@/app/actions/ai-ranking";
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

async function fetchImageBase64(url: string | null): Promise<string | null> {
    if (!url) return null;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        const mime = res.headers.get("content-type") ?? "image/jpeg";
        return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
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

// ── Executive Summary slide (KPI row + funnel) ────────────────────────────────
type FunnelStage = { label: string; value: number };

function addExecutiveSummarySlide(pptx: PptxGenJS, stages: FunnelStage[]) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });
    slide.addText("EXECUTIVE SUMMARY", {
        x: 0.3, y: 0.18, w: 12.75, h: 0.36, fontSize: 10, bold: true, color: C.indigo, charSpacing: 2,
    });

    const poolTotal = stages[0]?.value ?? 0;
    const shortlisted = stages.find(s => s.label === "Shortlisted")?.value ?? 0;
    const coverage = poolTotal > 0 ? Math.round((shortlisted / poolTotal) * 1000) / 10 : 0;

    // ── KPI row — white cards, colored accent bar + label only (no solid fill) ─
    const kpis = [
        { label: "TOTAL CANDIDATES FOUND", value: `${poolTotal}`, accent: C.indigo },
        { label: "SHORTLISTED", value: `${shortlisted}`, accent: "059669" },
        { label: "COVERAGE", value: `${coverage}%`, accent: "0284c7" },
    ];
    const KPI_Y = 0.7, KPI_H = 1.3, KPI_W = 4.0, KPI_GAP = 0.25;
    kpis.forEach((k, i) => {
        const kx = 0.3 + i * (KPI_W + KPI_GAP);
        slide.addShape(pptx.ShapeType.roundRect, {
            x: kx, y: KPI_Y, w: KPI_W, h: KPI_H, fill: { color: C.slate100 }, line: { color: C.slate200, width: 0.75 }, rectRadius: 0.12,
        });
        slide.addShape(pptx.ShapeType.rect, { x: kx, y: KPI_Y, w: 0.06, h: KPI_H, fill: { color: k.accent } });
        slide.addText(k.label, {
            x: kx + 0.25, y: KPI_Y + 0.18, w: KPI_W - 0.5, h: 0.3,
            fontSize: 9.5, bold: true, color: k.accent, charSpacing: 1,
        });
        slide.addText(k.value, {
            x: kx + 0.25, y: KPI_Y + 0.5, w: KPI_W - 0.5, h: 0.7,
            fontSize: 40, bold: true, color: C.slate900,
        });
    });

    // ── Funnel ───────────────────────────────────────────────────────────────
    slide.addText("SEARCH → SHORTLIST FUNNEL", {
        x: 0.3, y: 2.35, w: 12.75, h: 0.3, fontSize: 8.5, bold: true, color: C.slate500, charSpacing: 1.5,
    });

    const maxVal = Math.max(...stages.map(s => s.value), 1);
    const FUNNEL_Y = 2.8, BOX_H = 1.0, GAP = 0.55;
    const BOX_W = (12.75 - (stages.length - 1) * GAP) / stages.length;
    stages.forEach((s, i) => {
        const fx = 0.3 + i * (BOX_W + GAP);
        const scale = 0.55 + 0.45 * (s.value / maxVal);
        const boxH = BOX_H * scale;
        const boxY = FUNNEL_Y + (BOX_H - boxH);
        slide.addShape(pptx.ShapeType.roundRect, {
            x: fx, y: boxY, w: BOX_W, h: boxH, fill: { color: i === 0 ? C.indigo50 : "eef2ff" }, line: { color: C.indigo, width: 1 }, rectRadius: 0.1,
        });
        slide.addText(`${s.value}`, {
            x: fx, y: boxY + 0.08, w: BOX_W, h: boxH - 0.4, align: "center", valign: "bottom", fontSize: 24, bold: true, color: C.indigo,
        });
        slide.addText(s.label.toUpperCase(), {
            x: fx, y: FUNNEL_Y + BOX_H + 0.1, w: BOX_W, h: 0.4, align: "center", fontSize: 9, bold: true, color: C.slate600, charSpacing: 0.5,
        });
        if (i < stages.length - 1) {
            slide.addText("→", {
                x: fx + BOX_W, y: FUNNEL_Y + BOX_H / 2 - 0.25, w: GAP, h: 0.5, align: "center", valign: "middle", fontSize: 20, color: C.slate300,
            });
        }
    });
}

// ── Market Overview slide (SET/Non-SET, Thailand vs Overseas, Industry) ───────
function addMarketOverviewSlide(pptx: PptxGenJS, breakdown: MarketBreakdown) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });
    slide.addText("MARKET OVERVIEW", {
        x: 0.3, y: 0.18, w: 12.75, h: 0.36, fontSize: 10, bold: true, color: C.indigo, charSpacing: 2,
    });

    const total = breakdown.totalCandidates || 1;
    const pct = (n: number) => Math.round((n / total) * 100);
    const overseas = total - breakdown.thailandCount;

    // ── Stat tile row: SET | Non-SET | Thailand | Overseas ────────────────────
    const tiles = [
        { label: "SET COMPANY", value: breakdown.setCount, accent: "059669" },
        { label: "NON-SET COMPANY", value: breakdown.nonSetCount, accent: C.slate500 },
        { label: "THAILAND-BASED", value: breakdown.thailandCount, accent: C.indigo },
        { label: "OVERSEAS", value: overseas, accent: "0284c7" },
    ];
    const TILE_Y = 0.7, TILE_H = 1.15, TILE_W = 2.95, TILE_GAP = 0.2;
    tiles.forEach((t, i) => {
        const tx = 0.3 + i * (TILE_W + TILE_GAP);
        slide.addShape(pptx.ShapeType.roundRect, {
            x: tx, y: TILE_Y, w: TILE_W, h: TILE_H, fill: { color: C.slate100 }, line: { color: C.slate200, width: 0.75 }, rectRadius: 0.1,
        });
        slide.addShape(pptx.ShapeType.rect, { x: tx, y: TILE_Y, w: 0.06, h: TILE_H, fill: { color: t.accent } });
        slide.addText(t.label, { x: tx + 0.18, y: TILE_Y + 0.14, w: TILE_W - 0.36, h: 0.24, fontSize: 8, bold: true, color: t.accent, charSpacing: 0.8 });
        slide.addText(`${t.value}`, { x: tx + 0.18, y: TILE_Y + 0.38, w: TILE_W - 0.36, h: 0.5, fontSize: 26, bold: true, color: C.slate900 });
        slide.addText(`${pct(t.value)}%`, { x: tx + 0.18, y: TILE_Y + 0.85, w: TILE_W - 0.36, h: 0.22, fontSize: 9, color: C.slate500 });
    });

    // ── Industry Distribution — horizontal bars, fixed categorical order ─────
    slide.addText("INDUSTRY DISTRIBUTION", {
        x: 0.3, y: 2.2, w: 12.75, h: 0.3, fontSize: 8.5, bold: true, color: C.slate500, charSpacing: 1.5,
    });

    const industryColors = ["6366f1", "059669", "7c3aed", "0284c7", "ea580c", "f59e0b", C.slate500];
    const TOP_N = 6;
    const sorted = [...breakdown.industries].sort((a, b) => b.count - a.count);
    const top = sorted.slice(0, TOP_N);
    const otherCount = sorted.slice(TOP_N).reduce((sum, i) => sum + i.count, 0);
    const rows = otherCount > 0 ? [...top, { label: "Other", count: otherCount }] : top;

    const maxCount = Math.max(...rows.map(r => r.count), 1);
    const BAR_Y0 = 2.65, ROW_H = 0.58, LABEL_W = 3.0, BAR_MAX_W = 7.5;
    rows.forEach((r, i) => {
        const ry = BAR_Y0 + i * ROW_H;
        const color = industryColors[i % industryColors.length];
        slide.addText(r.label, { x: 0.3, y: ry, w: LABEL_W, h: ROW_H - 0.1, fontSize: 10, color: C.slate700, valign: "middle" });
        slide.addShape(pptx.ShapeType.rect, { x: 0.3 + LABEL_W, y: ry + 0.12, w: BAR_MAX_W, h: 0.24, fill: { color: C.slate100 } });
        const barW = Math.max(0.15, BAR_MAX_W * (r.count / maxCount));
        slide.addShape(pptx.ShapeType.rect, { x: 0.3 + LABEL_W, y: ry + 0.12, w: barW, h: 0.24, fill: { color } });
        slide.addText(`${r.count} (${pct(r.count)}%)`, {
            x: 0.3 + LABEL_W + BAR_MAX_W + 0.15, y: ry, w: 1.6, h: ROW_H - 0.1, fontSize: 9.5, bold: true, color: C.slate700, valign: "middle",
        });
    });
}

// ── Summary slide ─────────────────────────────────────────────────────────────
// Layout order: query box → final_recommendation → key insights bullets → score cards
function addSummarySlide(
    pptx: PptxGenJS,
    summary: { final_recommendation?: string; highlights?: string[] } | null,
    query?: string | null,
    avgScores?: AvgScores | null,
) {
    if (!summary?.final_recommendation && !summary?.highlights?.length && !query) return;

    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });

    slide.addText("AI ASSESSMENT SUMMARY", {
        x: 0.3, y: 0.18, w: 12.75, h: 0.36, fontSize: 10, bold: true, color: C.indigo, charSpacing: 2,
    });

    let curY = 0.65;

    // ① Origin query box
    if (query) {
        slide.addShape(pptx.ShapeType.roundRect, {
            x: 0.3, y: curY, w: 12.75, h: 0.72, fill: { color: C.slate100 }, rectRadius: 0.08,
        });
        slide.addText("SEARCH CRITERIA", {
            x: 0.5, y: curY + 0.08, w: 12.3, h: 0.2,
            fontSize: 7, bold: true, color: C.indigo, charSpacing: 1.5,
        });
        slide.addText(trunc(query, 340), {
            x: 0.5, y: curY + 0.3, w: 12.3, h: 0.34,
            fontSize: 9.5, color: C.slate600, italic: true, wrap: true,
        });
        curY += 0.9;
    }

    // ② Final recommendation
    if (summary?.final_recommendation) {
        const rec = summary.final_recommendation.replace(/^✦\s*/, "").trim();
        const estLines = Math.max(2, Math.ceil(rec.length / 95));
        const recH = Math.min(2.4, estLines * 0.32 + 0.1);
        slide.addShape(pptx.ShapeType.ellipse, {
            x: 0.3, y: curY + 0.11, w: 0.11, h: 0.11, fill: { color: C.indigo },
        });
        slide.addText(rec, {
            x: 0.5, y: curY, w: 12.55, h: recH,
            fontSize: 12, color: C.slate900, wrap: true, valign: "top",
            lineSpacingMultiple: 1.4,
        });
        curY += recH + 0.25;
    }

    // ③ Key insights
    if (summary?.highlights?.length) {
        slide.addShape(pptx.ShapeType.line, {
            x: 0.3, y: curY, w: 12.75, h: 0, line: { color: C.slate200, width: 0.75 },
        });
        curY += 0.24;

        slide.addText("KEY INSIGHTS", {
            x: 0.3, y: curY, w: 12.75, h: 0.28,
            fontSize: 8, bold: true, color: C.indigo, charSpacing: 2,
        });
        curY += 0.38;

        for (const bullet of summary.highlights.slice(0, 5)) {
            const text = bullet.replace(/^[•\-]\s*/, "").trim();
            const estH = Math.min(0.7, Math.max(0.32, Math.ceil(text.length / 130) * 0.3 + 0.05));
            slide.addShape(pptx.ShapeType.ellipse, {
                x: 0.35, y: curY + 0.1, w: 0.11, h: 0.11, fill: { color: C.indigo },
            });
            slide.addText(text, {
                x: 0.56, y: curY, w: 12.5, h: estH,
                fontSize: 10.5, color: C.slate700, wrap: true, valign: "top",
                lineSpacingMultiple: 1.35,
            });
            curY += estH + 0.12;
            if (curY > 5.7) break;
        }
    }

    // ④ Score cards row (bottom fixed)
    if (avgScores) {
        const CARD_Y = 6.35;
        const CARD_H = 0.82;
        const CARD_W = 2.45;
        const GAP    = 0.1;
        const cards = [
            { label: "OVERALL",    value: avgScores.overall,    max: 100, accent: C.indigo },
            { label: "EXPERIENCE", value: avgScores.experience, max: 25,  accent: "059669" },
            { label: "LEADERSHIP", value: avgScores.leadership, max: 25,  accent: "7c3aed" },
            { label: "MARKET",     value: avgScores.market,     max: 25,  accent: "0284c7" },
            { label: "SKILLS",     value: avgScores.skills,     max: 25,  accent: "ea580c" },
        ];
        cards.forEach((card, i) => {
            const cx = 0.3 + i * (CARD_W + GAP);
            slide.addShape(pptx.ShapeType.roundRect, {
                x: cx, y: CARD_Y, w: CARD_W, h: CARD_H, fill: { color: C.slate100 }, line: { color: C.slate200, width: 0.5 }, rectRadius: 0.1,
            });
            slide.addShape(pptx.ShapeType.rect, { x: cx, y: CARD_Y, w: CARD_W, h: 0.05, fill: { color: card.accent } });
            slide.addText(card.label, {
                x: cx, y: CARD_Y + 0.14, w: CARD_W, h: 0.22,
                align: "center", fontSize: 7, bold: true, color: card.accent, charSpacing: 0.8,
            });
            slide.addText(`${card.value}`, {
                x: cx, y: CARD_Y + 0.33, w: CARD_W, h: 0.38,
                align: "center", fontSize: 22, bold: true, color: C.slate900,
            });
            slide.addText(`/ ${card.max}`, {
                x: cx, y: CARD_Y + 0.67, w: CARD_W, h: 0.18,
                align: "center", fontSize: 8, color: C.slate500,
            });
        });
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
        const lineH = Math.min(0.32, (y + h - curY) / history.length);
        history.forEach(line => {
            slide.addText(trunc(line, 110), {
                x: x + padX, y: curY, w: w - padX * 2, h: lineH,
                fontSize: 7.5, color: C.slate600, wrap: true, valign: "top", lineSpacingMultiple: 1.05,
            });
            curY += lineH;
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
// Ordering matches the reference n8n Long List workflow: AI-scored/ranked
// candidates first (already sorted by score/rank by the caller), then the
// rest of the JR pool. Manually paginated at a fixed 20 rows/slide instead of
// pptxgenjs's height-based autoPage, so every page shows a predictable count.
const LONGLIST_PAGE_SIZE = 20;

function addLongListSlide(pptx: PptxGenJS, results: Stage3Result[], titleBase: string) {
    const totalPages = Math.max(1, Math.ceil(results.length / LONGLIST_PAGE_SIZE));

    for (let page = 0; page < totalPages; page++) {
        const pageResults = results.slice(page * LONGLIST_PAGE_SIZE, (page + 1) * LONGLIST_PAGE_SIZE);
        const rowOffset = page * LONGLIST_PAGE_SIZE;

        const slide = pptx.addSlide();
        slide.background = { color: C.white };
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });
        const title = totalPages > 1 ? `${titleBase} (${page + 1}/${totalPages})` : titleBase;
        slide.addText(title, { x: 0.3, y: 0.18, w: 12.75, h: 0.55, fontSize: 20, bold: true, color: C.slate900 });

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
        ];

        const dataRows = pageResults.map((r, idx) => {
            const rowFill = idx % 2 === 0 ? { color: C.white } : { color: C.slate100 };
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
            ];
        });

        (slide as any).addTable([headerRow, ...dataRows], {
            x: 0.2, y: 0.85, w: 12.9,
            fontSize: 8,
            rowH: 0.3,
            border: { type: "solid", pt: 0.5, color: C.slate200 },
            colW: [0.5, 2.2, 2.0, 2.4, 0.55, 0.7, 1.4, 1.4, 0.85], // total ≈ 12.0
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

    let title = jrTitle;
    if (!title) {
        const { data: jr } = await adminAuthClient
            .from("job_requisitions").select("position_jr").eq("jr_id", jrId).single();
        title = (jr as any)?.position_jr ?? jrId;
    }

    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const photos  = await Promise.all(top3.map(r => fetchImageBase64(r.photo_url)));

    const poolCandidateIds = jobData.pool_candidate_ids ?? sorted.map(r => r.candidate_id);
    const marketBreakdown = await getPoolMarketBreakdown(poolCandidateIds);
    const poolTotal = jobData.pool_total ?? sorted.length;
    const assessedCount = jobData.candidate_count ?? sorted.length;
    const shortlisted = jobData.result_count ?? Math.min(20, sorted.length);

    const pptx = new PptxGenJS();
    pptx.layout  = "LAYOUT_WIDE";
    pptx.author  = "CG Talent Hub";
    pptx.company = "CG Talent Hub";
    pptx.subject = `AI Assessment — ${title}`;
    pptx.title   = `${jrId} Assessment Report`;

    addCoverSlide(pptx, jrId, title, sorted.length, dateStr);
    addExecutiveSummarySlide(pptx, [
        { label: "Total Pool", value: poolTotal },
        { label: "Assessed", value: assessedCount },
        { label: "Shortlisted", value: shortlisted },
        { label: "Top 3", value: Math.min(3, sorted.length) },
    ]);
    addMarketOverviewSlide(pptx, marketBreakdown);
    addSummarySlide(pptx, jobData.summary, null, avgScores);

    for (let i = 0; i < top3.length; i++) {
        await addCandidateSlide(pptx, top3[i], photos[i], i + 1);
    }

    addTopTableSlide(pptx, top20, `Top ${top20.length} Summary`);

    // Long List order matches the reference workflow: AI-scored candidates
    // first (already sorted by score), then the rest of the JR pool.
    const roster = await getJRCandidateRoster(jrId);
    const scoredIds = new Set(sorted.map(r => r.candidate_id));
    const longList = [...sorted, ...roster.filter(r => !scoredIds.has(r.candidate_id))];
    if (longList.length > 0) addLongListSlide(pptx, longList, `Long List — ${longList.length} Candidates`);

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
    const poolTotal = jobData.pool_total ?? sorted.length;
    const assessedCount = jobData.candidate_count ?? sorted.length;
    const shortlisted = jobData.result_count ?? Math.min(20, sorted.length);

    const pptx = new PptxGenJS();
    pptx.layout  = "LAYOUT_WIDE";
    pptx.author  = "CG Talent Hub";
    pptx.company = "CG Talent Hub";
    pptx.subject = `AI Search — ${queryTitle}`;
    pptx.title   = `Search Report — ${jobId}`;

    addCoverSlide(pptx, jobId, queryTitle, sorted.length, dateStr);
    addExecutiveSummarySlide(pptx, [
        { label: "Total Pool", value: poolTotal },
        { label: "Assessed", value: assessedCount },
        { label: "Shortlisted", value: shortlisted },
        { label: "Top 3", value: Math.min(3, sorted.length) },
    ]);
    addMarketOverviewSlide(pptx, marketBreakdown);
    // Pass full query (not truncated) and avg scores to summary slide
    addSummarySlide(pptx, jobData.summary, jobData.query, avgScores);

    for (let i = 0; i < top3.length; i++) {
        await addCandidateSlide(pptx, top3[i], photos[i], i + 1);
    }

    addTopTableSlide(pptx, top20, `Top ${top20.length} Summary`);
    if (sorted.length > 20) addTopTableSlide(pptx, sorted, `Full Ranking — ${sorted.length} Candidates`);

    const base64  = await pptx.write({ outputType: "base64" }) as string;
    const safeName = jobId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    return { base64, filename: `search_${safeName}_${new Date().toISOString().slice(0, 10)}.pptx` };
}
