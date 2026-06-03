"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    Bot, User, Send, Loader2, Sparkles, ChevronDown, ChevronUp,
    RotateCcw, Search, UserPlus, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FilterPanel } from "@/app/ai-search-demo/FilterPanel";
import { ChainRatingPicker } from "@/app/ai-search-demo/ChainRatingPicker";
import { CandidateTableView } from "@/app/candidates/list/table-view";
import { AddCandidateDialog } from "@/components/ai-search/AddCandidateDialog";
import {
    getDemoFilterOptions,
    getCascadingFilterOptions,
    searchDemoCandidates,
    fetchCandidatePage,
    searchPositionSuggestions,
    searchCompanySuggestions,
} from "@/app/actions/ai-search-demo";
import { EMPTY_FILTERS, type DemoFilterState } from "@/app/ai-search-demo/types";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const MODELS = [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite-preview-06-17", label: "Gemini 2.5 Flash Lite" },
    { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
];

const PAGE_SIZE = 20;
const STORAGE_KEY = "ai-search-v3-messages-v2";
const N8N_WEBHOOK = "https://n8n.srv1212906.hstgr.cloud/webhook/ai-search-chat";

type ChatMsg = { id: string; role: "user" | "assistant"; content: string };

export default function AISearchV3Page() {
    const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
    const [chatOpen, setChatOpen] = useState(true);
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [input, setInput] = useState("");
    const [hasLoaded, setHasLoaded] = useState(false);

    const [filters, setFilters] = useState<DemoFilterState>(EMPTY_FILTERS);
    const [staticOptions, setStaticOptions] = useState<any>(null);
    const [cascadingOptions, setCascadingOptions] = useState<any>(null);
    const [cascadeLoading, setCascadeLoading] = useState(false);
    const [chainCounts, setChainCounts] = useState<any[]>([]);
    const [subBrandsByChain, setSubBrandsByChain] = useState<Record<string, string[]>>({});

    const [allCandidateIds, setAllCandidateIds] = useState<string[]>([]);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [summary, setSummary] = useState({ total: 0, current: 0, past: 0, companies: 0 });
    const [currentPage, setCurrentPage] = useState(1);
    const [searching, setSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Load localStorage after mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setMessages(JSON.parse(saved));
        } catch {}
        setHasLoaded(true);
    }, []);

    // Persist messages
    useEffect(() => {
        if (!hasLoaded) return;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
    }, [messages, hasLoaded]);

    useEffect(() => {
        getDemoFilterOptions().then((opts) => {
            setStaticOptions(opts);
            setChainCounts(opts.chainCounts ?? []);
            setSubBrandsByChain(opts.subBrandsByChain ?? {});
        });
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const updateCascading = useCallback(async (f: DemoFilterState) => {
        setCascadeLoading(true);
        const opts = await getCascadingFilterOptions(f);
        setCascadingOptions(opts);
        setCascadeLoading(false);
    }, []);

    function applyFiltersFromAI(f: any) {
        const newFilters: DemoFilterState = {
            ...EMPTY_FILTERS,
            position_search: f.position_search ?? [],
            position_levels: f.position_levels ?? [],
            hotel_ratings: f.hotel_ratings ?? [],
            countries: f.countries ?? [],
            industries: f.industries ?? [],
            hotel_chains: f.hotel_chains ?? [],
            genders: f.genders ?? [],
            current_only: f.current_only ?? false,
            current_and_latest: f.current_and_latest ?? false,  // search ALL experiences by default
        };
        setFilters(newFilters);
        runSearch(newFilters);
    }

    async function runSearch(f: DemoFilterState) {
        setSearching(true);
        setHasSearched(true);
        setCurrentPage(1);
        setCandidates([]);
        try {
            const result = await searchDemoCandidates(f);
            setAllCandidateIds(result.candidateIds);
            setSummary({ total: result.total, current: result.current, past: result.past, companies: result.companies });
            if (result.candidateIds.length > 0) {
                const page = await fetchCandidatePage(result.candidateIds, 1, PAGE_SIZE);
                setCandidates(page);
            }
        } finally {
            setSearching(false);
        }
    }

    async function loadPage(page: number) {
        const data = await fetchCandidatePage(allCandidateIds, page, PAGE_SIZE);
        setCandidates(data);
        setCurrentPage(page);
    }

    const handleFilterChange = (f: DemoFilterState) => {
        setFilters(f);
        updateCascading(f);
    };

    const clearChat = () => {
        setMessages([]);
        localStorage.removeItem(STORAGE_KEY);
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        const userMsg: ChatMsg = { id: Date.now().toString(), role: "user", content: input };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);

        const assistantId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "…" }]);

        try {
            const res = await fetch(N8N_WEBHOOK, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: input, sessionId: "ai-search-v3" }),
                signal: AbortSignal.timeout(120000),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const rawText = await res.text();
            let content = "";
            let filters: any = {};

            try {
                const data = JSON.parse(rawText);
                const first = Array.isArray(data) ? data[0] : data;
                content = first.answer ?? first.output ?? first.text ?? rawText;
                content = content.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
                if (first?.filters) filters = first.filters;
            } catch {
                content = rawText;
            }

            setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: content || "⚠️ No response" } : m
            ));

            if (filters && Object.keys(filters).length > 0) {
                applyFiltersFromAI(filters);
            }
        } catch (e: any) {
            setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: `⚠️ ${e.message}` } : m
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const activeFilterCount = [
        filters.position_search.length, filters.position_levels.length,
        filters.hotel_ratings.length, filters.countries.length,
        filters.industries.length, filters.hotel_chains.length,
    ].reduce((a, b) => a + b, 0);

    const totalPages = Math.ceil(summary.total / PAGE_SIZE);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-xl bg-indigo-100">
                        <Sparkles className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-800">AI Power Search</h1>
                        <p className="text-[11px] text-slate-500">Chat with AI · Filter · Explore</p>
                    </div>
                </div>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="h-8 w-52 text-xs rounded-lg border-slate-200">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {MODELS.map((m) => (
                            <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="max-w-full px-4 py-4 space-y-3">

                {/* ── Chat Section ── */}
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    {/* Chat header — always visible */}
                    <div
                        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                        onClick={() => setChatOpen(!chatOpen)}
                    >
                        <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-indigo-500" />
                            <span className="text-sm font-bold text-slate-700">AI Assistant</span>
                            {messages.length > 0 && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{messages.length}</Badge>
                            )}
                            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
                        </div>
                        <div className="flex items-center gap-2">
                            {messages.length > 0 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); clearChat(); }}
                                    className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                            {chatOpen
                                ? <ChevronUp className="h-4 w-4 text-slate-400" />
                                : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </div>
                    </div>

                    {chatOpen && (
                        <div className="border-t">
                            {/* Messages */}
                            <div className="h-72 overflow-y-auto px-5 py-3 space-y-3">
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <Bot className="h-10 w-10 opacity-15 mb-2" />
                                        <p className="text-sm font-medium">Ask me to find candidates</p>
                                        <p className="text-xs mt-1 opacity-60">"Find GM of 5-star hotels in Thailand"</p>
                                    </div>
                                )}
                                {messages.map((m) => (
                                    <div key={m.id} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
                                        {m.role === "assistant" && (
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                                                <Bot className="h-3 w-3 text-indigo-600" />
                                            </div>
                                        )}
                                        <div className={cn(
                                            "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                                            m.role === "user"
                                                ? "bg-indigo-600 text-white rounded-tr-sm"
                                                : "bg-slate-100 text-slate-800 rounded-tl-sm"
                                        )}>
                                            <span className="whitespace-pre-wrap">{m.content}</span>
                                        </div>
                                        {m.role === "user" && (
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                                                <User className="h-3 w-3 text-slate-500" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input */}
                            <div className="border-t px-4 py-3 flex gap-2 bg-slate-50/80">
                                <Textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask AI to find candidates... (Enter to send, Shift+Enter for newline)"
                                    className="min-h-[38px] max-h-28 resize-none text-sm rounded-xl border-slate-200 bg-white"
                                    rows={1}
                                />
                                <Button
                                    onClick={handleSend}
                                    disabled={isLoading || !input.trim()}
                                    size="sm"
                                    className="h-10 w-10 p-0 rounded-xl shrink-0"
                                >
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Hotel Chain & Rating ── */}
                {staticOptions && (
                    <div className="bg-white rounded-2xl border shadow-sm px-4 pb-3">
                        <ChainRatingPicker
                            chainCounts={chainCounts}
                            subBrandsByChain={subBrandsByChain}
                            filters={filters}
                            onFiltersChange={handleFilterChange}
                            onAutoSearch={runSearch}
                        />
                    </div>
                )}

                {/* ── Filters ── */}
                {staticOptions && (
                    <div className="bg-white rounded-2xl border shadow-sm px-4 pb-3">
                        <div className="flex items-center justify-between pt-3 pb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Filters</span>
                                {activeFilterCount > 0 && (
                                    <Badge className="text-[10px] h-4 px-1.5 bg-indigo-600 text-white border-none">{activeFilterCount}</Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {activeFilterCount > 0 && (
                                    <button
                                        onClick={() => { setFilters(EMPTY_FILTERS); setCascadingOptions(null); }}
                                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500"
                                    >
                                        <RotateCcw className="h-3 w-3" /> Reset
                                    </button>
                                )}
                                <Button onClick={() => runSearch(filters)} disabled={searching} size="sm" className="h-7 gap-1.5 rounded-lg text-xs">
                                    {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                                    Search
                                </Button>
                            </div>
                        </div>
                        <FilterPanel
                            staticOptions={staticOptions}
                            cascadingOptions={cascadingOptions}
                            cascadeLoading={cascadeLoading}
                            filters={filters}
                            onChange={handleFilterChange}
                            onReset={() => { setFilters(EMPTY_FILTERS); setCascadingOptions(null); }}
                            onSearchPositions={(q, f) => searchPositionSuggestions(q, f)}
                            onSearchCompanies={(q, f) => searchCompanySuggestions(q, f)}
                        />
                    </div>
                )}

                {/* ── Results ── */}
                {(hasSearched || searching) && (
                    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-700">Results</span>
                                {summary.total > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Badge variant="secondary" className="text-[10px]">{summary.total} total</Badge>
                                        <span>{summary.current} current</span>
                                        <span>·</span>
                                        <span>{summary.companies} companies</span>
                                    </div>
                                )}
                            </div>
                            {selectedIds.length > 0 && (
                                <Button size="sm" className="h-7 text-xs gap-1.5 rounded-lg" onClick={() => setAddDialogOpen(true)}>
                                    <UserPlus className="h-3.5 w-3.5" />
                                    Add {selectedIds.length} to JR
                                </Button>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <CandidateTableView
                                candidates={candidates}
                                loading={searching}
                                selectedIds={selectedIds}
                                onToggleSelect={(id) => setSelectedIds(prev =>
                                    prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
                                )}
                                onToggleSelectAll={(ids) => setSelectedIds(ids)}
                                showHotelColumn={filters.hotel_ratings.length > 0 || filters.hotel_chains.length > 0}
                            />
                        </div>
                        {totalPages > 1 && (
                            <div className="px-5 py-3 border-t flex items-center justify-between">
                                <span className="text-xs text-slate-500">Page {currentPage} of {totalPages}</span>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={currentPage === 1} onClick={() => loadPage(currentPage - 1)}>Prev</Button>
                                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={currentPage >= totalPages} onClick={() => loadPage(currentPage + 1)}>Next</Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>

            <AddCandidateDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                candidateIds={selectedIds}
                candidateNames={selectedIds.map(id => candidates.find((c: any) => c.candidate_id === id)?.name ?? id)}
                onSuccess={() => { setAddDialogOpen(false); setSelectedIds([]); }}
            />
        </div>
    );
}
