"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    Bot, User, Send, Loader2, Sparkles, ChevronDown, ChevronUp,
    RotateCcw, Search, UserPlus, Trash2, Users, TrendingUp, Building2, Globe
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

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
    return (
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <div className={`p-2 rounded-md ${color}`}>
                <Icon className="h-4 w-4 text-white" />
            </div>
            <div>
                <p className="text-xl font-bold text-slate-800">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
            </div>
        </div>
    );
}

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
    const [summary, setSummary] = useState({ total: 0, current: 0, past: 0, companies: 0, countries: 0 });
    const [currentPage, setCurrentPage] = useState(1);
    const [searching, setSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Load from localStorage after mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setMessages(JSON.parse(saved));
        } catch {}
        setHasLoaded(true);
    }, []);

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

    function resolveChainNames(chains: string[]): string[] {
        if (!chainCounts.length) return chains;
        return chains.map(chain => {
            const lower = chain.toLowerCase();
            const match = chainCounts.find(c => {
                const cLower = c.chain_name.toLowerCase();
                return cLower.includes(lower) || lower.includes(cLower.split(' ')[0]);
            });
            return match?.chain_name ?? chain;
        });
    }

    function applyFiltersFromAI(f: any) {
        const newFilters: DemoFilterState = {
            ...EMPTY_FILTERS,
            position_search: f.position_search ?? [],
            position_levels: f.position_levels ?? [],
            hotel_ratings: f.hotel_ratings ?? [],
            countries: f.countries ?? [],
            industries: f.industries ?? [],
            hotel_chains: resolveChainNames(f.hotel_chains ?? []),
            genders: f.genders ?? [],
            current_only: f.current_only ?? false,
            current_and_latest: f.current_and_latest ?? true,
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
            setSummary({ total: result.total, current: result.current, past: result.past, companies: result.companies, countries: result.countries ?? 0 });
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
            let aiFilters: any = {};

            try {
                const data = JSON.parse(rawText);
                const first = Array.isArray(data) ? data[0] : data;
                content = first.answer ?? first.output ?? first.text ?? rawText;
                content = content.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
                if (first?.filters) aiFilters = first.filters;
            } catch { content = rawText; }

            setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: content || "⚠️ No response" } : m
            ));
            if (aiFilters && Object.keys(aiFilters).length > 0) {
                applyFiltersFromAI(aiFilters);
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
        <div className="flex flex-col bg-slate-50 min-h-screen">

            {/* ── Chat Section (collapsible, top) ── */}
            <div className="bg-white border-b shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-xl bg-indigo-100">
                            <Sparkles className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-slate-800">AI Power Search</h1>
                            <p className="text-[11px] text-slate-500">Chat with AI · Filter · Explore</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                            <SelectTrigger className="h-8 w-48 text-xs rounded-lg border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MODELS.map((m) => (
                                    <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div
                            className="flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium text-slate-600"
                            onClick={() => setChatOpen(!chatOpen)}
                        >
                            <Bot className="h-4 w-4 text-indigo-500" />
                            <span>AI Chat</span>
                            {messages.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1">{messages.length}</Badge>}
                            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
                            {chatOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                    </div>
                </div>

                {/* Chat expanded */}
                {chatOpen && (
                    <div className="border-t mx-6 mb-3">
                        <div className="h-56 overflow-y-auto py-3 space-y-2.5">
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                    <Bot className="h-8 w-8 opacity-15 mb-2" />
                                    <p className="text-sm">"Find GM of 5-star hotels in Thailand"</p>
                                </div>
                            )}
                            {messages.map((m) => (
                                <div key={m.id} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                                    {m.role === "assistant" && (
                                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                                            <Bot className="h-3 w-3 text-indigo-600" />
                                        </div>
                                    )}
                                    <div className={cn(
                                        "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                                        m.role === "user" ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-slate-100 text-slate-800 rounded-tl-sm"
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
                        <div className="flex gap-2 pt-2 border-t">
                            <Textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask AI to find candidates... (Enter to send)"
                                className="min-h-[36px] max-h-20 resize-none text-sm rounded-xl border-slate-200"
                                rows={1}
                            />
                            <div className="flex flex-col gap-1">
                                <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="sm" className="h-9 w-9 p-0 rounded-xl">
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                                {messages.length > 0 && (
                                    <Button onClick={clearChat} variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl text-slate-400 hover:text-red-500">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Hotel Chain & Rating ── */}
            {staticOptions && (
                <div className="bg-white border-b px-6 py-2">
                    <ChainRatingPicker
                        chainCounts={chainCounts}
                        subBrandsByChain={subBrandsByChain}
                        filters={filters}
                        onFiltersChange={handleFilterChange}
                        onAutoSearch={runSearch}
                    />
                </div>
            )}

            {/* ── Main Body: Filter Left + Results Right ── */}
            <div className="flex gap-4 px-6 py-4">

                {/* Left: FilterPanel */}
                <div className="w-64 shrink-0 flex flex-col gap-2">
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
                    <Button
                        onClick={() => runSearch(filters)}
                        disabled={searching || activeFilterCount === 0}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 shrink-0"
                    >
                        {searching
                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching...</>
                            : <><Search className="h-4 w-4 mr-2" />Search{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</>}
                    </Button>
                    {activeFilterCount > 0 && (
                        <button
                            onClick={() => { setFilters(EMPTY_FILTERS); setCascadingOptions(null); }}
                            className="flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-red-500 py-1"
                        >
                            <RotateCcw className="h-3 w-3" /> Reset filters
                        </button>
                    )}
                </div>

                {/* Right: Summary + Results */}
                <div className="flex-1 flex flex-col gap-3 min-w-0">
                    {hasSearched && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-5 gap-3 shrink-0">
                                <SummaryCard label="Total Found" value={searching ? "…" : summary.total} icon={Users} color="bg-indigo-500" />
                                <SummaryCard label="Currently in Role" value={searching ? "…" : summary.current} icon={TrendingUp} color="bg-emerald-500" />
                                <SummaryCard label="Past Role" value={searching ? "…" : summary.past} icon={RotateCcw} color="bg-sky-500" />
                                <SummaryCard label="Companies" value={searching ? "…" : summary.companies} icon={Building2} color="bg-violet-500" />
                                <SummaryCard label="Countries" value={searching ? "…" : summary.countries} icon={Globe} color="bg-teal-500" />
                            </div>

                            {/* Candidate Table */}
                            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                <div className="px-4 py-2.5 border-b flex items-center justify-between shrink-0">
                                    <span className="text-sm font-bold text-slate-700">
                                        {searching ? "Searching..." : `${summary.total} candidates`}
                                    </span>
                                    {selectedIds.length > 0 && (
                                        <Button size="sm" className="h-7 text-xs gap-1.5 rounded-lg" onClick={() => setAddDialogOpen(true)}>
                                            <UserPlus className="h-3.5 w-3.5" />
                                            Add {selectedIds.length} to JR
                                        </Button>
                                    )}
                                </div>
                                <div>
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
                                    <div className="px-4 py-2.5 border-t flex items-center justify-between shrink-0">
                                        <span className="text-xs text-slate-500">Page {currentPage} of {totalPages}</span>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={currentPage === 1} onClick={() => loadPage(currentPage - 1)}>Prev</Button>
                                            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={currentPage >= totalPages} onClick={() => loadPage(currentPage + 1)}>Next</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {!hasSearched && !searching && (
                        <div className="flex-1 flex items-center justify-center text-slate-400">
                            <div className="text-center">
                                <Search className="h-16 w-16 opacity-10 mx-auto mb-3" />
                                <p className="font-medium">Ask AI or use filters to search</p>
                                <p className="text-xs mt-1 opacity-60">Results will appear here</p>
                            </div>
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
