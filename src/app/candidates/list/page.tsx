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
    Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Filters State
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
        ageMax: ""
    });

    // Master Data
    const [options, setOptions] = useState<{
        countries: string[];
        industries: string[];
        groups: string[];
        positions: string[];
        jobGroupings: string[];
        jobFunctions: string[];
        statuses: string[];
        genders: string[];
        mapping: any[]; // { country, company, industry }
    }>({
        countries: [], industries: [], groups: [], positions: [],
        jobGroupings: [], jobFunctions: [], statuses: [], genders: [], mapping: []
    });

    // 1. Fetch Options
    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const res = await fetch('/api/candidates/filters');
                const data = await res.json();
                setOptions({
                    countries: data.countries || [],
                    industries: data.industries || [],
                    groups: data.groups || [],
                    positions: data.positions || [],
                    jobGroupings: data.jobGroupings || [],
                    jobFunctions: data.jobFunctions || [],
                    statuses: data.statuses || [],
                    genders: data.genders || [],
                    mapping: data.mapping || []
                });
            } catch (error) {
                console.error("Failed to load filters", error);
            }
        };
        fetchOptions();
    }, []);

    // 2. Compute Available Companies (Cascading Logic)
    const availableCompanies = useMemo(() => {
        if (!options.mapping || options.mapping.length === 0) return [];

        let filtered = options.mapping;

        // Filter by Country
        if (filters.countries.length > 0) {
            filtered = filtered.filter((m: any) => filters.countries.includes(m.country));
        }

        // Filter by Industry
        if (filters.industries.length > 0) {
            filtered = filtered.filter((m: any) => filters.industries.includes(m.industry));
        }

        // Extract unique companies
        const uniqueCompanies = Array.from(new Set(filtered.map((m: any) => m.company))).filter(Boolean) as string[];
        return uniqueCompanies.sort();
    }, [options.mapping, filters.countries, filters.industries]);


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
    }, [filters, searchTerm]);

    const clearAll = () => {
        setFilters({
            countries: [], industries: [], jobGroupings: [], jobFunctions: [], statuses: [], genders: [], companies: [],
            ageMin: "", ageMax: ""
        });
        setSearchTerm("");
    };

    // Helper to toggle filter array
    const toggleFilter = (key: keyof typeof filters, value: string) => {
        setFilters(prev => {
            const current = prev[key] as string[];
            const updated = current.includes(value)
                ? current.filter(item => item !== value)
                : [...current, value];
            return { ...prev, [key]: updated };
        });
    };

    return (
        <div className="flex flex-col gap-6 h-full p-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Candidate Explorer</h1>
                    <p className="text-muted-foreground mt-1">
                        Deep search across entire talent pool. Found <span className="text-primary font-bold">{totalCount}</span> profiles.
                    </p>
                </div>
                <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> Export Results
                </Button>
            </div>

            {/* Filter Bar */}
            <Card className="p-5 bg-card border-none shadow-lg ring-1 ring-border rounded-xl space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                    {/* Search */}
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search Name, Email, ID..."
                            className="pl-9 bg-secondary/30 border-transparent focus:bg-background transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="h-8 w-px bg-border mx-2" />

                    {/* Filter Dropdowns using Popover + Command for robustness */}
                    {/* 1. Position */}
                    <FilterMultiSelect label="Position" icon={Briefcase} options={options.positions} selected={filters.positions} onChange={(v: string) => toggleFilter('positions', v)} />

                    {/* 2. Company (Dependent) */}
                    <FilterMultiSelect
                        label={`Company (${availableCompanies.length})`}
                        icon={Layers}
                        options={availableCompanies}
                        selected={filters.companies}
                        onChange={(v: string) => toggleFilter('companies', v)}
                        disabled={availableCompanies.length === 0}
                    />

                    {/* 3. Gender */}
                    <FilterMultiSelect label="Gender" icon={User} options={options.genders} selected={filters.genders} onChange={(v: string) => toggleFilter('genders', v)} />

                    {/* 4. Age Inputs */}
                    <div className="flex items-center gap-2 bg-secondary/30 px-3 py-1.5 rounded-md border border-transparent focus-within:border-primary/50 transition-colors">
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
                    <FilterMultiSelect label="Status" icon={Tags} options={options.statuses} selected={filters.statuses} onChange={(v: string) => toggleFilter('statuses', v)} />

                    {/* 6. Country */}
                    <FilterMultiSelect label="Country" icon={MapPin} options={options.countries} selected={filters.countries} onChange={(v: string) => toggleFilter('countries', v)} />

                    {/* 7. Company Group */}
                    <FilterMultiSelect label="Company Group" icon={Building} options={options.groups} selected={filters.groups} onChange={(v: string) => toggleFilter('groups', v)} />

                    {/* 8. Industry */}
                    <FilterMultiSelect label="Industry" icon={Building} options={options.industries} selected={filters.industries} onChange={(v: string) => toggleFilter('industries', v)} />

                    {/* 9. Job Group */}
                    <FilterMultiSelect label="Job Group" icon={Briefcase} options={options.jobGroupings} selected={filters.jobGroupings} onChange={(v: string) => toggleFilter('jobGroupings', v)} />

                    {/* 10. Job Function */}
                    <FilterMultiSelect label="Job Function" icon={Layers} options={options.jobFunctions} selected={filters.jobFunctions} onChange={(v: string) => toggleFilter('jobFunctions', v)} />
                </div>

                {/* Active Filter Chips */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed min-h-[2rem]">
                    <span className="text-xs font-medium text-muted-foreground self-center mr-2">Active Filters:</span>
                    {filters.countries.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('countries', c)} color="blue" />)}
                    {filters.industries.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('industries', c)} color="purple" />)}
                    {filters.groups.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('groups', c)} color="orange" />)}
                    {filters.positions.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('positions', c)} color="pink" />)}
                    {filters.jobGroupings.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('jobGroupings', c)} color="orange" />)}
                    {filters.companies.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('companies', c)} color="indigo" />)}
                    {filters.statuses.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('statuses', c)} color="emerald" />)}
                    {filters.genders.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('genders', c)} color="cyan" />)}
                    {filters.jobFunctions.map(c => <Chip key={c} label={c} onRemove={() => toggleFilter('jobFunctions', c)} color="pink" />)}

                    {(Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v) || searchTerm) && (
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive hover:bg-destructive/10 ml-auto" onClick={clearAll}>
                            Clear All
                        </Button>
                    )}
                </div>
            </Card>

            {/* Results List */}
            <div className="flex-1 space-y-4 overflow-y-auto pr-2 pb-2">
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
                        <CandidateRichCard key={candidate.candidate_id} candidate={candidate} />
                    ))
                )}
            </div>

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
        </div>
    );
}

// --- Components ---

function Chip({ label, onRemove, color }: any) {
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
        <Badge variant="outline" className={cn("pr-1 gap-1 font-normal transition-all text-[11px]", colors[color] || colors.blue)}>
            {label}
            <div onClick={onRemove} className="cursor-pointer hover:bg-black/10 rounded-full p-0.5">
                <X className="h-3 w-3" />
            </div>
        </Badge>
    );
}

function FilterMultiSelect({ label, icon: Icon, options = [], selected, onChange, disabled }: any) {
    const [open, setOpen] = useState(false);
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
            <PopoverContent className="p-0 w-[200px]" align="start">
                <Command>
                    <CommandInput placeholder={`Search ${label}...`} className="h-9" />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-y-auto">
                            {options.map((option: string) => {
                                const isSelected = selected.includes(option);
                                return (
                                    <CommandItem
                                        key={option}
                                        value={option}
                                        onSelect={() => {
                                            onChange(option);
                                        }}
                                    >
                                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                            <Check className={cn("h-4 w-4")} />
                                        </div>
                                        {option}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        {selected.length > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem onSelect={() => selected.forEach((s: string) => onChange(s))} className="justify-center text-center">
                                        Clear filters
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

function CandidateRichCard({ candidate }: { candidate: Candidate }) {
    const [expanded, setExpanded] = useState(true);
    // Sort experiences: Present first, then by End Date descending
    const sortedExperiences = useMemo(() => sortExperiences(candidate.experiences), [candidate.experiences]);
    const currentJob = sortedExperiences.find(e => e.is_current_job) || sortedExperiences[0];

    return (
        <Card className="overflow-hidden border-none shadow-md ring-1 ring-border group transition-all hover:ring-primary/40 hover:shadow-xl bg-card">
            {/* Summary Header */}
            <div className="p-5 flex gap-5 items-start relative bg-gradient-to-r from-card via-card to-secondary/5">

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

                <Avatar className="h-16 w-16 border-2 border-background shadow-lg ring-2 ring-secondary/50">
                    <AvatarImage src={candidate.photo} />
                    <AvatarFallback className="bg-primary/5 text-primary text-xl font-black">
                        {candidate.name?.substring(0, 2)?.toUpperCase()}
                    </AvatarFallback>
                </Avatar>

                {/* Profile Age Indicator */}
                <ProfileAgeIndicator created={candidate.created_date} modified={candidate.modify_date} />

                <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-lg font-bold truncate text-foreground group-hover:text-primary transition-colors flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = `/candidates/${candidate.candidate_id}`}>
                        {candidate.name}
                        <Badge variant="outline" className="ml-2 text-[10px] h-5 hover:bg-primary hover:text-white transition-colors">View Profile &gt;</Badge>
                    </h3>

                    <div className="flex flex-wrap gap-y-1 gap-x-3 mt-2 text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1"><Badge variant="outline" className="font-mono text-[10px] h-5">{candidate.candidate_id}</Badge></span>
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
                <div className="border-t bg-secondary/5">
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
    let endPage = Math.min(totalPages, startPage + 4);

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
