"use server";

import PptxGenJS from "pptxgenjs";
import { adminAuthClient } from "@/lib/supabase/admin";
import { getStage3JobStatus, type Stage3Result } from "@/app/actions/ai-ranking";

// ── Colors ──────────────────────────────────────────────────────────────────
const C = {
    indigo:   "6366f1",
    slate900: "0f172a",
    slate700: "334155",
    slate500: "64748b",
    slate300: "cbd5e1",
    slate200: "e2e8f0",
    slate100: "f1f5f9",
    white:    "ffffff",
    green:    "22c55e",
    amber:    "f59e0b",
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

    // Left accent bar
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.1, h: "100%", fill: { color: C.indigo } });

    // Brand
    slide.addText("CG TALENT HUB", {
        x: 0.35, y: 0.3, w: 5, h: 0.35,
        fontSize: 9, bold: true, color: C.indigo, charSpacing: 4,
    });

    // Label
    slide.addText("AI Assessment Report", {
        x: 0.35, y: 0.75, w: 9.3, h: 0.45,
        fontSize: 14, italic: true, color: "94a3b8",
    });

    // JR Title (big)
    slide.addText(jrTitle || jrId, {
        x: 0.35, y: 1.4, w: 9.3, h: 2.2,
        fontSize: 38, bold: true, color: C.white, wrap: true, valign: "top",
    });

    // Meta chips row
    const metaY = 4.6;
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.35, y: metaY, w: 1.5, h: 0.42, fill: { color: "1e293b" }, rectRadius: 0.06 });
    slide.addText(jrId, { x: 0.35, y: metaY, w: 1.5, h: 0.42, align: "center", valign: "middle", fontSize: 9, color: "94a3b8" });

    slide.addShape(pptx.ShapeType.roundRect, { x: 2.0, y: metaY, w: 2.2, h: 0.42, fill: { color: "1e293b" }, rectRadius: 0.06 });
    slide.addText(`${total} Candidates Assessed`, { x: 2.0, y: metaY, w: 2.2, h: 0.42, align: "center", valign: "middle", fontSize: 9, color: "94a3b8" });

    slide.addShape(pptx.ShapeType.roundRect, { x: 4.35, y: metaY, w: 2.0, h: 0.42, fill: { color: "1e293b" }, rectRadius: 0.06 });
    slide.addText(dateStr, { x: 4.35, y: metaY, w: 2.0, h: 0.42, align: "center", valign: "middle", fontSize: 9, color: "94a3b8" });
}

// ── Candidate hero slide (Top 3) ─────────────────────────────────────────────
async function addCandidateSlide(pptx: PptxGenJS, r: Stage3Result, photoBase64: string | null) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };

    // Left accent
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });

    // Rank badge
    const rankColors: Record<number, string> = { 1: C.amber, 2: "94a3b8", 3: "b45309" };
    const rColor = rankColors[r.rank] ?? C.indigo;
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.2, y: 0.18, w: 0.58, h: 0.58, fill: { color: rColor }, rectRadius: 0.08 });
    slide.addText(`#${r.rank}`, { x: 0.2, y: 0.18, w: 0.58, h: 0.58, align: "center", valign: "middle", fontSize: 15, bold: true, color: C.white });

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

    // Name
    slide.addText(r.name, { x: 2.1, y: 0.18, w: 7.7, h: 0.68, fontSize: 28, bold: true, color: C.slate900 });

    // Position + Company
    const posLine = [r.position, r.company].filter(Boolean).join("   •   ");
    if (posLine) slide.addText(posLine, { x: 2.1, y: 0.88, w: 7.7, h: 0.35, fontSize: 10.5, color: C.slate500 });

    // 4-Dimension score bars
    const dims = [
        { label: "Experience",  score: r.experience_score,  summary: r.experience_summary },
        { label: "Leadership",  score: r.leadership_score,  summary: r.leadership_summary },
        { label: "Market Fit",  score: r.market_score,      summary: r.market_summary },
        { label: "Skills",      score: r.skills_score,      summary: r.skills_summary },
    ];

    dims.forEach((d, i) => {
        const y = 1.38 + i * 0.58;
        const sc = d.score ?? 0;
        // Label
        slide.addText(d.label, { x: 2.1, y, w: 1.4, h: 0.32, fontSize: 9, bold: true, color: C.slate700, valign: "middle" });
        // Bar background
        slide.addShape(pptx.ShapeType.rect, { x: 3.62, y: y + 0.08, w: 3.3, h: 0.17, fill: { color: C.slate200 } });
        // Bar fill
        if (sc > 0) slide.addShape(pptx.ShapeType.rect, { x: 3.62, y: y + 0.08, w: 3.3 * (sc / 100), h: 0.17, fill: { color: scoreColor(sc) } });
        // Score number
        slide.addText(`${sc}`, { x: 7.0, y, w: 0.48, h: 0.32, fontSize: 9, bold: true, color: C.slate700, valign: "middle", align: "right" });
        // Summary (right column)
        if (d.summary) {
            slide.addText(trunc(d.summary, 90), {
                x: 7.6, y, w: 2.2, h: 0.32, fontSize: 7.5, color: C.slate500, valign: "middle", wrap: true,
            });
        }
    });

    // Divider
    slide.addShape(pptx.ShapeType.line, { x: 2.1, y: 3.75, w: 7.7, h: 0, line: { color: C.slate200, width: 0.75 } });

    // Strengths
    slide.addText("STRENGTHS", { x: 2.1, y: 3.88, w: 2, h: 0.26, fontSize: 7.5, bold: true, color: C.green, charSpacing: 1 });
    slide.addText(trunc(r.strengths, 280), {
        x: 2.1, y: 4.16, w: 3.7, h: 1.3, fontSize: 8.5, color: C.slate700, wrap: true, valign: "top",
    });

    // Gaps
    slide.addText("AREAS TO NOTE", { x: 6.1, y: 3.88, w: 2.2, h: 0.26, fontSize: 7.5, bold: true, color: C.amber, charSpacing: 1 });
    slide.addText(trunc(r.gaps, 280), {
        x: 6.1, y: 4.16, w: 3.7, h: 1.3, fontSize: 8.5, color: C.slate700, wrap: true, valign: "top",
    });
}

// ── Table slides (Summary + Full list) ─────────────────────────────────────
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
        return [
            { text: `${r.rank}`,   options: { ...base, align: "center" as const, bold: true } },
            { text: r.name,        options: { ...base, bold: true, color: C.slate900 } },
            { text: trunc(r.position, 35) || "-",  options: { ...base, color: C.slate700 } },
            { text: trunc(r.company, 30) || "-",   options: { ...base, color: C.slate700 } },
            { text: `${r.score}`,  options: { ...base, align: "center" as const, bold: true, color: scoreColor(r.score) } },
            { text: r.experience_score != null ? `${r.experience_score}` : "-", options: { ...base, align: "center" as const } },
            { text: r.leadership_score != null ? `${r.leadership_score}` : "-", options: { ...base, align: "center" as const } },
            { text: r.market_score != null      ? `${r.market_score}`      : "-", options: { ...base, align: "center" as const } },
            { text: r.skills_score != null      ? `${r.skills_score}`      : "-", options: { ...base, align: "center" as const } },
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

// ── Main export function ─────────────────────────────────────────────────────
export async function generateAssessmentPPTX(
    jobId: string,
    jrId: string,
    jrTitle: string,
): Promise<{ base64: string; filename: string }> {
    // 1. Fetch ranking data
    const jobData = await getStage3JobStatus(jobId, jrId);
    if (!jobData || jobData.results.length === 0) throw new Error("ไม่มีผลลัพธ์ AI Assessment");

    const sorted = [...jobData.results].sort((a, b) => a.rank - b.rank);
    const top3   = sorted.slice(0, 3);
    const top20  = sorted.slice(0, 20);

    // 2. Fetch JR info for title fallback
    let title = jrTitle;
    if (!title) {
        const { data: jr } = await adminAuthClient
            .from("job_requisitions")
            .select("position_jr")
            .eq("jr_id", jrId)
            .single();
        title = (jr as any)?.position_jr ?? jrId;
    }

    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    // 3. Prefetch Top 3 photos in parallel
    const photos = await Promise.all(top3.map(r => fetchImageBase64(r.photo_url)));

    // 4. Build PPTX
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author  = "CG Talent Hub";
    pptx.company = "CG Talent Hub";
    pptx.subject = `AI Assessment — ${title}`;
    pptx.title   = `${jrId} Assessment Report`;

    // Slide 1: Cover
    addCoverSlide(pptx, jrId, title, sorted.length, dateStr);

    // Slides 2–4: Top 3 hero
    for (let i = 0; i < top3.length; i++) {
        await addCandidateSlide(pptx, top3[i], photos[i]);
    }

    // Slide 5+: Summary table (Top 20 with 4-dim scores)
    addTableSlide(pptx, top20, `Top ${top20.length} Summary`);

    // Full list if more than 20
    if (sorted.length > 20) {
        addTableSlide(pptx, sorted, `Full Ranking — ${sorted.length} Candidates`);
    }

    // 5. Export as base64
    const base64 = await pptx.write({ outputType: "base64" }) as string;
    const filename = `${jrId}_assessment_${new Date().toISOString().slice(0, 10)}.pptx`;

    return { base64, filename };
}
