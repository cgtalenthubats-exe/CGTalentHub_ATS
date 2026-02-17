"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
    Search,
    MapPin,
    Building,
    Briefcase,
    Layers,
    ChevronDown,
    ChevronUp,
    Download,
    X,
    Linkedin,
    User,
    Tags,
    Filter,
    Check,
    LayoutList,
    Table as TableIcon,
    RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CandidateTableView } from "./table-view";
import { AddCandidateDialog } from "@/components/ai-search/AddCandidateDialog";
import { Plus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
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

import { cn } from "@/lib/utils";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { AsyncFilterMultiSelect } from "@/components/ui/async-filter-multi-select";
import { SmartCandidateSearch } from "@/components/smart-candidate-search"; // [NEW] Smart Search
import { searchCompanies, searchPositions } from "@/app/actions/candidate-filters";
import { triggerCandidateRefresh } from "@/app/actions/n8n-actions";

// Types
interface Candidate {
    candidate_id: string;
    name: string;
    email: string;
    mobile_phone: string;
    nationality: string;
    age: number;
    gender?: string;
    candidate_status?: string;
    job_grouping?: string;
    job_function?: string;
    photo?: string;
    linkedin?: string;
    created_date: string;
    modify_date: string;
    experiences: Experience[];
}

interface Experience {
    id: number;
    company: string;
    position: string;
    start_date: string;
    end_date: string;
    country: string;
    company_industry?: string;
    is_current_job?: boolean;
}

export default function CandidateListPage() {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);

    // Selection & Dialog States
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectAllMode, setSelectAllMode] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [targetCandidateIds, setTargetCandidateIds] = useState<string[]>([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Filters State
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'table'>('list');
    const [searchTerm, setSearchTerm] = useState("");
    const [filters, setFilters] = useState({
        countries: [] as string[],
        industries: [] as string[],
        groups: [] as string[], // Company Group
        positions: [] as string[], // Position

        jobGroupings: [] as string[],
        jobFunctions: [] as string[],
        statuses: [] as string[],
        genders: [] as string[],

        companies: [] as string[], // Dependent

        ageMin: "",
        ageMax: "",
        experienceType: "All" as 'Current' | 'Past' | 'All'
    });

    // Master Data
    const [options, setOptions] = useState<{
        countries: string[];
        industries: string[];
        groups: string[];
        // positions: string[]; // Removed, now async
        jobGroupings: string[];
        jobFunctions: string[];
        statuses: string[];
        genders: string[];
        // companies: string[]; // Removed, now async
        // mapping: any[]; // Removed heavy mapping
    }>({
        countries: [], industries: [], groups: [],
        jobGroupings: [], jobFunctions: [], statuses: [], genders: []
    });

    // 1. Fetch Options (Only small lists)
    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const res = await fetch('/api/candidates/filters');
                const data = await res.json();
                setOptions({
                    countries: data.countries || [],
                    industries: data.industries || [],
                    groups: data.groups || [],
                    // positions: data.positions || [],
                    jobGroupings: data.jobGroupings || [],
                    jobFunctions: data.jobFunctions || [],
                    statuses: data.statuses || [],
                    genders: data.genders || [],
                    // companies: data.companies || [],
                    // mapping: data.mapping || []
                });
            } catch (error) {
                console.error("Failed to load filters", error);
            }
        };
        fetchOptions();
    }, []);

    // 2. Compute Available Companies (Cascading Logic) - REMOVED for peformance
    // We now rely on server-side search for companies, maybe passing current filters to context if needed in future
    // but for now, simple global search for companies is better than crashing the browser.

    // 3. Fetch Candidates
    const fetchCandidates = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/candidates/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filters: {
                        country: filters.countries.length ? filters.countries : undefined,
                        industry: filters.industries.length ? filters.industries : undefined,
                        group: filters.groups.length ? filters.groups : undefined,
                        position: filters.positions.length ? filters.positions : undefined,
                        company: filters.companies.length ? filters.companies : undefined,

                        jobGrouping: filters.jobGroupings.length ? filters.jobGroupings : undefined,
                        jobFunction: filters.jobFunctions.length ? filters.jobFunctions : undefined,
                        status: filters.statuses.length ? filters.statuses : undefined,
                        gender: filters.genders.length ? filters.genders : undefined,

                        ageMin: filters.ageMin ? parseInt(filters.ageMin) : undefined,
                        ageMax: filters.ageMax ? parseInt(filters.ageMax) : undefined,
                        experienceType: filters.experienceType,
                    },
                    search: searchTerm,
                    page: currentPage,
                    pageSize: pageSize
                })
            });
            const result = await res.json();
            setCandidates(result.data || []);
            setTotalCount(result.total || 0);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };


    // Debounce Fetch
    useEffect(() => {
        const timeout = setTimeout(fetchCandidates, 500);
        return () => clearTimeout(timeout);
    }, [filters, searchTerm, currentPage, pageSize]);

    // Reset Page on Filter Change
    useEffect(() => {
        setCurrentPage(1);
        setSelectAllMode(false);
        setSelectedIds([]);
    }, [filters, searchTerm]);

    // Update selection when Page changes (Looping behavior or preserve? Standard is preserve IDs but SelectAllMode might reset or persist?)
    // Decision: If Global Select All is ON, it persists across pages. 
    // If NOT Global, we keep selectedIds as is (cross-page selection).
    useEffect(() => {
        if (selectAllMode) {
            // Ensure visual consistency on new page
            setSelectedIds(candidates.map(c => c.candidate_id));
        }
    }, [currentPage, candidates, selectAllMode]);

    const clearAll = () => {
        setFilters({
            countries: [], industries: [], jobGroupings: [], jobFunctions: [], statuses: [], genders: [], companies: [],
            groups: [], positions: [],
            ageMin: "",
            ageMax: "",
            experienceType: "All"
        });
        setSearchTerm("");
    };

    // Helper to update filter array directly (for batch updates)
    const setFilterArray = (key: keyof typeof filters, values: string[]) => {
        setFilters(prev => ({ ...prev, [key]: values }));
    };

    // Helper to toggle filter array (kept for chips, but could be refactored)
    const toggleFilter = (key: keyof typeof filters, value: string) => {
        setFilters(prev => {
            const current = (prev as any)[key] as string[];
            const updated = current.includes(value)
                ? current.filter(item => item !== value)
                : [...current, value];
            return { ...prev, [key]: updated };
        });
    };

    // Selection Handlers
    const handleToggleSelect = (id: string) => {
        if (selectAllMode) {
            setSelectAllMode(false);
            // If we were in "Select All Global", deselecting one means we are now just selecting specific IDs.
            // Since we can't track "All except one" easily without backend support, 
            // we'll revert to "Select All on Current Page" minus the one deselected.
            setSelectedIds(candidates.map(c => c.candidate_id).filter(cid => cid !== id));
        } else {
            setSelectedIds(prev =>
                prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
            );
        }
    };

    const handleToggleSelectAll = (ids: string[]) => {
        if (selectAllMode) {
            setSelectAllMode(false);
            setSelectedIds([]);
        } else if (selectedIds.length === ids.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(ids);
        }
    };

    const handleSelectGlobal = () => {
        setSelectAllMode(true);
        setSelectedIds(candidates.map(c => c.candidate_id)); // Visually select current page
    };

    const handleBulkAddToJR = (ids: string[]) => {
        setTargetCandidateIds(ids);
        setIsAddDialogOpen(true);
        setIsAddDialogOpen(true);
    };

    const handleRefreshData = async (ids: string[]) => {
        toast.promise(
            triggerCandidateRefresh(ids, "Recruiter (Manual Trigger)"),
            {
                loading: `Sending ${ids.length} candidates to n8n for refresh...`,
                success: (data: any) => {
                    if (data.success) return `Successfully triggered refresh for ${ids.length} candidates!`;
                    throw new Error(data.error);
                },
                error: (err) => `Failed to refresh: ${err.message}`
            }
        );
    };

    return (
        <div className="flex flex-col gap-6 p-6 max-w-[1600px] mx-auto min-h-screen">
            {/* Compact Header & Toolbar */}
            <div className="flex flex-col gap-4 bg-card p-4 rounded-xl border shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                            Candidate Explorer
                            <Badge variant="secondary" className="font-mono text-xs">{totalCount} found</Badge>
                        </h1>
                        <p className="text-xs text-muted-foreground mt-0.5">Deep search across talent pool.</p>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-96">
                            {/* Replaced Input with Smart Search */}
                            <SmartCandidateSearch
                                onSearch={(term, type) => {
                                    if (type === 'global') {
                                        setSearchTerm(term);
                                    } else if (type === 'company') {
                                        setFilterArray('companies', [...filters.companies, term]);
                                        setSearchTerm(""); // Clear global search if filter applied
                                    } else if (type === 'position') {
                                        setFilterArray('positions', [...filters.positions, term]);
                                        setSearchTerm("");
                                    }
                                }}
                                filters={filters}
                                placeholder={searchTerm || "Search Name, Email, ID, Company..."}
                            />
                        </div>
                        <Button
                            variant={showFilters ? "secondary" : "outline"}
                            size="sm"
                            className="h-9 gap-2"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <Filter className="h-4 w-4" />
                            <span className="hidden sm:inline">Filters</span>
                            {/* Show count of active filters if hidden */}
                            {!showFilters && Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v) && (
                                <span className="h-1.5 w-1.5 rounded-full bg-primary absolute top-1 right-1" />
                            )}
                        </Button>
                        <Button variant="outline" size="sm" className="h-9 gap-2">
                            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
                        </Button>
                        <div className="flex items-center border rounded-md bg-secondary/20 p-0.5 ml-1 h-9">
                            <Button
                                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-8 w-8 p-0 rounded-sm shadow-none"
                                onClick={() => setViewMode('list')}
                                title="List View"
                            >
                                <LayoutList className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-8 w-8 p-0 rounded-sm shadow-none"
                                onClick={() => setViewMode('table')}
                                title="Table View"
                            >
                                <TableIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Collapsible Filters */}
                {showFilters && (
                    <div className="pt-2 border-t border-dashed animate-in slide-in-from-top-2 fade-in duration-200 space-y-3">
                        <div className="flex flex-wrap gap-2 items-center">
                            {/* NEW: Experience Type Filter */}
                            <div className="flex items-center bg-secondary/30 p-0.5 rounded-lg border border-primary/10 h-9">
                                {['All', 'Current', 'Past'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setFilters(prev => ({ ...prev, experienceType: type as any }))}
                                        className={cn(
                                            "px-3 h-8 text-[10px] font-bold transition-all rounded-md",
                                            filters.experienceType === type
                                                ? "bg-primary text-white shadow-sm"
                                                : "text-muted-foreground hover:text-primary hover:bg-white/50"
                                        )}
                                    >
                                        {type === 'All' ? 'Exp: All' : type}
                                    </button>
                                ))}
                            </div>

                            <div className="h-4 w-px bg-border mx-1" />

                            {/* Filter Dropdowns using Popover + Command for robustness */}

                            {/* 1. Position (ASYNC) */}
                            <AsyncFilterMultiSelect
                                label="Position"
                                icon={Briefcase}
                                selected={filters.positions}
                                onChange={(v: string[]) => setFilterArray('positions', v)}
                                fetcher={searchPositions}
                                placeholder="Search Position..."
                                filters={filters} // [NEW] Pass context
                            />

                            {/* 2. Company (ASYNC) */}
                            <AsyncFilterMultiSelect
                                label="Company"
                                icon={Layers}
                                selected={filters.companies}
                                onChange={(v: string[]) => setFilterArray('companies', v)}
                                fetcher={searchCompanies}
                                placeholder="Search Company..."
                                filters={filters} // [NEW] Pass context
                            />

                            {/* 3. Gender */}
                            <FilterMultiSelect label="Gender" icon={User} options={options.genders} selected={filters.genders} onChange={(v: string[]) => setFilterArray('genders', v)} />

                            {/* 4. Age Inputs */}
                            <div className="flex items-center gap-2 bg-secondary/30 px-3 py-1.5 rounded-md border border-transparent focus-within:border-primary/50 transition-colors h-9">
                                <span className="text-xs font-medium text-muted-foreground">Age:</span>
                                <input
                                    className="w-8 bg-transparent text-xs text-center border-none outline-none focus:ring-0"
                                    placeholder="Min" value={filters.ageMin} onChange={e => setFilters({ ...filters, ageMin: e.target.value })}
                                />
                                <span className="text-muted-foreground">-</span>
                                <input
                                    className="w-8 bg-transparent text-xs text-center border-none outline-none focus:ring-0"
                                    placeholder="Max" value={filters.ageMax} onChange={e => setFilters({ ...filters, ageMax: e.target.value })}
                                />
                            </div>

                            {/* 5. Status */}
                            <FilterMultiSelect label="Status" icon={Tags} options={options.statuses} selected={filters.statuses} onChange={(v: string[]) => setFilterArray('statuses', v)} />

                            {/* 6. Country */}
                            <FilterMultiSelect label="Country" icon={MapPin} options={options.countries} selected={filters.countries} onChange={(v: string[]) => setFilterArray('countries', v)} />

                            {/* 7. Company Group */}
                            <FilterMultiSelect label="Company Group" icon={Building} options={options.groups} selected={filters.groups} onChange={(v: string[]) => setFilterArray('groups', v)} />

                            {/* 8. Industry */}
                            <FilterMultiSelect label="Industry" icon={Building} options={options.industries} selected={filters.industries} onChange={(v: string[]) => setFilterArray('industries', v)} />

                            {/* 9. Job Group */}
                            <FilterMultiSelect label="Job Group" icon={Briefcase} options={options.jobGroupings} selected={filters.jobGroupings} onChange={(v: string[]) => setFilterArray('jobGroupings', v)} />

                            {/* 10. Job Function */}
                            <FilterMultiSelect label="Job Function" icon={Layers} options={options.jobFunctions} selected={filters.jobFunctions} onChange={(v: string[]) => setFilterArray('jobFunctions', v)} />
                        </div>

                        {/* Active Filter Chips */}
                        <div className="flex flex-wrap gap-2 min-h-[1.5rem] items-center">
                            <span className="text-[10px] font-medium text-muted-foreground mr-1">Active:</span>
                            {filters.countries.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('countries', c)} color="blue" />)}
                            {filters.industries.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('industries', c)} color="purple" />)}
                            {filters.groups.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('groups', c)} color="orange" />)}

                            {/* Position - Grouped */}
                            {filters.positions.length <= 5 ? (
                                filters.positions.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('positions', c)} color="pink" />)
                            ) : (
                                <GroupedFilterChip
                                    label="Positions"
                                    count={filters.positions.length}
                                    items={filters.positions}
                                    onClear={() => setFilters(prev => ({ ...prev, positions: [] }))}
                                    color="pink"
                                />
                            )}

                            {filters.jobGroupings.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('jobGroupings', c)} color="orange" />)}

                            {/* Company - Grouped */}
                            {filters.companies.length <= 5 ? (
                                filters.companies.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('companies', c)} color="indigo" />)
                            ) : (
                                <GroupedFilterChip
                                    label="Companies"
                                    count={filters.companies.length}
                                    items={filters.companies}
                                    onClear={() => setFilters(prev => ({ ...prev, companies: [] }))}
                                    color="indigo"
                                />
                            )}

                            {filters.statuses.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('statuses', c)} color="emerald" />)}
                            {filters.genders.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('genders', c)} color="cyan" />)}
                            {filters.jobFunctions.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('jobFunctions', c)} color="pink" />)}

                            {filters.experienceType !== 'All' && (
                                <Badge variant="secondary" className="gap-1 h-7 border-blue-200 bg-blue-50 text-blue-700">
                                    {filters.experienceType === 'Current' ? 'Current Roles Only' : 'Past Roles Only'}
                                    <X
                                        className="h-3 w-3 cursor-pointer hover:text-blue-900"
                                        onClick={() => setFilters(prev => ({ ...prev, experienceType: 'All' }))}
                                    />
                                </Badge>
                            )}
                            {(Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v)) && (
                                <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto text-destructive hover:bg-destructive/10 rounded-full" onClick={clearAll} title="Clear All">
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Select All Banner */}
            <AnimatePresence>
                {!selectAllMode && selectedIds.length > 0 && candidates.length > 0 && selectedIds.length === candidates.length && totalCount > candidates.length && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 flex items-center justify-center gap-2 text-sm text-indigo-900 overflow-hidden"
                    >
                        <span>All <b>{candidates.length}</b> candidates on this page are selected.</span>
                        <button
                            onClick={handleSelectGlobal}
                            className="font-bold text-indigo-700 hover:underline hover:text-indigo-900"
                        >
                            Select all {totalCount} candidates matching this search
                        </button>
                    </motion.div>
                )}
                {selectAllMode && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-indigo-600 text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 text-sm overflow-hidden shadow-sm"
                    >
                        <span>All <b>{totalCount}</b> candidates are selected.</span>
                        <button
                            onClick={() => { setSelectAllMode(false); setSelectedIds([]); }}
                            className="font-bold underline hover:text-indigo-100"
                        >
                            Clear selection
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Results Content */}
            {viewMode === 'table' ? (
                <div className="flex-1 pb-2">
                    <CandidateTableView
                        candidates={candidates}
                        loading={loading}
                        selectedIds={selectedIds}
                        onToggleSelect={handleToggleSelect}
                        onToggleSelectAll={(ids) => handleToggleSelectAll(ids)}
                    />
                </div>
            ) : (
                <div className="flex-1 space-y-4 pb-2">
                    {loading ? (
                        <div className="space-y-4 opacity-50">
                            {[1, 2, 3].map(i => <div key={i} className="h-40 w-full bg-secondary/20 animate-pulse rounded-xl" />)}
                        </div>
                    ) : candidates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
                            <Filter className="h-10 w-10 opacity-20" />
                            <p>No candidates found matching your specific criteria.</p>
                            <Button variant="link" onClick={clearAll}>Clear all filters</Button>
                        </div>
                    ) : (
                        candidates.map(candidate => (
                            <CandidateRichCard
                                key={candidate.candidate_id}
                                candidate={candidate}
                                isSelected={selectedIds.includes(candidate.candidate_id)}
                                onToggleSelect={() => handleToggleSelect(candidate.candidate_id)}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Rows per page:</span>
                    <select
                        className="bg-secondary/30 h-8 rounded-md px-2 text-xs border-none focus:ring-1 focus:ring-primary"
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                    <span>
                        Page {currentPage} of {Math.max(1, Math.ceil(totalCount / pageSize))}
                    </span>
                </div>
                <PaginationControls currentPage={currentPage} totalCount={totalCount} pageSize={pageSize} onPageChange={setCurrentPage} />
            </div>

            {/* Selection Toolbar */}
            <AnimatePresence>
                {!isAddDialogOpen && selectedIds.length > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl border border-white/10 ring-1 ring-black/50"
                    >
                        <div className="flex flex-col">
                            <span className="text-sm font-black">{selectAllMode ? totalCount : selectedIds.length} SELECTED</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Candidate Explorer</span>
                        </div>
                        <div className="w-px h-8 bg-white/10 mx-2" />
                        <Button
                            onClick={() => handleBulkAddToJR(selectedIds)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 px-8 font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                        >
                            <Plus className="w-5 h-5" /> Add to Job Requisition
                        </Button>
                        <div className="w-px h-8 bg-white/10 mx-2" />
                        <Button
                            onClick={() => handleRefreshData(selectedIds)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 px-6 font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                        >
                            <RefreshCw className="w-4 h-4" /> Refresh Data
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            <AddCandidateDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                candidateIds={targetCandidateIds}
                candidateNames={targetCandidateIds.map(id => candidates.find(c => c.candidate_id === id)?.name || id)}
                onSuccess={() => {
                    setSelectedIds([]);
                    setTargetCandidateIds([]);
                }}
                isSelectAll={selectAllMode}
                filters={filters}
                search={searchTerm}
                totalCount={totalCount}
            />
        </div>
    );
}

// --- Components ---

function Chip({ label, onRemove, color, title }: any) {
    const colors: any = {
        blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        purple: "bg-purple-500/10 text-purple-600 border-purple-500/20",
        emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        indigo: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
        orange: "bg-orange-500/10 text-orange-600 border-orange-500/20",
        pink: "bg-pink-500/10 text-pink-600 border-pink-500/20",
        cyan: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    };
    return (
        <Badge variant="outline" className={cn("pr-1 gap-1 font-normal transition-all text-[11px]", colors[color] || colors.blue)} title={title}>
            {label}
            <div onClick={onRemove} className="cursor-pointer hover:bg-black/10 rounded-full p-0.5">
                <X className="h-3 w-3" />
            </div>
        </Badge>
    );
}

function GroupedFilterChip({ label, count, items, onClear, color }: any) {
    const colors: any = {
        indigo: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
        pink: "bg-pink-500/10 text-pink-600 border-pink-500/20",
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Badge
                    variant="outline"
                    className={cn("pr-1 gap-1 font-normal transition-all text-[11px] cursor-pointer hover:bg-opacity-80", colors[color])}
                >
                    <span className="font-bold">{count}</span> {label}
                    <div onClick={(e) => { e.stopPropagation(); onClear(); }} className="cursor-pointer hover:bg-black/10 rounded-full p-0.5 ml-1">
                        <X className="h-3 w-3" />
                    </div>
                </Badge>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-2">
                    <h4 className="font-medium text-xs text-muted-foreground pb-2 border-b">Selected {label}</h4>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                        {items.map((item: string) => (
                            <div key={item} className="text-xs py-1 px-2 rounded hover:bg-secondary/50 truncate" title={item}>
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function FilterMultiSelect({ label, icon: Icon, options = [], selected, onChange, disabled }: any) {
    const [open, setOpen] = useState(false);
    const [tempSelected, setTempSelected] = useState<string[]>(selected);

    // Sync tempSelected with parent selected when popover opens
    useEffect(() => {
        if (open) {
            setTempSelected(selected);
        }
    }, [open, selected]);

    const handleToggle = (option: string) => {
        setTempSelected(prev =>
            prev.includes(option)
                ? prev.filter(i => i !== option)
                : [...prev, option]
        );
    };

    const handleApply = () => {
        onChange(tempSelected);
        setOpen(false);
    };

    const handleClear = () => {
        setTempSelected([]);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-2 border-dashed bg-background", selected.length > 0 && "border-primary/50 bg-primary/5")} disabled={disabled}>
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {label}
                    {selected.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1 text-[10px] bg-primary text-primary-foreground">{selected.length}</Badge>
                    )}
                    <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[240px]" align="start">
                <Command>
                    <CommandInput placeholder={`Search ${label}...`} className="h-9" />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-y-auto">
                            {options.map((option: string) => {
                                const isSelected = tempSelected.includes(option);
                                return (
                                    <CommandItem
                                        key={option}
                                        value={option}
                                        onSelect={() => handleToggle(option)}
                                    >
                                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                            <Check className={cn("h-4 w-4")} />
                                        </div>
                                        {option}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        {tempSelected.length > 0 && (
                            <div className="border-t pt-1 mt-1">
                                <CommandGroup heading="Selected Current">
                                    {tempSelected.map((item: string) => {
                                        if (options.includes(item)) return null;
                                        return (
                                            <CommandItem key={item} value={item} onSelect={() => handleToggle(item)}>
                                                <div className="mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary bg-primary text-primary-foreground">
                                                    <Check className="h-4 w-4" />
                                                </div>
                                                {item}
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            </div>
                        )}
                    </CommandList>
                    <div className="flex items-center justify-between p-2 border-t bg-slate-50">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-[10px] font-bold text-slate-500 hover:text-red-500 px-2"
                            onClick={handleClear}
                        >
                            Clear
                        </Button>
                        <div className="flex gap-1.5">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-[10px] px-2"
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                className="h-8 text-[10px] px-3 bg-primary text-white font-bold"
                                onClick={handleApply}
                            >
                                Apply ({tempSelected.length})
                            </Button>
                        </div>
                    </div>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function ProfileAgeIndicator({ created, modified }: { created: string, modified: string }) {
    const calculateAge = (dateString: string) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 30) return { label: `${diffDays}d`, color: "bg-emerald-500" };
        if (diffDays < 365) return { label: `${Math.floor(diffDays / 30)}m`, color: "bg-yellow-500" };
        return { label: `${Math.floor(diffDays / 365)}y`, color: "bg-red-500" };
    };

    // Use Modified Date preferably, fallback to Created
    const age = calculateAge(modified) || calculateAge(created);

    if (!age) return null;

    return (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5" title={`Profile Age: ${age.label} (based on last modified)`}>
            <div className={cn("h-2.5 w-2.5 rounded-full shadow-sm ring-1 ring-white/20", age.color)} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{age.label} ago</span>
        </div>
    );
}

// Helper for Sort
function sortExperiences(exps: Experience[]) {
    if (!exps) return [];
    return [...exps].sort((a, b) => {
        const isAPresent = !a.end_date || a.end_date.toLowerCase() === 'present';
        const isBPresent = !b.end_date || b.end_date.toLowerCase() === 'present';

        if (isAPresent && !isBPresent) return -1;
        if (!isAPresent && isBPresent) return 1;
        if (isAPresent && isBPresent) return 0;

        // Compare dates (assuming string format like "1/2023" or "2023-01")
        // Try parsing
        const dateA = new Date(a.end_date);
        const dateB = new Date(b.end_date);
        return dateB.getTime() - dateA.getTime();
    });
}

function CandidateRichCard({
    candidate,
    isSelected,
    onToggleSelect
}: {
    candidate: Candidate;
    isSelected?: boolean;
    onToggleSelect?: () => void;
}) {
    const [expanded, setExpanded] = useState(true);
    // Sort experiences: Present first, then by End Date descending
    const sortedExperiences = useMemo(() => sortExperiences(candidate.experiences), [candidate.experiences]);
    const currentJob = sortedExperiences.find(e => e.is_current_job) || sortedExperiences[0];

    return (
        <Card className={cn(
            "overflow-hidden border-none shadow-md ring-1 ring-border group transition-all hover:ring-primary/40 hover:shadow-xl bg-card relative",
            isSelected && "ring-2 ring-indigo-600 shadow-indigo-500/10 bg-indigo-50/10"
        )}>
            {/* Selection Checkbox */}
            <div className="absolute top-4 left-4 z-10">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={onToggleSelect}
                    className="h-5 w-5 border-slate-300 bg-white shadow-sm data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 transition-all"
                />
            </div>

            {/* Summary Header */}
            <div className={cn("p-5 flex gap-5 items-start relative bg-gradient-to-r from-card via-card to-secondary/5", isSelected && "pl-14")}>

                {/* Action Buttons (Top Right) */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    {candidate.candidate_status && (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none shadow-sm uppercase tracking-wider text-[10px]">
                            {candidate.candidate_status}
                        </Badge>
                    )}
                    {candidate.linkedin && (
                        <a href={candidate.linkedin} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-blue-600 text-white hover:scale-110 transition-transform shadow-sm" title="View on LinkedIn">
                            <Linkedin className="h-3.5 w-3.5" />
                        </a>
                    )}
                </div>

                <CandidateAvatar
                    src={candidate.photo}
                    name={candidate.name}
                    className="h-24 w-24 border-4 border-background shadow-xl ring-2 ring-secondary/50"
                    fallbackClassName="text-3xl"
                />

                {/* Profile Age Indicator */}
                <ProfileAgeIndicator created={candidate.created_date} modified={candidate.modify_date} />

                <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-xl font-black truncate text-slate-900 group-hover:text-primary transition-colors flex items-center gap-2 cursor-pointer leading-none tracking-tight" onClick={() => window.location.href = `/candidates/${candidate.candidate_id}`}>
                        {candidate.name}
                        <Badge variant="outline" className="ml-2 text-[10px] h-5 hover:bg-primary hover:text-white transition-colors">View Profile &gt;</Badge>
                    </h3>

                    <div className="flex flex-wrap gap-y-1 gap-x-3 mt-3 text-sm font-medium text-muted-foreground items-center">
                        <span className="flex items-center gap-1">
                            <Badge variant="secondary" className="font-mono text-[13px] font-black h-6 bg-slate-100 text-slate-600 border border-slate-200">
                                {candidate.candidate_id}
                            </Badge>
                        </span>
                        <span className="flex items-center gap-1">{candidate.nationality || "N/A"}</span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span>{candidate.age ? `${candidate.age} Years` : "Age -"}</span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span>{candidate.gender || "Gender -"}</span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span className="flex items-center gap-1 text-foreground"><MapPin className="h-3 w-3 text-primary" /> {currentJob?.country || "Global"}</span>
                    </div>

                    <div className="flex gap-2 mt-4">
                        {candidate.job_grouping && <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">{candidate.job_grouping}</Badge>}
                        {candidate.job_function && <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-700">{candidate.job_function}</Badge>}
                    </div>
                </div>

                <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="self-center ml-2">
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
            </div>

            {/* Experience Table */}
            {expanded && (
                <div className={cn("border-t bg-secondary/5", isSelected && "pl-8")}>
                    <div className="grid grid-cols-12 gap-4 px-6 py-2 border-b bg-secondary/20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <div className="col-span-4">Position</div>
                        <div className="col-span-3">Company</div>
                        <div className="col-span-2">Country</div>
                        <div className="col-span-3 text-right pr-4">Period</div>
                    </div>
                    <div className="divide-y divide-border/50">
                        {sortedExperiences.map((exp) => (
                            <div key={exp.id} className="grid grid-cols-12 gap-4 px-6 py-2.5 text-xs hover:bg-white/50 transition-colors items-center">
                                <div className="col-span-4 font-semibold text-foreground truncate" title={exp.position}>{exp.position}</div>
                                <div className="col-span-3 text-muted-foreground truncate" title={exp.company}>{exp.company}</div>
                                <div className="col-span-2 text-muted-foreground truncate" title={exp.country}>{exp.country}</div>
                                <div className="col-span-3 text-right pr-4 font-mono text-[11px]">
                                    <span className="text-muted-foreground">{exp.start_date || "?"}</span>
                                    <span className="mx-1 text-muted-foreground/50">-</span>
                                    <span className={!exp.end_date || exp.end_date.toLowerCase() === 'present' ? "text-emerald-600 font-bold" : "text-muted-foreground"}>
                                        {!exp.end_date || exp.end_date.toLowerCase() === 'present' ? 'Present' : exp.end_date}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {sortedExperiences.length === 0 && (
                            <div className="p-4 text-center text-xs text-muted-foreground">No experience recorded.</div>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
}

function PaginationControls({ currentPage, totalCount, pageSize, onPageChange }: any) {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Sliding Window Logic
    let startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }

    return (
        <div className="flex items-center gap-1">
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
            >
                Previous
            </Button>

            {startPage > 1 && (
                <>
                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={() => onPageChange(1)}>1</Button>
                    {startPage > 2 && <span className="text-muted-foreground px-1">...</span>}
                </>
            )}

            {pages.map(p => (
                <Button
                    key={p}
                    variant={currentPage === p ? "default" : "ghost"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => onPageChange(p)}
                >
                    {p}
                </Button>
            ))}

            {endPage < totalPages && (
                <>
                    {endPage < totalPages - 1 && <span className="text-muted-foreground px-1">...</span>}
                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={() => onPageChange(totalPages)}>{totalPages}</Button>
                </>
            )}

            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
            >
                Next
            </Button>
        </div>
    )
}
