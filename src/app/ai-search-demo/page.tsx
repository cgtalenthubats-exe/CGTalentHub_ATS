"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Building2, Briefcase, TrendingUp, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import { CandidateTableView } from "@/app/candidates/list/table-view";
import { FilterPanel } from "./FilterPanel";
import { SuggestedFilters } from "./SuggestedFilters";
import { AddCandidateDialog } from "@/components/ai-search/AddCandidateDialog";
import {
    getDemoFilterOptions,
    getCascadingFilterOptions,
    searchDemoCandidates,
    fetchCandidatePage,
    parseQueryToFilters,
    searchPositionSuggestions,
    searchCompanySuggestions,
} from "@/app/actions/ai-search-demo";
import { EMPTY_FILTERS, type DemoFilterState, type AiParseResult } from "./types";
import { CohortInsights } from "./CohortInsights";

// --- Summary Card ---
function SummaryCard({ label, value, icon: Icon, color }: {
    label: string; value: number | string; icon: React.ElementType; color: string;
}) {
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

// --- Pagination Controls (copied from candidates/list) ---
function PaginationControls({ currentPage, totalCount, pageSize, onPageChange }: {
    currentPage: number; totalCount: number; pageSize: number; onPageChange: (p: number) => void;
}) {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    let startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
    const pages: number[] = [];
    for (let i = startPage; i <= endPage; i++) pages.push(i);

    return (
        <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                Previous
            </Button>
            {startPage > 1 && (
                <>
                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={() => onPageChange(1)}>1</Button>
                    {startPage > 2 && <span className="text-muted-foreground px-1">...</span>}
                </>
            )}
            {pages.map(p => (
                <Button key={p} variant={currentPage === p ? "default" : "ghost"} size="sm" className="w-8 h-8 p-0" onClick={() => onPageChange(p)}>
                    {p}
                </Button>
            ))}
            {endPage < totalPages && (
                <>
                    {endPage < totalPages - 1 && <span className="text-muted-foreground px-1">...</span>}
                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={() => onPageChange(totalPages)}>{totalPages}</Button>
                </>
            )}
            <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}>
                Next
            </Button>
        </div>
    );
}

const PAGE_SIZE = 20;

export default function AiSearchDemoPage() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [pendingFilters, setPendingFilters] = useState<DemoFilterState>(EMPTY_FILTERS);
    const [staticOptions, setStaticOptions] = useState<any>(null);
    const [cascadingOptions, setCascadingOptions] = useState<any>(null);
    const [cascadeLoading, setCascadeLoading] = useState(false);

    // Search result state
    const [allCandidateIds, setAllCandidateIds] = useState<string[]>([]);
    const [summary, setSummary] = useState({ total: 0, current: 0, past: 0, companies: 0 });
    const [candidates, setCandidates] = useState<any[]>([]);
    const [currentPage, setCurrentPage] = useState(1);

    const [searchLoading, setSearchLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(false);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<AiParseResult["suggestions"]>({});
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const cascadeRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Load static options once
    useEffect(() => {
        void getDemoFilterOptions().then((data) => {
            setStaticOptions(data);
            setOptionsLoading(false);
        });
    }, []);

    // Cascading options — debounced 500ms
    useEffect(() => {
        clearTimeout(cascadeRef.current);
        setCascadeLoading(true);
        cascadeRef.current = setTimeout(() => {
            void getCascadingFilterOptions(pendingFilters).then((data) => {
                setCascadingOptions(data);
                setCascadeLoading(false);
            });
        }, 500);
    }, [pendingFilters]);

    // Fetch page when page number changes (after initial search)
    useEffect(() => {
        if (allCandidateIds.length === 0) return;
        setPageLoading(true);
        void fetchCandidatePage(allCandidateIds, currentPage, PAGE_SIZE).then((data) => {
            setCandidates(data);
            setPageLoading(false);
        });
    }, [currentPage, allCandidateIds]);

    const handleSearch = async (overrideFilters?: DemoFilterState) => {
        const filtersToUse = overrideFilters ?? pendingFilters;
        setSearchLoading(true);
        setHasSearched(true);
        setCurrentPage(1);
        try {
            const result = await searchDemoCandidates(filtersToUse);
            setAllCandidateIds(result.candidateIds);
            setSummary({ total: result.total, current: result.current, past: result.past, companies: result.companies });
            // Fetch page 1
            const page1 = await fetchCandidatePage(result.candidateIds, 1, PAGE_SIZE);
            setCandidates(page1);
        } catch (err) {
            console.error("search error:", err);
            setAllCandidateIds([]);
            setCandidates([]);
            setSummary({ total: 0, current: 0, past: 0, companies: 0 });
        } finally {
            setSearchLoading(false);
        }
    };

    const handleAiSearch = async () => {
        if (!query.trim()) return;
        setAiLoading(true);
        setAiError(null);
        try {
            const { filters: parsed, suggestions: sugg } = await parseQueryToFilters(query.trim());
            // Merge parsed filters (non-empty values override current)
            setPendingFilters((prev) => ({
                ...prev,
                ...(parsed.position_keywords?.length ? { position_keywords: parsed.position_keywords } : {}),
                ...(parsed.position_levels?.length ? { position_levels: parsed.position_levels } : {}),
                ...(parsed.industry_group !== undefined ? { industry_group: parsed.industry_group ?? null } : {}),
                ...(parsed.industries?.length ? { industries: parsed.industries } : {}),
                ...(parsed.regions?.length ? { regions: parsed.regions } : {}),
                ...(parsed.countries?.length ? { countries: parsed.countries } : {}),
                ...(parsed.hotel_ratings?.length ? { hotel_ratings: parsed.hotel_ratings } : {}),
                ...(parsed.current_only !== undefined ? { current_only: parsed.current_only } : {}),
                ...(parsed.job_functions?.length ? { job_functions: parsed.job_functions } : {}),
                ...(parsed.exclude_companies?.length ? { exclude_companies: parsed.exclude_companies } : {}),
                ...(parsed.exclude_countries?.length ? { exclude_countries: parsed.exclude_countries } : {}),
                ...(parsed.exclude_keywords?.length ? { exclude_keywords: parsed.exclude_keywords } : {}),
            }));
            setSuggestions(sugg ?? {});
        } catch (err) {
            setAiError("AI ไม่สามารถแปลง query ได้ ลองพิมพ์ใหม่อีกครั้ง");
            console.error("AI parse error:", err);
        } finally {
            setAiLoading(false);
        }
    };

    const handleAddSuggestion = (key: keyof DemoFilterState, value: string) => {
        setPendingFilters((prev) => {
            const current = prev[key];
            if (Array.isArray(current) && !current.includes(value)) {
                return { ...prev, [key]: [...current, value] };
            }
            return prev;
        });
        // Remove used suggestion from the list
        setSuggestions((prev) => ({
            ...prev,
            [key]: ((prev[key as keyof typeof prev] as string[] | undefined) ?? []).filter((v) => v !== value),
        }));
    };

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleToggleSelectAll = (ids: string[]) => {
        const allSelected = ids.every(id => selectedIds.includes(id));
        setSelectedIds(prev =>
            allSelected ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]
        );
    };

    const handleReset = () => {
        setPendingFilters(EMPTY_FILTERS);
        setAllCandidateIds([]);
        setCandidates([]);
        setSummary({ total: 0, current: 0, past: 0, companies: 0 });
        setCascadingOptions(null);
        setSuggestions({});
        setHasSearched(false);
        setCurrentPage(1);
        setSelectedIds([]);
    };

    const handleAddJobFunction = (fn: string) => {
        if (pendingFilters.job_functions.includes(fn)) {
            handleSearch();
            return;
        }
        const newFilters = { ...pendingFilters, job_functions: [...pendingFilters.job_functions, fn] };
        setPendingFilters(newFilters);
        handleSearch(newFilters);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const activeFilterCount = Object.entries(pendingFilters).reduce((acc, [k, v]) => {
        if (k === "current_only" || k === "age_include_unknown") return acc + (v ? 0 : 0);
        if (k === "industry_group") return acc + (v !== null ? 1 : 0);
        if (k === "age_min" || k === "age_max") return acc; // counted once below
        if (Array.isArray(v)) return acc + v.length;
        return acc;
    }, 0) + ((pendingFilters.age_min !== null || pendingFilters.age_max !== null) ? 1 : 0);

    const isLoading = searchLoading || pageLoading;

    return (
        <>
        <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
            <div className="px-6 pt-4">
                <AtsBreadcrumb items={[{ label: "AI Search Demo" }]} />
            </div>

            {/* Query Input */}
            <div className="px-6 pt-4 pb-3">
                <div className={`bg-white border rounded-xl shadow-sm p-3 flex gap-3 items-end transition-colors ${aiError ? "border-red-300" : "border-slate-200"}`}>
                    <div className="flex-1">
                        <Textarea
                            placeholder='เช่น "Find GM of 4-5 star hotel in Thailand" — AI จะ set filter ให้อัตโนมัติ'
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setAiError(null); }}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiSearch(); } }}
                            rows={2}
                            className="resize-none border-0 shadow-none focus-visible:ring-0 text-sm"
                        />
                        {aiError && <p className="text-xs text-red-500 mt-1">{aiError}</p>}
                    </div>
                    <Button
                        size="sm"
                        className="shrink-0 bg-indigo-600 hover:bg-indigo-700"
                        disabled={!query.trim() || aiLoading}
                        onClick={handleAiSearch}
                    >
                        {aiLoading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Parsing...</> : <><Search className="h-3.5 w-3.5 mr-1.5" />AI Search</>}
                    </Button>
                </div>
            </div>

            {/* Body */}
            <div className="flex gap-4 px-6 pb-6 flex-1 min-h-0">
                {/* Filter Panel */}
                {optionsLoading ? (
                    <div className="w-64 shrink-0 bg-white border border-slate-200 rounded-xl flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <div className="w-64 shrink-0 flex flex-col min-h-0">
                        {/* Scrollable area: filter + suggestions */}
                        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-0.5">
                                    <FilterPanel
                                    staticOptions={staticOptions!}
                                    cascadingOptions={cascadingOptions}
                                    cascadeLoading={cascadeLoading}
                                    filters={pendingFilters}
                                    onChange={setPendingFilters}
                                    onReset={handleReset}
                                    onSearchPositions={(q, f) => searchPositionSuggestions(q, f)}
                                    onSearchCompanies={(q, f) => searchCompanySuggestions(q, f)}
                                />
                            <SuggestedFilters
                                suggestions={suggestions}
                                filters={pendingFilters}
                                onAdd={handleAddSuggestion}
                            />
                        </div>
                        {/* Search button pinned at bottom */}
                        <div className="pt-2 shrink-0">
                            <Button
                                onClick={() => handleSearch()}
                                disabled={searchLoading || activeFilterCount === 0}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
                            >
                                {searchLoading ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching...</>
                                ) : (
                                    <><Search className="h-4 w-4 mr-2" />Search {activeFilterCount > 0 ? `(${activeFilterCount} filters)` : ""}</>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Right side */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-3">
                        <SummaryCard label="Total Found" value={searchLoading ? "..." : summary.total} icon={Users} color="bg-indigo-500" />
                        <SummaryCard label="Currently in Role" value={searchLoading ? "..." : summary.current} icon={TrendingUp} color="bg-emerald-500" />
                        <SummaryCard label="Past Role" value={searchLoading ? "..." : summary.past} icon={Briefcase} color="bg-sky-500" />
                        <SummaryCard label="Companies" value={searchLoading ? "..." : summary.companies} icon={Building2} color="bg-violet-500" />
                    </div>

                    {/* Cohort Insights */}
                    {hasSearched && allCandidateIds.length > 0 && (
                        <CohortInsights candidateIds={allCandidateIds} totalFound={summary.total} onAddJobFunction={handleAddJobFunction} />
                    )}

                    {/* Select-all-results banner */}
                    {(() => {
                        const pageIds = candidates.map(c => c.candidate_id);
                        const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
                        const allResultsSelected = selectedIds.length === allCandidateIds.length && allCandidateIds.length > 0;
                        if (!allPageSelected || allCandidateIds.length <= PAGE_SIZE) return null;
                        return (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm text-indigo-800 flex items-center justify-between">
                                {allResultsSelected
                                    ? <span>เลือกทั้งหมด <strong>{allCandidateIds.length}</strong> candidates แล้ว</span>
                                    : <span>เลือก <strong>{pageIds.length}</strong> คนในหน้านี้แล้ว</span>
                                }
                                <button
                                    onClick={() => allResultsSelected
                                        ? setSelectedIds([])
                                        : setSelectedIds([...allCandidateIds])
                                    }
                                    className="ml-4 font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                                >
                                    {allResultsSelected
                                        ? "ยกเลิกทั้งหมด"
                                        : `เลือกทั้งหมด ${allCandidateIds.length} คน`
                                    }
                                </button>
                            </div>
                        );
                    })()}

                    {/* Candidate Table */}
                    <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-y-auto">
                        {!hasSearched ? (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                เลือก filter แล้วกด Search เพื่อดูผลลัพธ์
                            </div>
                        ) : (
                            <CandidateTableView
                                candidates={candidates}
                                loading={isLoading}
                                selectedIds={selectedIds}
                                onToggleSelect={handleToggleSelect}
                                onToggleSelectAll={handleToggleSelectAll}
                            />
                        )}
                    </div>

                    {/* Pagination + Evaluate */}
                    {hasSearched && summary.total > 0 && (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <p className="text-xs text-slate-500">
                                    แสดง {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, summary.total)} จาก {summary.total} candidates
                                </p>
                                <PaginationControls
                                    currentPage={currentPage}
                                    totalCount={summary.total}
                                    pageSize={PAGE_SIZE}
                                    onPageChange={handlePageChange}
                                />
                            </div>
                            <Button
                                disabled={candidates.length === 0}
                                className="bg-indigo-600 hover:bg-indigo-700 px-6"
                            >
                                ประเมิน Stage 2 & 3
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Floating selection bar */}
        {selectedIds.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700">
                <span className="text-sm font-bold">{selectedIds.length} SELECTED</span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400 uppercase tracking-wide">AI Search Demo</span>
                <Button
                    size="sm"
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-indigo-500 hover:bg-indigo-400 text-white ml-1 gap-1"
                >
                    <Plus className="w-3.5 h-3.5" /> Add to Job Requisition
                </Button>
                <button
                    onClick={() => setSelectedIds([])}
                    className="text-slate-400 hover:text-white transition-colors ml-1"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        )}

        <AddCandidateDialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            candidateIds={selectedIds}
            candidateNames={selectedIds.map(id => candidates.find(c => c.candidate_id === id)?.name ?? "")}
            onSuccess={(jrId) => {
                setSelectedIds([]);
                router.push(`/requisitions/manage?jr_id=${jrId}`);
            }}
        />
        </>
    );
}
