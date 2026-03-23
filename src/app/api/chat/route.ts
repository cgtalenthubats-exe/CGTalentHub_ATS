import { NextResponse } from 'next/server';
import { getN8nUrl } from '@/app/actions/admin-actions';

export async function POST(req: Request) {
    try {
        const { message, sessionId, history = [] } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Read webhook URL from n8n_configs table at runtime
        const config = await getN8nUrl('chat_assistant');

        if (!config || !config.url) {
            return NextResponse.json({
                answer: '⚙️ ยังไม่ได้ตั้งค่า Webhook URL สำหรับ Chat Assistant\n\nไปที่ **n8n Integration** ในเมนูซ้าย → ใส่ URL ในช่อง "Chat Assistant" → กด Save'
            });
        }

        // POST to n8n webhook
        // Payload: { message, sessionId } — n8n Postgres Chat Memory handles history
        const payload: Record<string, any> = { message };

        // Prefer sessionId (for Postgres Chat Memory in n8n)
        // Fall back to history array for backward compatibility
        if (sessionId) {
            payload.sessionId = sessionId;
        } else if (history.length > 0) {
            payload.history = history;
        }

        const n8nRes = await fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(60000), // 60s timeout for AI agent processing
        });

        if (!n8nRes.ok) {
            throw new Error(`n8n responded with HTTP ${n8nRes.status}`);
        }

        // Read raw text first — n8n may return JSON or plain text
        const rawText = await n8nRes.text();
        let answer: string;

        try {
            // Try parsing as JSON
            const data = JSON.parse(rawText);
            // n8n returns various shapes: { answer }, { output }, { text }, or nested arrays
            if (Array.isArray(data)) {
                // n8n "All Incoming Items" returns an array
                const first = data[0] || {};
                answer = first.answer ?? first.output ?? first.text ?? JSON.stringify(first);
            } else {
                answer = data.answer ?? data.output ?? data.text ?? JSON.stringify(data);
            }
        } catch {
            // Not JSON — treat raw text as the answer
            answer = rawText;
        }

        // Fix escaped newlines: n8n often double-escapes \n as \\n in expressions
        answer = answer
            .replace(/\\n/g, '\n')     // \\n → real newline
            .replace(/\\t/g, '\t')     // \\t → real tab
            .replace(/\\"/g, '"');     // \\" → real quote

        return NextResponse.json({ answer });

    } catch (error: any) {
        console.error('[/api/chat] Error:', error);
        return NextResponse.json({
            answer: `❌ เกิดข้อผิดพลาด: ${error.message}`
        }, { status: 500 });
    }
}
