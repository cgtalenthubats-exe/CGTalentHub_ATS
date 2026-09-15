import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { adminAuthClient } from "@/lib/supabase/admin";

export type JDPdfMeta = {
    jrId: string;
    title?: string | null;
    bu?: string | null;
    subBu?: string | null;
    jrType?: string | null;
};

// pdfkit's built-in Helvetica is a core-14 PDF font restricted to WinAnsi
// encoding — it silently mis-renders anything outside that (bullets, en/em
// dashes, curly quotes, ellipsis), which is exactly what JD text pasted from
// Word/Outlook is full of. Noto Sans covers all of those, so every JD renders
// correctly regardless of what punctuation the recruiter pasted in.
const NOTO_SANS_PATH = path.join(process.cwd(), "public", "fonts", "noto-sans-regular.ttf");

/**
 * Renders the JD text as a simple, fully-paginated PDF (pdfkit handles line
 * wrapping and page breaks natively — no manual character-count math needed,
 * unlike fitting the same text into a fixed-size pptx textbox).
 */
export function generateJDPdfBuffer(meta: JDPdfMeta, jobDescription: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 56 });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        try {
            doc.registerFont("NotoSans", fs.readFileSync(NOTO_SANS_PATH));
            doc.font("NotoSans");
        } catch (e) {
            console.error("Failed to load NotoSans font for JD PDF — falling back to Helvetica:", e);
        }

        doc.fontSize(9).fillColor("#6366f1").text("CG TALENT HUB — JOB DESCRIPTION", { characterSpacing: 1 });
        doc.moveDown(0.6);
        doc.fontSize(20).fillColor("#0f172a").text(meta.title || meta.jrId);
        doc.moveDown(0.3);

        const metaLine = [meta.bu, meta.subBu, meta.jrType, meta.jrId].filter(Boolean).join("   ·   ");
        if (metaLine) doc.fontSize(10).fillColor("#64748b").text(metaLine);
        doc.moveDown(1);
        doc.strokeColor("#e2e8f0").moveTo(doc.x, doc.y).lineTo(539, doc.y).stroke();
        doc.moveDown(1);

        doc.fontSize(11).fillColor("#334155").text(jobDescription, { align: "left", lineGap: 4 });

        doc.moveDown(2);
        doc.fontSize(8).fillColor("#94a3b8").text(
            "This PDF was auto-generated from the job description text on file — no original file was uploaded for this JR.",
            { align: "left" }
        );

        doc.end();
    });
}

/** Uploads the generated PDF next to real JD uploads (same "resumes" bucket, separate prefix) and returns its public URL. */
export async function uploadGeneratedJDPdf(jrId: string, buffer: Buffer): Promise<string> {
    const path = `jr_feedback/generated/${jrId}_${Date.now()}.pdf`;
    const { error } = await adminAuthClient.storage.from("resumes").upload(path, buffer, {
        contentType: "application/pdf",
        upsert: true,
    });
    if (error) throw error;
    const { data } = adminAuthClient.storage.from("resumes").getPublicUrl(path);
    return data.publicUrl;
}

/** Generates + uploads in one step; returns the public URL to store in `generated_jd_file`. */
export async function generateAndStoreJDPdf(meta: JDPdfMeta, jobDescription: string): Promise<string> {
    const buffer = await generateJDPdfBuffer(meta, jobDescription);
    return uploadGeneratedJDPdf(meta.jrId, buffer);
}
