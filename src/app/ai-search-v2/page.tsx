"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, BarChart2, History, Plus, Send, Loader2, Sparkles, ChevronDown, ChevronRight, X, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import { StatusPipeline } from "@/components/ai-search/StatusPipeline";
import { ResultsTable } from "@/components/ai-search/ResultsTable";
import { CandidateDetailPanel } from "@/components/ai-search/CandidateDetailPanel";
import { AddCandidateDialog } from "@/components/ai-search/AddCandidateDialog";
import { PipelineStatus } from "@/components/ai-search/types-status";
import { ConsolidatedResult } from "@/components/ai-search/types";
import {
    v2GetSearchResults,
    v2GetSession,
    v2GetPipelineStatuses,
    v2GetHistory,
    v2GetChatMessages,
    v2SaveChatMessage,
    v2EnsureSession,
} from "@/app/actions/ai-search-v2";
import {
    onboardExternalCandidate,
    bulkOnboardExternalCandidates,
} from "@/app/actions/ai-search";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type View = "chat" | "report";

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

interface SearchSession {
    session_id: string;
    original_query: string;
    status: string;
    timestamp: string;
}

function generateSessionId(): string {
    return `v2_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function AISearchV2Page() {
    const [view, setView] = useState<View>("chat");
    const [sessionId, setSessionId] = useState<string>(() => generateSessionId());
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [thinkingStatus, setThinkingStatus] = useState("Thinking...");

    // Report state
    const [results, setResults] = useState<ConsolidatedResult[]>([]);
    const [pipelineStatuses, setPipelineStatuses] = useState<PipelineStatus[]>([]);
    const [sessionStatus, setSessionStatus] = useState<string | null>(null);
    const [originalQuery, setOriginalQuery] = useState<string | null>(null);
    const [reportReady, setReportReady] = useState(false);
    const [searchJob, setSearchJob] = useState<any>(null);
    const [isInsightsOpen, setIsInsightsOpen] = useState(true);

    // History
    const [historyOpen, setHistoryOpen] = useState(false);
    const [sessions, setSessions] = useState<SearchSession[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Detail panel
    const [selectedResult, setSelectedResult] = useState<ConsolidatedResult | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [targetCandidateIds, setTargetCandidateIds] = useState<string[]>([]);
    const [onboardingIds, setOnboardingIds] = useState<string[]>([]);
    const [filterSource, setFilterSource] = useState<"all" | "internal" | "external">("all");

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const historyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Close history on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
                setHistoryOpen(false);
            }
        }
        if (historyOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [historyOpen]);

    // Poll when processing
    useEffect(() => {
        if (sessionStatus !== "processing") return;
        const interval = setInterval(() => fetchReport(sessionId, true), 5000);
        return () => clearInterval(interval);
    }, [sessionId, sessionStatus]);

    async function fetchReport(sid: string, silent = false) {
        const [jobRes, statusRes, resultsRes] = await Promise.all([
            v2GetSession(sid),
            v2GetPipelineStatuses(sid),
            v2GetSearchResults(sid),
        ]);
        if (jobRes.success && jobRes.data) {
            setSessionStatus(jobRes.data.status);
            setOriginalQuery(jobRes.data.original_query);
            setSearchJob(jobRes.data);
        }
        if (statusRes.success && statusRes.data) setPipelineStatuses(statusRes.data);
        if (resultsRes.success && resultsRes.data) setResults(resultsRes.data);
    }

    async function loadHistory() {
        setLoadingHistory(true);
        const res = await v2GetHistory();
        if (res.success && res.data) setSessions(res.data as SearchSession[]);
        setLoadingHistory(false);
    }

    function handleNewSession() {
        setSessionId(generateSessionId());
        setMessages([]);
        setResults([]);
        setPipelineStatuses([]);
        setSessionStatus(null);
        setOriginalQuery(null);
        setReportReady(false);
        setSelectedResult(null);
        setSearchJob(null);
        setView("chat");
    }

    async function handleSelectSession(sid: string) {
        setHistoryOpen(false);
        setSessionId(sid);
        setMessages([]);
        setResults([]);
        setPipelineStatuses([]);
        setSessionStatus(null);
        setReportReady(false);
        setSelectedResult(null);

        // Load chat messages from v2_chat_messages
        const chatRes = await v2GetChatMessages(sid);
        if (chatRes.success && chatRes.data && chatRes.data.length > 0) {
            setMessages(chatRes.data.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.created_at),
            })));
        } else {
            // Fallback: show session query if no chat messages
            const jobRes = await v2GetSession(sid);
            if (jobRes.success && jobRes.data?.original_query) {
                setMessages([
                    { id: "q", role: "user", content: jobRes.data.original_query, timestamp: new Date(jobRes.data.timestamp) },
                    { id: "a", role: "assistant", content: `ค้นหา "${jobRes.data.original_query}" เสร็จแล้วครับ กด **Report** เพื่อดูผลลัพธ์`, timestamp: new Date() },
                ]);
            }
        }

        await fetchReport(sid);
        setReportReady(true);
        setView("report");
    }

    async function handleSend() {
        const text = input.trim();
        if (!text || isLoading) return;

        const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: "user", content: text, timestamp: new Date() };
        setMessages((p) => [...p, userMsg]);
        setInput("");
        setIsLoading(true);
        setThinkingStatus("Thinking...");

        const t1 = setTimeout(() => setThinkingStatus("Analyzing..."), 10000);
        const t2 = setTimeout(() => setThinkingStatus("Almost there..."), 40000);

        try {
            // Ensure session row exists
            await v2EnsureSession(sessionId, "sumethwork@gmail.com");
            // Save user message
            await v2SaveChatMessage(sessionId, "user", text);

            const res = await fetch("/api/v2/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, sessionId, userEmail: "sumethwork@gmail.com" }),
            });
            const data = await res.json();
            const answer = data.answer || "ไม่มีคำตอบจากระบบ";

            // Save assistant message
            await v2SaveChatMessage(sessionId, "assistant", answer);

            setMessages((p) => [...p, { id: `a_${Date.now()}`, role: "assistant", content: answer, timestamp: new Date() }]);

            // Auto-fetch report after every AI response (lightweight — checks v2_search_sessions)
            await fetchReport(sessionId, true);
            if (results.length > 0) setReportReady(true);
        } catch (err: any) {
            setMessages((p) => [...p, { id: `err_${Date.now()}`, role: "assistant", content: `Error: ${err.message}`, timestamp: new Date() }]);
        } finally {
            clearTimeout(t1);
            clearTimeout(t2);
            setIsLoading(false);
        }
    }

    const filteredResults = results.filter((r) => {
        if (filterSource === "all") return true;
        if (filterSource === "internal") return r.source === "internal_db";
        if (filterSource === "external") return r.source === "external_db";
        return true;
    });

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
            {/* Top Bar */}
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between gap-3 shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <AtsBreadcrumb items={[{ label: "AI Power Search V2" }]} />
                    {/* View Toggle */}
                    <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                        <button
                            onClick={() => setView("chat")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                view === "chat" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Chat
                        </button>
                        <button
                            onClick={() => setView("report")}
                            disabled={!reportReady && results.length === 0}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                view === "report" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700",
                                !reportReady && results.length === 0 && "opacity-40 cursor-not-allowed"
                            )}
                        >
                            <BarChart2 className="w-3.5 h-3.5" />
                            Report
                            {sessionStatus === "processing" && (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            )}
                            {results.length > 0 && (
                                <span className="bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full text-[10px]">
                                    {results.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* History Button */}
                    <div className="relative" ref={historyRef}>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-xs gap-1.5"
                            onClick={() => { setHistoryOpen(!historyOpen); if (!historyOpen) loadHistory(); }}
                        >
                            <History className="w-3.5 h-3.5" />
                            History
                            <ChevronDown className={cn("w-3 h-3 transition-transform", historyOpen && "rotate-180")} />
                        </Button>

                        <AnimatePresence>
                            {historyOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className="absolute right-0 top-full mt-2 w-80 bg-white border rounded-2xl shadow-xl z-50 overflow-hidden"
                                >
                                    <div className="p-3 border-b flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700">Search History</span>
                                        <button onClick={() => setHistoryOpen(false)} className="text-slate-400 hover:text-slate-600">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto">
                                        {loadingHistory ? (
                                            <div className="flex justify-center py-6">
                                                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                            </div>
                                        ) : sessions.length === 0 ? (
                                            <p className="text-xs text-slate-400 text-center py-6">No history yet</p>
                                        ) : (
                                            sessions.map((s) => (
                                                <button
                                                    key={s.session_id}
                                                    onClick={() => handleSelectSession(s.session_id)}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b last:border-0 transition-colors"
                                                >
                                                    <p className="text-xs font-semibold text-slate-800 truncate">{s.original_query || "Untitled"}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={cn(
                                                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                                            s.status === "completed" ? "bg-emerald-100 text-emerald-600" :
                                                            s.status === "processing" ? "bg-blue-100 text-blue-600" :
                                                            "bg-red-100 text-red-600"
                                                        )}>{s.status}</span>
                                                        <span className="text-[10px] text-slate-400">
                                                            {new Date(s.timestamp).toLocaleDateString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5" onClick={handleNewSession}>
                        <Plus className="w-3.5 h-3.5" />
                        New
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative">
                {/* Chat View */}
                <div className={cn("absolute inset-0 flex flex-col", view === "chat" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-200">
                                    <Sparkles className="w-7 h-7 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-900">AI Power Search V2</h2>
                                    <p className="text-sm text-slate-500 mt-1">บอกสิ่งที่ต้องการค้นหา AI จะช่วยค้นหา candidate ที่เหมาะสม</p>
                                </div>
                                <div className="grid grid-cols-1 gap-2 w-full max-w-sm mt-2">
                                    {["หา GM โรงแรม 5 ดาวในไทย ประสบการณ์ Marriott", "CFO บริษัทอสังหาฯ ในกรุงเทพ 10+ ปี"].map((q) => (
                                        <button key={q} onClick={() => setInput(q)}
                                            className="text-left px-4 py-3 bg-white border rounded-xl text-xs text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm font-medium">
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {messages.map((msg) => (
                            <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                                <div className={cn(
                                    "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                                    msg.role === "user"
                                        ? "bg-indigo-600 text-white rounded-br-sm"
                                        : "bg-white border text-slate-800 shadow-sm rounded-bl-sm"
                                )}>
                                    {msg.role === "assistant" ? (
                                        <div className="prose prose-sm max-w-none prose-p:my-1">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <span>{msg.content}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                                    <span className="text-xs text-slate-500 animate-pulse">{thinkingStatus}</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="px-4 pb-4 pt-2 bg-white/80 backdrop-blur border-t">
                        <div className="flex gap-2 max-w-2xl mx-auto">
                            <Textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                disabled={isLoading}
                                placeholder="พิมพ์คำค้นหา หรือถามได้เลย..."
                                className="bg-slate-50 border-slate-200 rounded-xl min-h-[44px] max-h-[120px] resize-none"
                                rows={1}
                            />
                            <Button onClick={handleSend} disabled={!input.trim() || isLoading} className="rounded-xl h-11 px-5 shrink-0">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Report View */}
                <div className={cn("absolute inset-0 overflow-y-auto", view === "report" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
                    <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
                        {originalQuery && (
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1 flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3" /> Current Search
                                </p>
                                <p className="text-base font-bold text-slate-800 italic">&quot;{originalQuery}&quot;</p>
                            </div>
                        )}

                        <StatusPipeline statuses={pipelineStatuses} />

                        {/* AI Insights */}
                        {searchJob?.stage3_overall_summary && (
                            <div>
                                <button
                                    onClick={() => setIsInsightsOpen(!isInsightsOpen)}
                                    className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 uppercase tracking-widest mb-3 transition-colors"
                                >
                                    {isInsightsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    AI Insights
                                </button>
                                <AnimatePresence>
                                    {isInsightsOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="bg-gradient-to-br from-indigo-50/50 to-white border border-indigo-100 rounded-xl p-5 shadow-sm space-y-4">
                                                <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                                    <Sparkles className="w-4 h-4 text-indigo-600" />
                                                    AI Insights
                                                </h3>
                                                {(() => {
                                                    const parts = searchJob.stage3_overall_summary.split("\n\n");
                                                    const mainText = parts.find((p: string) => !p.startsWith("💡")) ?? "";
                                                    const finalInsight = parts.find((p: string) => p.startsWith("💡"));
                                                    // Split main text into sentence-level bullets
                                                    const bullets = mainText.split(/(?<=\.)\s+/).filter((s: string) => s.trim().length > 10);
                                                    return (
                                                        <>
                                                            <ul className="space-y-2">
                                                                {bullets.map((b: string, i: number) => (
                                                                    <li key={i} className="flex items-start gap-2">
                                                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                                                                        <span className="text-xs text-slate-700 leading-relaxed">{b.trim()}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                            {finalInsight && (
                                                                <div className="bg-indigo-600 rounded-xl px-4 py-3">
                                                                    <p className="text-xs font-semibold text-white leading-relaxed">
                                                                        {finalInsight.replace("💡 ", "")}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {results.length === 0 && sessionStatus !== "processing" && (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                                <BarChart2 className="w-10 h-10 opacity-30" />
                                <p className="text-sm font-medium">ยังไม่มีผลลัพธ์ — กลับไปที่ Chat เพื่อเริ่มค้นหาครับ</p>
                            </div>
                        )}

                        {/* Top 20 Candidates */}
                        {(() => {
                            const top20 = filteredResults.filter(r => r.stage2_pass !== false && r.stage3_score != null).slice(0, 20);
                            const otherQualified = filteredResults.filter(r => r.stage2_pass !== false && r.stage3_score == null);
                            const notQualified = filteredResults.filter(r => r.stage2_pass === false);

                            const sharedProps = {
                                onSelectResult: setSelectedResult,
                                activeResultId: selectedResult?.id,
                                disableScroll: true,
                                selectedIds,
                                onToggleSelect: (id: string) => setSelectedIds((p) => p.includes(id) ? p.filter((i) => i !== id) : [...p, id]),
                                onToggleSelectAll: (ids: string[]) => setSelectedIds(selectedIds.length === ids.length ? [] : ids),
                                onBulkAddToJR: (ids: string[]) => { setTargetCandidateIds(ids); setIsAddDialogOpen(true); },
                                onOnboard: async (id: string) => {
                                    const r = results.find((x) => x.id === id);
                                    if (!r || r.source !== "external_db") return;
                                    setOnboardingIds((p) => [...p, id]);
                                    await onboardExternalCandidate(r.candidate_ref_id, "sumethwork@gmail.com");
                                    setOnboardingIds((p) => p.filter((i) => i !== id));
                                    fetchReport(sessionId, true);
                                },
                                onBulkOnboard: async (ids: string[]) => {
                                    const extIds = results.filter((r) => ids.includes(r.id) && r.source === "external_db" && !r.onboarded_id).map((r) => r.candidate_ref_id);
                                    if (!extIds.length) return;
                                    setOnboardingIds((p) => [...p, ...ids]);
                                    await bulkOnboardExternalCandidates(extIds, "sumethwork@gmail.com");
                                    setOnboardingIds((p) => p.filter((i) => !ids.includes(i)));
                                    fetchReport(sessionId, true);
                                },
                                onboardingIds,
                                filterSource,
                                onFilterSourceChange: setFilterSource,
                            };

                            return (
                                <div className="space-y-6">
                                    {top20.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">🏆 Top Matches</span>
                                                <span className="text-[10px] text-slate-400">({top20.length} candidates)</span>
                                            </div>
                                            <ResultsTable results={top20} {...sharedProps} />
                                        </div>
                                    )}
                                    {otherQualified.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">📋 Other Qualified</span>
                                                <span className="text-[10px] text-slate-400">({otherQualified.length} candidates — pending Stage 3)</span>
                                            </div>
                                            <ResultsTable results={otherQualified} {...sharedProps} />
                                        </div>
                                    )}
                                    {notQualified.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-red-400">❌ Not Qualified</span>
                                                <span className="text-[10px] text-slate-400">({notQualified.length} candidates)</span>
                                            </div>
                                            <ResultsTable results={notQualified} {...sharedProps} />
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Slide-over Detail Panel */}
                    <AnimatePresence>
                        {selectedResult && (
                            <div className="fixed inset-y-0 right-0 w-[850px] z-[100] flex shadow-2xl">
                                <CandidateDetailPanel
                                    result={selectedResult}
                                    onClose={() => setSelectedResult(null)}
                                    onImportToJR={(id) => { setTargetCandidateIds([id]); setIsAddDialogOpen(true); }}
                                />
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Add to JR Dialog */}
            <AddCandidateDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                candidateIds={targetCandidateIds}
                candidateNames={targetCandidateIds.map((id) => results.find((r) => r.id === id)?.name || "Unknown")}
                candidateSources={targetCandidateIds.map((id) => results.find((r) => r.id === id)?.source || "internal_db")}
                onSuccess={() => setSelectedIds([])}
            />
        </div>
    );
}

function renderSummaryContent(content: any, textColorClass: string, results: ConsolidatedResult[] = []) {
    if (!content) return null;

    let parsed = content;
    if (typeof content === "string") {
        try { parsed = JSON.parse(content); } catch { return <p className={`text-xs ${textColorClass} leading-relaxed whitespace-pre-line`}>{content}</p>; }
    }

    if (typeof parsed === "object" && parsed !== null) {
        if (parsed.executive_summary && parsed.candidates && Array.isArray(parsed.candidates)) {
            return (
                <div className="space-y-4">
                    <div className="bg-white/50 rounded-lg p-3 border border-indigo-100/50">
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">Executive Summary</h4>
                        <p className={`text-xs ${textColorClass} leading-relaxed`}>{parsed.executive_summary}</p>
                    </div>
                    {parsed.final_insight && (
                        <div className="bg-white/50 rounded-lg p-3 border border-emerald-100/50">
                            <h4 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2 flex items-center gap-2">
                                <Sparkles className="w-3 h-3 text-emerald-500" /> Final Insight
                            </h4>
                            <p className="text-xs text-emerald-800 font-medium leading-relaxed italic">&quot;{parsed.final_insight}&quot;</p>
                        </div>
                    )}
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-70">Candidate Analysis</h4>
                        <div className="grid gap-3">
                            {parsed.candidates.map((c: any, idx: number) => {
                                const result = results.find((r) => r.candidate_ref_id === c.id);
                                const photoUrl = result?.photo_url;
                                return (
                                    <div key={c.id || idx} className="bg-white rounded-lg p-3 border shadow-sm">
                                        <div className="flex items-start gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
                                                {photoUrl ? <img src={photoUrl} alt={c.name} className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-slate-400">{c.name?.charAt(0)}</span>}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-slate-800">{c.name}</span>
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{c.id}</span>
                                                </div>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">Rank #{c.rank}</span>
                                                    <span className="text-[10px] font-bold bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-100">Score: {c.score}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Why this candidate?</span>
                                                <p className="text-xs text-slate-700 leading-snug">{c.why}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-red-50 p-2 rounded border border-red-100">
                                                    <span className="text-[10px] uppercase font-bold text-red-400 block mb-0.5">Risk</span>
                                                    <p className="text-[10px] text-red-800 leading-snug">{c.risk}</p>
                                                </div>
                                                <div className="bg-orange-50 p-2 rounded border border-orange-100">
                                                    <span className="text-[10px] uppercase font-bold text-orange-400 block mb-0.5">Trade-off</span>
                                                    <p className="text-[10px] text-orange-800 leading-snug">{c.trade_off}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        }

        if (Array.isArray(parsed)) {
            return <ul className={`list-disc list-inside text-xs ${textColorClass} space-y-1`}>{parsed.map((item, idx) => <li key={idx}>{typeof item === "object" ? JSON.stringify(item) : item}</li>)}</ul>;
        }

        return (
            <div className={`space-y-2 text-xs ${textColorClass}`}>
                {Object.entries(parsed).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-1 border-b border-black/5 pb-2 last:border-0">
                        <span className="font-bold uppercase opacity-70 text-[10px] tracking-wider">{key.replace(/_/g, " ")}</span>
                        <span className="font-medium whitespace-pre-wrap">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
                    </div>
                ))}
            </div>
        );
    }

    return <p className={`text-xs ${textColorClass} leading-relaxed whitespace-pre-line`}>{String(parsed)}</p>;
}
