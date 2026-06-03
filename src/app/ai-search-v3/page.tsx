"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    Bot, User, Send, Loader2, Sparkles, ChevronDown, ChevronUp,
    RotateCcw, SlidersHorizontal, Search, UserPlus, Trash2
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

export default function AISearchV3Page() {
    const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
    const [filtersOpen, setFiltersOpen] = useState(false);
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
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [savedMessages, setSavedMessages] = useState<any[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState("");
    const [hasLoaded, setHasLoaded] = useState(false);

    // Load saved messages from localStorage after mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setMessages(JSON.parse(saved));
        } catch {}
        setHasLoaded(true);
    }, []);

    type ChatMsg = { id: string; role: "user" | "assistant"; content: string };
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Persist messages
    useEffect(() => {
        if (!hasLoaded) return;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
    }, [messages, hasLoaded]);

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
            // Call n8n webhook directly from browser (same as Test button in n8n Integration page)
            const res = await fetch("https://n8n.srv1212906.hstgr.cloud/webhook/ai-search-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: input,
                    sessionId: "ai-search-v3",
                }),
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
            current_and_latest: f.current_and_latest ?? true,
        };
        setFilters(newFilters);
        runSearch(newFilters);
    }

    async function runSearch(f: DemoFilterState) {
        setSearching(true);
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const activeFilterCount = [
        filters.position_search.length,
        filters.position_levels.length,
        filters.hotel_ratings.length,
        filters.countries.length,
        filters.industries.length,
        filters.hotel_chains.length,
        filters.genders.length,
    ].reduce((a, b) => a + b, 0);

    const totalPages = Math.ceil(summary.total / PAGE_SIZE);

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0">
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

            {/* Main layout — 2 columns */}
            <div className="flex flex-1 overflow-hidden">

                {/* LEFT — Chat + Filters */}
                <div className="w-96 shrink-0 border-r bg-white flex flex-col overflow-hidden">

                    {/* Chat messages — scrollable */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                                <Bot className="h-12 w-12 opacity-15 mb-3" />
                                <p className="text-sm font-medium">Ask me to find candidates</p>
                                <p className="text-xs mt-1 opacity-60 text-center px-4">"Find GM of 5-star hotels in Thailand"</p>
                            </div>
                        )}
                        {messages.map((m: any) => (
                            <div key={m.id} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                                {m.role === "assistant" && (
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <Bot className="h-3 w-3 text-indigo-600" />
                                    </div>
                                )}
                                <div className={cn(
                                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                                    m.role === "user"
                                        ? "bg-indigo-600 text-white rounded-tr-sm"
                                        : "bg-slate-100 text-slate-800 rounded-tl-sm"
                                )}>
                                    <span className="whitespace-pre-wrap">{(m as any).content}</span>
                                </div>
                                {m.role === "user" && (
                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                                        <User className="h-3 w-3 text-slate-500" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && (messages.length === 0 || (messages[messages.length - 1] as any)?.role === "user") && (
                            <div className="flex gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                    <Bot className="h-3 w-3 text-indigo-600" />
                                </div>
                                <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat input */}
                    <div className="border-t px-3 py-2.5 flex gap-2 bg-slate-50/80 shrink-0">
                        <Textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask AI... (Enter to send)"
                            className="min-h-[38px] max-h-24 resize-none text-sm rounded-xl border-slate-200 bg-white"
                            rows={1}
                        />
                        <div className="flex flex-col gap-1.5">
                            <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="sm" className="h-9 w-9 p-0 rounded-xl shrink-0">
                                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            </Button>
                            {messages.length > 0 && (
                                <Button onClick={clearChat} variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl shrink-0 text-slate-400 hover:text-red-500">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Filters — collapsible at bottom of left col */}
                    <div className="border-t shrink-0">
                        <div
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => setFiltersOpen(!filtersOpen)}
                        >
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                                <span className="text-xs font-bold text-slate-600">Filters</span>
                                {activeFilterCount > 0 && (
                                    <Badge className="text-[10px] h-4 px-1.5 bg-indigo-600 text-white border-none">{activeFilterCount}</Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {activeFilterCount > 0 && (
                                    <button onClick={(e) => { e.stopPropagation(); setFilters(EMPTY_FILTERS); setCascadingOptions(null); setCandidates([]); setSummary({ total: 0, current: 0, past: 0, companies: 0 }); setAllCandidateIds([]); }}
                                        className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-1">
                                        <RotateCcw className="h-2.5 w-2.5" /> Reset
                                    </button>
                                )}
                                {filtersOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />}
                            </div>
                        </div>

                        {filtersOpen && (
                            <div className="max-h-[50vh] overflow-y-auto border-t px-3 pb-3">
                                {staticOptions && (
                                    <ChainRatingPicker
                                        chainCounts={chainCounts}
                                        subBrandsByChain={subBrandsByChain}
                                        filters={filters}
                                        onFiltersChange={handleFilterChange}
                                        onAutoSearch={runSearch}
                                    />
                                )}
                                {staticOptions && (
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
                                )}
                                <div className="mt-2 flex justify-end">
                                    <Button onClick={() => runSearch(filters)} disabled={searching} size="sm" className="gap-1.5 rounded-lg h-8 text-xs">
                                        {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                                        Search
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT — Results */}
                <div className="flex-1 overflow-y-auto">
                    {summary.total === 0 && !searching ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-300">
                            <Search className="h-16 w-16 opacity-20 mb-4" />
                            <p className="text-sm font-medium opacity-60">Results will appear here</p>
                            <p className="text-xs mt-1 opacity-40">Ask AI or use filters on the left</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            {/* Results header */}
                            <div className="px-5 py-3 border-b bg-white flex items-center justify-between sticky top-0 z-10">
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

                            {/* Table */}
                            <div className="flex-1 overflow-x-auto">
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

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="px-5 py-3 border-t bg-white flex items-center justify-between shrink-0">
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
