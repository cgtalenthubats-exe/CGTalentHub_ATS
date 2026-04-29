import { NextResponse } from 'next/server';
import { getN8nUrl } from '@/app/actions/admin-actions';

export async function POST(req: Request) {
    try {
        const { message, sessionId, userEmail = 'sumethwork@gmail.com' } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const config = await getN8nUrl('v2_chat_assistant');

        if (!config || !config.url) {
            return NextResponse.json({
                answer: '⚙️ ยังไม่ได้ตั้งค่า Webhook URL สำหรับ AI Search V2\n\nไปที่ **n8n Integration** → ใส่ URL ในช่อง "v2_chat_assistant" → กด Save'
            });
        }

        const n8nRes = await fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, sessionId, userEmail }),
            signal: AbortSignal.timeout(600000),
        });

        if (!n8nRes.ok) {
            throw new Error(`n8n responded with HTTP ${n8nRes.status}`);
        }

        const rawText = await n8nRes.text();
        let answer: string;

        try {
            const data = JSON.parse(rawText);
            if (Array.isArray(data)) {
                const first = data[0] || {};
                answer = first.answer ?? first.output ?? first.text ?? JSON.stringify(first);
            } else {
                answer = data.answer ?? data.output ?? data.text ?? JSON.stringify(data);
            }
        } catch {
            answer = rawText;
        }

        answer = answer
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"');

        return NextResponse.json({ answer });

    } catch (error: any) {
        console.error('[/api/v2/chat] Error:', error);
        return NextResponse.json({
            answer: `❌ เกิดข้อผิดพลาด: ${error.message}`
        }, { status: 500 });
    }
}
