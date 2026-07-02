"use server";

import PptxGenJS from "pptxgenjs";
import { adminAuthClient } from "@/lib/supabase/admin";
import { getStage3JobStatus, type Stage3Result } from "@/app/actions/ai-ranking";

// ── Colors ──────────────────────────────────────────────────────────────────
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

function scoreColor(score: number | null): string {
    if (score === null) return C.slate300;
    if (score >= 80) return C.green;
    if (score >= 60) return C.indigo;
    if (score >= 40) return C.amber;
    return C.red;
}

function trunc(s: string | null | undefined, max: number): string {
    if (!s) return "";
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

async function fetchImageBase64(url: string | null): Promise<string | null> {
    if (!url) return null;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        const mime = res.headers.get("content-type") ?? "image/jpeg";
        return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
    } catch {
        return null;
    }
}

// ── Cover slide ─────────────────────────────────────────────────────────────
function addCoverSlide(pptx: PptxGenJS, jrId: string, jrTitle: string, total: number, dateStr: string) {
    const slide = pptx.addSlide();
    slide.background = { color: C.slate900 };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.1, h: "100%", fill: { color: C.indigo } });

    slide.addText("CG TALENT HUB", {
        x: 0.35, y: 0.3, w: 5, h: 0.35, fontSize: 9, bold: true, color: C.indigo, charSpacing: 4,
    });
    slide.addText("AI Assessment Report", {
        x: 0.35, y: 0.75, w: 9.3, h: 0.45, fontSize: 14, italic: true, color: "94a3b8",
    });
    slide.addText(jrTitle || jrId, {
        x: 0.35, y: 1.4, w: 9.3, h: 2.2, fontSize: 38, bold: true, color: C.white, wrap: true, valign: "top",
    });

    const metaY = 4.6;
    const chips = [
        { x: 0.35, w: 1.5, text: jrId },
        { x: 2.0,  w: 2.4, text: `${total} Candidates Assessed` },
        { x: 4.55, w: 2.1, text: dateStr },
    ];
    for (const chip of chips) {
        slide.addShape(pptx.ShapeType.roundRect, { x: chip.x, y: metaY, w: chip.w, h: 0.42, fill: { color: "1e293b" }, rectRadius: 0.06 });
        slide.addText(chip.text, { x: chip.x, y: metaY, w: chip.w, h: 0.42, align: "center", valign: "middle", fontSize: 9, color: "94a3b8" });
    }
}

// ── Summary slide ────────────────────────────────────────────────────────────
function addSummarySlide(
    pptx: PptxGenJS,
    summary: { final_recommendation?: string; highlights?: string[] } | null,
) {
    if (!summary?.final_recommendation && !summary?.highlights?.length) return;

    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });

    // Header
    slide.addText("AI ASSESSMENT SUMMARY", {
        x: 0.3, y: 0.18, w: 9.4, h: 0.38,
        fontSize: 10, bold: true, color: C.indigo, charSpacing: 2,
    });

    let curY = 0.65;

    // Main recommendation paragraph
    if (summary.final_recommendation) {
        const rec = summary.final_recommendation.replace(/^✦\s*/, "").trim();
        // Accent marker
        slide.addShape(pptx.ShapeType.roundRect, {
            x: 0.3, y: curY, w: 0.06, h: 0.06, fill: { color: C.indigo }, rectRadius: 0.03,
        });
        slide.addText(trunc(rec, 600), {
            x: 0.5, y: curY, w: 9.3, h: 1.6,
            fontSize: 10, color: C.slate900, wrap: true, valign: "top", bold: false,
            lineSpacingMultiple: 1.3,
        });
        curY += 1.75;
    }

    // Divider
    if (summary.highlights?.length) {
        slide.addShape(pptx.ShapeType.line, { x: 0.3, y: curY, w: 9.4, h: 0, line: { color: C.slate200, width: 0.5 } });
        curY += 0.2;

        slide.addText("KEY INSIGHTS", {
            x: 0.3, y: curY, w: 3, h: 0.3, fontSize: 8, bold: true, color: C.indigo, charSpacing: 2,
        });
        curY += 0.35;

        for (const bullet of summary.highlights.slice(0, 5)) {
            const text = bullet.replace(/^[•\-]\s*/, "").trim();
            // Bullet dot
            slide.addShape(pptx.ShapeType.ellipse, {
                x: 0.35, y: curY + 0.08, w: 0.1, h: 0.1, fill: { color: C.indigo },
            });
            const lineH = Math.min(1.0, Math.ceil(text.length / 120) * 0.36 + 0.1);
            slide.addText(trunc(text, 260), {
                x: 0.55, y: curY, w: 9.0, h: lineH,
                fontSize: 9.5, color: C.slate700, wrap: true, valign: "top",
                lineSpacingMultiple: 1.25,
            });
            curY += lineH + 0.08;
            if (curY > 5.2) break;
        }
    }
}

// ── Candidate hero slide ─────────────────────────────────────────────────────
async function addCandidateSlide(pptx: PptxGenJS, r: Stage3Result, photoBase64: string | null, displayRank: number) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });

    // Rank badge
    const rankColors: Record<number, string> = { 1: C.amber, 2: "94a3b8", 3: "b45309" };
    const rColor = rankColors[displayRank] ?? C.indigo;
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.2, y: 0.18, w: 0.58, h: 0.58, fill: { color: rColor }, rectRadius: 0.08 });
    slide.addText(`#${displayRank}`, { x: 0.2, y: 0.18, w: 0.58, h: 0.58, align: "center", valign: "middle", fontSize: 15, bold: true, color: C.white });

    // Photo or initial
    const photoX = 0.2, photoY = 0.92, photoW = 1.65, photoH = 1.65;
    if (photoBase64) {
        slide.addImage({ data: photoBase64, x: photoX, y: photoY, w: photoW, h: photoH, rounding: true });
    } else {
        slide.addShape(pptx.ShapeType.roundRect, { x: photoX, y: photoY, w: photoW, h: photoH, fill: { color: "dde1f0" }, rectRadius: photoW / 2 });
        slide.addText(r.name.charAt(0).toUpperCase(), {
            x: photoX, y: photoY, w: photoW, h: photoH,
            align: "center", valign: "middle", fontSize: 44, bold: true, color: C.indigo,
        });
    }

    // Overall score box
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.2, y: 2.72, w: 1.65, h: 0.82, fill: { color: C.indigo }, rectRadius: 0.1 });
    slide.addText("OVERALL", { x: 0.2, y: 2.74, w: 1.65, h: 0.28, align: "center", fontSize: 7, bold: true, color: "a5b4fc", charSpacing: 1 });
    slide.addText(`${r.score}`, { x: 0.2, y: 2.96, w: 1.65, h: 0.55, align: "center", fontSize: 26, bold: true, color: C.white });

    // Name + position
    slide.addText(r.name, { x: 2.1, y: 0.18, w: 7.7, h: 0.68, fontSize: 28, bold: true, color: C.slate900 });
    const posLine = [r.position, r.company].filter(Boolean).join("   •   ");
    if (posLine) slide.addText(posLine, { x: 2.1, y: 0.88, w: 7.7, h: 0.35, fontSize: 10.5, color: C.slate500 });

    const has4Dim = r.experience_score !== null;

    if (has4Dim) {
        // ── 4-Dimension score bars + summaries ──────────────────────────────
        const dims = [
            { label: "Experience",  score: r.experience_score,  summary: r.experience_summary },
            { label: "Leadership",  score: r.leadership_score,  summary: r.leadership_summary },
            { label: "Market Fit",  score: r.market_score,      summary: r.market_summary },
            { label: "Skills",      score: r.skills_score,      summary: r.skills_summary },
        ];

        dims.forEach((d, i) => {
            const y = 1.38 + i * 0.58;
            const sc = d.score ?? 0;
            slide.addText(d.label, { x: 2.1, y, w: 1.35, h: 0.32, fontSize: 9, bold: true, color: C.slate700, valign: "middle" });
            slide.addShape(pptx.ShapeType.rect, { x: 3.55, y: y + 0.08, w: 3.1, h: 0.16, fill: { color: C.slate200 } });
            if (sc > 0) slide.addShape(pptx.ShapeType.rect, { x: 3.55, y: y + 0.08, w: 3.1 * (sc / 100), h: 0.16, fill: { color: scoreColor(sc) } });
            slide.addText(`${sc}`, { x: 6.75, y, w: 0.45, h: 0.32, fontSize: 9, bold: true, color: C.slate700, valign: "middle", align: "right" });
            if (d.summary) {
                slide.addText(trunc(d.summary, 110), {
                    x: 7.3, y, w: 2.5, h: 0.32, fontSize: 7.5, color: C.slate500, valign: "middle", wrap: true,
                });
            }
        });

        // Divider + Strengths / Gaps
        slide.addShape(pptx.ShapeType.line, { x: 2.1, y: 3.75, w: 7.7, h: 0, line: { color: C.slate200, width: 0.75 } });
        slide.addText("STRENGTHS", { x: 2.1, y: 3.88, w: 2, h: 0.26, fontSize: 7.5, bold: true, color: C.green, charSpacing: 1 });
        slide.addText(trunc(r.strengths, 280), { x: 2.1, y: 4.16, w: 3.7, h: 1.3, fontSize: 8.5, color: C.slate700, wrap: true, valign: "top" });
        slide.addText("AREAS TO NOTE", { x: 6.1, y: 3.88, w: 2.2, h: 0.26, fontSize: 7.5, bold: true, color: C.amber, charSpacing: 1 });
        slide.addText(trunc(r.gaps, 280), { x: 6.1, y: 4.16, w: 3.7, h: 1.3, fontSize: 8.5, color: C.slate700, wrap: true, valign: "top" });

    } else {
        // ── No 4-dim — expanded Strengths / Gaps / Tradeoff layout ──────────
        const divY = 1.55;
        slide.addShape(pptx.ShapeType.line, { x: 2.1, y: divY, w: 7.7, h: 0, line: { color: C.slate200, width: 0.75 } });

        slide.addText("STRENGTHS", { x: 2.1, y: divY + 0.12, w: 2, h: 0.26, fontSize: 7.5, bold: true, color: C.green, charSpacing: 1 });
        slide.addText(trunc(r.strengths, 400), { x: 2.1, y: divY + 0.42, w: 3.7, h: 1.8, fontSize: 8.5, color: C.slate700, wrap: true, valign: "top" });

        slide.addText("AREAS TO NOTE", { x: 6.1, y: divY + 0.12, w: 2.2, h: 0.26, fontSize: 7.5, bold: true, color: C.amber, charSpacing: 1 });
        slide.addText(trunc(r.gaps, 400), { x: 6.1, y: divY + 0.42, w: 3.7, h: 1.8, fontSize: 8.5, color: C.slate700, wrap: true, valign: "top" });

        if (r.tradeoff) {
            const trY = divY + 2.45;
            slide.addShape(pptx.ShapeType.line, { x: 2.1, y: trY, w: 7.7, h: 0, line: { color: C.slate200, width: 0.75 } });
            slide.addText("OVERALL EVALUATION", { x: 2.1, y: trY + 0.12, w: 3, h: 0.26, fontSize: 7.5, bold: true, color: C.indigo, charSpacing: 1 });
            slide.addText(trunc(r.tradeoff, 500), { x: 2.1, y: trY + 0.42, w: 7.7, h: 1.2, fontSize: 8.5, color: C.slate700, wrap: true, valign: "top" });
        }
    }
}

// ── Table slide ─────────────────────────────────────────────────────────────
function addTableSlide(pptx: PptxGenJS, results: Stage3Result[], title: string) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });
    slide.addText(title, { x: 0.3, y: 0.18, w: 9.4, h: 0.55, fontSize: 20, bold: true, color: C.slate900 });

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

    const dataRows = results.map((r, idx) => {
        const rowFill = idx % 2 === 0 ? { color: C.white } : { color: C.slate100 };
        const base = { fill: rowFill, valign: "middle" as const };
        const dim = (v: number | null) => v != null ? `${v}` : "-";
        return [
            { text: `${idx + 1}`,                        options: { ...base, align: "center" as const, bold: true } },
            { text: r.name,                              options: { ...base, bold: true, color: C.slate900 } },
            { text: trunc(r.position, 35) || "-",        options: { ...base, color: C.slate700 } },
            { text: trunc(r.company, 30) || "-",         options: { ...base, color: C.slate700 } },
            { text: `${r.score}`,                        options: { ...base, align: "center" as const, bold: true, color: scoreColor(r.score) } },
            { text: dim(r.experience_score),             options: { ...base, align: "center" as const } },
            { text: dim(r.leadership_score),             options: { ...base, align: "center" as const } },
            { text: dim(r.market_score),                 options: { ...base, align: "center" as const } },
            { text: dim(r.skills_score),                 options: { ...base, align: "center" as const } },
        ];
    });

    (slide as any).addTable([headerRow, ...dataRows], {
        x: 0.2, y: 0.85, w: 9.6,
        fontSize: 8.5,
        rowH: 0.31,
        border: { type: "solid", pt: 0.5, color: C.slate200 },
        autoPage: true,
        autoPageRepeatHeader: true,
        autoPageHeaderRows: 1,
        autoPageSlideStartY: 0.5,
        newSlideStartY: 0.5,
        colW: [0.4, 2.1, 2.0, 2.0, 0.6, 0.6, 0.6, 0.6, 0.6],
    });
}

// ── Main export ──────────────────────────────────────────────────────────────
export async function generateAssessmentPPTX(
    jobId: string,
    jrId: string,
    jrTitle: string,
): Promise<{ base64: string; filename: string }> {
    const jobData = await getStage3JobStatus(jobId, jrId);
    if (!jobData || jobData.results.length === 0) throw new Error("ไม่มีผลลัพธ์ AI Assessment");

    // Sort by overall score DESC (consistent with web UI)
    const sorted = [...jobData.results].sort((a, b) => b.score - a.score || a.rank - b.rank);
    const top3  = sorted.slice(0, 3);
    const top20 = sorted.slice(0, 20);

    // Fallback title from DB
    let title = jrTitle;
    if (!title) {
        const { data: jr } = await adminAuthClient
            .from("job_requisitions").select("position_jr").eq("jr_id", jrId).single();
        title = (jr as any)?.position_jr ?? jrId;
    }

    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    // Prefetch Top 3 photos in parallel
    const photos = await Promise.all(top3.map(r => fetchImageBase64(r.photo_url)));

    // Build PPTX
    const pptx = new PptxGenJS();
    pptx.layout  = "LAYOUT_WIDE";
    pptx.author  = "CG Talent Hub";
    pptx.company = "CG Talent Hub";
    pptx.subject = `AI Assessment — ${title}`;
    pptx.title   = `${jrId} Assessment Report`;

    // Slide 1: Cover
    addCoverSlide(pptx, jrId, title, sorted.length, dateStr);

    // Slide 2: AI Summary (if available)
    addSummarySlide(pptx, jobData.summary);

    // Slides 3–5: Top 3 hero (displayRank = 1/2/3 by score order)
    for (let i = 0; i < top3.length; i++) {
        await addCandidateSlide(pptx, top3[i], photos[i], i + 1);
    }

    // Slide 6+: Summary table (Top 20)
    addTableSlide(pptx, top20, `Top ${top20.length} Summary`);

    // Full list if > 20
    if (sorted.length > 20) {
        addTableSlide(pptx, sorted, `Full Ranking — ${sorted.length} Candidates`);
    }

    const base64 = await pptx.write({ outputType: "base64" }) as string;
    return { base64, filename: `${jrId}_assessment_${new Date().toISOString().slice(0, 10)}.pptx` };
}
