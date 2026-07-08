"use server";

import PptxGenJS from "pptxgenjs";
import { adminAuthClient } from "@/lib/supabase/admin";
import { getStage3JobStatus, type Stage3Result } from "@/app/actions/ai-ranking";
import { getSearchJobStatus } from "@/app/actions/ai-search-ranking";

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
    text: string;
    light: string;
    getScore:   (r: Stage3Result) => number | null;
    getSummary: (r: Stage3Result) => string | null;
};

const DIM: DimDef[] = [
    {
        key: "experience", label: "Experience & Expertise", chipLabel: "EXPERIENCE",
        bg: "d1fae5", text: "059669", light: "6ee7b7",
        getScore:   r => r.experience_score,
        getSummary: r => r.experience_summary,
    },
    {
        key: "leadership", label: "Strategic Leadership", chipLabel: "LEADERSHIP",
        bg: "ede9fe", text: "7c3aed", light: "c4b5fd",
        getScore:   r => r.leadership_score,
        getSummary: r => r.leadership_summary,
    },
    {
        key: "market", label: "Market & Networking", chipLabel: "MARKET",
        bg: "e0f2fe", text: "0284c7", light: "7dd3fc",
        getScore:   r => r.market_score,
        getSummary: r => r.market_summary,
    },
    {
        key: "skills", label: "Skill Set", chipLabel: "SKILLS",
        bg: "ffedd5", text: "ea580c", light: "fdba74",
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
            { label: "OVERALL",    value: avgScores.overall,    max: 100, bg: C.indigo,  accent: "a5b4fc" },
            { label: "EXPERIENCE", value: avgScores.experience, max: 25,  bg: "059669",  accent: "6ee7b7" },
            { label: "LEADERSHIP", value: avgScores.leadership, max: 25,  bg: "7c3aed",  accent: "c4b5fd" },
            { label: "MARKET",     value: avgScores.market,     max: 25,  bg: "0284c7",  accent: "7dd3fc" },
            { label: "SKILLS",     value: avgScores.skills,     max: 25,  bg: "ea580c",  accent: "fdba74" },
        ];
        cards.forEach((card, i) => {
            const cx = 0.3 + i * (CARD_W + GAP);
            slide.addShape(pptx.ShapeType.roundRect, {
                x: cx, y: CARD_Y, w: CARD_W, h: CARD_H, fill: { color: card.bg }, rectRadius: 0.1,
            });
            slide.addText(card.label, {
                x: cx, y: CARD_Y + 0.08, w: CARD_W, h: 0.22,
                align: "center", fontSize: 7, bold: true, color: card.accent, charSpacing: 0.8,
            });
            slide.addText(`${card.value}`, {
                x: cx, y: CARD_Y + 0.27, w: CARD_W, h: 0.38,
                align: "center", fontSize: 22, bold: true, color: C.white,
            });
            slide.addText(`/ ${card.max}`, {
                x: cx, y: CARD_Y + 0.61, w: CARD_W, h: 0.18,
                align: "center", fontSize: 8, color: card.accent,
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
        x: 0.2, y: 2.52, w: 1.5, h: 0.78, fill: { color: C.indigo }, rectRadius: 0.1,
    });
    slide.addText("OVERALL", {
        x: 0.2, y: 2.55, w: 1.5, h: 0.24,
        align: "center", fontSize: 7, bold: true, color: "a5b4fc", charSpacing: 1,
    });
    slide.addText(`${r.score}`, {
        x: 0.2, y: 2.76, w: 1.5, h: 0.5,
        align: "center", fontSize: 26, bold: true, color: C.white,
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

    // ── Info chips: age | linkedin | address ─────────────────────────────────
    let chipX = 2.0;
    const INFO_Y = 1.13, INFO_H = 0.3;
    if (r.age != null) {
        const ageLabel = r.age_source === "estimated" ? `~${r.age} yrs (est.)` : `${r.age} yrs`;
        slide.addShape(pptx.ShapeType.roundRect, {
            x: chipX, y: INFO_Y, w: 1.45, h: INFO_H, fill: { color: C.slate100 }, rectRadius: 0.05,
        });
        slide.addText(`AGE  ${ageLabel}`, {
            x: chipX + 0.1, y: INFO_Y, w: 1.25, h: INFO_H, fontSize: 8, color: C.slate600, valign: "middle",
        });
        chipX += 1.55;
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
        // ── 4D chip row (y=1.63) ─────────────────────────────────────────────
        // 4 chips spanning x=2.0→12.8 (10.8" total), equal width with 0.1" gaps
        const CHIP_ROW_Y = 1.63;
        const CHIP_H     = 0.54;
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

        // ── 4D 2×2 grid (y=2.27) ─────────────────────────────────────────────
        // Col 0: x=2.0, w=5.3  |  gap=0.2  |  Col 1: x=7.5, w=5.3
        // Row 0: y=2.27, h=1.74  |  gap=0.1  |  Row 1: y=4.11, h=1.74
        const GRID_Y     = 2.27;
        const ROW_H      = 1.74;
        const ROW_GAP    = 0.1;
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

            // Box background
            slide.addShape(pptx.ShapeType.roundRect, {
                x: bx, y: by, w: bw, h: bh, fill: { color: d.bg }, rectRadius: 0.1,
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

        // ── Strengths / Gaps (bottom, aligned with grid columns) ─────────────
        const BOT_Y = GRID_Y + 2 * (ROW_H + ROW_GAP) + 0.06;
        const BOT_H = Math.max(0.5, 7.22 - BOT_Y);

        if (r.strengths) {
            slide.addShape(pptx.ShapeType.roundRect, {
                x: COL_X[0], y: BOT_Y, w: COL_W[0], h: BOT_H, fill: { color: C.green50 }, rectRadius: 0.08,
            });
            slide.addText("STRENGTHS", {
                x: COL_X[0] + 0.18, y: BOT_Y + 0.1, w: COL_W[0] - 0.28, h: 0.22,
                fontSize: 7.5, bold: true, color: C.green, charSpacing: 1,
            });
            slide.addText(trunc(r.strengths, 300), {
                x: COL_X[0] + 0.18, y: BOT_Y + 0.34, w: COL_W[0] - 0.28, h: BOT_H - 0.44,
                fontSize: 8.5, color: C.slate700, wrap: true, valign: "top", lineSpacingMultiple: 1.25,
            });
        }
        if (r.gaps) {
            slide.addShape(pptx.ShapeType.roundRect, {
                x: COL_X[1], y: BOT_Y, w: COL_W[1], h: BOT_H, fill: { color: C.amber50 }, rectRadius: 0.08,
            });
            slide.addText("AREAS TO NOTE", {
                x: COL_X[1] + 0.18, y: BOT_Y + 0.1, w: COL_W[1] - 0.28, h: 0.22,
                fontSize: 7.5, bold: true, color: C.amber, charSpacing: 1,
            });
            slide.addText(trunc(r.gaps, 300), {
                x: COL_X[1] + 0.18, y: BOT_Y + 0.34, w: COL_W[1] - 0.28, h: BOT_H - 0.44,
                fontSize: 8.5, color: C.slate700, wrap: true, valign: "top", lineSpacingMultiple: 1.25,
            });
        }

    } else {
        // ── No 4D: expanded strengths / gaps / tradeoff layout ───────────────
        const divY = 1.62;
        slide.addShape(pptx.ShapeType.line, {
            x: 2.0, y: divY, w: 10.8, h: 0, line: { color: C.slate200, width: 0.75 },
        });

        slide.addText("STRENGTHS", {
            x: 2.0, y: divY + 0.15, w: 2.0, h: 0.25, fontSize: 7.5, bold: true, color: C.green, charSpacing: 1,
        });
        slide.addText(trunc(r.strengths, 500), {
            x: 2.0, y: divY + 0.44, w: 5.2, h: 2.0, fontSize: 9, color: C.slate700, wrap: true, valign: "top", lineSpacingMultiple: 1.25,
        });

        slide.addText("AREAS TO NOTE", {
            x: 7.4, y: divY + 0.15, w: 2.5, h: 0.25, fontSize: 7.5, bold: true, color: C.amber, charSpacing: 1,
        });
        slide.addText(trunc(r.gaps, 500), {
            x: 7.4, y: divY + 0.44, w: 5.4, h: 2.0, fontSize: 9, color: C.slate700, wrap: true, valign: "top", lineSpacingMultiple: 1.25,
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

// ── Summary table slide ───────────────────────────────────────────────────────
function addTableSlide(pptx: PptxGenJS, results: Stage3Result[], title: string) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });
    slide.addText(title, { x: 0.3, y: 0.18, w: 12.75, h: 0.55, fontSize: 20, bold: true, color: C.slate900 });

    const hOpts = { bold: true, color: C.white, fill: { color: C.indigo }, valign: "middle" as const };
    const headerRow = [
        { text: "#",         options: { ...hOpts, align: "center" as const } },
        { text: "Candidate", options: hOpts },
        { text: "Position",  options: hOpts },
        { text: "Company",   options: hOpts },
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
            { text: trunc(r.position, 38) || "-",     options: { ...base, color: C.slate600 } },
            { text: trunc(r.company, 32) || "-",      options: { ...base, color: C.slate600 } },
            { text: `${r.score}`,                     options: { ...base, align: "center" as const, bold: true, color: scoreColor(r.score) } },
            { text: fmt(r.experience_score),          options: { ...base, align: "center" as const, bold: true, color: DIM_COL_COLORS[0] } },
            { text: fmt(r.leadership_score),          options: { ...base, align: "center" as const, bold: true, color: DIM_COL_COLORS[1] } },
            { text: fmt(r.market_score),              options: { ...base, align: "center" as const, bold: true, color: DIM_COL_COLORS[2] } },
            { text: fmt(r.skills_score),              options: { ...base, align: "center" as const, bold: true, color: DIM_COL_COLORS[3] } },
        ];
    });

    (slide as any).addTable([headerRow, ...dataRows], {
        x: 0.2, y: 0.85, w: 12.9,
        fontSize: 8.5,
        rowH: 0.31,
        border: { type: "solid", pt: 0.5, color: C.slate200 },
        autoPage: true,
        autoPageRepeatHeader: true,
        autoPageHeaderRows: 1,
        autoPageSlideStartY: 0.5,
        newSlideStartY: 0.5,
        colW: [0.4, 3.2, 2.6, 2.6, 0.7, 0.7, 0.7, 0.7, 0.7], // total ≈ 12.3
    });
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

    const pptx = new PptxGenJS();
    pptx.layout  = "LAYOUT_WIDE";
    pptx.author  = "CG Talent Hub";
    pptx.company = "CG Talent Hub";
    pptx.subject = `AI Assessment — ${title}`;
    pptx.title   = `${jrId} Assessment Report`;

    addCoverSlide(pptx, jrId, title, sorted.length, dateStr);
    addSummarySlide(pptx, jobData.summary, null, avgScores);

    for (let i = 0; i < top3.length; i++) {
        await addCandidateSlide(pptx, top3[i], photos[i], i + 1);
    }

    addTableSlide(pptx, top20, `Top ${top20.length} Summary`);
    if (sorted.length > 20) addTableSlide(pptx, sorted, `Full Ranking — ${sorted.length} Candidates`);

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

    const pptx = new PptxGenJS();
    pptx.layout  = "LAYOUT_WIDE";
    pptx.author  = "CG Talent Hub";
    pptx.company = "CG Talent Hub";
    pptx.subject = `AI Search — ${queryTitle}`;
    pptx.title   = `Search Report — ${jobId}`;

    addCoverSlide(pptx, jobId, queryTitle, sorted.length, dateStr);
    // Pass full query (not truncated) and avg scores to summary slide
    addSummarySlide(pptx, jobData.summary, jobData.query, avgScores);

    for (let i = 0; i < top3.length; i++) {
        await addCandidateSlide(pptx, top3[i], photos[i], i + 1);
    }

    addTableSlide(pptx, top20, `Top ${top20.length} Summary`);
    if (sorted.length > 20) addTableSlide(pptx, sorted, `Full Ranking — ${sorted.length} Candidates`);

    const base64  = await pptx.write({ outputType: "base64" }) as string;
    const safeName = jobId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    return { base64, filename: `search_${safeName}_${new Date().toISOString().slice(0, 10)}.pptx` };
}
