"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Search,
    UserPlus,
    Check,
    Loader2,
    X,
    Filter,
    Briefcase,
    MapPin,
    User,
    Tags,
    ChevronDown,
    AlertCircle,
    Building2,
    CheckCircle2
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import { searchCandidates } from "@/app/actions/candidate";
import { addCandidatesToJR, getExistingCandidateIdsForJR } from "@/app/actions/jr-candidates";
import { SmartCandidateSearch } from "@/components/smart-candidate-search";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AddCandidateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jrId: string;
    onSuccess: () => void;
}

export function AddCandidateDialog({ open, onOpenChange, jrId, onSuccess }: AddCandidateDialogProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [existingIds, setExistingIds] = useState<string[]>([]);
    const [listType, setListType] = useState("Longlist");
    const [submitting, setSubmitting] = useState(false);

    // Blacklist Alert State
    const [showBlacklistAlert, setShowBlacklistAlert] = useState(false);
    const [blacklistedInSelection, setBlacklistedInSelection] = useState<any[]>([]);

    // Filters
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        countries: [] as string[],
        industries: [] as string[],
        positions: [] as string[],
        companies: [] as string[],
        jobFunctions: [] as string[],
        statuses: [] as string[],
        genders: [] as string[],
        ageMin: "",
        ageMax: ""
    });

    const [options, setOptions] = useState<any>({
        countries: [], industries: [], positions: [], companies: [], jobFunctions: [], statuses: [], genders: []
    });

    // Fetch filters and existing candidates on open
    useEffect(() => {
        if (open) {
            const fetchData = async () => {
                // 1. Fetch filter options
                try {
                    const res = await fetch('/api/candidates/filters');
                    const data = await res.json();
                    setOptions(data);
                } catch (e) {
                    console.error("Failed to load filters", e);
                }

                // 2. Fetch existing candidates for this JR
                const existing = await getExistingCandidateIdsForJR(jrId);
                setExistingIds(existing);
            };
            fetchData();
        }
    }, [open, jrId]);

    // Search Logic (Debounced)
    useEffect(() => {
        // DEBUG LOG
        console.log("AddCandidateDialog: Search Effect Triggered", { searchQuery, filters });

        const timer = setTimeout(async () => {
            console.log("AddCandidateDialog: Debounce Timeout Executing", { searchQuery, len: searchQuery.trim().length });

            if (searchQuery.trim().length >= 2 || Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v)) {
                console.log("AddCandidateDialog: Starting Search...");
                setSearching(true);
                try {
                    // We use the same API as Candidate Explorer for consistency
                    const res = await fetch('/api/candidates/search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            search: searchQuery.trim(),
                            filters: {
                                country: filters.countries,
                                position: filters.positions,
                                industry: filters.industries,
                                company: filters.companies,
                                status: filters.statuses,
                                gender: filters.genders,
                                jobFunction: filters.jobFunctions,
                                ageMin: filters.ageMin ? parseInt(filters.ageMin) : undefined,
                                ageMax: filters.ageMax ? parseInt(filters.ageMax) : undefined,
                            },
                            pageSize: 20
                        })
                    });
                    const data = await res.json();
                    console.log("AddCandidateDialog: Search Results", data.data?.length);
                    setResults(data.data || []);
                } catch (e) {
                    console.error("Search failed", e);
                } finally {
                    setSearching(false);
                }
            } else {
                console.log("AddCandidateDialog: Clearing Results");
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery, filters]);

    const handleToggle = (id: string) => {
        if (existingIds.includes(id)) return;
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        const newlySelectable = results
            .filter(c => !existingIds.includes(c.candidate_id))
            .map(c => c.candidate_id);

        if (newlySelectable.every(id => selectedIds.includes(id))) {
            // Deselect all from current results
            setSelectedIds(prev => prev.filter(id => !newlySelectable.includes(id)));
        } else {
            // Select all from current results
            setSelectedIds(prev => Array.from(new Set([...prev, ...newlySelectable])));
        }
    };

    const handleAdd = async (force: boolean = false) => {
        if (selectedIds.length === 0) return;

        // Check for Blacklisted candidates if not forced
        if (!force) {
            const blacklisted = results.filter(c => selectedIds.includes(c.candidate_id) && c.candidate_status === "Blacklist");
            if (blacklisted.length > 0) {
                setBlacklistedInSelection(blacklisted);
                setShowBlacklistAlert(true);
                return;
            }
        }

        setSubmitting(true);
        const { success, error } = await addCandidatesToJR(jrId, selectedIds, listType);
        setSubmitting(false);

        if (success) {
            toast.success(`Successfully added ${selectedIds.length} candidate(s)`);
            onSuccess();
            onOpenChange(false);
            setSelectedIds([]);
            setSearchQuery("");
            setFilters({
                countries: [], industries: [], positions: [], companies: [], jobFunctions: [], statuses: [], genders: [], ageMin: "", ageMax: ""
            });
        } else {
            toast.error("Error: " + error);
        }
    };

    const handleSkipBlacklisted = () => {
        const blacklistIds = blacklistedInSelection.map(c => c.candidate_id);
        const filteredIds = selectedIds.filter(id => !blacklistIds.includes(id));

        if (filteredIds.length === 0) {
            setSelectedIds([]);
            setShowBlacklistAlert(false);
            toast.info("All selected candidates were blacklisted and have been skipped.");
            return;
        }

        // Proceed with filtered IDs
        setSelectedIds(filteredIds);
        setShowBlacklistAlert(false);
        // We can't call handleAdd immediately because selectedIds state update might not be reflected yet
        // So we call it with the manual filtered list
        proceedWithFiltered(filteredIds);
    };

    const proceedWithFiltered = async (ids: string[]) => {
        setSubmitting(true);
        const { success, error } = await addCandidatesToJR(jrId, ids, listType);
        setSubmitting(false);
        if (success) {
            toast.success(`Successfully added ${ids.length} candidate(s) (Skipped blacklisted)`);
            onSuccess();
            onOpenChange(false);
            setSelectedIds([]);
            setSearchQuery("");
        } else {
            toast.error("Error: " + error);
        }
    };

    const toggleFilter = (key: keyof typeof filters, value: string) => {
        setFilters(prev => {
            const current = (prev[key] as string[]);
            const updated = current.includes(value)
                ? current.filter(item => item !== value)
                : [...current, value];
            return { ...prev, [key]: updated };
        });
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-3xl overflow-hidden flex flex-col max-h-[96vh] p-0 border-none shadow-2xl rounded-2xl">
                    <DialogHeader className="p-7 pb-5 bg-gradient-to-r from-indigo-50/80 to-slate-50/50 dark:from-slate-900 dark:to-slate-950 border-b">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1.5">
                                <DialogTitle className="flex items-center gap-2.5 text-2xl font-black text-slate-800 dark:text-slate-100">
                                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                        <UserPlus className="h-6 w-6" />
                                    </div>
                                    Add Candidates to Pipeline
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 font-medium">
                                    Advanced multi-layered search & selection tool.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="px-7 py-5 flex flex-col gap-4 bg-white dark:bg-slate-950 border-b shadow-sm z-10">
                        <div className="flex gap-3">
                            <div className="flex-1 relative group z-20">
                                <SmartCandidateSearch
                                    onSearch={(term, type) => {
                                        if (type === 'global') {
                                            setSearchQuery(term);
                                        } else if (type === 'company') {
                                            setFilters(prev => ({
                                                ...prev,
                                                companies: prev.companies.includes(term) ? prev.companies : [...prev.companies, term]
                                            }));
                                            setSearchQuery("");
                                            setShowFilters(true);
                                        } else if (type === 'position') {
                                            setFilters(prev => ({
                                                ...prev,
                                                positions: prev.positions.includes(term) ? prev.positions : [...prev.positions, term]
                                            }));
                                            setSearchQuery("");
                                            setShowFilters(true);
                                        }
                                    }}
                                    onRawQueryChange={setSearchQuery}
                                    filters={filters}
                                    placeholder={searchQuery || "Search Name, Email, ID, Company..."}
                                    className="h-12 [&_button]:h-12 [&_button]:text-base [&_button]:rounded-xl [&_button]:bg-slate-50 [&_button]:border-slate-200 [&_button]:border-solid [&_button]:hover:bg-slate-100 [&_button]:text-slate-600 [&_button]:font-medium"
                                />
                            </div>
                            <Button
                                variant={showFilters ? "secondary" : "outline"}
                                className={cn(
                                    "shrink-0 h-12 w-12 rounded-xl group relative overflow-hidden transition-all",
                                    showFilters ? "bg-primary text-white hover:bg-primary/90" : "border-slate-200"
                                )}
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                <Filter className="h-5 w-5" />
                                {Object.values(filters).some(f => Array.isArray(f) && f.length > 0) && (
                                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full" />
                                )}
                            </Button>
                        </div>

                        {showFilters && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1 animate-in slide-in-from-top-3 duration-300">
                                <FilterSelect label="Position" icon={Briefcase} options={options.positions} selected={filters.positions} onChange={(v: string) => toggleFilter('positions', v)} />
                                <FilterSelect label="Company" icon={Building2} options={options.companies} selected={filters.companies} onChange={(v: string) => toggleFilter('companies', v)} />
                                <FilterSelect label="Country" icon={MapPin} options={options.countries} selected={filters.countries} onChange={(v: string) => toggleFilter('countries', v)} />
                                <FilterSelect label="Industry" icon={Briefcase} options={options.industries} selected={filters.industries} onChange={(v: string) => toggleFilter('industries', v)} />
                                <FilterSelect label="Gender" icon={User} options={options.genders} selected={filters.genders} onChange={(v: string) => toggleFilter('genders', v)} />
                                <FilterSelect label="Status" icon={Tags} options={options.statuses} selected={filters.statuses} onChange={(v: string) => toggleFilter('statuses', v)} />
                                <FilterSelect label="Function" icon={Briefcase} options={options.jobFunctions} selected={filters.jobFunctions} onChange={(v: string) => toggleFilter('jobFunctions', v)} />
                            </div>
                        )}

                        {results.length > 0 && !searching && (
                            <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                    <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                                        {results.length} results matching criteria
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-[11px] uppercase font-black text-primary hover:bg-primary/10 transition-colors"
                                    onClick={handleSelectAll}
                                >
                                    {results.every(c => selectedIds.includes(c.candidate_id) || existingIds.includes(c.candidate_id))
                                        ? "Deselect All From View" : "Select All Available"}
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto px-7 py-3 min-h-[400px] bg-slate-50/40 dark:bg-slate-900/20">
                        {searching ? (
                            <div className="flex flex-col items-center justify-center h-full py-20 gap-4 opacity-70">
                                <div className="relative">
                                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                    <Search className="h-5 w-5 text-primary/40 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                </div>
                                <p className="text-sm font-bold text-slate-600 animate-pulse">Scanning Talent Pool...</p>
                            </div>
                        ) : results.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2.5 pb-8 pt-1">
                                {results.map((c) => {
                                    const isExisting = existingIds.includes(c.candidate_id);
                                    const isSelected = selectedIds.includes(c.candidate_id);
                                    return (
                                        <div
                                            key={c.candidate_id}
                                            className={cn(
                                                "group flex items-start gap-4 p-4 rounded-xl border transition-all relative overflow-hidden",
                                                isExisting ? "border-slate-100 bg-slate-50/50 opacity-60 cursor-not-allowed" :
                                                    isSelected ? "border-primary/40 bg-white ring-2 ring-primary/20 shadow-md translate-x-1" :
                                                        "border-slate-100 bg-white hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 cursor-pointer shadow-sm"
                                            )}
                                            onClick={() => handleToggle(c.candidate_id)}
                                        >
                                            <div className="mt-1">
                                                <div className={cn(
                                                    "h-5 w-5 rounded-md border flex items-center justify-center transition-all",
                                                    isSelected ? "bg-primary border-primary scale-110 shadow-lg shadow-primary/20" : "border-slate-300 bg-white",
                                                    isExisting && "hidden"
                                                )}>
                                                    {isSelected && <Check className="h-3.5 w-3.5 text-white stroke-[3px]" />}
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <Avatar className="h-12 w-12 border-2 border-white shadow-md flex-shrink-0 group-hover:scale-105 transition-transform">
                                                    <AvatarImage src={c.photo} />
                                                    <AvatarFallback className="bg-slate-100 font-black text-slate-400">{c.name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                {isSelected && !isExisting && (
                                                    <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-white rounded-full p-1 animate-in zoom-in">
                                                        <Check className="h-2 w-2 text-white stroke-[4px]" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className={cn("text-base font-black truncate transition-colors", isSelected ? "text-primary" : "text-slate-800")}>{c.name}</p>
                                                    <Badge variant="secondary" className="text-sm font-mono font-bold h-6 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 shadow-sm px-2">{c.candidate_id}</Badge>
                                                    {isExisting && (
                                                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[10px] font-bold h-5 animate-in fade-in slide-in-from-left-1">
                                                            Pipeline Active
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-500 font-bold">
                                                    <div className="flex items-center gap-2 truncate text-slate-700/80">
                                                        <Briefcase className="h-3.5 w-3.5 text-primary/50 shrink-0" />
                                                        {c.job_function || "Position N/A"}
                                                    </div>
                                                    <div className="flex items-center gap-2 truncate">
                                                        <MapPin className="h-3.5 w-3.5 text-emerald-500/50 shrink-0" />
                                                        {c.nationality || "Country N/A"}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-3.5 w-3.5 text-blue-500/50 shrink-0" />
                                                        <span>{c.age ? `${c.age} yrs` : "Age N/A"} • {c.gender?.charAt(0) || "-"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {isSelected && !isExisting && (
                                                <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-primary animate-in slide-in-from-right duration-300" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (searchQuery.length >= 2 || Object.values(filters).some(v => Array.isArray(v) && v.length > 0)) ? (
                            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                                <div className="p-4 rounded-full bg-slate-100 mb-4">
                                    <X className="h-10 w-10 opacity-40" />
                                </div>
                                <p className="text-base font-black text-slate-600">No Talent Found</p>
                                <p className="text-sm font-medium mt-1">Try expanding your search parameters</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-24 text-slate-300">
                                <div className="relative mb-6">
                                    <Search className="h-20 w-20 opacity-10" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="h-3 w-3 rounded-full bg-primary/20 animate-ping" />
                                    </div>
                                </div>
                                <p className="text-sm font-black italic tracking-wide text-center px-12 opacity-60">Ready for search across total database...</p>
                            </div>
                        )}
                    </div>

                    {/* TWO-STEP ACTION FOOTER */}
                    <DialogFooter className={cn(
                        "p-7 border-t flex flex-col sm:flex-row items-center gap-5 transition-all duration-500",
                        selectedIds.length > 0 ? "bg-primary/[0.03] animate-in fade-in" : "bg-white dark:bg-slate-950"
                    )}>
                        <div className="flex-1 w-full sm:w-auto">
                            {selectedIds.length > 0 ? (
                                <div className="flex items-center gap-4 animate-in zoom-in duration-300">
                                    <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-lg shadow-xl shadow-primary/30 relative">
                                        {selectedIds.length}
                                        <CheckCircle2 className="h-5 w-5 text-white absolute -top-1.5 -right-1.5 bg-green-500 rounded-full p-0.5 border-2 border-primary shadow-sm" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[11px] font-black text-primary uppercase tracking-[0.1em]">Talent Selection Active</p>
                                        <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                                            Assigning {selectedIds.length} profiles...
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 text-slate-400 font-bold bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                                    <AlertCircle className="h-4 w-4" />
                                    <span className="text-xs uppercase tracking-wider">Select profiles to unlock action</span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                            {selectedIds.length > 0 && (
                                <select
                                    className="h-11 w-full sm:w-[180px] px-4 rounded-xl bg-white border-2 border-primary ring-0 text-sm font-black text-primary focus:outline-none focus:ring-4 focus:ring-primary/10 animate-in fade-in slide-in-from-right-3 duration-500 cursor-pointer shadow-lg shadow-primary/5 transition-all hover:scale-[1.02]"
                                    value={listType}
                                    onChange={(e) => setListType(e.target.value)}
                                >
                                    <option value="Longlist">Longlist Pipeline</option>
                                    <option value="Top profile">Top Profile Star</option>
                                </select>
                            )}
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Button
                                    variant="outline"
                                    className="h-11 px-6 rounded-xl bg-white border-slate-200 hover:bg-slate-50 font-bold dark:bg-slate-900"
                                    onClick={() => onOpenChange(false)}
                                    disabled={submitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    disabled={selectedIds.length === 0 || submitting}
                                    className="h-11 px-10 rounded-xl shadow-2xl shadow-primary/40 font-black text-sm uppercase tracking-wider min-w-[150px] transition-all hover:scale-[1.02] active:scale-95"
                                    onClick={() => handleAdd(false)}
                                >
                                    {submitting ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        `Push to JR`
                                    )}
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Blacklist Warning Dialog */}
            <Dialog open={showBlacklistAlert} onOpenChange={setShowBlacklistAlert}>
                <DialogContent className="sm:max-w-md border-none shadow-2xl rounded-2xl overflow-hidden p-0">
                    <DialogHeader className="p-8 pb-4 bg-rose-50 border-b border-rose-100">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-200 animate-pulse">
                                <AlertCircle className="h-8 w-8 stroke-[3px]" />
                            </div>
                            <DialogTitle className="text-2xl font-black text-rose-700 uppercase tracking-tight">
                                Blacklist Warning!
                            </DialogTitle>
                        </div>
                    </DialogHeader>
                    <div className="p-8 space-y-4">
                        <p className="text-base font-bold text-slate-700 leading-relaxed">
                            You have selected <span className="text-rose-600 font-black">{blacklistedInSelection.length}</span> candidate(s) that are currently <span className="underline decoration-rose-500 decoration-4">Blacklisted</span>.
                        </p>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 max-h-40 overflow-y-auto">
                            {blacklistedInSelection.map(c => (
                                <div key={c.candidate_id} className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
                                    <div>
                                        <p className="text-sm font-black text-slate-800">{c.name}</p>
                                        <p className="text-xs font-medium text-rose-500 italic">Note: {c.blacklist_note || "No reason provided"}</p>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] font-mono border-rose-200 text-rose-600 uppercase">Blacklist</Badge>
                                </div>
                            ))}
                        </div>
                        <p className="text-sm font-medium text-slate-500">
                            How would you like to proceed?
                        </p>
                    </div>
                    <DialogFooter className="p-8 pt-4 bg-slate-50/50 border-t flex flex-col sm:flex-row gap-3">
                        <Button
                            variant="ghost"
                            className="flex-1 h-12 rounded-xl font-bold text-slate-500 hover:bg-slate-100"
                            onClick={() => setShowBlacklistAlert(false)}
                        >
                            Cancel
                        </Button>
                        <div className="flex flex-col sm:flex-row gap-2 flex-[2]">
                            <Button
                                variant="secondary"
                                className="flex-1 h-12 rounded-xl font-black text-slate-700 border-2 border-slate-200 hover:bg-slate-100"
                                onClick={handleSkipBlacklisted}
                            >
                                Skip & Continue
                            </Button>
                            <Button
                                className="flex-1 h-12 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-lg shadow-rose-100"
                                onClick={() => {
                                    setShowBlacklistAlert(false);
                                    handleAdd(true);
                                }}
                            >
                                Add Anyway
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// Helper Filter Component
function FilterSelect({ label, icon: Icon, options = [], selected, onChange }: any) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(
                    "h-8 gap-1.5 border-dashed text-[10px] font-bold uppercase tracking-tight",
                    selected.length > 0 && "border-primary text-primary bg-primary/5"
                )}>
                    <Icon className="h-3 w-3" />
                    {label}
                    {selected.length > 0 && (
                        <span className="ml-1 px-1 bg-primary text-white rounded-sm text-[8px]">{selected.length}</span>
                    )}
                    <ChevronDown className="h-3 w-3 opacity-30 ml-auto" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[180px]" align="start">
                <Command>
                    <CommandInput placeholder={label} className="h-8 text-xs" />
                    <CommandList>
                        <CommandEmpty className="py-2 text-[10px]">No matches</CommandEmpty>
                        <CommandGroup className="max-h-48 overflow-y-auto p-1">
                            {options.map((option: string) => {
                                const isSelected = selected.includes(option);
                                return (
                                    <CommandItem
                                        key={option}
                                        value={option}
                                        onSelect={() => onChange(option)}
                                        className="text-xs"
                                    >
                                        <div className={cn("mr-2 flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-white" : "opacity-30")}>
                                            <Check className={cn("h-3 w-3", !isSelected && "hidden")} />
                                        </div>
                                        <span className="truncate">{option}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        {selected.length > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem onSelect={() => selected.forEach((s: string) => onChange(s))} className="justify-center text-[10px] text-primary font-bold py-1">
                                        Clear
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
