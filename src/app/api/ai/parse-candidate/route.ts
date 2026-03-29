import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service Role for fetching settings securely
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
    try {
        const { text } = await req.json();
        if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 });

        // 1. Fetch configurations strictly from n8n_configs
        const { data: settingsData, error: settingsError } = await supabase
            .from("n8n_configs")
            .select("name, value")
            .in("name", ["ai_parse_prompt", "google_ai_api_key", "ai_model_name"]);

        if (settingsError || !settingsData) {
            return NextResponse.json({ error: "Configuration missing in database" }, { status: 500 });
        }

        const systemPrompt = settingsData.find(s => s.name === "ai_parse_prompt")?.value;
        const apiKey = settingsData.find(s => s.name === "google_ai_api_key")?.value;
        const modelName = settingsData.find(s => s.name === "ai_model_name")?.value || "gemini-3.1-flash-lite-preview";

        if (!apiKey) return NextResponse.json({ error: "API Key not configured." }, { status: 500 });
        if (!systemPrompt) return NextResponse.json({ error: "Prompt not configured." }, { status: 500 });

        // 2. Prompt Gemini
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nRAW TEXT:\n${text}` }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        const resBody = await response.json();
        if (!response.ok) {
            const errorMsg = resBody?.error?.message || "Gemini API Failure";
            return NextResponse.json({ error: errorMsg }, { status: response.status });
        }

        const aiOutput = resBody.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!aiOutput) return NextResponse.json({ error: "Empty AI response" }, { status: 500 });

        return NextResponse.json(JSON.parse(aiOutput));

    } catch (error: any) {
        console.error("AI Parse Exception:", error);
        return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
    }
}
