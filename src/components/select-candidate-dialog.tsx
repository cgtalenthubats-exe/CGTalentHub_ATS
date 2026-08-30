"use client";

import React, { useState, useEffect } from "react";
import { Search, Loader2, Briefcase, Building2, MapPin, User, Filter, Tags } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { AsyncFilterMultiSelect } from "@/components/ui/async-filter-multi-select";
import { searchCompanies, searchPositions } from "@/app/actions/candidate-filters";
import { cn } from "@/lib/utils";

export interface PickedCandidate {
    candidate_id: string;
    name: string;
}

interface SelectCandidateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (candidate: PickedCandidate) => void;
    title?: string;
    description?: string;
}

type FilterState = {
    positions: string[];
    companies: string[];
    countries: string[];
    industries: string[];
    genders: string[];
    statuses: string[];
};

const EMPTY_FILTERS: FilterState = { positions: [], companies: [], countries: [], industries: [], genders: [], statuses: [] };

function toggle(arr: string[], value: string): string[] {
    return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
}

// Single-pick candidate search — same search/filter/list look as
// AddCandidateDialog (JR Manage's "Add Candidates to Pipeline"), reusing the
// same /api/candidates/search + /api/candidates/filters endpoints, but
// simplified to a single click-to-pick row instead of checkbox multi-select
// + bulk push. Shows the default pool immediately on open, same as JR
// Manage's dialog — search/filters narrow it rather than gating it.
export function SelectCandidateDialog({ open, onOpenChange, onSelect, title = "Select Candidate", description = "Search and pick a candidate to continue." }: SelectCandidateDialogProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [totalResults, setTotalResults] = useState(0);
    const [page, setPage] = useState(1);
    const [searching, setSearching] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
    const [options, setOptions] = useState<{ countries: string[]; industries: string[]; genders: string[]; statuses: string[] }>({
        countries: [], industries: [], genders: [], statuses: [],
    });

    useEffect(() => {
        if (!open) {
            setSearchQuery("");
            setResults([]);
            setShowFilters(false);
            setFilters(EMPTY_FILTERS);
            return;
        }
        fetch('/api/candidates/filters').then(r => r.json()).then(setOptions).catch(e => console.error("Failed to load filters", e));
    }, [open]);

    const fetchCandidates = async (pageNum: number, replace: boolean) => {
        if (replace) setSearching(true); else setLoadingMore(true);
        try {
            const res = await fetch('/api/candidates/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    search: searchQuery.trim(),
                    filters: {
                        position: filters.positions,
                        company: filters.companies,
                        country: filters.countries,
                        industry: filters.industries,
                        gender: filters.genders,
                        status: filters.statuses,
                    },
                    page: pageNum,
                    pageSize: 20,
                }),
            });
            const data = await res.json();
            setResults(prev => replace ? (data.data || []) : [...prev, ...(data.data || [])]);
            setTotalResults(data.total || 0);
            setPage(pageNum);
        } catch (e) {
            console.error("Candidate search failed", e);
        } finally {
            setSearching(false);
            setLoadingMore(false);
        }
    };

    // Debounced — fires immediately on open (empty search + empty filters is a
    // valid query, same as JR Manage's dialog showing its default pool).
    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(() => fetchCandidates(1, true), 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, searchQuery, filters]);

    const handleLoadMore = () => {
        if (!loadingMore && results.length < totalResults) fetchCandidates(page + 1, false);
    };

    const activeFilterCount = Object.values(filters).reduce((n, v) => n + v.length, 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-indigo-500" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            autoFocus
                            placeholder="Search by name, ID, position, or company..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-10 bg-white border-slate-200 rounded-xl"
                        />
                    </div>
                    <Button
                        variant={showFilters ? "secondary" : "outline"}
                        size="icon"
                        className={cn("shrink-0 h-10 w-10 rounded-xl relative", showFilters && "bg-primary text-white hover:bg-primary/90")}
                        onClick={() => setShowFilters(v => !v)}
                    >
                        <Filter className="h-4 w-4" />
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] font-bold flex items-center justify-center bg-rose-500 text-white border-2 border-white rounded-full">
                                {activeFilterCount}
                            </span>
                        )}
                    </Button>
                </div>

                {showFilters && (
                    <div className="flex flex-wrap gap-2 items-center pb-1 animate-in slide-in-from-top-2 duration-200">
                        <AsyncFilterMultiSelect
                            label="Position" icon={Briefcase}
                            selected={filters.positions}
                            onChange={v => setFilters(prev => ({ ...prev, positions: v }))}
                            fetcher={searchPositions}
                            placeholder="Search Position..."
                        />
                        <AsyncFilterMultiSelect
                            label="Company" icon={Building2}
                            selected={filters.companies}
                            onChange={v => setFilters(prev => ({ ...prev, companies: v }))}
                            fetcher={searchCompanies}
                            placeholder="Search Company..."
                        />
                        <FilterMultiSelect label="Country" icon={MapPin} options={options.countries} selected={filters.countries} onChange={v => setFilters(prev => ({ ...prev, countries: toggle(prev.countries, v) }))} />
                        <FilterMultiSelect label="Industry" icon={Briefcase} options={options.industries} selected={filters.industries} onChange={v => setFilters(prev => ({ ...prev, industries: toggle(prev.industries, v) }))} />
                        <FilterMultiSelect label="Gender" icon={User} options={options.genders} selected={filters.genders} onChange={v => setFilters(prev => ({ ...prev, genders: toggle(prev.genders, v) }))} />
                        <FilterMultiSelect label="Status" icon={Tags} options={options.statuses} selected={filters.statuses} onChange={v => setFilters(prev => ({ ...prev, statuses: toggle(prev.statuses, v) }))} />
                    </div>
                )}

                {results.length > 0 && !searching && (
                    <div className="flex items-center gap-2 pb-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">{results.length} of {totalResults.toLocaleString()} results</p>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto min-h-[300px]">
                    {searching ? (
                        <div className="flex flex-col items-center justify-center h-full py-16 gap-3 opacity-70">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm font-bold text-slate-600">Searching...</p>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-16 gap-2 text-slate-400">
                            <Search className="h-8 w-8 opacity-20" />
                            <span className="text-xs">No matching candidates</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 pb-2 pt-1">
                            {results.map((c) => (
                                <div
                                    key={c.candidate_id}
                                    onClick={() => onSelect({ candidate_id: c.candidate_id, name: c.name })}
                                    className={cn(
                                        "group flex items-start gap-4 p-3 rounded-xl border transition-all cursor-pointer",
                                        "border-slate-100 bg-white hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 shadow-sm"
                                    )}
                                >
                                    <Avatar className="h-11 w-11 border-2 border-white shadow-md flex-shrink-0 group-hover:scale-105 transition-transform">
                                        <AvatarImage src={c.photo} />
                                        <AvatarFallback className="bg-slate-100 font-black text-slate-400">{c.name?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className="text-sm font-black truncate text-slate-800">{c.name}</p>
                                            <Badge variant="secondary" className="text-[10px] font-mono font-bold h-5 bg-slate-100 text-slate-600 border-slate-200">{c.candidate_id}</Badge>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-500 font-bold">
                                            <div className="flex items-center gap-1.5 truncate text-slate-700/80">
                                                <Briefcase className="h-3 w-3 text-primary/50 shrink-0" />
                                                {c.job_function || "Position N/A"}
                                            </div>
                                            <div className="flex items-center gap-1.5 truncate text-slate-700/80 col-span-2 md:col-span-1">
                                                <Building2 className="h-3 w-3 text-indigo-500/50 shrink-0" />
                                                {c.experiences?.[0]?.company || c.company || "Company N/A"}
                                            </div>
                                            <div className="flex items-center gap-1.5 truncate">
                                                <MapPin className="h-3 w-3 text-emerald-500/50 shrink-0" />
                                                {c.nationality || "Country N/A"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {results.length < totalResults && (
                                <div className="flex justify-center pt-2 pb-1">
                                    <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore} className="min-w-[120px]">
                                        {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load More"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
