import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function callGeminiVision(apiKey: string, modelName: string, imageBase64: string, mimeType: string, attempt = 0): Promise<any> {
    const fileType = mimeType === 'application/pdf' ? 'PDF document' : 'image'
    const prompt = `You are an expert at reading organizational chart ${fileType}s.
Analyze this org chart ${fileType} carefully and extract every visible person or position node.

Return a JSON array with this exact structure:
[{ "name": "...", "title": "...", "parent_name": "..." }]

Rules:
- name: The person's name OR the position/role label, exactly as written in the image
- title: Their job title if shown separately from the name, otherwise null
- parent_name: The EXACT name of their direct manager/superior as it appears in your output, or null for the top-level node
- Include ALL visible nodes — do not skip anyone
- parent_name must exactly match the "name" of another node in your output
- Return only the JSON array, no other text`

    const body = {
        contents: [{
            role: 'user',
            parts: [
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
                { text: prompt }
            ]
        }],
        generationConfig: { response_mime_type: 'application/json' }
    };

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const retryable = res.status === 429 || res.status >= 500;
        if (retryable && attempt < 3) {
            await sleep(Math.pow(2, attempt) * 1000); // 1s, 2s, 4s
            return callGeminiVision(apiKey, modelName, imageBase64, mimeType, attempt + 1);
        }
        throw new Error(errBody?.error?.message || `Gemini error ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('Gemini did not return an array');
    return parsed;
}

export async function POST(req: NextRequest) {
    try {
        const { imageBase64, mimeType } = await req.json();
        if (!imageBase64) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

        const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
        if (mimeType && !allowedMime.includes(mimeType)) {
            return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
        }

        const { data: settings, error } = await supabase
            .from('n8n_configs')
            .select('name, value')
            .in('name', ['google_ai_api_key', 'ai_model_name']);

        if (error || !settings) return NextResponse.json({ error: 'Could not load AI settings' }, { status: 500 });

        const apiKey = settings.find(s => s.name === 'google_ai_api_key')?.value;
        const modelName = settings.find(s => s.name === 'ai_model_name')?.value || 'gemini-1.5-flash';

        if (!apiKey) return NextResponse.json({ error: 'Google AI API key not configured in Settings → AI Configuration' }, { status: 500 });

        const nodes = await callGeminiVision(apiKey, modelName, imageBase64, mimeType || 'image/jpeg');

        return NextResponse.json({ nodes });

    } catch (err: any) {
        console.error('[ParseOrgImage]', err);
        return NextResponse.json({ error: err.message || 'Parse failed' }, { status: 500 });
    }
}
