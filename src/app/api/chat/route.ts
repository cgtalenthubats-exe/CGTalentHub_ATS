import { NextResponse } from 'next/server';
import { getN8nUrl } from '@/app/actions/admin-actions';

export async function POST(req: Request) {
    try {
        const { message, history = [] } = await req.json();

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
        // Payload: { message: string, history: { role: string, content: string }[] }
        const n8nRes = await fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, history }),
            signal: AbortSignal.timeout(30000),
        });

        if (!n8nRes.ok) {
            throw new Error(`n8n responded with HTTP ${n8nRes.status}`);
        }

        const data = await n8nRes.json();

        // n8n should return: { answer } or { output } or { text }
        const answer = data.answer ?? data.output ?? data.text ?? JSON.stringify(data);

        return NextResponse.json({ answer });

    } catch (error: any) {
        console.error('[/api/chat] Error:', error);
        return NextResponse.json({
            answer: `❌ เกิดข้อผิดพลาด: ${error.message}`
        }, { status: 500 });
    }
}
