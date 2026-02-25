"use client";

import React, { useEffect, useState } from "react";
import { getN8nConfigs, updateN8nConfig, N8nConfig } from "@/app/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Undo, Webhook, CheckCircle2, AlertCircle, ExternalLink, Copy, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";

// Payload documentation for each webhook
const WEBHOOK_DOCS: Record<string, {
    trigger: string;
    payload: string;
    response: string;
    note?: string;
}> = {
    "CSV Upload": {
        trigger: "ถูกเรียกหลังจาก batch CSV upload สำเร็จ",
        payload: `POST  {
  batch_id: string,
  requester: "email@...",
  candidate_count: number,
  candidates: [{ id, name, linkedin, email }]
}`,
        response: `{ success: true }  (n8n scrapes LinkedIn profiles async)`,
    },
    "JR Report": {
        trigger: "ถูกเรียกเมื่อ user กด 'Create Report' ในหน้า JR Manage",
        payload: `GET  ?jr_id=JR000001&requester=email@...&log_id=123`,
        response: `{ success: true }  (n8n generates + emails report async)`,
        note: "ใช้ GET method — parameters ส่งผ่าน URL query string",
    },
    "interview_feedback_webhook": {
        trigger: "ถูกเรียกเมื่อ submit interview feedback พร้อมไฟล์แนบ",
        payload: `POST  multipart/form-data  {
  jr_candidate_id: string,
  feedback: string,
  file: (PDF/attachment)
}`,
        response: `{ success: true }`,
    },
    "Candidate Search": {
        trigger: "ถูกเรียกเมื่อ user ทำ AI Search หา candidate",
        payload: `GET  ?query=Python+Developer&filters=...`,
        response: `{ candidates: [{ candidate_id, name, score, ... }] }`,
        note: "ใช้ GET method — search query ส่งผ่าน URL query string",
    },
    "Candidate Refresh": {
        trigger: "ถูกเรียกเมื่อ user กด 'Refresh Profile' สำหรับ candidate ที่เลือก",
        payload: `POST  {
  candidate_ids: ["C00001", "C00002"],
  requester: "email@...",
  request_date: "2026-02-23T..."
}`,
        response: `{ success: true }  (n8n re-scrapes + updates profiles async)`,
    },
    "chat_assistant": {
        trigger: "ถูกเรียกจาก Chat Widget (มุมขวาล่างของ Webapp)",
        payload: `POST  {
  message: "คำถามจาก user",
  history: [{ role: "user"|"assistant", content: "..." }]
}`,
        response: `{ answer: "คำตอบจาก AI" }`,
        note: "🔜 Coming Soon — ระบบนี้ยังอยู่ระหว่างพัฒนา",
    },
};

export default function N8nAdminPage() {
    const [configs, setConfigs] = useState<N8nConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [editValues, setEditValues] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState<Record<number, boolean>>({});
    const [testing, setTesting] = useState<Record<number, boolean>>({});
    const [testStatus, setTestStatus] = useState<Record<number, 'ok' | 'error' | null>>({});

    useEffect(() => { loadConfigs(); }, []);

    const loadConfigs = async () => {
        setLoading(true);
        const data = await getN8nConfigs();
        setConfigs(data);
        const vals: Record<number, string> = {};
        data.forEach(c => { vals[c.id] = c.url || ''; });
        setEditValues(vals);
        setLoading(false);
    };

    const handleSave = async (config: N8nConfig) => {
        setSaving(prev => ({ ...prev, [config.id]: true }));
        const res = await updateN8nConfig(config.id, editValues[config.id] || '', config.method);
        setSaving(prev => ({ ...prev, [config.id]: false }));
        if (res.success) {
            toast.success(`✅ Saved "${config.name}"`);
            loadConfigs();
        } else {
            toast.error('Error: ' + res.error);
        }
    };

    const handleTest = async (config: N8nConfig) => {
        const url = editValues[config.id];
        if (!url) { toast.error('กรุณาใส่ Webhook URL ก่อน'); return; }

        setTesting(prev => ({ ...prev, [config.id]: true }));
        setTestStatus(prev => ({ ...prev, [config.id]: null }));

        try {
            const isGet = config.method === 'GET';
            const testUrl = isGet ? `${url}?test=true` : url;
            const res = await fetch(testUrl, {
                method: config.method,
                headers: isGet ? undefined : { 'Content-Type': 'application/json' },
                body: isGet ? undefined : JSON.stringify({ test: true }),
                signal: AbortSignal.timeout(10000),
            });
            const ok = res.ok || res.status < 500;
            setTestStatus(prev => ({ ...prev, [config.id]: ok ? 'ok' : 'error' }));
            toast[ok ? 'success' : 'error'](ok
                ? `✅ Reachable (HTTP ${res.status})`
                : `❌ HTTP ${res.status}`);
        } catch (e: any) {
            setTestStatus(prev => ({ ...prev, [config.id]: 'error' }));
            toast.error('❌ ' + e.message);
        } finally {
            setTesting(prev => ({ ...prev, [config.id]: false }));
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
            <AtsBreadcrumb items={[{ label: 'n8n Integration' }]} />

            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Webhook className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">n8n Integration Hub</h1>
                    <p className="text-slate-500 text-sm">ตั้งค่า Webhook URL สำหรับแต่ละ n8n Workflow</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16 text-slate-400 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading...
                </div>
            ) : (
                <div className="space-y-4">
                    {configs.map((config) => {
                        const docs = WEBHOOK_DOCS[config.name];
                        const isDirty = editValues[config.id] !== (config.url || '');
                        const status = testStatus[config.id];
                        const isNew = !config.url;

                        return (
                            <Card key={config.id} className="border-slate-200">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div>
                                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                                {config.name}
                                                {config.name === 'chat_assistant' && (
                                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">🔜 Coming Soon</Badge>
                                                )}
                                            </CardTitle>
                                            <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
                                        </div>
                                        <div className="flex gap-1.5 items-center shrink-0">
                                            <Badge className={`font-mono text-[10px] ${config.method === 'POST'
                                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                                : 'bg-green-100 text-green-700 border-green-200'}`}>
                                                {config.method}
                                            </Badge>
                                            {status === 'ok' && <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 text-[10px]"><CheckCircle2 className="w-3 h-3" />OK</Badge>}
                                            {status === 'error' && <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 text-[10px]"><AlertCircle className="w-3 h-3" />Failed</Badge>}
                                            {config.url && !status && <Badge variant="outline" className="text-slate-400 text-[10px]">✓ Saved</Badge>}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {/* Trigger & Payload Docs */}
                                    {docs && (
                                        <div className="rounded-lg bg-slate-950 p-3 space-y-2 text-[11px] font-mono">
                                            <p className="text-slate-400">// {docs.trigger}</p>
                                            <p className="text-amber-400 whitespace-pre">{docs.payload}</p>
                                            <p className="text-green-400">← {docs.response}</p>
                                            {docs.note && <p className="text-sky-400 font-sans">⚠️ {docs.note}</p>}
                                        </div>
                                    )}

                                    {/* URL Input */}
                                    <div className="flex gap-2">
                                        <Input
                                            value={editValues[config.id] || ''}
                                            onChange={e => setEditValues(prev => ({ ...prev, [config.id]: e.target.value }))}
                                            placeholder="https://your-n8n.com/webhook/..."
                                            className="font-mono text-sm"
                                        />
                                        {editValues[config.id] && (
                                            <>
                                                <Button variant="ghost" size="icon" title="Copy"
                                                    onClick={() => { navigator.clipboard.writeText(editValues[config.id]); toast.success('Copied!'); }}>
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" asChild title="Open URL">
                                                    <a href={editValues[config.id]} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                </Button>
                                            </>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 items-center flex-wrap">
                                        <Button size="sm" onClick={() => handleSave(config)}
                                            disabled={saving[config.id] || !isDirty}
                                            className="bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40">
                                            {saving[config.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                                            Save
                                        </Button>
                                        <Button size="sm" variant="outline"
                                            onClick={() => handleTest(config)}
                                            disabled={testing[config.id] || !editValues[config.id]}
                                            className="border-slate-300 gap-1.5">
                                            {testing[config.id]
                                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Testing...</>
                                                : <><FlaskConical className="w-3.5 h-3.5" />Test</>}
                                        </Button>
                                        {isDirty && (
                                            <Button size="sm" variant="ghost"
                                                onClick={() => setEditValues(prev => ({ ...prev, [config.id]: config.url || '' }))}
                                                className="text-slate-400">
                                                <Undo className="w-3.5 h-3.5 mr-1" />Reset
                                            </Button>
                                        )}
                                        {config.updated_at && (
                                            <span className="ml-auto text-[10px] text-slate-400">
                                                Updated {new Date(config.updated_at).toLocaleString('th-TH')}
                                            </span>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
