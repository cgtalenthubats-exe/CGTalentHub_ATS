import { NextResponse } from 'next/server';
import { getN8nUrl } from '@/app/actions/admin-actions';

export async function POST(req: Request) {
    try {
        const { message, sessionId } = await req.json();
        if (!message) return NextResponse.json({ answer: 'Message required' }, { status: 400 });

        const config = await getN8nUrl('ai_search_chat');
        if (!config?.url) {
            return NextResponse.json({ answer: '⚙️ Webhook URL not configured' });
        }

        const n8nRes = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Connection': 'close',   // force new TCP connection each request
            },
            body: JSON.stringify({ message, sessionId: sessionId ?? 'default' }),
            signal: AbortSignal.timeout(120000), // 2 min timeout
        });

        if (!n8nRes.ok) throw new Error(`n8n HTTP ${n8nRes.status}`);

        const rawText = await n8nRes.text();
        let answer = '';
        let filters: any = {};
        let session_id = '';

        try {
            const data = JSON.parse(rawText);
            const first = Array.isArray(data) ? data[0] : data;
            answer = first.answer ?? first.output ?? first.text ?? JSON.stringify(first);
            if (first?.filters) filters = first.filters;
            if (first?.session_id) session_id = first.session_id;
        } catch {
            answer = rawText;
        }

        // Fix escaped chars
        answer = answer.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');

        return NextResponse.json({ answer, filters, session_id });

    } catch (error: any) {
        console.error('[/api/ai-search-chat]', error.message);
        return NextResponse.json({
            answer: `❌ ${error.message}`
        }, { status: 500 });
    }
}
