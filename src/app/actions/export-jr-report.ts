"use server";

import PptxGenJS from "pptxgenjs";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { adminAuthClient } from "@/lib/supabase/admin";
import {
    groupExperiencesByCandidate,
    formatExperienceHistory,
    formatEducationHeadline,
    type ExperienceRow,
} from "@/lib/candidate-experience-utils";

// ── Palette (same as export-pptx.ts) ─────────────────────────────────────────
const C = {
    indigo:   "6366f1",
    indigo50: "eef2ff",
    slate900: "0f172a",
    slate700: "334155",
    slate600: "475569",
    slate500: "64748b",
    slate400: "94a3b8",
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

// ── Constants ─────────────────────────────────────────────────────────────────
const SHORT_PROFILE_PAGE_SIZE = 6;
const LONGLIST_PAGE_SIZE = 20;
const CHARS_PER_INCH_7_5PT = 18; // was tuned for 7pt (20/inch); scaled down for the bumped 7.5pt info text

const FIXED_GROUP_ORDER = [
    "Retail / FMCG / F&B",
    "Technology / Digital / Telecom",
    "Hospitality & Real Estate",
    "Financial Services / Banking / Insurance",
    "Consulting Firm / Consulting Services",
    "Others",
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────
type StatusColor = {
    bg_color: string | null;        // hex without #, e.g. "fef2f2"
    font_color: string | null;      // hex without #
    row_color_enabled: boolean;
    stage_order: number;
};
type StatusColorMap = Map<string, StatusColor>;

type JRInfo = {
    position_jr: string | null;
    bu: string | null;
    sub_bu: string | null;
    jr_id: string;
    jr_type: string | null;
    job_description: string | null;
    feedback_file: string | null;
};

type CandidateForReport = {
    candidate_id: string;
    name: string;
    photo_url: string | null;
    linkedin: string | null;
    age: number | null;
    age_source: string | null;
    gender: string | null;
    nationality: string | null;
    job_function: string | null;
    candidate_status: string[] | null;
    position: string | null;
    company: string | null;
    company_id: number | null;
    location: string | null;
    group: string | null;
    rating: string | null;
    education: string | null;
    experience_history: string[];
    rank: number;
    list_type: string | null;
    latest_status: string | null;
    // score field kept for compatibility with bucketLongList (unused in JR Report)
    score: number;
};

type JRReportData = {
    jr: JRInfo;
    allCandidates: CandidateForReport[];
    topProfileCandidates: CandidateForReport[];
    internalCandidates: CandidateForReport[];
    totalCandidates: number;
    topProfileCount: number;
    totalCompanies: number;
    statusColors: StatusColorMap;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function trunc(s: string | null | undefined, max: number): string {
    if (!s) return "";
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function sanitizeHyperlinkUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
        return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    } catch {
        return null;
    }
}

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
            return null;
        }
    } catch { return null; }
}

let _linkedinIconUri: string | null = null;
function getLinkedinIconUri(): string | null {
    if (_linkedinIconUri !== null) return _linkedinIconUri;
    try {
        _linkedinIconUri = `data:image/png;base64,${fs.readFileSync(
            path.join(process.cwd(), "public", "linkedin-logo.png")
        ).toString("base64")}`;
    } catch (e) {
        console.error("Failed to load LinkedIn icon for JR Report PPTX", e);
        _linkedinIconUri = "";
    }
    return _linkedinIconUri;
}

// ── Cover slide ───────────────────────────────────────────────────────────────
function addCoverSlide(pptx: PptxGenJS, jrId: string, jrTitle: string, total: number, dateStr: string) {
    const slide = pptx.addSlide();
    slide.background = { color: C.slate900 };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.1, h: "100%", fill: { color: C.indigo } });

    slide.addText("CG TALENT HUB", {
        x: 0.35, y: 0.3, w: 5, h: 0.35, fontSize: 9, bold: true, color: C.indigo, charSpacing: 4,
    });
    slide.addText("JR Candidate Report", {
        x: 0.35, y: 0.75, w: 12.6, h: 0.45, fontSize: 14, italic: true, color: C.slate400,
    });
    slide.addText(jrTitle || jrId, {
        x: 0.35, y: 1.4, w: 12.6, h: 2.2, fontSize: 38, bold: true, color: C.white, wrap: true, valign: "top",
    });

    const chips = [
        { x: 0.35, w: 1.5,  text: jrId },
        { x: 2.0,  w: 2.1,  text: `${total} Candidates` },
        { x: 4.25, w: 2.2,  text: dateStr },
    ];
    for (const chip of chips) {
        slide.addShape(pptx.ShapeType.roundRect, { x: chip.x, y: 4.6, w: chip.w, h: 0.42, fill: { color: "1e293b" }, rectRadius: 0.06 });
        slide.addText(chip.text, { x: chip.x, y: 4.6, w: chip.w, h: 0.42, align: "center", valign: "middle", fontSize: 9, color: C.slate400 });
    }
}

// ── Section cover ─────────────────────────────────────────────────────────────
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
        x: 0.9, y: 3.95, w: 11.5, h: 0.5, fontSize: 13, italic: true, color: C.slate400, wrap: true, valign: "top",
    });
}

// ── JR Brief slide ────────────────────────────────────────────────────────────
function addBriefSlide(pptx: PptxGenJS, jr: JRInfo) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });
    slide.addText("THE BRIEF", {
        x: 0.3, y: 0.18, w: 12.75, h: 0.36, fontSize: 10, bold: true, color: C.indigo, charSpacing: 2,
    });
    slide.addText(jr.position_jr || jr.jr_id, {
        x: 0.3, y: 0.65, w: 12.75, h: 0.8, fontSize: 26, bold: true, color: C.slate900, wrap: true, valign: "top",
    });

    const chips = [
        jr.bu      ? { label: "BU",      value: jr.bu }      : null,
        jr.sub_bu  ? { label: "SUB BU",  value: jr.sub_bu }  : null,
        jr.jr_type ? { label: "JR TYPE", value: jr.jr_type } : null,
        { label: "JR ID", value: jr.jr_id },
    ].filter((c): c is { label: string; value: string } => c !== null);

    let curY = 1.55;
    if (chips.length) {
        const CHIP_W = 4.1, CHIP_H = 0.65, GAP = 0.2;
        chips.forEach((c, i) => {
            const cx = 0.3 + (i % 3) * (CHIP_W + GAP);
            const cy = curY + Math.floor(i / 3) * (CHIP_H + 0.15);
            slide.addShape(pptx.ShapeType.roundRect, {
                x: cx, y: cy, w: CHIP_W, h: CHIP_H, fill: { color: C.slate100 }, line: { color: C.slate200, width: 0.5 }, rectRadius: 0.08,
            });
            slide.addText(c.label, { x: cx + 0.18, y: cy + 0.08, w: CHIP_W - 0.36, h: 0.2, fontSize: 7.5, bold: true, color: C.indigo, charSpacing: 1 });
            slide.addText(c.value, { x: cx + 0.18, y: cy + 0.3, w: CHIP_W - 0.36, h: 0.3, fontSize: 12, bold: true, color: C.slate900, wrap: true });
        });
        curY += (CHIP_H + 0.15) * Math.ceil(chips.length / 3) + 0.2;
    }

    // "feedback_file" is the JD source file uploaded on the JR form (labelled
    // "Job Description File" there) — a misleading column name from an older
    // feature, but it's the only place the original PDF/Drive link lives.
    const jdFileUrl = sanitizeHyperlinkUrl(jr.feedback_file);

    if (jr.job_description || jdFileUrl) {
        slide.addShape(pptx.ShapeType.line, { x: 0.3, y: curY, w: 12.75, h: 0, line: { color: C.slate200, width: 0.75 } });
        curY += 0.2;
        slide.addText("JOB DESCRIPTION", {
            x: 0.3, y: curY, w: 8, h: 0.24, fontSize: 8, bold: true, color: C.slate500, charSpacing: 1.5,
        });
        // Link to the full original file — the text preview below is capped at
        // 1400 chars and most JDs run much longer, so this is the only way to
        // see the whole thing.
        if (jdFileUrl) {
            const linkW = 2.6, linkH = 0.28;
            const linkX = 0.3 + 12.75 - linkW, linkY = curY - 0.03;
            slide.addShape(pptx.ShapeType.roundRect, {
                x: linkX, y: linkY, w: linkW, h: linkH,
                fill: { color: C.indigo50 }, line: { color: C.indigo, width: 0.75 }, rectRadius: linkH / 2,
                hyperlink: { url: jdFileUrl },
            });
            slide.addText("View Original JD File  ↗", {
                x: linkX, y: linkY, w: linkW, h: linkH, fontSize: 8, bold: true, color: C.indigo,
                align: "center", valign: "middle", hyperlink: { url: jdFileUrl },
            });
        }
        curY += 0.3;
        if (jr.job_description) {
            slide.addText(trunc(jr.job_description, 1400), {
                x: 0.3, y: curY, w: 12.75, h: 7.2 - curY, fontSize: 11, color: C.slate700, wrap: true, valign: "top", lineSpacingMultiple: 1.35,
            });
        }
    }
}

// ── Summary Mapping slide ─────────────────────────────────────────────────────
function addSummaryMappingSlide(
    pptx: PptxGenJS,
    opts: {
        jrPosition: string;
        allCandidates: CandidateForReport[];
        topProfileCount: number;
        jrId: string;
    },
) {
    const { jrPosition, allCandidates, topProfileCount, jrId } = opts;

    // Build group stats
    const topCandidateIds = new Set(
        allCandidates
            .filter(c => (c.list_type ?? "").toLowerCase().includes("top"))
            .map(c => c.candidate_id)
    );
    // "Company|Location" composite key for Top Profile companies
    const topCompanyKeys = new Set<string>();
    const globalCompanies = new Set<string>();

    type GroupStats = {
        people: number;
        companies: Set<string>;
        locations: Map<string, Set<string>>;    // location → Set<company>
        nationalities: Map<string, number>;
    };
    const groupStats = new Map<string, GroupStats>();
    for (const g of FIXED_GROUP_ORDER) {
        groupStats.set(g, { people: 0, companies: new Set(), locations: new Map(), nationalities: new Map() });
    }

    for (const c of allCandidates) {
        const company = c.company || "";
        const loc = c.location || "N/A";
        const isTop = topCandidateIds.has(c.candidate_id);
        if (company) globalCompanies.add(company);
        if (isTop && company) topCompanyKeys.add(`${company}|${loc}`);

        const g = FIXED_GROUP_ORDER.includes(c.group as any) ? c.group! : "Others";
        const stats = groupStats.get(g)!;
        stats.people++;
        if (company) {
            stats.companies.add(company);
            if (!stats.locations.has(loc)) stats.locations.set(loc, new Set());
            stats.locations.get(loc)!.add(company);
        }
        const nat = c.nationality || "N/A";
        stats.nationalities.set(nat, (stats.nationalities.get(nat) ?? 0) + 1);
    }

    const activeGroups = FIXED_GROUP_ORDER.filter(g => (groupStats.get(g)?.people ?? 0) > 0);
    const totalCandidates = allCandidates.length;
    const totalCompanies = globalCompanies.size;

    // ── Slide ────────────────────────────────────────────────────────────────
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });

    // Eyebrow + title
    slide.addText("SUMMARY MAPPING", {
        x: 0.28, y: 0.12, w: 13, h: 0.22, fontSize: 8.5, bold: true, color: C.indigo, charSpacing: 2,
    });
    slide.addText(jrPosition, {
        x: 0.28, y: 0.35, w: 13, h: 0.5, fontSize: 18, bold: true, color: C.slate900, wrap: true, valign: "top",
    });

    // Top Profile legend — a visible chip in the top-right corner, read before
    // the "**" marks scattered through the columns below (was a faint caption
    // buried at the bottom of the slide, easy to miss).
    const legendW = 1.9, legendH = 0.3;
    const legendX = 0.28 + 12.9 - legendW, legendY = 0.13;
    slide.addShape(pptx.ShapeType.roundRect, {
        x: legendX, y: legendY, w: legendW, h: legendH,
        fill: { color: C.indigo50 }, line: { color: C.indigo, width: 0.75 }, rectRadius: legendH / 2,
    });
    slide.addText([
        { text: "** ", options: { bold: true, color: C.indigo } },
        { text: "= Top Profile", options: { color: C.indigo } },
    ], {
        x: legendX, y: legendY, w: legendW, h: legendH, fontSize: 8, align: "center", valign: "middle",
    });

    // Narrative summary line — restores the framing sentence from the legacy
    // n8n slide ("We have the Top N profiles out of M candidates...") while
    // keeping the same underlying counts/groups the old compact stat row used.
    const narrativeRuns: { text: string; options: any }[] = [
        { text: `We have the Top `, options: { color: C.slate700 } },
        { text: `${topProfileCount}`, options: { bold: true, color: C.indigo } },
        { text: ` profiles out of `, options: { color: C.slate700 } },
        { text: `${totalCandidates}`, options: { bold: true, color: C.slate900 } },
        { text: ` candidates across `, options: { color: C.slate700 } },
        { text: `${totalCompanies}`, options: { bold: true, color: C.slate700 } },
        { text: ` companies, from key groups including `, options: { color: C.slate700 } },
        { text: activeGroups.join(", "), options: { color: C.slate600, italic: true } },
        { text: `.`, options: { color: C.slate700 } },
    ];
    slide.addText(narrativeRuns, {
        x: 0.28, y: 0.86, w: 12.9, h: 0.4, fontSize: 9.5, wrap: true, valign: "top",
    });

    // Divider
    slide.addShape(pptx.ShapeType.line, {
        x: 0.28, y: 1.3, w: 12.9, h: 0, line: { color: C.slate300, width: 1 },
    });

    // ── Group columns ────────────────────────────────────────────────────────
    const COLS = activeGroups.length || 1;
    const BODY_X = 0.28;
    const BODY_W = 12.9;
    const COL_GAP = 0.14;
    const colW = (BODY_W - COL_GAP * (COLS - 1)) / COLS;
    const BODY_Y = 1.38;
    const BODY_BOTTOM = 7.3;   // leave room for legend

    const LH_XS  = 0.112;   // 7pt line height
    const LH_SM  = 0.122;   // 7.5pt line height
    const LH_MD  = 0.132;   // 8pt line height
    const GAP_XS  = 0.04;
    const GAP_SM  = 0.07;
    const GAP_MD  = 0.1;

    activeGroups.forEach((groupName, idx) => {
        const x = BODY_X + idx * (colW + COL_GAP);
        const stats = groupStats.get(groupName)!;

        // Column separator (vertical line, not for first col)
        if (idx > 0) {
            slide.addShape(pptx.ShapeType.line, {
                x: x - COL_GAP / 2, y: BODY_Y, w: 0, h: BODY_BOTTOM - BODY_Y,
                line: { color: C.slate300, width: 1 },
            });
        }

        let curY = BODY_Y;
        const safeAdd = (y: number) => y < BODY_BOTTOM;

        // Group name — solid header bar (slate900, not indigo) so it reads as a
        // clear column divider and never gets confused with the indigo used to
        // highlight Top Profile companies further down the same column.
        if (safeAdd(curY)) {
            const nameLines = Math.max(1, Math.ceil(groupName.length / Math.floor(colW * 12)));
            const headerPad = 0.05;
            const headerH = LH_MD * nameLines + headerPad * 2;
            slide.addShape(pptx.ShapeType.rect, {
                x, y: curY, w: colW, h: headerH, fill: { color: C.slate900 },
            });
            slide.addText(groupName, {
                x: x + 0.07, y: curY, w: colW - 0.14, h: headerH,
                fontSize: 8, bold: true, color: C.white, wrap: true, valign: "middle",
            });
            curY += headerH + GAP_SM;
        }

        // People / companies count
        if (safeAdd(curY)) {
            slide.addText(`${stats.people} people · ${stats.companies.size} companies`, {
                x, y: curY, w: colW, h: LH_SM, fontSize: 7.5, color: C.slate500,
            });
            curY += LH_SM + GAP_MD;
        }

        // Sort locations: locations with Top Profile companies come first
        const sortedLocs = Array.from(stats.locations.entries()).sort(([locA, coA], [locB, coB]) => {
            const hasTopA = Array.from(coA).some(c => topCompanyKeys.has(`${c}|${locA}`));
            const hasTopB = Array.from(coB).some(c => topCompanyKeys.has(`${c}|${locB}`));
            if (hasTopA && !hasTopB) return -1;
            if (!hasTopA && hasTopB) return 1;
            return locA.localeCompare(locB);
        });

        // Reserve room at the bottom of the column for a "+N more" note in case
        // the company list doesn't fit — a group like "Retail / FMCG / F&B" can
        // easily outgrow the column, and silently dropping the tail is worse
        // than saying so.
        const OVERFLOW_NOTE_H = 0.15;
        const LOC_LIMIT = BODY_BOTTOM - OVERFLOW_NOTE_H - 0.03;
        let renderedCompanies = 0;
        let truncated = false;

        for (const [locName, companies] of sortedLocs) {
            if (curY + LH_SM > LOC_LIMIT) { truncated = true; break; }

            // Location header
            slide.addText(`${locName}  (${companies.size})`, {
                x, y: curY, w: colW, h: LH_SM, fontSize: 7.5, bold: true, color: C.slate700,
            });
            curY += LH_SM + GAP_XS;

            // Companies: top first, then alpha
            const sortedCos = Array.from(companies).sort((a, b) => {
                const tA = topCompanyKeys.has(`${a}|${locName}`);
                const tB = topCompanyKeys.has(`${b}|${locName}`);
                if (tA && !tB) return -1;
                if (!tA && tB) return 1;
                return a.localeCompare(b);
            });

            // Full company names, wrapped to fit the column instead of "…" truncated
            // — column width varies with how many groups are active, so a fixed
            // char limit either cut names short in wide columns or overflowed in
            // narrow ones.
            const CHARS_PER_INCH_7PT = 20;
            for (const co of sortedCos) {
                const isTop = topCompanyKeys.has(`${co}|${locName}`);
                const label = `• ${co}${isTop ? " **" : ""}`;
                const availW = colW - 0.06;
                const charsPerLine = Math.max(10, Math.floor(availW * CHARS_PER_INCH_7PT));
                const lineCount = Math.max(1, Math.ceil(label.length / charsPerLine));
                const lineH = LH_XS * lineCount;
                if (curY + lineH > LOC_LIMIT) { truncated = true; break; }
                slide.addText(label, {
                    x: x + 0.06, y: curY, w: availW, h: lineH,
                    fontSize: 7,
                    color: isTop ? C.indigo : C.slate600,
                    bold: isTop,
                    wrap: true,
                    valign: "top",
                });
                curY += lineH;
                renderedCompanies++;
            }
            if (truncated) break;
            curY += GAP_SM;
        }

        if (truncated) {
            const remaining = Math.max(1, stats.companies.size - renderedCompanies);
            slide.addText(`+ ${remaining} more compan${remaining === 1 ? "y" : "ies"} not shown`, {
                x, y: LOC_LIMIT + 0.03, w: colW, h: OVERFLOW_NOTE_H, fontSize: 6.5, italic: true, color: C.amber,
            });
            curY = BODY_BOTTOM; // no room left in this column — skip Nationality below
        } else {
            curY += GAP_SM;
        }

        // Nationality breakdown
        if (safeAdd(curY + LH_SM)) {
            slide.addText("Nationality", {
                x, y: curY, w: colW, h: LH_SM, fontSize: 7.5, bold: true, color: C.slate500,
            });
            curY += LH_SM + GAP_XS;

            const natSorted = Array.from(stats.nationalities.entries()).sort((a, b) => b[1] - a[1]);
            for (const [nat, count] of natSorted) {
                if (!safeAdd(curY)) break;
                slide.addText(`• ${nat}  ${count} ppl`, {
                    x: x + 0.06, y: curY, w: colW - 0.06, h: LH_XS, fontSize: 7, color: C.slate500,
                });
                curY += LH_XS;
            }
        }
    });

    // Footer tag (Top Profile legend now lives as a chip up near the title)
    slide.addText(`${jrId}`, {
        x: 10.5, y: 7.33, w: 2.73, h: 0.15, fontSize: 7, color: C.slate400, align: "right",
    });
}

// ── Short Profile card slides ─────────────────────────────────────────────────
async function addShortProfileCardsSlides(
    pptx: PptxGenJS,
    candidates: CandidateForReport[],
    titleBase: string,
    statusColors: StatusColorMap,
) {
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
        const CARD_W = (12.7 - 2 * GAP) / 3;
        const CARD_H = (6.5 - GAP) / 2;

        pageItems.forEach((c, i) => {
            const col = i % 3, row = Math.floor(i / 3);
            const cx = GRID_X + col * (CARD_W + GAP), cy = GRID_Y + row * (CARD_H + GAP);
            const photo = photos[photoOffset + i];
            const displayRank = page * SHORT_PROFILE_PAGE_SIZE + i + 1;

            slide.addShape(pptx.ShapeType.roundRect, {
                x: cx, y: cy, w: CARD_W, h: CARD_H,
                fill: { color: C.slate100 }, line: { color: C.slate200, width: 0.5 }, rectRadius: 0.08,
            });

            // Header: rank + name
            slide.addText(`${displayRank}. ${c.name}`, {
                x: cx + 0.15, y: cy + 0.08, w: CARD_W - 1.9, h: 0.4,
                fontSize: 13, bold: true, color: C.slate900, wrap: true, valign: "top",
            });

            // Status badge (top-right) — filled pill matching the status chip
            // style on JR Manage's candidate list (bg_color fill, font_color text)
            if (c.latest_status) {
                const sc = statusColors.get(c.latest_status);
                const chipBg = sc?.bg_color ? sc.bg_color.replace("#", "") : "e2e8f0";
                const chipText = sc?.font_color ? sc.font_color.replace("#", "") : C.slate600;
                const chipW = 1.55, chipH = 0.28;
                const chipX = cx + CARD_W - chipW - 0.15, chipY = cy + 0.12;
                slide.addShape(pptx.ShapeType.roundRect, {
                    x: chipX, y: chipY, w: chipW, h: chipH,
                    fill: { color: chipBg }, rectRadius: chipH / 2,
                });
                slide.addText(c.latest_status, {
                    x: chipX, y: chipY, w: chipW, h: chipH,
                    fontSize: 8, bold: true, color: chipText,
                    align: "center", valign: "middle",
                });
            }

            // Photo
            const photoX = cx + 0.15, photoY = cy + 0.5, photoS = 0.85;
            if (photo) {
                slide.addImage({ data: photo, x: photoX, y: photoY, w: photoS, h: photoS, rounding: true });
            } else {
                slide.addShape(pptx.ShapeType.roundRect, {
                    x: photoX, y: photoY, w: photoS, h: photoS, fill: { color: "dde1f0" }, rectRadius: photoS / 2,
                });
                slide.addText(c.name.charAt(0).toUpperCase(), {
                    x: photoX, y: photoY, w: photoS, h: photoS,
                    align: "center", valign: "middle", fontSize: 22, bold: true, color: C.indigo,
                });
            }

            // Info lines
            const infoW = CARD_W - photoS - 0.45;
            const fields: { label: string; value: string }[] = [
                { label: "Position",    value: c.position    || "-" },
                { label: "Company",     value: c.company     || "-" },
                { label: "Nationality", value: c.nationality || "-" },
                { label: "Location",    value: c.location    || "-" },
                { label: "Age",         value: c.age != null ? `${c.age}` : "-" },
                { label: "Education",   value: c.education   || "-" },
            ];
            const charsPerLine = Math.max(10, Math.floor(infoW * CHARS_PER_INCH_7_5PT));
            let estLines = 0;
            const infoRuns: { text: string; options: any }[] = [];
            fields.forEach(f => {
                infoRuns.push({ text: `${f.label}: `, options: { bold: true } });
                infoRuns.push({ text: f.value, options: { breakLine: true } });
                estLines += Math.max(1, Math.ceil((f.label.length + 2 + f.value.length) / charsPerLine));
            });
            const infoH = estLines * 0.14;
            slide.addText(infoRuns, {
                x: photoX + photoS + 0.15, y: photoY, w: infoW, h: Math.max(photoS, infoH),
                fontSize: 7.5, color: C.slate600, wrap: true, valign: "top", lineSpacingMultiple: 1.15,
            });

            // LinkedIn + Rating row
            const contentBottom = photoY + Math.max(photoS, infoH);
            const badgeY = contentBottom + 0.1;
            const linkedinIconUri = c.linkedin ? getLinkedinIconUri() : null;
            if (c.linkedin && linkedinIconUri) {
                slide.addImage({
                    data: linkedinIconUri,
                    x: cx + 0.15, y: badgeY, w: 0.26, h: 0.26,
                    hyperlink: { url: sanitizeHyperlinkUrl(c.linkedin)! },
                });
            }
            if (c.rating) {
                const ratingX = cx + (c.linkedin ? 0.48 : 0.15);
                slide.addShape(pptx.ShapeType.roundRect, {
                    x: ratingX, y: badgeY, w: 0.95, h: 0.26, fill: { color: C.amber50 }, rectRadius: 0.05,
                });
                slide.addText(`★ ${c.rating}`, {
                    x: ratingX, y: badgeY, w: 0.95, h: 0.26,
                    align: "center", valign: "middle", fontSize: 7.5, bold: true, color: C.amber,
                });
            }

            // Experience history
            if (c.experience_history.length) {
                const expY = badgeY + 0.34;
                slide.addText("EXPERIENCE", {
                    x: cx + 0.15, y: expY, w: CARD_W - 0.3, h: 0.18,
                    fontSize: 7, bold: true, color: C.slate500, charSpacing: 0.5,
                });
                slide.addText(c.experience_history.slice(0, 3).join("\n"), {
                    x: cx + 0.15, y: expY + 0.2, w: CARD_W - 0.3,
                    h: Math.max(0.3, cy + CARD_H - 0.1 - (expY + 0.24)),
                    fontSize: 7, color: C.slate600, wrap: true, valign: "top", lineSpacingMultiple: 1.15,
                });
            }
        });
    }
}

// ── Long List helpers ─────────────────────────────────────────────────────────
const isTopProfileCandidate = (c: CandidateForReport) => (c.list_type ?? "").toLowerCase().includes("top");

function bucketLongList(pool: CandidateForReport[], statusColors: StatusColorMap): CandidateForReport[] {
    // Mirrors n8n Prepare Slides1 bucket order:
    //   Top Profile (by rank) → Standard → Not-progressing → Rejected (always last)
    //
    // "Rejected" is explicitly separated to the tail (matches n8n: grayList then rejectedList).
    // "Successful Placement" is row_color_enabled but a positive outcome — keep in Standard.
    const top = pool.filter(isTopProfileCandidate).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    const rest = pool.filter(r => !isTopProfileCandidate(r));

    const isRejected  = (r: CandidateForReport) => r.latest_status === "Rejected";
    const isColored   = (r: CandidateForReport) =>
        (statusColors.get(r.latest_status ?? "")?.row_color_enabled ?? false)
        && !isRejected(r)
        && r.latest_status !== "Successful Placement";

    // Standard: active pipeline (row_color_enabled false) + Successful Placement
    const standard = rest.filter(r => !isColored(r) && !isRejected(r));
    // Not-progressing: colored negative statuses (Not fit, Not Open, Not Pass Interview, Hold, Too Senior…)
    //   sorted by stage_order so statuses appear in a consistent, recognisable order
    const notProgressing = rest
        .filter(isColored)
        .sort((a, b) =>
            (statusColors.get(a.latest_status ?? "")?.stage_order ?? 99) -
            (statusColors.get(b.latest_status ?? "")?.stage_order ?? 99));
    // Rejected always last
    const rejected = rest.filter(isRejected);

    return [...top, ...standard, ...notProgressing, ...rejected];
}

function addLongListSlide(pptx: PptxGenJS, results: CandidateForReport[], titleBase: string, statusColors: StatusColorMap) {
    const totalPages = Math.max(1, Math.ceil(results.length / LONGLIST_PAGE_SIZE));

    for (let page = 0; page < totalPages; page++) {
        const pageResults = results.slice(page * LONGLIST_PAGE_SIZE, (page + 1) * LONGLIST_PAGE_SIZE);
        const rowOffset = page * LONGLIST_PAGE_SIZE;

        const slide = pptx.addSlide();
        slide.background = { color: C.white };
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: C.indigo } });
        const title = totalPages > 1 ? `${titleBase} (${page + 1}/${totalPages})` : titleBase;
        slide.addText(title, { x: 0.3, y: 0.18, w: 6.5, h: 0.55, fontSize: 20, bold: true, color: C.slate900 });

        // Legend — coloured rows = row_color_enabled statuses from status_master
        slide.addShape(pptx.ShapeType.rect, { x: 8.7, y: 0.22, w: 0.22, h: 0.16, fill: { color: "fef2f2" }, line: { color: C.slate200, width: 0.5 } });
        slide.addText("= Closed / Not Progressed", { x: 8.98, y: 0.18, w: 4.1, h: 0.24, fontSize: 8, color: C.slate600, valign: "middle" });
        slide.addShape(pptx.ShapeType.rect, { x: 8.7, y: 0.44, w: 0.22, h: 0.16, fill: { color: "d1fae5" }, line: { color: C.slate200, width: 0.5 } });
        slide.addText("= Placed / Won", { x: 8.98, y: 0.4, w: 4.1, h: 0.24, fontSize: 8, color: C.slate600, valign: "middle" });

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
            const sc = statusColors.get(r.latest_status ?? "");
            const isColored = sc?.row_color_enabled ?? false;
            // Bg: use status_master bg_color when row_color_enabled, else alternate white/slate100
            const bgHex = isColored && sc?.bg_color
                ? sc.bg_color.replace("#", "")
                : idx % 2 === 0 ? C.white : C.slate100;
            const fgHex = isColored && sc?.font_color
                ? sc.font_color.replace("#", "")
                : C.slate600;
            const rowFill = { color: bgHex };
            const base = { fill: rowFill, valign: "middle" as const };
            return [
                { text: `${rowOffset + idx + 1}`,          options: { ...base, align: "center" as const, bold: true, color: isColored ? fgHex : C.slate500 } },
                { text: trunc(r.company, 30) || "-",        options: { ...base, color: fgHex } },
                { text: r.name,                             options: { ...base, bold: true, color: isColored ? fgHex : C.slate900 } },
                { text: trunc(r.position, 34) || "-",       options: { ...base, color: fgHex } },
                { text: r.age != null ? `${r.age}` : "-",  options: { ...base, align: "center" as const, color: fgHex } },
                { text: trunc(r.gender, 8) || "-",          options: { ...base, align: "center" as const, color: fgHex } },
                { text: trunc(r.location, 20) || "-",       options: { ...base, color: fgHex } },
                { text: trunc(r.nationality, 18) || "-",    options: { ...base, color: fgHex } },
                { text: r.linkedin ? "View" : "-",          options: (() => { const u = sanitizeHyperlinkUrl(r.linkedin); return u ? { ...base, align: "center" as const, color: C.indigo, hyperlink: { url: u } } : { ...base, align: "center" as const, color: C.slate300 }; })() },
                { text: r.latest_status ?? "-",             options: { ...base, color: fgHex, bold: isColored } },
            ];
        });

        (slide as any).addTable([headerRow, ...dataRows], {
            x: 0.2, y: 0.85, w: 12.9,
            fontSize: 8,
            rowH: 0.3,
            border: { type: "solid", pt: 0.5, color: C.slate200 },
            colW: [0.45, 1.9, 1.8, 2.2, 0.5, 0.65, 1.15, 1.15, 0.7, 1.6],
        });
    }
}

// ── Data fetching ─────────────────────────────────────────────────────────────
async function fetchJRReportData(jrId: string): Promise<JRReportData> {
    const [jrRes, jrCandidatesRes] = await Promise.all([
        adminAuthClient
            .from("job_requisitions")
            .select("position_jr, bu, sub_bu, jr_id, jr_type, job_description, feedback_file")
            .eq("jr_id", jrId)
            .single(),
        adminAuthClient
            .from("jr_candidates")
            .select("candidate_id, jr_candidate_id, rank, list_type")
            .eq("jr_id", jrId),
    ]);

    const jr = (jrRes.data ?? { position_jr: null, bu: null, sub_bu: null, jr_id: jrId, jr_type: null, job_description: null, feedback_file: null }) as JRInfo;
    const jrCandidates = (jrCandidatesRes.data ?? []) as any[];

    // Always fetch status_master for coloring (needed even for empty JR)
    const statusMasterRes = await adminAuthClient
        .from("status_master")
        .select("status, stage_order, font_color, bg_color, row_color_enabled");
    const statusColors: StatusColorMap = new Map(
        (statusMasterRes.data ?? []).map((s: any) => [
            s.status as string,
            {
                bg_color:          s.bg_color   ? String(s.bg_color).replace("#", "")   : null,
                font_color:        s.font_color ? String(s.font_color).replace("#", "") : null,
                row_color_enabled: Boolean(s.row_color_enabled),
                stage_order:       Number(s.stage_order ?? 99),
            } satisfies StatusColor,
        ])
    );
    // "Too Senior" lives in Candidate Profile.candidate_status (profile-level tag),
    // not in status_master. Add it manually so bucket sorting + row coloring work.
    statusColors.set("Too Senior", {
        bg_color:          "f1f5f9",  // slate100 — visually distinct from the red cluster
        font_color:        "64748b",  // slate500
        row_color_enabled: true,
        stage_order:       95,
    });

    if (!jrCandidates.length) {
        return { jr, allCandidates: [], topProfileCandidates: [], internalCandidates: [], totalCandidates: 0, topProfileCount: 0, totalCompanies: 0, statusColors };
    }

    const candidateIds = jrCandidates.map((j: any) => j.candidate_id as string);
    const jrCandidateIds = jrCandidates.map((j: any) => j.jr_candidate_id as string);

    // Parallel data fetch
    const [profilesRes, expRes, enhanceRes, statusRes] = await Promise.all([
        adminAuthClient
            .from("Candidate Profile")
            .select("candidate_id, name, photo, linkedin, age, age_source, nationality, gender, candidate_status, job_function")
            .in("candidate_id", candidateIds),
        adminAuthClient
            .from("candidate_experiences")
            .select("candidate_id, position, company, company_id, country, start_date, end_date, is_current_job")
            .in("candidate_id", candidateIds),
        adminAuthClient
            .from("candidate_profile_enhance")
            .select("candidate_id, education_summary")
            .in("candidate_id", candidateIds),
        adminAuthClient
            .from("status_log")
            .select("jr_candidate_id, status, log_id")
            .in("jr_candidate_id", jrCandidateIds)
            .order("log_id", { ascending: true }),
    ]);

    // Maps
    const profileMap = new Map<string, any>((profilesRes.data ?? []).map((p: any) => [p.candidate_id, p]));
    const expByCandidate = groupExperiencesByCandidate((expRes.data ?? []) as ExperienceRow[]);
    const enhanceMap = new Map<string, any>((enhanceRes.data ?? []).map((e: any) => [e.candidate_id, e]));

    // Latest status per jr_candidate_id (last row wins since sorted asc)
    const statusMap = new Map<string, string>();
    for (const s of (statusRes.data ?? [])) {
        statusMap.set(String((s as any).jr_candidate_id), (s as any).status);
    }

    const jrCandMap = new Map<string, any>(jrCandidates.map((j: any) => [j.candidate_id, j]));

    // Collect all unique company_ids from latest experience per candidate
    const companyIds = [...new Set(
        candidateIds.flatMap(cId => {
            const exps = expByCandidate.get(cId) ?? [];
            return exps[0]?.company_id != null ? [(exps[0] as any).company_id as number] : [];
        })
    )];

    const companyMasterRes = companyIds.length
        ? await adminAuthClient
              .from("company_master")
              .select("company_id, group, rating, set")
              .in("company_id", companyIds)
        : { data: [] as any[] };
    const companyMap = new Map<number, any>((companyMasterRes.data ?? []).map((c: any) => [c.company_id, c]));

    // Build full candidate rows
    const allCandidates: CandidateForReport[] = candidateIds.map(cId => {
        const profile = profileMap.get(cId) ?? {} as any;
        const jrRow   = jrCandMap.get(cId)!;
        const exps    = expByCandidate.get(cId) ?? [];
        const latest  = exps[0] as (ExperienceRow & { company_id?: number }) | undefined;
        const company = latest?.company_id != null ? companyMap.get(latest.company_id as number) : null;
        const enhance = enhanceMap.get(cId);

        return {
            candidate_id:     cId,
            name:             profile.name ?? cId,
            photo_url:        profile.photo ?? null,
            linkedin:         profile.linkedin ?? null,
            age:              profile.age ?? null,
            age_source:       profile.age_source ?? null,
            gender:           profile.gender ?? null,
            nationality:      profile.nationality ?? null,
            job_function:     profile.job_function ?? null,
            candidate_status: profile.candidate_status ?? null,
            position:         latest?.position ?? null,
            company:          latest?.company ?? null,
            company_id:       (latest as any)?.company_id ?? null,
            location:         latest?.country ?? null,
            group:            company?.group ?? null,
            rating:           company?.rating ?? null,
            education:        formatEducationHeadline(enhance?.education_summary) || null,
            experience_history: formatExperienceHistory(exps, 4),
            rank:             jrRow.rank ?? 999,
            list_type:        jrRow.list_type ?? "Longlist",
            // Pipeline status (status_log) takes priority; fall back to "Too Senior"
            // from candidate_status when no pipeline status exists yet. "Too Senior"
            // is a profile-level tag (Candidate Profile.candidate_status[]), not a
            // status_master entry — so we check candidate_status directly here.
            latest_status:    statusMap.get(String(jrRow.jr_candidate_id))
                ?? (Array.isArray(profile.candidate_status) && profile.candidate_status.includes("Too Senior")
                    ? "Too Senior"
                    : null),
            score:            0,
        };
    });

    const topProfileCandidates = allCandidates
        .filter(c => (c.list_type ?? "").toLowerCase().includes("top"))
        .sort((a, b) => a.rank - b.rank);

    const internalCandidates = allCandidates.filter(
        c => Array.isArray(c.candidate_status) && c.candidate_status.includes("Internal Candidate")
    );

    const totalCompanies = new Set(allCandidates.map(c => c.company).filter(Boolean)).size;

    return {
        jr,
        allCandidates,
        topProfileCandidates,
        internalCandidates,
        totalCandidates: candidateIds.length,
        topProfileCount: topProfileCandidates.length,
        totalCompanies,
        statusColors,
    };
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateJRReportPPTX(
    jrId: string,
): Promise<{ base64: string; filename: string }> {
    const data = await fetchJRReportData(jrId);
    const jr = data.jr;
    const jrPosition = jr.position_jr || jrId;
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const pptx = new PptxGenJS();
    pptx.layout  = "LAYOUT_WIDE";
    pptx.author  = "CG Talent Hub";
    pptx.company = "CG Talent Hub";
    pptx.subject = `JR Candidate Report — ${jrId}`;
    pptx.title   = `${jrId} Candidate Report`;

    // Slide 1: Cover
    addCoverSlide(pptx, jrId, jrPosition, data.totalCandidates, dateStr);

    // Slide 2: The Brief (position + BU/sub BU/type + JD)
    addBriefSlide(pptx, jr);

    // Slide 3: Summary Mapping
    addSummaryMappingSlide(pptx, {
        jrPosition,
        allCandidates: data.allCandidates,
        topProfileCount: data.topProfileCount,
        jrId,
    });

    // Section 01: Top Profile short cards
    if (data.topProfileCandidates.length > 0) {
        addSectionCoverSlide(
            pptx,
            "Section 01",
            "Short Profile Potential Candidates",
            "Recruiter-curated top profiles for this role.",
        );
        await addShortProfileCardsSlides(
            pptx,
            data.topProfileCandidates,
            "Short Profile — Potential Candidates",
            data.statusColors,
        );
    }

    // Section 02: Internal Candidates (if any)
    if (data.internalCandidates.length > 0) {
        addSectionCoverSlide(
            pptx,
            "Section 02",
            "Internal Candidates",
            "Candidates currently within the organisation.",
        );
        await addShortProfileCardsSlides(
            pptx,
            data.internalCandidates,
            "Internal Candidates",
            data.statusColors,
        );
    }

    // Appendix: Long List (all candidates, bucketed)
    if (data.allCandidates.length > 0) {
        addSectionCoverSlide(
            pptx,
            "Appendix",
            "The Long List",
            "Every candidate considered for this role.",
        );
        addLongListSlide(
            pptx,
            bucketLongList(data.allCandidates, data.statusColors),
            `Long List — ${data.totalCandidates} Candidates`,
            data.statusColors,
        );
    }

    const base64 = await pptx.write({ outputType: "base64" }) as string;
    const filename = `${jrId}_report_${new Date().toISOString().slice(0, 10)}.pptx`;
    return { base64, filename };
}
