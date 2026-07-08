"use server";

import { google } from "googleapis";
import { generateAssessmentPPTX, generateSearchPPTX } from "./export-pptx";

interface EmailParams {
    emails: string[];
    subject: string;
    message?: string;
}

export async function shareSearchReport(params: EmailParams & { jobId: string }): Promise<void> {
    const { base64, filename } = await generateSearchPPTX(params.jobId);
    await sendGmailWithAttachment({
        base64,
        filename,
        emails: params.emails,
        subject: params.subject,
        message: params.message,
    });
}

export async function shareAssessmentReport(
    params: EmailParams & { jobId: string; jrId: string; jrTitle: string },
): Promise<void> {
    const { base64, filename } = await generateAssessmentPPTX(params.jobId, params.jrId, params.jrTitle);
    await sendGmailWithAttachment({
        base64,
        filename,
        emails: params.emails,
        subject: params.subject,
        message: params.message,
    });
}

async function sendGmailWithAttachment(params: {
    base64: string;
    filename: string;
    emails: string[];
    subject: string;
    message?: string;
}): Promise<void> {
    const { base64, filename, emails, subject, message } = params;

    if (!emails.length) throw new Error("ต้องระบุ email อย่างน้อย 1 ที่อยู่");

    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    const from = process.env.GMAIL_FROM;

    if (!clientId || !clientSecret || !refreshToken || !from) {
        throw new Error(
            "Gmail credentials ยังไม่ได้ตั้งค่า — กรุณาเพิ่ม GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_FROM ใน .env.local",
        );
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: "v1", auth });

    const boundary = `cg_${Date.now()}`;
    const subjectEncoded = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const htmlBody = message
        ? `<p style="font-family:Arial,sans-serif;color:#334155;font-size:14px">${message.replace(/\n/g, "<br>")}</p><br><p style="font-family:Arial,sans-serif;color:#64748b;font-size:13px">Please find the AI Assessment Report attached.</p>`
        : `<p style="font-family:Arial,sans-serif;color:#334155;font-size:14px">Please find the AI Assessment Report attached.</p>`;

    const rawMsg = [
        `MIME-Version: 1.0`,
        `From: CG Talent Hub <${from}>`,
        `To: ${emails.join(", ")}`,
        `Subject: ${subjectEncoded}`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        ``,
        htmlBody,
        ``,
        `--${boundary}`,
        `Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${filename}"`,
        ``,
        base64,
        ``,
        `--${boundary}--`,
    ].join("\r\n");

    await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: Buffer.from(rawMsg).toString("base64url") },
    });
}
