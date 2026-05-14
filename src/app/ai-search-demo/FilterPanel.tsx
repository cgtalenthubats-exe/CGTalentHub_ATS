"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { ChevronDown, SlidersHorizontal, RotateCcw, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DemoFilterState, POSITION_LEVELS } from "./types";

interface StaticOptions {
    keywords: { keyword: string; group_label: string }[];
    industries: { group: string; industry: string }[];
    countries: { country: string; region: string }[];
    jobFunctions: string[];
    hotelChains: string[];
}

interface CascadingOptions {
    keywords:      string[];
    levels:        string[];
    positions:     string[];
    companies:     string[];
    countries:     string[];
    hotel_ratings: string[];
    hotel_chains:  string[];
    sub_brands:    string[];
    regions:       string[];
    job_functions: string[];
    genders:       string[];
    nationalities: string[];
}

interface FilterPanelProps {
    staticOptions: StaticOptions;
    cascadingOptions: CascadingOptions | null;
    cascadeLoading?: boolean;
    filters: DemoFilterState;
    onChange: (filters: DemoFilterState) => void;
    onReset: () => void;
    onSearchPositions: (query: string, filters: DemoFilterState) => Promise<string[]>;
    onSearchCompanies: (query: string, filters: DemoFilterState) => Promise<string[]>;
}

// --- Section label divider ---
function SectionLabel({ label }: { label: string }) {
    return (
        <div className="px-3 pt-3 pb-0.5 text-[10px] font-black uppercase text-slate-400 tracking-widest select-none">
            {label}
        </div>
    );
}

// --- Multi-select popover (search + checkboxes + Apply/Clear) ---
function FilterPopover({
    label,
    options,
    selected,
    onChange,
    placeholder = "Search...",
    emptyHint,
    variant = "include",
}: {
    label: string;
    options: string[];
    selected: string[];
    onChange: (v: string[]) => void;
    placeholder?: string;
    emptyHint?: string;
    variant?: "include" | "exclude";
}) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState<string[]>([]);
    const [search, setSearch] = useState("");

    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) { setPending([...selected]); setSearch(""); }
        setOpen(isOpen);
    };

    const filtered = useMemo(
        () => search ? options.filter(o => o.toLowerCase().includes(search.toLowerCase())) : options,
        [options, search]
    );

    const toggle = (val: string) =>
        setPending(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val]);

    const apply = () => { onChange([...pending]); setOpen(false); };
    const clear = () => { onChange([]); setPending([]); setOpen(false); };
    const count = selected.length;
    const isExclude = variant === "exclude";

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left",
                    count > 0
                        ? isExclude ? "bg-red-50 text-red-800" : "bg-indigo-50 text-indigo-800"
                        : "text-slate-600 hover:bg-slate-50"
                )}>
                    <span className={cn("font-medium truncate", isExclude && count === 0 && "text-slate-500")}>
                        {label}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        {count > 0 && (
                            <Badge className={cn(
                                "h-4 px-1.5 text-[10px]",
                                isExclude ? "bg-red-500 text-white" : "bg-indigo-600 text-white"
                            )}>{count}</Badge>
                        )}
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" sideOffset={4} className="w-64 p-0 shadow-xl border border-slate-100 rounded-xl z-50">
                <div className="px-3 pt-3 pb-2 border-b border-slate-100">
                    <div className="mb-1.5 text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</div>
                    <input
                        placeholder={placeholder}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                        className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
                    />
                </div>
                <ScrollArea className="max-h-[220px]">
                    <div className="p-2 flex flex-col gap-0.5">
                        {options.length === 0 && emptyHint && !search && (
                            <div className="text-xs text-slate-400 text-center py-3 italic">{emptyHint}</div>
                        )}
                        {filtered.length === 0 && search && (
                            <div className="text-xs text-slate-400 text-center py-3">No results</div>
                        )}
                        {filtered.map(opt => (
                            <label key={opt} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700">
                                <Checkbox
                                    checked={pending.includes(opt)}
                                    onCheckedChange={() => toggle(opt)}
                                    className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 shrink-0"
                                />
                                <span className="leading-snug truncate">{opt}</span>
                            </label>
                        ))}
                    </div>
                </ScrollArea>
                <div className="flex gap-2 p-2 border-t border-slate-100">
                    <button onClick={clear} className="flex-1 text-xs text-red-500 hover:text-red-700 font-semibold py-1.5 border border-red-100 rounded-md hover:bg-red-50 transition-colors">
                        Clear
                    </button>
                    <button onClick={apply} className="flex-1 text-xs text-white bg-indigo-600 hover:bg-indigo-700 font-semibold py-1.5 rounded-md transition-colors">
                        Apply
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

// --- Industry Group — single-select popover ---
function IndustryGroupPopover({
    groups,
    selected,
    onChange,
}: {
    groups: string[];
    selected: string | null;
    onChange: (v: string | null) => void;
}) {
    const [open, setOpen] = useState(false);

    const select = (g: string) => {
        onChange(selected === g ? null : g);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left",
                    selected ? "bg-indigo-50 text-indigo-800" : "text-slate-600 hover:bg-slate-50"
                )}>
                    <span className="font-medium truncate flex-1">Industry Group</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        {selected && <Badge className="h-4 px-1.5 text-[10px] bg-indigo-600 text-white">1</Badge>}
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" sideOffset={4} className="w-64 p-0 shadow-xl border border-slate-100 rounded-xl z-50">
                <div className="px-3 pt-3 pb-2 border-b border-slate-100">
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Industry Group</div>
                    {selected && <div className="text-xs text-indigo-700 font-semibold">{selected}</div>}
                </div>
                <ScrollArea className="max-h-[220px]">
                    <div className="p-2 flex flex-col gap-0.5">
                        {groups.map(g => (
                            <button
                                key={g}
                                onClick={() => select(g)}
                                className={cn(
                                    "w-full text-left text-xs px-2 py-2 rounded-lg transition-colors font-medium",
                                    selected === g ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-50"
                                )}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </ScrollArea>
                {selected && (
                    <div className="p-2 border-t border-slate-100">
                        <button
                            onClick={() => { onChange(null); setOpen(false); }}
                            className="w-full text-xs text-red-500 hover:text-red-700 font-semibold py-1.5 border border-red-100 rounded-md hover:bg-red-50 transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

// --- Age range popover ---
function AgeFilterPopover({
    ageMin, ageMax, includeUnknown, onChange,
}: {
    ageMin: number | null;
    ageMax: number | null;
    includeUnknown: boolean;
    onChange: (min: number | null, max: number | null, incl: boolean) => void;
}) {
    const [open, setOpen] = useState(false);
    const [pendingMin, setPendingMin] = useState("");
    const [pendingMax, setPendingMax] = useState("");
    const [pendingIncl, setPendingIncl] = useState(true);

    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) {
            setPendingMin(ageMin !== null ? String(ageMin) : "");
            setPendingMax(ageMax !== null ? String(ageMax) : "");
            setPendingIncl(includeUnknown);
        }
        setOpen(isOpen);
    };

    const apply = () => {
        onChange(
            pendingMin !== "" ? parseInt(pendingMin) : null,
            pendingMax !== "" ? parseInt(pendingMax) : null,
            pendingIncl
        );
        setOpen(false);
    };

    const clear = () => {
        onChange(null, null, true);
        setOpen(false);
    };

    const hasFilter = ageMin !== null || ageMax !== null;
    const label = hasFilter
        ? `Age: ${ageMin ?? "–"} to ${ageMax ?? "–"}`
        : "Age Range";

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left",
                    hasFilter ? "bg-indigo-50 text-indigo-800" : "text-slate-600 hover:bg-slate-50"
                )}>
                    <span className="font-medium truncate">{label}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        {hasFilter && <Badge className="h-4 px-1.5 text-[10px] bg-indigo-600 text-white">1</Badge>}
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" sideOffset={4} className="w-64 p-0 shadow-xl border border-slate-100 rounded-xl z-50">
                <div className="px-3 pt-3 pb-2.5 border-b border-slate-100">
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Age Range</div>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            placeholder="Min"
                            min={18} max={80}
                            value={pendingMin}
                            onChange={e => setPendingMin(e.target.value)}
                            className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-300 bg-white text-center"
                        />
                        <span className="text-slate-400 text-xs shrink-0">–</span>
                        <input
                            type="number"
                            placeholder="Max"
                            min={18} max={80}
                            value={pendingMax}
                            onChange={e => setPendingMax(e.target.value)}
                            className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-300 bg-white text-center"
                        />
                    </div>
                </div>
                <div className="px-3 py-2.5 border-b border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                            checked={pendingIncl}
                            onCheckedChange={v => setPendingIncl(!!v)}
                            className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 shrink-0"
                        />
                        <span className="text-xs text-slate-600 font-medium">Include unknown age</span>
                    </label>
                </div>
                <div className="flex gap-2 p-2">
                    <button onClick={clear} className="flex-1 text-xs text-red-500 hover:text-red-700 font-semibold py-1.5 border border-red-100 rounded-md hover:bg-red-50 transition-colors">
                        Clear
                    </button>
                    <button onClick={apply} className="flex-1 text-xs text-white bg-indigo-600 hover:bg-indigo-700 font-semibold py-1.5 rounded-md transition-colors">
                        Apply
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

// --- Generic free-text autocomplete popover (used for Position, Company, Exclude Company) ---
function LiveSearchPopover({
    label,
    selected,
    onChange,
    activeFilters,
    onSearch,
    placeholder,
    emptyHint,
    noResultText,
    variant = "include",
}: {
    label: string;
    selected: string[];
    onChange: (v: string[]) => void;
    activeFilters: DemoFilterState;
    onSearch: (query: string, filters: DemoFilterState) => Promise<string[]>;
    placeholder?: string;
    emptyHint?: string;
    noResultText?: string;
    variant?: "include" | "exclude";
}) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const isExclude = variant === "exclude";

    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) {
            setPending([...selected]);
            setSearch("");
            setSuggestions([]);
            setLoading(true);
            onSearch("", activeFilters).then(results => {
                setSuggestions(results);
                setLoading(false);
            });
        }
        setOpen(isOpen);
    };

    useEffect(() => {
        if (!open) return;
        clearTimeout(debounceRef.current);
        if (search.trim().length === 0) return; // handled by handleOpenChange
        if (search.trim().length < 2) { setLoading(false); return; }
        setLoading(true);
        debounceRef.current = setTimeout(async () => {
            const results = await onSearch(search.trim(), activeFilters);
            setSuggestions(results);
            setLoading(false);
        }, 300);
        return () => clearTimeout(debounceRef.current);
    }, [search, activeFilters, onSearch, open]);

    const toggle = (val: string) =>
        setPending(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val]);

    const apply = () => { onChange([...pending]); setOpen(false); };
    const clear = () => { onChange([]); setPending([]); setOpen(false); };
    const count = selected.length;

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left",
                    count > 0
                        ? isExclude ? "bg-red-50 text-red-800" : "bg-indigo-50 text-indigo-800"
                        : "text-slate-600 hover:bg-slate-50"
                )}>
                    <span className={cn("font-medium truncate", isExclude && count === 0 && "text-slate-500")}>{label}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        {count > 0 && (
                            <Badge className={cn(
                                "h-4 px-1.5 text-[10px]",
                                isExclude ? "bg-red-500 text-white" : "bg-indigo-600 text-white"
                            )}>{count}</Badge>
                        )}
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" sideOffset={4} className="w-72 p-0 shadow-xl border border-slate-100 rounded-xl z-50">
                <div className="px-3 pt-3 pb-2 border-b border-slate-100">
                    <div className="mb-1.5 text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</div>
                    <div className="relative">
                        <input
                            placeholder={placeholder ?? "Search..."}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                            className="w-full text-xs px-2 py-1.5 pr-6 border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
                        />
                        {loading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-slate-400" />}
                    </div>
                    {search.trim().length === 1 && (
                        <p className="text-[10px] text-slate-400 mt-1">พิมพ์อย่างน้อย 2 ตัวอักษร</p>
                    )}
                    {!loading && suggestions.length > 0 && search.trim().length !== 1 && (
                        <p className="text-[10px] text-slate-400 mt-1">{suggestions.length} results</p>
                    )}
                </div>

                {/* Select All row */}
                {suggestions.length > 0 && (() => {
                    const allSelected = suggestions.every(s => pending.includes(s));
                    const someSelected = !allSelected && suggestions.some(s => pending.includes(s));
                    const toggleAll = () => {
                        if (allSelected) {
                            setPending(prev => prev.filter(p => !suggestions.includes(p)));
                        } else {
                            setPending(prev => [...new Set([...prev, ...suggestions])]);
                        }
                    };
                    return (
                        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer select-none" onClick={toggleAll}>
                                <div className={cn(
                                    "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                    allSelected
                                        ? "bg-indigo-600 border-indigo-600"
                                        : someSelected ? "bg-indigo-100 border-indigo-400" : "bg-white border-slate-300"
                                )}>
                                    {allSelected && <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 text-white fill-current"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                    {someSelected && <div className="h-1.5 w-1.5 bg-indigo-500 rounded-sm" />}
                                </div>
                                <span className="text-xs font-semibold text-slate-600">Select All</span>
                            </label>
                            {pending.length > 0 && (
                                <span className="text-[10px] text-indigo-600 font-semibold">{pending.length} selected</span>
                            )}
                        </div>
                    );
                })()}

                <ScrollArea className="max-h-[220px]">
                    <div className="p-2 flex flex-col gap-0.5">
                        {loading && search.trim().length === 0 && pending.length === 0 && (
                            <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                กำลังโหลด...
                            </div>
                        )}
                        {/* Show already-selected items when no search */}
                        {search.trim().length < 2 && pending.length > 0 && pending.map(s => (
                            <label key={s} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs font-medium bg-indigo-50 text-indigo-800">
                                <Checkbox
                                    checked={true}
                                    onCheckedChange={() => toggle(s)}
                                    className="border-indigo-400 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 shrink-0"
                                />
                                <span className="leading-snug">{s}</span>
                            </label>
                        ))}
                        {!loading && search.trim().length >= 2 && suggestions.length === 0 && (
                            <div className="text-xs text-slate-400 text-center py-3">
                                {noResultText ?? "ไม่พบผลที่ตรงกัน"}
                            </div>
                        )}
                        {suggestions.map(s => (
                            <label key={s} className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs font-medium",
                                pending.includes(s) ? "bg-indigo-50 text-indigo-800" : "text-slate-700 hover:bg-slate-50"
                            )}>
                                <Checkbox
                                    checked={pending.includes(s)}
                                    onCheckedChange={() => toggle(s)}
                                    className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 shrink-0"
                                />
                                <span className="leading-snug">{s}</span>
                            </label>
                        ))}
                    </div>
                </ScrollArea>

                <div className="flex gap-2 p-2 border-t border-slate-100">
                    <button onClick={clear} className="flex-1 text-xs text-red-500 hover:text-red-700 font-semibold py-1.5 border border-red-100 rounded-md hover:bg-red-50 transition-colors">
                        Clear
                    </button>
                    <button onClick={apply} className={cn(
                        "flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors text-white",
                        isExclude ? "bg-red-500 hover:bg-red-600" : "bg-indigo-600 hover:bg-indigo-700"
                    )}>
                        Apply
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

// --- Main FilterPanel ---
export function FilterPanel({ staticOptions, cascadingOptions, cascadeLoading, filters, onChange, onReset, onSearchPositions, onSearchCompanies }: FilterPanelProps) {
    if (!staticOptions) return null;

    const set = <K extends keyof DemoFilterState>(key: K, value: DemoFilterState[K]) =>
        onChange({ ...filters, [key]: value });

    const cascade = cascadingOptions;

    const keywordOptions = useMemo(
        () => cascade ? (cascade.keywords ?? staticOptions.keywords.map(k => k.keyword)) : staticOptions.keywords.map(k => k.keyword),
        [cascade, staticOptions.keywords]
    );
    const availableLevels = useMemo(
        () => cascade ? (cascade.levels ?? POSITION_LEVELS) : POSITION_LEVELS,
        [cascade]
    );
    const industryGroups = useMemo(
        () => [...new Set(staticOptions.industries.map(i => i.group))],
        [staticOptions.industries]
    );
    const availableIndustries = useMemo(
        () => filters.industry_group
            ? staticOptions.industries.filter(i => i.group === filters.industry_group).map(i => i.industry)
            : staticOptions.industries.map(i => i.industry),
        [staticOptions.industries, filters.industry_group]
    );
    const regions = useMemo(
        () => [...new Set(staticOptions.countries.map(c => c.region).filter(Boolean))].sort(),
        [staticOptions.countries]
    );
    const availableRegions = useMemo(
        () => cascade ? (cascade.regions ?? regions) : regions,
        [cascade, regions]
    );
    const availableCountries = useMemo(() => {
        if (cascade?.countries) return cascade.countries;
        const base = filters.regions.length > 0
            ? staticOptions.countries.filter(c => filters.regions.includes(c.region))
            : staticOptions.countries;
        return base.map(c => c.country);
    }, [cascade, staticOptions.countries, filters.regions]);
    const jobFunctionOptions = useMemo(
        () => cascade ? (cascade.job_functions ?? staticOptions.jobFunctions) : staticOptions.jobFunctions,
        [cascade, staticOptions.jobFunctions]
    );
    const positionOptions = useMemo(() => cascade?.positions ?? [], [cascade]);
    const genderOptions = useMemo(() => cascade?.genders ?? [], [cascade]);
    const nationalityOptions = useMemo(() => cascade?.nationalities ?? [], [cascade]);

    const activeCount = [
        filters.position_keywords.length,
        filters.position_levels.length,
        filters.industry_group ? 1 : 0,
        filters.industries.length,
        filters.regions.length,
        filters.countries.length,
        (filters.current_only || filters.current_and_latest) ? 1 : 0,
        filters.job_functions.length,
        filters.positions.length,
        filters.companies.length,
        filters.genders.length,
        filters.nationalities.length,
        (filters.age_min !== null || filters.age_max !== null) ? 1 : 0,
    ].reduce((a, b) => a + b, 0);

    return (
        <div className="w-60 shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filters
                    {activeCount > 0 && (
                        <Badge className="h-4 px-1.5 text-[10px] bg-indigo-600 text-white">{activeCount}</Badge>
                    )}
                    {cascadeLoading && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                </span>
                {activeCount > 0 && (
                    <button onClick={onReset} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-red-500 transition-colors">
                        <RotateCcw className="h-3 w-3" /> Reset
                    </button>
                )}
            </div>

            {/* Filter rows */}
            <div className="py-1">
                <SectionLabel label="Position" />
                <FilterPopover
                    label="Keywords"
                    options={keywordOptions}
                    selected={filters.position_keywords}
                    onChange={v => set("position_keywords", v)}
                    placeholder="Search keywords..."
                />
                <FilterPopover
                    label="Level"
                    options={availableLevels}
                    selected={filters.position_levels}
                    onChange={v => set("position_levels", v)}
                    placeholder="Search level..."
                />

                <SectionLabel label="Industry" />
                <IndustryGroupPopover
                    groups={industryGroups}
                    selected={filters.industry_group}
                    onChange={v => set("industry_group", v)}
                />
                <FilterPopover
                    label="Industry"
                    options={availableIndustries}
                    selected={filters.industries}
                    onChange={v => set("industries", v)}
                    placeholder="Search industry..."
                />

                <SectionLabel label="Location" />
                <FilterPopover
                    label="Region"
                    options={availableRegions}
                    selected={filters.regions}
                    onChange={v => set("regions", v)}
                    placeholder="Search region..."
                />
                <FilterPopover
                    label="Country"
                    options={availableCountries}
                    selected={filters.countries}
                    onChange={v => set("countries", v)}
                    placeholder="Search country..."
                />

                <SectionLabel label="Other" />
                <FilterPopover
                    label="Gender"
                    options={genderOptions}
                    selected={filters.genders}
                    onChange={v => set("genders", v)}
                    placeholder="Search gender..."
                    emptyHint="Apply filters first"
                />
                <FilterPopover
                    label="Nationality"
                    options={nationalityOptions}
                    selected={filters.nationalities}
                    onChange={v => set("nationalities", v)}
                    placeholder="Search nationality..."
                    emptyHint="Apply filters first"
                />
                <AgeFilterPopover
                    ageMin={filters.age_min}
                    ageMax={filters.age_max}
                    includeUnknown={filters.age_include_unknown}
                    onChange={(min, max, incl) => onChange({ ...filters, age_min: min, age_max: max, age_include_unknown: incl })}
                />

                {/* Experience Scope — 3-way selector */}
                <div className="px-3 py-2 flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Experience Scope</span>
                    {([
                        { label: "All Experiences",      value: "all" },
                        { label: "Current + Latest",     value: "current_and_latest" },
                        { label: "Current Only",         value: "current_only" },
                    ] as const).map(opt => {
                        const active =
                            opt.value === "current_only"        ? filters.current_only :
                            opt.value === "current_and_latest"  ? filters.current_and_latest :
                            !filters.current_only && !filters.current_and_latest;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => onChange({
                                    ...filters,
                                    current_only:        opt.value === "current_only",
                                    current_and_latest:  opt.value === "current_and_latest",
                                })}
                                className={cn(
                                    "w-full text-left text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors",
                                    active
                                        ? "bg-indigo-600 text-white"
                                        : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>

                <FilterPopover
                    label="Job Function"
                    options={jobFunctionOptions}
                    selected={filters.job_functions}
                    onChange={v => set("job_functions", v)}
                    placeholder="Search function..."
                />
                <LiveSearchPopover
                    label="Position (actual)"
                    selected={filters.positions}
                    onChange={v => set("positions", v)}
                    activeFilters={filters}
                    onSearch={onSearchPositions}
                    placeholder='เช่น "Visual Merch", "F&B Manager"...'
                    emptyHint="พิมพ์เพื่อค้นหาตำแหน่งจากข้อมูลจริง"
                />
                <LiveSearchPopover
                    label="Company"
                    selected={filters.companies}
                    onChange={v => set("companies", v)}
                    activeFilters={filters}
                    onSearch={onSearchCompanies}
                    placeholder='เช่น "Marriott", "Minor Hotel"...'
                    emptyHint="พิมพ์เพื่อค้นหาบริษัทจากข้อมูลจริง"
                />

                <SectionLabel label="Exclude" />
                <LiveSearchPopover
                    label="Exclude Company"
                    selected={filters.exclude_companies}
                    onChange={v => set("exclude_companies", v)}
                    activeFilters={filters}
                    onSearch={onSearchCompanies}
                    placeholder='เช่น "Marriott"...'
                    emptyHint="พิมพ์ชื่อบริษัทที่ต้องการ exclude"
                    variant="exclude"
                />
                <FilterPopover
                    label="Exclude Country"
                    options={availableCountries.filter(o => !filters.countries.includes(o))}
                    selected={filters.exclude_countries}
                    onChange={v => set("exclude_countries", v)}
                    placeholder="Exclude country..."
                    variant="exclude"
                />
                <FilterPopover
                    label="Exclude Keyword"
                    options={keywordOptions.filter(o => !filters.position_keywords.includes(o))}
                    selected={filters.exclude_keywords}
                    onChange={v => set("exclude_keywords", v)}
                    placeholder="Exclude keyword..."
                    variant="exclude"
                />
                <div className="pb-1" />
            </div>
        </div>
    );
}
