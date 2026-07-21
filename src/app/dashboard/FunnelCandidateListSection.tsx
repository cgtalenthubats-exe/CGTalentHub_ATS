"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Users, Building2, Briefcase, TrendingUp, Loader2, X, Globe,
    ChevronDown, AlertCircle, UserPlus,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CandidateTableView } from "@/app/candidates/list/table-view";
import { AddCandidateDialog } from "@/components/ai-search/AddCandidateDialog";
import { searchDemoCandidates, fetchCandidatePage } from "@/app/actions/ai-search-demo";
import { EMPTY_FILTERS, type DemoFilterState } from "@/app/ai-search-demo/types";
import type { PopulationFilters } from "@/app/actions/candidate-population";

const PAGE_SIZE = 20;
const EMPTY_SUMMARY = { total: 0, current: 0, past: 0, companies: 0, countries: 0 };

// Best-effort translation of the Funnel tab's aggregate filters into the
// ai-search filter shape. set_symbols and job_groupings have no equivalent
// field downstream (search_candidate_ids has no SET-company or job_grouping
// param) and are dropped — surfaced via `droppedFilterNote` below.
//
// current_and_latest: false ("All Experiences" scope) matters here — the
// Funnel RPC counts a candidate if ANY experience row (not just their
// current/latest one) satisfies the active filters, so this list must use
// the same scope or its total undercounts against the Funnel's number.
function mapPopulationFiltersToDemoFilters(f: PopulationFilters): DemoFilterState {
    return {
        ...EMPTY_FILTERS,
        industry_group: f.groups?.[0] ?? null, // DemoFilterState only supports a single Industry Group
        industries: f.industries ?? [],
        regions: f.continents ?? [],
        countries: f.countries ?? [],
        position_keywords: f.position_keywords ?? [],
        hotel_chains: f.hotel_chains ?? [],
        job_functions: f.job_functions ?? [],
        current_and_latest: false,
    };
}

function hasMappedFilter(f: DemoFilterState): boolean {
    return (
        f.industry_group !== null ||
        f.industries.length > 0 ||
        f.regions.length > 0 ||
        f.countries.length > 0 ||
        f.position_keywords.length > 0 ||
        f.hotel_chains.length > 0 ||
        f.job_functions.length > 0
    );
}

// --- Sub-filter dropdown — copied verbatim from ai-search-demo/page.tsx & ai-search-v3/page.tsx ---
function SubMSFilter({ label, options, selected, setSelected }: {
    label: string; options: string[]; selected: string[]; setSelected: (v: string[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) { setPending([...selected]); setSearch(""); }
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

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
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

function getScopedExps(c: any) {
    const exps: any[] = c.experiences ?? [];
    const cur = exps.find((e: any) => e.is_current_job === "Current");
    return cur ? [cur] : exps.slice(0, 1);
}

// The candidate-list part of ai-search-v3 (summary cards + sub-filter bar +
// table + pagination), live-synced to the Candidate Funnel tab's own
// filters — no separate FilterPanel here, the Funnel tab above IS the filter.
export default function FunnelCandidateListSection({ filters: populationFilters }: { filters: PopulationFilters }) {
    const [filters, setFilters] = useState<DemoFilterState>(EMPTY_FILTERS);
    const [allCandidateIds, setAllCandidateIds] = useState<string[]>([]);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [allCandidatesData, setAllCandidatesData] = useState<any[]>([]);
    const [allDataLoading, setAllDataLoading] = useState(false);
    const [summary, setSummary] = useState(EMPTY_SUMMARY);
    const [currentPage, setCurrentPage] = useState(1);
    const [searching, setSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [droppedFilterNote, setDroppedFilterNote] = useState<string | null>(null);

    const [subSearch, setSubSearch] = useState("");
    const [subPosition, setSubPosition] = useState<string[]>([]);
    const [subCompany, setSubCompany] = useState<string[]>([]);
    const [subCountry, setSubCountry] = useState<string[]>([]);
    const [subNationality, setSubNationality] = useState<string[]>([]);
    const [subGender, setSubGender] = useState<string[]>([]);
    const [subHotelRating, setSubHotelRating] = useState<string[]>([]);
    const hasSubFilter = !!(subSearch || subPosition.length || subCompany.length || subCountry.length || subNationality.length || subGender.length || subHotelRating.length);
    const clearSubFilters = () => { setSubSearch(""); setSubPosition([]); setSubCompany([]); setSubCountry([]); setSubNationality([]); setSubGender([]); setSubHotelRating([]); };

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [addDialogOpen, setAddDialogOpen] = useState(false);

    const subOptions = React.useMemo(() => {
        const uniq = (arr: (string | null | undefined)[]) => Array.from(new Set(arr.filter(Boolean))).sort() as string[];
        const src = allCandidatesData.length > 0 ? allCandidatesData : candidates;
        return {
            positions: uniq(src.flatMap(c => getScopedExps(c).map((e: any) => e.position))),
            companies: uniq(src.flatMap(c => getScopedExps(c).map((e: any) => e.company))),
            countries: uniq(src.flatMap(c => getScopedExps(c).map((e: any) => e.country))),
            nationalities: uniq(src.map(c => c.nationality)),
            genders: uniq(src.map(c => c.gender)),
            hotelRatings: uniq(src.flatMap(c => getScopedExps(c).map((e: any) => e.hotel_rating))),
        };
    }, [allCandidatesData, candidates]);

    const applySubFilter = useCallback((data: any[]) => {
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
    }, [subSearch, subPosition, subCompany, subCountry, subNationality, subGender, subHotelRating]);

    const sourceData = hasSubFilter && allCandidatesData.length > 0 ? allCandidatesData : candidates;
    const allFiltered = React.useMemo(() => applySubFilter(sourceData), [applySubFilter, sourceData]);
    const displayCandidates = React.useMemo(() => {
        if (!hasSubFilter) return candidates;
        const start = (currentPage - 1) * PAGE_SIZE;
        return allFiltered.slice(start, start + PAGE_SIZE);
    }, [hasSubFilter, candidates, allFiltered, currentPage]);

    const runSearch = useCallback(async (f: DemoFilterState) => {
        setSearching(true);
        setHasSearched(true);
        setCurrentPage(1);
        try {
            const result = await searchDemoCandidates(f);
            setAllCandidateIds(result.candidateIds);
            setAllCandidatesData([]);
            clearSubFilters();
            setSummary({ total: result.total, current: result.current, past: result.past, companies: result.companies, countries: result.countries ?? 0 });
            const page1 = await fetchCandidatePage(result.candidateIds.slice(0, PAGE_SIZE), 1, PAGE_SIZE);
            setCandidates(page1);
            if (result.candidateIds.length > 0) {
                setAllDataLoading(true);
                void fetchCandidatePage(result.candidateIds, 1, result.candidateIds.length).then(all => {
                    setAllCandidatesData(all);
                    setAllDataLoading(false);
                });
            }
        } catch (err) {
            console.error("Funnel candidate list search error:", err);
            setAllCandidateIds([]);
            setCandidates([]);
            setSummary(EMPTY_SUMMARY);
        } finally {
            setSearching(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Live-sync: re-search every time the Funnel tab's own filters change —
    // this section has no filter controls of its own.
    useEffect(() => {
        const mapped = mapPopulationFiltersToDemoFilters(populationFilters);
        setFilters(mapped);

        const droppedSet = !!populationFilters.set_symbols?.length;
        const droppedGrouping = !!populationFilters.job_groupings?.length;
        setDroppedFilterNote(
            droppedSet && droppedGrouping ? "SET Company and Job Grouping filters aren't carried over into this list."
            : droppedSet ? "SET Company filter isn't carried over into this list."
            : droppedGrouping ? "Job Grouping filter isn't carried over into this list."
            : null
        );

        if (hasMappedFilter(mapped)) {
            void runSearch(mapped);
        } else {
            setHasSearched(false);
            setCandidates([]);
            setAllCandidateIds([]);
            setSummary(EMPTY_SUMMARY);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [populationFilters, runSearch]);

    // Fetch page when page number changes
    useEffect(() => {
        if (allCandidateIds.length === 0) return;
        const pageIds = allCandidateIds.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
        void fetchCandidatePage(pageIds, 1, PAGE_SIZE).then(setCandidates);
    }, [currentPage, allCandidateIds]);

    const totalPages = Math.max(1, Math.ceil((hasSubFilter ? allFiltered.length : summary.total) / PAGE_SIZE));

    return (
        <div id="funnel-candidate-list" className="flex flex-col gap-3 scroll-mt-4">
            <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Candidates matching current filters</h2>
            </div>
            {droppedFilterNote && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 w-fit">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{droppedFilterNote}</span>
                </div>
            )}

            {hasSearched ? (
                <>
                    <div className="grid grid-cols-5 gap-3 shrink-0">
                        <SummaryCard label="Total Found" value={searching ? "…" : summary.total} icon={Users} color="bg-indigo-500" />
                        <SummaryCard label="Currently in Role" value={searching ? "…" : summary.current} icon={TrendingUp} color="bg-emerald-500" />
                        <SummaryCard label="Past Role" value={searching ? "…" : summary.past} icon={Briefcase} color="bg-sky-500" />
                        <SummaryCard label="Companies" value={searching ? "…" : summary.companies} icon={Building2} color="bg-violet-500" />
                        <SummaryCard label="Countries" value={searching ? "…" : summary.countries} icon={Globe} color="bg-teal-500" />
                    </div>

                    {candidates.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mr-1">Filters:</span>
                            <SubMSFilter label="Position" options={subOptions.positions} selected={subPosition} setSelected={setSubPosition} />
                            <SubMSFilter label="Company" options={subOptions.companies} selected={subCompany} setSelected={setSubCompany} />
                            <SubMSFilter label="Country" options={subOptions.countries} selected={subCountry} setSelected={setSubCountry} />
                            <SubMSFilter label="Nationality" options={subOptions.nationalities} selected={subNationality} setSelected={setSubNationality} />
                            <SubMSFilter label="Gender" options={subOptions.genders} selected={subGender} setSelected={setSubGender} />
                            <SubMSFilter label="Hotel Rating" options={subOptions.hotelRatings} selected={subHotelRating} setSelected={setSubHotelRating} />
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

                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        <div className="px-4 py-2.5 border-b flex items-center justify-between shrink-0">
                            <span className="text-sm font-bold text-slate-700">
                                {searching
                                    ? <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />Searching...</span>
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
                        <CandidateTableView
                            candidates={displayCandidates}
                            loading={searching}
                            selectedIds={selectedIds}
                            onToggleSelect={(id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
                            onToggleSelectAll={(ids) => setSelectedIds(ids)}
                            showHotelColumn={filters.hotel_ratings.length > 0 || filters.hotel_chains.length > 0}
                        />
                        {totalPages > 1 && (
                            <div className="px-4 py-2.5 border-t flex items-center justify-between shrink-0">
                                <span className="text-xs text-slate-500">Page {currentPage} of {totalPages}</span>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Prev</Button>
                                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="bg-white rounded-xl border shadow-sm flex items-center justify-center text-slate-400 py-16 text-sm">
                    No filters carried over into the candidate list — refine the filters above (e.g. Country, Industry, Position Keyword, Hotel Chain, Job Function).
                </div>
            )}

            <AddCandidateDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                candidateIds={selectedIds}
                candidateNames={selectedIds.map(id => candidates.find(c => c.candidate_id === id)?.name ?? "")}
                onSuccess={() => setSelectedIds([])}
            />
        </div>
    );
}
