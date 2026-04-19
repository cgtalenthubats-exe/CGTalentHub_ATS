"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/notifications";
import { Loader2, Save, Sparkles, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";

export function AISettings() {
    const [prompt, setPrompt] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [modelName, setModelName] = useState("gemini-3.1-flash-lite-preview");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("n8n_configs")
                .select("name, value")
                .in("name", ["ai_parse_prompt", "google_ai_api_key", "ai_model_name"]);

            if (error) throw error;
            if (data) {
                const p = data.find(s => s.name === "ai_parse_prompt");
                const k = data.find(s => s.name === "google_ai_api_key");
                const m = data.find(s => s.name === "ai_model_name");
                if (p) setPrompt(p.value);
                if (k) setApiKey(k.value);
                if (m) setModelName(m.value);
            }
        } catch (error) {
            console.error("Error fetching AI settings:", error);
            toast.error("Failed to load AI settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            
            const updates = [
                { name: "ai_parse_prompt", value: prompt, description: "System prompt for AI candidate parsing" },
                { name: "google_ai_api_key", value: apiKey, description: "Google AI API Key for Gemini" },
                { name: "ai_model_name", value: modelName, description: "Gemini Model Name (Preview)" }
            ];

            for (const item of updates) {
                const { error } = await supabase.from("n8n_configs").upsert({ 
                    ...item,
                    url: 'N/A',
                    method: 'POST',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'name' });
                
                if (error) throw error;
            }

            toast.success("AI Configuration updated successfully");
        } catch (error: any) {
            console.error("Error saving AI settings:", error);
            toast.error(`Save failed: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleResetPrompt = () => {
        setPrompt("You are a professional recruiting assistant. Your task is to extract structured information from a candidate's CV or LinkedIn profile text. Return only a valid JSON object matching the requested schema. No conversational text.");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-indigo-500" />
                            <div>
                                <CardTitle className="text-lg">Manual Input Assistant</CardTitle>
                                <CardDescription>Configure Gemini AI for candidate profile parsing.</CardDescription>
                            </div>
                        </div>
                        <Button 
                            onClick={handleSave} 
                            disabled={saving}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Save AI Config
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Google AI API Key</label>
                            <input 
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="AIzaSy..."
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                            <p className="text-[10px] text-slate-500 italic">Get your key from Google AI Studio.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Gemini Model Name</label>
                            <Select value={modelName} onValueChange={setModelName}>
                                <SelectTrigger className="w-full bg-white font-mono text-sm h-10">
                                    <SelectValue placeholder="Select a model" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash-Lite (Recommended)</SelectItem>
                                    <SelectItem value="gemini-3-flash-preview">Gemini 3 Flash</SelectItem>
                                    <SelectItem value="gemini-3.1-pro-preview">Gemini 3.1 Pro</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-slate-500 italic">Preview versions required for latest Gemini 3 series.</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-slate-700">System Extraction Prompt</label>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleResetPrompt}
                                className="h-7 text-[10px] text-slate-500 hover:text-indigo-600 px-2"
                            >
                                <RotateCcw className="w-3 h-3 mr-1" /> Reset to Default
                            </Button>
                        </div>
                        <Textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Instruct the AI how to parse the text..."
                            className="min-h-[120px] bg-white text-sm leading-relaxed"
                        />
                        <p className="text-[10px] text-slate-400">
                            Provide clear instructions on how the AI should structure the JSON output.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
