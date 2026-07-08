"use client";

import { useState, useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Download, Mail, X, Check, AlertCircle } from "lucide-react";

export interface ShareReportDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    /** Called on dialog open to generate the PPTX — result is used for client-side download */
    generateFn: () => Promise<{ base64: string; filename: string }>;
    /** Server action that generates+sends PPTX internally — keeps base64 off the wire */
    shareAction: (params: { emails: string[]; subject: string; message?: string }) => Promise<void>;
    defaultSubject: string;
}

function EmailTagInput({
    emails,
    onChange,
}: {
    emails: string[];
    onChange: (emails: string[]) => void;
}) {
    const [input, setInput] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const commit = (raw: string) => {
        const val = raw.trim().replace(/,+$/, "").trim();
        if (!val || emails.includes(val)) { setInput(""); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return;
        onChange([...emails, val]);
        setInput("");
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
            e.preventDefault();
            commit(input);
        } else if (e.key === "Backspace" && !input && emails.length > 0) {
            onChange(emails.slice(0, -1));
        }
    };

    return (
        <div
            className="min-h-[42px] flex flex-wrap gap-1.5 items-center border border-slate-200 rounded-lg px-2.5 py-2 cursor-text bg-white focus-within:ring-1 focus-within:ring-indigo-300 focus-within:border-indigo-300 transition-all"
            onClick={() => inputRef.current?.focus()}
        >
            {emails.map((email) => (
                <span
                    key={email}
                    className="inline-flex items-center gap-1 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2.5 py-0.5 shrink-0"
                >
                    {email}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onChange(emails.filter((em) => em !== email)); }}
                        className="hover:text-red-500 transition-colors ml-0.5"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </span>
            ))}
            <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => { if (input.includes("@")) commit(input); }}
                placeholder={emails.length === 0 ? "Type email and press Enter..." : ""}
                className="flex-1 min-w-[160px] outline-none text-sm bg-transparent placeholder:text-slate-400"
            />
        </div>
    );
}

export function ShareReportDialog({
    open,
    onOpenChange,
    generateFn,
    shareAction,
    defaultSubject,
}: ShareReportDialogProps) {
    const [pptx, setPptx] = useState<{ base64: string; filename: string } | null>(null);
    const [generating, setGenerating] = useState(false);
    const [genError, setGenError] = useState<string | null>(null);

    const [emails, setEmails] = useState<string[]>([]);
    const [subject, setSubject] = useState(defaultSubject);
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [sendOk, setSendOk] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            setPptx(null);
            setGenerating(false);
            setGenError(null);
            setEmails([]);
            setMessage("");
            setSendOk(false);
            setSendError(null);
            return;
        }
        setSubject(defaultSubject);
        setGenerating(true);
        setGenError(null);
        setPptx(null);
        generateFn()
            .then(setPptx)
            .catch((e: Error) => setGenError(e.message ?? "เกิดข้อผิดพลาด"))
            .finally(() => setGenerating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleDownload = () => {
        if (!pptx) return;
        const a = document.createElement("a");
        a.href = `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${pptx.base64}`;
        a.download = pptx.filename;
        a.click();
    };

    const handleSend = async () => {
        if (!emails.length || !subject.trim()) return;
        setSending(true);
        setSendOk(false);
        setSendError(null);
        try {
            await shareAction({ emails, subject: subject.trim(), message: message.trim() || undefined });
            setSendOk(true);
            setEmails([]);
            setMessage("");
        } catch (e: any) {
            setSendError(e.message ?? "ส่งไม่สำเร็จ กรุณาลองอีกครั้ง");
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle className="text-slate-800 text-base">Export Report</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-1">
                    {generating && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin text-indigo-500 shrink-0" />
                            <span>Generating PPTX...</span>
                        </div>
                    )}
                    {genError && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {genError}
                        </div>
                    )}

                    <Button
                        onClick={handleDownload}
                        disabled={!pptx}
                        variant="outline"
                        className="w-full gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                    >
                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Download PPTX
                    </Button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-white px-3 text-xs text-slate-400">or send via Email</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-600">To</label>
                            <EmailTagInput emails={emails} onChange={setEmails} />
                            <p className="text-[11px] text-slate-400">Press Enter or comma to add multiple recipients</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-600">Subject</label>
                            <Input
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400">
                                Message <span className="font-normal">(optional)</span>
                            </label>
                            <Textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Additional message..."
                                className="text-sm resize-none"
                                rows={3}
                            />
                        </div>

                        {sendOk && (
                            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                                <Check className="h-4 w-4 shrink-0" />
                                Email sent successfully
                            </div>
                        )}
                        {sendError && (
                            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {sendError}
                            </div>
                        )}

                        <Button
                            onClick={handleSend}
                            disabled={!emails.length || !subject.trim() || sending}
                            className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
                        >
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                            {sending
                                ? "Sending..."
                                : emails.length > 0
                                ? `Send to ${emails.length} recipient${emails.length !== 1 ? "s" : ""}`
                                : "Send Email"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
