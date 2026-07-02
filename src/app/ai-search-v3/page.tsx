"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    Bot, User, Send, Loader2, Sparkles, ChevronDown, ChevronUp,
    RotateCcw, Search, UserPlus, Trash2, Users, TrendingUp, Building2, Globe, Filter, AlertCircle, X
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FilterPanel } from "@/app/ai-search-demo/FilterPanel";
import { ChainRatingPicker } from "@/app/ai-search-demo/ChainRatingPicker";
import { CandidateTableView } from "@/app/candidates/list/table-view";
import { AddCandidateDialog } from "@/components/ai-search/AddCandidateDialog";
import { Stage3ResultsPanel } from "@/app/ai-search-v3/Stage3ResultsPanel";
import { getSearchJobHistory, triggerVectorRankAssessment, type SearchJobSummary } from "@/app/actions/ai-search-ranking";
import { Input } from "@/components/ui/input";
import {
    getDemoFilterOptions,
    getCascadingFilterOptions,
    getFilteredChainCounts,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function SubMSFilter({ label, options, selected, setSelected }: {
    label: string; options: string[]; selected: string[]; setSelected: (v: string[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) { setPending([...selected]); setSearch(''); }
        setOpen(isOpen);
    };
    const filtered = search ? options.filter(o => o.toLowerCase().includes(search.toLowerCase())) : options;
    const toggle = (val: string) => setPending(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val]);
    const apply = () => { setSelected([...pending]); setOpen(false); };
    const clear = () => { setPending([]); setSelected([]); setOpen(false); };
    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button className={cn(
                    "h-8 inline-flex items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold shadow-sm whitespace-nowrap transition-all",
                    selected.length > 0 ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                )}>
                    {selected.length > 0 ? `${label} (${selected.length})` : label}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[240px] p-0 shadow-xl border-slate-100 rounded-xl z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                    <div className="mb-1.5 text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</div>
                    <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-300 bg-white" />
                </div>
                {filtered.length > 0 && (() => {
                    const allSel = filtered.every(o => pending.includes(o));
                    return (
                        <div className="px-2 py-1.5 border-b border-slate-100">
                            <label className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer select-none" onClick={() => {
                                if (allSel) setPending(p => p.filter(x => !filtered.includes(x)));
                                else setPending(p => [...new Set([...p, ...filtered])]);
                            }}>
                                <Checkbox checked={allSel} onCheckedChange={() => {
                                    if (allSel) setPending(p => p.filter(x => !filtered.includes(x)));
                                    else setPending(p => [...new Set([...p, ...filtered])]);
                                }} className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 shrink-0" />
                                <span className="text-xs font-semibold text-slate-600">Select All</span>
                            </label>
                        </div>
                    );
                })()}
                <ScrollArea className="max-h-[200px]">
                    <div className="p-2 flex flex-col gap-0.5">
                        {filtered.length === 0 && <div className="text-xs text-slate-400 text-center py-3">No options</div>}
                        {filtered.map(opt => (
                            <label key={opt} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700">
                                <Checkbox checked={pending.includes(opt)} onCheckedChange={() => toggle(opt)}
                                    className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 shrink-0" />
                                <span className="leading-snug">{opt}</span>
                            </label>
                        ))}
                    </div>
                </ScrollArea>
                <div className="flex gap-2 p-2 border-t border-slate-100">
                    <button onClick={clear} className="flex-1 text-xs text-red-500 hover:text-red-700 font-semibold py-1.5 border border-red-100 rounded-md hover:bg-red-50">Clear</button>
                    <button onClick={apply} className="flex-1 text-xs bg-indigo-600 text-white rounded-md py-1.5 font-semibold hover:bg-indigo-700">Apply</button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

const MODELS = [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite-preview-06-17", label: "Gemini 2.5 Flash Lite" },
    { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
];

const PAGE_SIZE = 20;
const STORAGE_KEY = "ai-search-v3-messages-v2";
const N8N_WEBHOOK = "https://n8n.srv1212906.hstgr.cloud/webhook/0777f5b4-867c-499e-b412-d5daecefefb5";
const VECTOR_RANK_WEBHOOK = "https://n8n.srv1212906.hstgr.cloud/webhook/vector-rank";

type ChatMsg = { id: string; role: "user" | "assistant"; content: string; filters?: any; sessionId?: string; jdText?: string };

function hasMeaningfulFilters(f: any): boolean {
    if (!f) return false;
    const arrayKeys = [
        "position_keywords", "position_search", "position_levels",
        "companies", "countries", "based_in_countries", "regions",
        "hotel_ratings", "hotel_chains", "hotel_sub_brands",
        "industries", "job_functions", "genders", "nationalities",
        "exclude_companies", "exclude_countries", "exclude_keywords",
    ];
    return arrayKeys.some((k) => Array.isArray(f[k]) && f[k].length > 0) || f.current_only === true;
}

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
    const [allCandidatesData, setAllCandidatesData] = useState<any[]>([]);
    const [allDataLoading, setAllDataLoading] = useState(false);
    const [summary, setSummary] = useState({ total: 0, current: 0, past: 0, companies: 0, countries: 0 });
    const [currentPage, setCurrentPage] = useState(1);
    const [searching, setSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Sub-filter state (client-side, within fetched result set)
    const [subSearch, setSubSearch] = useState("");
    const [subPosition, setSubPosition] = useState<string[]>([]);
    const [subCompany, setSubCompany] = useState<string[]>([]);
    const [subCountry, setSubCountry] = useState<string[]>([]);
    const [subNationality, setSubNationality] = useState<string[]>([]);
    const [subGender, setSubGender] = useState<string[]>([]);
    const [subHotelRating, setSubHotelRating] = useState<string[]>([]);
    const [subScope, setSubScope] = useState<'latest' | 'current' | 'all'>('latest');
    const hasSubFilter = !!(subSearch || subPosition.length || subCompany.length || subCountry.length || subNationality.length || subGender.length || subHotelRating.length);
    const clearSubFilters = () => { setSubSearch(""); setSubPosition([]); setSubCompany([]); setSubCountry([]); setSubNationality([]); setSubGender([]); setSubHotelRating([]); };

    const getScopedExps = (c: any) => {
        const exps: any[] = c.experiences ?? [];
        if (subScope === 'current') return exps.filter((e: any) => e.is_current_job === 'Current');
        if (subScope === 'latest') {
            const cur = exps.find((e: any) => e.is_current_job === 'Current');
            return cur ? [cur] : exps.slice(0, 1);
        }
        return exps;
    };

    const subOptions = React.useMemo(() => {
        const uniq = (arr: (string|null|undefined)[]) => Array.from(new Set(arr.filter(Boolean))).sort() as string[];
        const src = allCandidatesData.length > 0 ? allCandidatesData : candidates;
        const allExpsOf = (c: any) => {
            const exps: any[] = c.experiences ?? [];
            if (subScope === 'current') return exps.filter((e: any) => e.is_current_job === 'Current');
            if (subScope === 'latest') { const cur = exps.find((e: any) => e.is_current_job === 'Current'); return cur ? [cur] : exps.slice(0, 1); }
            return exps;
        };
        return {
            positions:     uniq(src.flatMap(c => allExpsOf(c).map((e: any) => e.position))),
            companies:     uniq(src.flatMap(c => allExpsOf(c).map((e: any) => e.company))),
            countries:     uniq(src.flatMap(c => allExpsOf(c).map((e: any) => e.country))),
            nationalities: uniq(src.map(c => c.nationality)),
            genders:       uniq(src.map(c => c.gender)),
            hotelRatings:  uniq(src.flatMap(c => allExpsOf(c).map((e: any) => e.hotel_rating))),
        };
    }, [allCandidatesData, candidates, subScope]);

    const applySubFilter = React.useCallback((data: any[]) => {
        if (!hasSubFilter) return data;
        return data.filter(c => {
            const scopedExps = getScopedExps(c);
            if (subSearch) {
                const q = subSearch.toLowerCase();
                if (!c.name?.toLowerCase().includes(q) && !scopedExps.some((e: any) => e.position?.toLowerCase().includes(q) || e.company?.toLowerCase().includes(q))) return false;
            }
            if (subPosition.length && !scopedExps.some((e: any) => subPosition.includes(e.position))) return false;
            if (subCompany.length && !scopedExps.some((e: any) => subCompany.includes(e.company))) return false;
            if (subCountry.length && !scopedExps.some((e: any) => subCountry.includes(e.country))) return false;
            if (subNationality.length && !subNationality.includes(c.nationality)) return false;
            if (subGender.length && !subGender.includes(c.gender)) return false;
            if (subHotelRating.length && !scopedExps.some((e: any) => subHotelRating.includes(e.hotel_rating))) return false;
            return true;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subSearch, subPosition, subCompany, subCountry, subNationality, subGender, subHotelRating, subScope]);

    const sourceData = hasSubFilter && allCandidatesData.length > 0 ? allCandidatesData : candidates;
    const allFiltered = React.useMemo(() => applySubFilter(sourceData), [applySubFilter, sourceData]);
    const displayCandidates = React.useMemo(() => {
        if (!hasSubFilter) return candidates;
        const start = (currentPage - 1) * PAGE_SIZE;
        return allFiltered.slice(start, start + PAGE_SIZE);
    }, [hasSubFilter, candidates, allFiltered, currentPage]);

    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const [jobIdInput, setJobIdInput] = useState("");
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [assessingId, setAssessingId] = useState<string | null>(null);
    const [jobHistory, setJobHistory] = useState<SearchJobSummary[]>([]);

    const [aiCriteria, setAiCriteria] = useState("");
    const [analysing, setAnalysing] = useState(false);
    const [analyseError, setAnalyseError] = useState<string | null>(null);
    const [resultTab, setResultTab] = useState("candidates");
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const cascadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cascadeGenRef = useRef(0);
    const resultsRef = useRef<HTMLDivElement>(null);

    const [filtersChangedSinceSearch, setFiltersChangedSinceSearch] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    // Load from localStorage after mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setMessages(JSON.parse(saved));
        } catch {}
        setHasLoaded(true);
    }, []);

    // Auto-scroll chat container (not full page) to bottom on new messages or after initial load
    useEffect(() => {
        const el = chatContainerRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [messages, hasLoaded]);

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
        getSearchJobHistory(20).then(setJobHistory);
    }, []);


    const updateCascading = useCallback(async (f: DemoFilterState) => {
        const gen = ++cascadeGenRef.current;
        setCascadeLoading(true);
        const opts = await getCascadingFilterOptions(f);
        if (gen !== cascadeGenRef.current) return; // stale response — newer request in flight
        setCascadingOptions(opts);
        setCascadeLoading(false);
    }, []);

    function resolveChainNames(chains: string[]): string[] {
        if (!chainCounts.length) return chains;
        return chains.map(chain => {
            const lower = chain.toLowerCase();
            // exact match first, then DB name contains the AI-supplied term (never reverse — avoids false positives)
            const exact = chainCounts.find(c => c.chain_name.toLowerCase() === lower);
            if (exact) return exact.chain_name;
            const contains = chainCounts.find(c => c.chain_name.toLowerCase().includes(lower));
            return contains?.chain_name ?? chain;
        });
    }

    function expandCompanyAliases(companies: string[]): string[] {
        const result: string[] = [];
        for (const name of companies) {
            const match = name.match(/^(.+?)\s*\((.+?)\)$/);
            if (match) {
                result.push(match[1].trim(), match[2].trim());
            } else {
                result.push(name);
            }
        }
        return Array.from(new Set(result));
    }

    async function applyFiltersFromAI(f: any) {
        const baseKeywords: string[] = f.position_keywords ?? [];
        const searchTerms: string[] = f.position_search ?? [];

        // get all suggestions for each search term (same items user sees in dropdown)
        const allSuggestions: Array<{ label: string; type: "keyword" | "position" }> = [];
        for (const term of searchTerms) {
            const suggestions = await searchPositionSuggestions(term);
            allSuggestions.push(...suggestions);
        }

        const expandedKeywords = allSuggestions.filter(s => s.type === "keyword").map(s => s.label);

        const mergedKeywords = Array.from(new Set([...baseKeywords, ...expandedKeywords]));
        // Don't expand raw positions — RPC handles ILIKE matching, expanding causes 500+ patterns → timeout
        const mergedPositions = Array.from(new Set([...searchTerms]));

        // expand company terms: split aliases → look up exact names from DB
        const splitTerms = expandCompanyAliases(f.companies ?? []);
        const expandedCompanyNames: string[] = [];
        for (const term of splitTerms) {
            if (term.trim().length < 2) continue;
            const results = await searchCompanySuggestions(term);
            expandedCompanyNames.push(...results);
        }
        const mergedCompanies = Array.from(new Set(expandedCompanyNames));

        const newFilters: DemoFilterState = {
            ...EMPTY_FILTERS,
            position_keywords: mergedKeywords,
            position_search: mergedPositions,
            position_levels: f.position_levels ?? [],
            companies: mergedCompanies,
            hotel_ratings: f.hotel_ratings ?? [],
            countries: f.countries ?? [],
            based_in_countries: f.based_in_countries ?? [],
            industries: f.industries ?? [],
            hotel_chains: resolveChainNames(f.hotel_chains ?? []),
            genders: f.genders ?? [],
            current_only: f.current_only ?? false,
            current_and_latest: f.current_and_latest ?? true,
        };
        setFilters(newFilters);
        runSearch(newFilters);
        updateCascading(newFilters);
    }

    async function runSearch(f: DemoFilterState) {
        setSearching(true);
        setHasSearched(true);
        setFiltersChangedSinceSearch(false);
        setSearchError(null);
        setCurrentPage(1);
        setCandidates([]);
        setAllCandidatesData([]);
        clearSubFilters();
        try {
            const result = await searchDemoCandidates(f);
            setAllCandidateIds(result.candidateIds);
            setSummary({ total: result.total, current: result.current, past: result.past, companies: result.companies, countries: result.countries ?? 0 });
            if (result.candidateIds.length > 0) {
                const firstPageIds = result.candidateIds.slice(0, PAGE_SIZE);
                const page = await fetchCandidatePage(firstPageIds, 1, PAGE_SIZE);
                setCandidates(page);
                // Background fetch all candidates for sub-filter
                setAllDataLoading(true);
                void fetchCandidatePage(result.candidateIds, 1, result.candidateIds.length).then(all => {
                    setAllCandidatesData(all);
                    setAllDataLoading(false);
                });
            }
            setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        } catch (e: any) {
            setSearchError("ค้นหาไม่สำเร็จ กรุณาลองใหม่");
        } finally {
            setSearching(false);
        }
    }

    async function loadPage(page: number) {
        const pageIds = allCandidateIds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        const data = await fetchCandidatePage(pageIds, 1, PAGE_SIZE);
        setCandidates(data);
        setCurrentPage(page);
    }

    const handleFilterChange = (f: DemoFilterState) => {
        setFilters(f);
        if (hasSearched) setFiltersChangedSinceSearch(true);
        if (cascadeTimerRef.current) clearTimeout(cascadeTimerRef.current);
        cascadeTimerRef.current = setTimeout(() => {
            updateCascading(f);
            // update chain counts dynamically when non-chain filters change
            const hasOtherFilters =
                f.position_keywords.length > 0 || f.position_levels.length > 0 ||
                f.position_search.length > 0 || f.countries.length > 0 ||
                f.regions.length > 0 || f.industries.length > 0 ||
                f.job_functions.length > 0 || f.hotel_ratings.length > 0 ||
                f.companies.length > 0 || f.current_only;
            if (hasOtherFilters) {
                getFilteredChainCounts(f).then(counts => { if (counts) setChainCounts(counts); });
            }
        }, 400);
    };

    const handleChainAutoSearch = (f: DemoFilterState) => {
        if (autoSearchTimerRef.current) clearTimeout(autoSearchTimerRef.current);
        autoSearchTimerRef.current = setTimeout(() => runSearch(f), 600);
    };

    const clearChat = () => {
        setMessages([]);
        localStorage.removeItem(STORAGE_KEY);
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        const jdText = input;
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
                body: JSON.stringify({ message: jdText, sessionId: "ai-search-v3" }),
                signal: AbortSignal.timeout(120000),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const rawText = await res.text();
            let content = "";
            let aiFilters: any = {};
            let sessionId: string | undefined;

            try {
                const data = JSON.parse(rawText);
                const first = Array.isArray(data) ? data[0] : data;
                content = first.answer ?? first.output ?? first.text ?? rawText;
                content = content.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
                if (first?.filters) aiFilters = first.filters;
                if (first?.session_id) sessionId = first.session_id;
            } catch { content = rawText; }

            setMessages(prev => prev.map(m =>
                m.id === assistantId
                    ? {
                        ...m,
                        content: content || "⚠️ No response",
                        filters: hasMeaningfulFilters(aiFilters) ? aiFilters : undefined,
                        sessionId: sessionId?.startsWith("v2_") ? sessionId : undefined,
                        jdText,
                    }
                    : m
            ));
        } catch (e: any) {
            setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: `⚠️ ${e.message}` } : m
            ));
        } finally {
            setIsLoading(false);
        }
    };

    async function runAIAssessment(msg: ChatMsg) {
        if (!msg.sessionId || !msg.jdText || assessingId) return;
        setAssessingId(msg.id);
        try {
            const res = await fetch(VECTOR_RANK_WEBHOOK, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: msg.sessionId, jd_text: msg.jdText, query: msg.jdText }),
                signal: AbortSignal.timeout(120000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.job_id) {
                setActiveJobId(data.job_id);
                setJobIdInput(data.job_id);
                setResultTab("ai-analyse");
                getSearchJobHistory(20).then(setJobHistory);
            }
        } catch (e: any) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: `⚠️ AI Assessment failed: ${e.message}` }]);
        } finally {
            setAssessingId(null);
        }
    }

    async function handleAIAnalyse() {
        if (!aiCriteria.trim() || !allCandidateIds.length || analysing) return;
        setAnalysing(true);
        setAnalyseError(null);
        try {
            const result = await triggerVectorRankAssessment(allCandidateIds, aiCriteria);
            setActiveJobId(result.jobId);
            setJobIdInput(result.jobId);
            setResultTab("ai-analyse");
            getSearchJobHistory(20).then(setJobHistory);
        } catch (e: any) {
            setAnalyseError(e.message);
        } finally {
            setAnalysing(false);
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const activeFilterCount =
        filters.position_search.length +
        filters.position_keywords.length +
        filters.position_levels.length +
        filters.hotel_ratings.length +
        filters.hotel_chains.length +
        filters.hotel_sub_brands.length +
        filters.countries.length +
        filters.based_in_countries.length +
        filters.regions.length +
        filters.industries.length +
        filters.companies.length +
        filters.job_functions.length +
        filters.genders.length +
        filters.nationalities.length +
        filters.exclude_companies.length +
        filters.exclude_countries.length +
        filters.exclude_keywords.length +
        (filters.current_only ? 1 : 0);

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
                        <div ref={chatContainerRef} className="h-[544px] overflow-y-auto py-3 space-y-2.5">
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
                                    <div className="flex flex-col gap-1.5 max-w-[75%]">
                                        <div className={cn(
                                            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                                            m.role === "user"
                                                ? "bg-indigo-600 text-white rounded-tr-sm whitespace-pre-wrap"
                                                : "bg-slate-100 text-slate-800 rounded-tl-sm prose prose-sm prose-slate max-w-none prose-p:my-1 prose-headings:mt-2 prose-headings:mb-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-strong:font-bold prose-code:text-xs prose-code:bg-slate-200 prose-code:px-1 prose-code:rounded"
                                        )}>
                                            {m.role === "user"
                                                ? m.content
                                                : <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                                            }
                                        </div>
                                        {(m.filters || m.sessionId) && (
                                            <div className="flex gap-1.5">
                                                {m.filters && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs gap-1.5 self-start rounded-lg border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                                        onClick={() => applyFiltersFromAI(m.filters)}
                                                    >
                                                        <Filter className="h-3 w-3" />
                                                        Apply to filters
                                                    </Button>
                                                )}
                                                {m.sessionId && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs gap-1.5 self-start rounded-lg border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                                        disabled={assessingId === m.id}
                                                        onClick={() => runAIAssessment(m)}
                                                    >
                                                        {assessingId === m.id
                                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                                            : <Sparkles className="h-3 w-3" />}
                                                        AI Assessment
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {m.role === "user" && (
                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                                            <User className="h-3 w-3 text-slate-500" />
                                        </div>
                                    )}
                                </div>
                            ))}
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
                        onAutoSearch={handleChainAutoSearch}
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
                            onClick={() => { setFilters(EMPTY_FILTERS); setCascadingOptions(null); setFiltersChangedSinceSearch(false); setSearchError(null); }}
                            className="flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-red-500 py-1"
                        >
                            <RotateCcw className="h-3 w-3" /> Reset filters
                        </button>
                    )}
                    {filtersChangedSinceSearch && hasSearched && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span>Filter เปลี่ยนแล้ว — กด Search เพื่อดูผลใหม่</span>
                        </div>
                    )}
                    {filters.position_search.length > 10 && (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                            💡 <strong>Tip:</strong> Using <strong>KW</strong> filters instead of raw position titles is significantly faster
                            — "General Manager KW" automatically covers all variations.
                        </div>
                    )}
                </div>

                {/* Right: Summary + Results */}
                <div ref={resultsRef} className="flex-1 flex flex-col gap-3 min-w-0">
                    <Tabs value={resultTab} onValueChange={setResultTab} className="flex flex-col gap-3 min-w-0">
                        <TabsList className="self-start">
                            <TabsTrigger value="candidates">
                                Candidates{hasSearched ? ` (${summary.total})` : ""}
                            </TabsTrigger>
                            <TabsTrigger value="ai-analyse">
                                AI Analyse{activeJobId ? " •" : ""}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="candidates" className="flex flex-col gap-3 min-w-0 mt-0">
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

                                    {/* Sub-filter bar — client-side filter within fetched results */}
                                    {candidates.length > 0 && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mr-1">Filters:</span>
                                            <div className="flex items-center h-8 bg-slate-100 rounded-lg p-0.5 gap-0.5 shrink-0">
                                                {([
                                                    { key: 'latest',  label: 'Current+Latest' },
                                                    { key: 'current', label: 'Current Only' },
                                                    { key: 'all',     label: 'All Exp.' },
                                                ] as const).map(({ key, label }) => (
                                                    <button key={key} onClick={() => setSubScope(key)}
                                                        className={cn("h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap",
                                                            subScope === key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                                        )}>
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                                                <input value={subSearch} onChange={e => setSubSearch(e.target.value)} placeholder="Search all fields..."
                                                    className="h-8 pl-6 pr-2.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-300 w-40 shadow-sm bg-white" />
                                            </div>
                                            <SubMSFilter label="Position"     options={subOptions.positions}     selected={subPosition}    setSelected={setSubPosition} />
                                            <SubMSFilter label="Company"      options={subOptions.companies}     selected={subCompany}     setSelected={setSubCompany} />
                                            <SubMSFilter label="Country"      options={subOptions.countries}     selected={subCountry}     setSelected={setSubCountry} />
                                            <SubMSFilter label="Nationality"  options={subOptions.nationalities} selected={subNationality} setSelected={setSubNationality} />
                                            <SubMSFilter label="Gender"       options={subOptions.genders}       selected={subGender}      setSelected={setSubGender} />
                                            <SubMSFilter label="Hotel Rating" options={subOptions.hotelRatings}  selected={subHotelRating} setSelected={setSubHotelRating} />
                                            {hasSubFilter && (
                                                <>
                                                    <button onClick={clearSubFilters} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors">
                                                        <X className="h-3 w-3" /> Reset
                                                    </button>
                                                    {allDataLoading
                                                        ? <span className="text-xs text-slate-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</span>
                                                        : <span className="text-xs text-slate-400">{allFiltered.length} / {summary.total}</span>
                                                    }
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Candidate Table */}
                                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                        <div className="px-4 py-2.5 border-b flex items-center justify-between shrink-0">
                                            <span className="text-sm font-bold text-slate-700">
                                                {searching
                                                    ? <span className="flex items-center gap-2">
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                                                        <span>
                                                            {filters.position_search.length > 10
                                                                ? `Searching across ${filters.position_search.length} position filters — this may take a moment...`
                                                                : "Searching..."}
                                                        </span>
                                                      </span>
                                                    : hasSubFilter
                                                        ? `${allFiltered.length} / ${summary.total} candidates`
                                                        : `${summary.total} candidates`
                                                }
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
                                                candidates={displayCandidates}
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
                                <div className="flex-1 flex items-center justify-center text-slate-400 py-24">
                                    <div className="text-center">
                                        <Search className="h-16 w-16 opacity-10 mx-auto mb-3" />
                                        <p className="font-medium">Ask AI or use filters to search</p>
                                        <p className="text-xs mt-1 opacity-60">Results will appear here</p>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="ai-analyse" className="flex flex-col gap-3 min-w-0 mt-0">
                            {/* AI Analyse — vector-rank top20 → Stage3 pipeline */}
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-500">AI Criteria</span>
                                    <span className="text-xs text-slate-400">{allCandidateIds.length} candidates in pool</span>
                                </div>
                                <Textarea
                                    value={aiCriteria}
                                    onChange={(e) => setAiCriteria(e.target.value)}
                                    placeholder="ระบุเกณฑ์ที่ต้องการให้ AI วิเคราะห์ เช่น ตำแหน่ง, ทักษะ, ประสบการณ์ที่ต้องการ..."
                                    className="min-h-[60px] text-sm rounded-lg border-slate-200 resize-none"
                                />
                                <div className="flex items-center justify-between gap-2">
                                    {analyseError && <span className="text-xs text-red-500">⚠️ {analyseError}</span>}
                                    <Button
                                        size="sm"
                                        className="h-8 text-xs gap-1.5 ml-auto bg-indigo-600 hover:bg-indigo-700"
                                        disabled={!aiCriteria.trim() || !allCandidateIds.length || analysing}
                                        onClick={handleAIAnalyse}
                                    >
                                        {analysing
                                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analysing...</>
                                            : <><Sparkles className="h-3.5 w-3.5" />AI Analyse</>}
                                    </Button>
                                </div>
                            </div>

                            {/* Temporary: load AI Ranking results by job_id (Stage 2/3 pipeline) */}
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-2.5 flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500 shrink-0">AI Ranking job_id:</span>
                                <Input
                                    value={jobIdInput}
                                    onChange={(e) => setJobIdInput(e.target.value)}
                                    placeholder="job_xxxxxxxxxxxxx"
                                    className="h-8 text-xs max-w-xs"
                                />
                                <Button size="sm" className="h-8 text-xs" onClick={() => setActiveJobId(jobIdInput.trim() || null)}>
                                    Load
                                </Button>
                                {jobHistory.length > 0 && (
                                    <Select onValueChange={(jobId) => { setJobIdInput(jobId); setActiveJobId(jobId); }}>
                                        <SelectTrigger className="h-8 w-56 text-xs">
                                            <SelectValue placeholder="หรือเลือกจาก job ล่าสุด..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {jobHistory.map((job) => (
                                                <SelectItem key={job.job_id} value={job.job_id} className="text-xs">
                                                    {new Date(job.created_at).toLocaleString("th-TH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                                    {" · "}{job.status}
                                                    {" · "}{job.query.slice(0, 30)}{job.query.length > 30 ? "…" : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                {activeJobId && (
                                    <Button size="sm" variant="ghost" className="h-8 text-xs text-slate-400 hover:text-red-500" onClick={() => { setActiveJobId(null); setJobIdInput(""); }}>
                                        Clear
                                    </Button>
                                )}
                            </div>

                            {activeJobId && <Stage3ResultsPanel jobId={activeJobId} />}

                            {!activeJobId && (
                                <div className="flex-1 flex items-center justify-center text-slate-400 py-24">
                                    <div className="text-center">
                                        <Sparkles className="h-16 w-16 opacity-10 mx-auto mb-3" />
                                        <p className="font-medium">กรอก AI Criteria แล้วกด "AI Analyse"</p>
                                        <p className="text-xs mt-1 opacity-60">หรือเลือก job ล่าสุดจาก dropdown ด้านบน</p>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
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
