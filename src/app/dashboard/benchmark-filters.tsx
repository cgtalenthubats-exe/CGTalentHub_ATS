"use client";

import React, { useMemo, useState } from "react";
import { Briefcase, Building2, Factory, RotateCcw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { ActiveFilterChips } from "@/components/ui/active-filter-chips";
import type { BenchmarkCandidate } from "@/app/actions/benchmark-actions";

/**
 * The candidate filter bar shared by the dashboard's benchmark tabs.
 *
 * Each dropdown offers only values that still exist once every *other* filter is applied, so the
 * options never lead to an empty result. That logic was written out seven times per tab; it is
 * generated from the field list below instead.
 */

interface FilterField {
    key: string;
    label: string;
    field: keyof BenchmarkCandidate;
    icon?: any;
    /** Placeholder values in the data that should never appear as a choice. */
    exclude?: string[];
}

export const BENCHMARK_FILTER_FIELDS: FilterField[] = [
    { key: "industry", label: "Industry", field: "company_industry", icon: Factory },
    { key: "group", label: "Company Group", field: "company_group", icon: Building2 },
    { key: "jobGrouping", label: "Job Grouping", field: "job_grouping", icon: Briefcase, exclude: ["NA", "Not found exp"] },
    { key: "jobFunction", label: "Job Function", field: "job_function", exclude: ["NA", "Not found exp"] },
    { key: "company", label: "Company", field: "company" },
    { key: "position", label: "Position", field: "position" },
    { key: "rating", label: "Rating", field: "rating", icon: Star },
];

export interface BenchmarkFilters {
    selected: Record<string, string[]>;
    filtered: BenchmarkCandidate[];
    options: Record<string, string[]>;
    toggle: (key: string, value: string) => void;
    remove: (key: string, value: string) => void;
    reset: () => void;
    activeCount: number;
}

function valuesOf(rows: BenchmarkCandidate[], f: FilterField): string[] {
    const exclude = f.exclude ?? [];
    return Array.from(
        new Set(rows.map(r => (r as any)[f.field]).filter(v => v && !exclude.includes(v)))
    ).sort() as string[];
}

export function useBenchmarkFilters(rows: BenchmarkCandidate[]): BenchmarkFilters {
    const [selected, setSelected] = useState<Record<string, string[]>>({});

    const apply = (source: BenchmarkCandidate[], skipKey?: string) =>
        BENCHMARK_FILTER_FIELDS.reduce((acc, f) => {
            if (f.key === skipKey) return acc;
            const picked = selected[f.key] ?? [];
            if (picked.length === 0) return acc;
            return acc.filter(r => picked.includes(((r as any)[f.field] as string) || ""));
        }, source);

    const filtered = useMemo(() => apply(rows), [rows, selected]);

    const options = useMemo(
        () => Object.fromEntries(
            BENCHMARK_FILTER_FIELDS.map(f => [f.key, valuesOf(apply(rows, f.key), f)])
        ) as Record<string, string[]>,
        [rows, selected]
    );

    return {
        selected,
        filtered,
        options,
        toggle: (key, value) => setSelected(prev => {
            const cur = prev[key] ?? [];
            return { ...prev, [key]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] };
        }),
        remove: (key, value) => setSelected(prev => ({ ...prev, [key]: (prev[key] ?? []).filter(v => v !== value) })),
        reset: () => setSelected({}),
        activeCount: Object.values(selected).reduce((n, v) => n + v.length, 0),
    };
}

export function BenchmarkFilterBar({ filters }: { filters: BenchmarkFilters }) {
    return (
        <>
            <div className="flex flex-wrap gap-3 items-center p-4 bg-muted/30 rounded-lg border">
                {BENCHMARK_FILTER_FIELDS.map(f => (
                    <FilterMultiSelect
                        key={f.key}
                        label={f.label}
                        icon={f.icon}
                        options={filters.options[f.key] ?? []}
                        selected={filters.selected[f.key] ?? []}
                        onChange={val => filters.toggle(f.key, val)}
                    />
                ))}
                <Button variant="ghost" size="sm" onClick={filters.reset} className="gap-2 text-slate-500 hover:text-red-500">
                    <RotateCcw className="h-3 w-3" /> Reset
                </Button>
            </div>

            <ActiveFilterChips
                groups={BENCHMARK_FILTER_FIELDS.map(f => ({
                    label: f.label,
                    values: filters.selected[f.key] ?? [],
                    onRemove: (v: string) => filters.remove(f.key, v),
                }))}
            />
        </>
    );
}
