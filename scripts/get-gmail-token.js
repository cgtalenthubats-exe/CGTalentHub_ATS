/**
 * Run once to get Gmail refresh token.
 * Usage: node scripts/get-gmail-token.js
 */
const { google } = require("googleapis");
const http = require("http");
const url = require("url");

// ── ใส่ค่าจาก Google Cloud Console ──────────────────────────
const CLIENT_ID = "PASTE_YOUR_CLIENT_ID_HERE";
const CLIENT_SECRET = "PASTE_YOUR_CLIENT_SECRET_HERE";
// ─────────────────────────────────────────────────────────────

const REDIRECT = "http://localhost:3001/cb";

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);

const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.send"],
    prompt: "consent", // บังคับให้ Google คืน refresh_token ทุกครั้ง
});

console.log("\n==============================================");
console.log("👉  เปิด URL นี้ใน browser:");
console.log("==============================================\n");
console.log(authUrl);
console.log("\n==============================================");
console.log("(รอรับ callback อยู่... อย่าปิด terminal นี้)");
console.log("==============================================\n");

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    if (parsed.pathname !== "/cb" || !parsed.query.code) {
        res.end("waiting...");
        return;
    }

    try {
        const { tokens } = await oauth2.getToken(parsed.query.code);

        if (!tokens.refresh_token) {
            res.end("❌ ไม่ได้ refresh_token — ลอง revoke access ก่อนแล้วรันใหม่");
            console.error("\n❌ ไม่ได้ refresh_token");
            console.error("วิธีแก้: ไปที่ https://myaccount.google.com/permissions");
            console.error("หา app ที่สร้าง → Revoke access → รัน script ใหม่\n");
            server.close();
            return;
        }

        console.log("\n✅ สำเร็จ! copy 4 บรรทัดนี้ใส่ .env.local:\n");
        console.log("─────────────────────────────────────────");
        console.log(`GMAIL_CLIENT_ID=${CLIENT_ID}`);
        console.log(`GMAIL_CLIENT_SECRET=${CLIENT_SECRET}`);
        console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log(`GMAIL_FROM=ใส่ email ที่เพิ่งกด Allow`);
        console.log("─────────────────────────────────────────\n");

        res.end("✅ Done! ปิดหน้าต่างนี้ได้เลย แล้วดู terminal");
    } catch (e) {
        console.error("Error:", e.message);
        res.end("Error: " + e.message);
    }

    server.close();
});

server.listen(3001, () => {
    console.log("Local server รอรับ callback ที่ http://localhost:3001/cb");
});
