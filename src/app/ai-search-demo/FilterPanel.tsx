"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronUp, X, SlidersHorizontal, RotateCcw, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    DemoFilterState,
    POSITION_LEVELS,
    HOTEL_RATINGS,
} from "./types";

interface StaticOptions {
    keywords: { keyword: string; group_label: string }[];
    industries: { group: string; industry: string }[];
    countries: { country: string; region: string }[];
    jobFunctions: string[];
}

interface CascadingOptions {
    keywords:      string[];
    levels:        string[];
    positions:     string[];
    companies:     string[];
    countries:     string[];
    hotel_ratings: string[];
    regions:       string[];
    job_functions: string[];
}

interface FilterPanelProps {
    staticOptions: StaticOptions;
    cascadingOptions: CascadingOptions | null;
    cascadeLoading?: boolean;
    filters: DemoFilterState;
    onChange: (filters: DemoFilterState) => void;
    onReset: () => void;
}

// --- Collapsible Section ---
function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
    const [open, setOpen] = useState(true);
    return (
        <div className="border-b border-slate-100 last:border-0">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between py-2.5 px-1 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
                <span className="flex items-center gap-2">
                    {title}
                    {count !== undefined && count > 0 && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-indigo-100 text-indigo-700">
                            {count}
                        </Badge>
                    )}
                </span>
                {open ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
            </button>
            {open && <div className="pb-3 px-1">{children}</div>}
        </div>
    );
}

// --- Tag multi-select with search ---
function TagSelect({
    options,
    selected,
    onChange,
    placeholder = "Search...",
    maxShow = 8,
    emptyHint,
    variant = "include",
}: {
    options: string[];
    selected: string[];
    onChange: (val: string[]) => void;
    placeholder?: string;
    maxShow?: number;
    emptyHint?: string;
    variant?: "include" | "exclude";
}) {
    const [search, setSearch] = useState("");
    const filtered = useMemo(
        () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase()) && !selected.includes(o)),
        [options, search, selected]
    );

    const toggle = (val: string) => {
        onChange(selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]);
    };

    if (options.length === 0 && selected.length === 0 && emptyHint) {
        return <p className="text-[11px] text-slate-400 italic">{emptyHint}</p>;
    }

    return (
        <div className="space-y-2">
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {selected.map((s) => (
                        <Badge key={s} variant="secondary" className={cn(
                            "text-xs pr-1 gap-1",
                            variant === "exclude"
                                ? "bg-red-50 text-red-700 border border-red-200 line-through"
                                : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                        )}>
                            <span className="max-w-[120px] truncate">{s}</span>
                            <button onClick={() => toggle(s)} className="ml-0.5 hover:text-red-500">
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
            <Input
                placeholder={placeholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs"
            />
            <div className="max-h-32 overflow-y-auto space-y-0.5">
                {filtered.slice(0, maxShow).map((o) => (
                    <button
                        key={o}
                        onClick={() => { toggle(o); setSearch(""); }}
                        className="w-full text-left text-xs px-2 py-1 rounded hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 truncate"
                    >
                        {o}
                    </button>
                ))}
                {filtered.length > maxShow && (
                    <p className="text-[10px] text-slate-400 px-2 py-1">{filtered.length - maxShow} more...</p>
                )}
                {filtered.length === 0 && search && (
                    <p className="text-[10px] text-slate-400 px-2 py-1">No results</p>
                )}
            </div>
        </div>
    );
}

// --- Checkbox group (pill style) ---
function CheckboxGroup({
    options,
    allOptions,
    selected,
    onChange,
}: {
    options: string[];
    allOptions: string[];
    selected: string[];
    onChange: (val: string[]) => void;
}) {
    const safeOptions = options ?? [];
    const safeSelected = selected ?? [];
    const toggle = (val: string) =>
        onChange(safeSelected.includes(val) ? safeSelected.filter((s) => s !== val) : [...safeSelected, val]);

    return (
        <div className="flex flex-wrap gap-1.5">
            {allOptions.map((o) => {
                const available = safeOptions.length === 0 || safeOptions.includes(o);
                const isSelected = safeSelected.includes(o);
                return (
                    <button
                        key={o}
                        onClick={() => toggle(o)}
                        className={cn(
                            "text-xs px-2.5 py-1 rounded-full border transition-colors",
                            isSelected
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : available
                                    ? "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                                    : "bg-slate-50 text-slate-300 border-slate-100 cursor-default"
                        )}
                        disabled={!available && !isSelected}
                    >
                        {o}
                    </button>
                );
            })}
        </div>
    );
}

// --- Main FilterPanel ---
export function FilterPanel({ staticOptions, cascadingOptions, cascadeLoading, filters, onChange, onReset }: FilterPanelProps) {
    const [localFilters, setLocalFilters] = useState<DemoFilterState>(filters);

    // Sync when external changes arrive (AI parse, reset)
    useEffect(() => { setLocalFilters(filters); }, [filters]);

    const set = <K extends keyof DemoFilterState>(key: K, value: DemoFilterState[K]) =>
        setLocalFilters(prev => ({ ...prev, [key]: value }));

    const hasPending = useMemo(
        () => JSON.stringify(localFilters) !== JSON.stringify(filters),
        [localFilters, filters]
    );

    const handleApply = () => onChange(localFilters);

    if (!staticOptions) return null;

    const cascade = cascadingOptions;

    // Keywords: cascade when available, else full static list
    const keywordOptions = useMemo(
        () => cascade ? (cascade.keywords ?? staticOptions.keywords.map((k) => k.keyword)) : staticOptions.keywords.map((k) => k.keyword),
        [cascade, staticOptions.keywords]
    );

    // Levels: use POSITION_LEVELS order, gray out unavailable ones via cascade
    const availableLevels = useMemo(
        () => cascade ? (cascade.levels ?? POSITION_LEVELS) : POSITION_LEVELS,
        [cascade]
    );

    // Industry group → filter industries (always from static)
    const industryGroups = useMemo(
        () => [...new Set(staticOptions.industries.map((i) => i.group))],
        [staticOptions.industries]
    );
    const availableIndustries = useMemo(
        () => filters.industry_group
            ? staticOptions.industries.filter((i) => i.group === filters.industry_group).map((i) => i.industry)
            : staticOptions.industries.map((i) => i.industry),
        [staticOptions.industries, filters.industry_group]
    );

    // Regions: always from static
    const regions = useMemo(
        () => [...new Set(staticOptions.countries.map((c) => c.region).filter(Boolean))].sort(),
        [staticOptions.countries]
    );

    // Countries: cascade when available, filtered by selected regions; else from static
    const availableCountries = useMemo(() => {
        if (cascade?.countries) return cascade.countries;
        const base = filters.regions.length > 0
            ? staticOptions.countries.filter((c) => filters.regions.includes(c.region))
            : staticOptions.countries;
        return base.map((c) => c.country);
    }, [cascade, staticOptions.countries, filters.regions]);

    // Job functions: cascade when available, else static
    const jobFunctionOptions = useMemo(
        () => cascade ? (cascade.job_functions ?? staticOptions.jobFunctions) : staticOptions.jobFunctions,
        [cascade, staticOptions.jobFunctions]
    );

    // Hotel ratings available: cascade when available, else all
    const availableHotelRatings = useMemo(
        () => cascade ? (cascade.hotel_ratings ?? HOTEL_RATINGS) : HOTEL_RATINGS,
        [cascade]
    );

    const availableRegions = useMemo(
        () => cascade ? (cascade.regions ?? regions) : regions,
        [cascade, regions]
    );

    // Positions: cascade only (dynamic, requires at least one filter)
    const positionOptions = useMemo(
        () => cascade?.positions ?? [],
        [cascade]
    );

    // Companies: cascade only (dynamic)
    const companyOptions = useMemo(
        () => cascade?.companies ?? [],
        [cascade]
    );

    const activeCount = [
        localFilters.position_keywords.length,
        localFilters.position_levels.length,
        localFilters.industry_group ? 1 : 0,
        localFilters.industries.length,
        localFilters.regions.length,
        localFilters.countries.length,
        localFilters.hotel_ratings.length,
        localFilters.current_only ? 1 : 0,
        localFilters.job_functions.length,
        localFilters.positions.length,
        localFilters.companies.length,
    ].reduce((a, b) => a + b, 0);

    return (
        <div className="w-60 shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 sticky top-0 bg-white z-10">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filters
                    {activeCount > 0 && (
                        <Badge className="h-4 px-1.5 text-[10px] bg-indigo-600 text-white">{activeCount}</Badge>
                    )}
                    {cascadeLoading && (
                        <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                    )}
                </span>
                <div className="flex items-center gap-1.5">
                    {hasPending && (
                        <button
                            onClick={handleApply}
                            className="flex items-center gap-1 text-[10px] font-bold bg-indigo-600 text-white px-2 py-1 rounded-md hover:bg-indigo-700 transition-colors"
                        >
                            <Check className="h-3 w-3" /> Apply
                        </button>
                    )}
                    {activeCount > 0 && (
                        <button onClick={onReset} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-red-500">
                            <RotateCcw className="h-3 w-3" /> Reset
                        </button>
                    )}
                </div>
            </div>

            <div className="px-3 py-1 divide-y divide-slate-100">
                {/* Position Keywords */}
                <Section title="Position Keywords" count={localFilters.position_keywords.length}>
                    <TagSelect
                        options={keywordOptions}
                        selected={localFilters.position_keywords}
                        onChange={(v) => set("position_keywords", v)}
                        placeholder="Search keywords..."
                    />
                </Section>

                {/* Position Level */}
                <Section title="Position Level" count={localFilters.position_levels.length}>
                    <CheckboxGroup
                        options={availableLevels}
                        allOptions={POSITION_LEVELS}
                        selected={localFilters.position_levels}
                        onChange={(v) => set("position_levels", v)}
                    />
                </Section>

                {/* Industry Group */}
                <Section title="Industry Group" count={localFilters.industry_group ? 1 : 0}>
                    <div className="space-y-1">
                        {industryGroups.map((g) => (
                            <button
                                key={g}
                                onClick={() => set("industry_group", localFilters.industry_group === g ? null : g)}
                                className={cn(
                                    "w-full text-left text-xs px-2 py-1.5 rounded transition-colors",
                                    localFilters.industry_group === g
                                        ? "bg-indigo-600 text-white"
                                        : "hover:bg-indigo-50 text-slate-600"
                                )}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </Section>

                {/* Industry */}
                <Section title="Industry" count={localFilters.industries.length}>
                    <TagSelect
                        options={availableIndustries}
                        selected={localFilters.industries}
                        onChange={(v) => set("industries", v)}
                        placeholder="Search industry..."
                    />
                </Section>

                {/* Region */}
                <Section title="Region" count={localFilters.regions.length}>
                    <CheckboxGroup
                        options={availableRegions}
                        allOptions={regions}
                        selected={localFilters.regions}
                        onChange={(v) => set("regions", v)}
                    />
                </Section>

                {/* Country */}
                <Section title="Country" count={localFilters.countries.length}>
                    <TagSelect
                        options={availableCountries}
                        selected={localFilters.countries}
                        onChange={(v) => set("countries", v)}
                        placeholder="Search country..."
                    />
                </Section>

                {/* Hotel Rating */}
                <Section title="Hotel Rating" count={localFilters.hotel_ratings.length}>
                    <CheckboxGroup
                        options={availableHotelRatings}
                        allOptions={HOTEL_RATINGS}
                        selected={localFilters.hotel_ratings}
                        onChange={(v) => set("hotel_ratings", v)}
                    />
                </Section>

                {/* Current Only */}
                <div className="py-3 flex items-center justify-between">
                    <span className="text-sm text-slate-700">Current Job Only</span>
                    <button
                        onClick={() => set("current_only", !localFilters.current_only)}
                        className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                            localFilters.current_only ? "bg-indigo-600" : "bg-slate-200"
                        )}
                    >
                        <span className={cn(
                            "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                            localFilters.current_only ? "translate-x-4" : "translate-x-1"
                        )} />
                    </button>
                </div>

                {/* Job Function */}
                <Section title="Job Function" count={localFilters.job_functions.length}>
                    <TagSelect
                        options={jobFunctionOptions}
                        selected={localFilters.job_functions}
                        onChange={(v) => set("job_functions", v)}
                        placeholder="Search function..."
                    />
                </Section>

                {/* Position (actual) — cascade only */}
                <Section title="Position (actual)" count={localFilters.positions.length}>
                    <TagSelect
                        options={positionOptions}
                        selected={localFilters.positions}
                        onChange={(v) => set("positions", v)}
                        placeholder="Search position..."
                        emptyHint="Select keywords or levels first"
                    />
                </Section>

                {/* Company — cascade only */}
                <Section title="Company" count={localFilters.companies.length}>
                    <TagSelect
                        options={companyOptions}
                        selected={localFilters.companies}
                        onChange={(v) => set("companies", v)}
                        placeholder="Search company..."
                        emptyHint="Apply filters first"
                    />
                </Section>

                {/* Exclude section */}
                <Section
                    title="Exclude"
                    count={localFilters.exclude_companies.length + localFilters.exclude_countries.length + localFilters.exclude_keywords.length}
                >
                    <div className="space-y-3">
                        <div>
                            <p className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider">Company</p>
                            <TagSelect
                                options={companyOptions.filter(o => !localFilters.companies.includes(o))}
                                selected={localFilters.exclude_companies}
                                onChange={(v) => set("exclude_companies", v)}
                                placeholder="Exclude company..."
                                emptyHint="Apply filters first"
                                variant="exclude"
                            />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider">Country</p>
                            <TagSelect
                                options={availableCountries.filter(o => !localFilters.countries.includes(o))}
                                selected={localFilters.exclude_countries}
                                onChange={(v) => set("exclude_countries", v)}
                                placeholder="Exclude country..."
                                variant="exclude"
                            />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider">Position Keyword</p>
                            <TagSelect
                                options={keywordOptions.filter(o => !localFilters.position_keywords.includes(o))}
                                selected={localFilters.exclude_keywords}
                                onChange={(v) => set("exclude_keywords", v)}
                                placeholder="Exclude keyword..."
                                variant="exclude"
                            />
                        </div>
                    </div>
                </Section>
            </div>
        </div>
    );
}
