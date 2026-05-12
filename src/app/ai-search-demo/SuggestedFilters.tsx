"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DemoFilterState, AiParseResult } from "./types";

type SuggestionMap = AiParseResult["suggestions"];

const LABELS: Record<keyof SuggestionMap, string> = {
    position_keywords:  "Position Keywords",
    position_levels:    "Position Level",
    industries:         "Industry",
    regions:            "Region",
    countries:          "Country",
    hotel_ratings:      "Hotel Rating",
    job_functions:      "Job Function",
    exclude_companies:  "Exclude Company",
    exclude_countries:  "Exclude Country",
    exclude_keywords:   "Exclude Keyword",
};

const PREVIEW = 3;

interface SuggestedFiltersProps {
    suggestions: SuggestionMap;
    filters: DemoFilterState;
    onAdd: (key: keyof DemoFilterState, value: string) => void;
}

function SuggestionGroup({
    label, items, activeValues, onAdd,
}: {
    label: string;
    items: string[];
    activeValues: string[];
    onAdd: (val: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const available = items.filter((v) => !activeValues.includes(v));
    if (available.length === 0) return null;

    const shown = expanded ? available : available.slice(0, PREVIEW);
    const remaining = available.length - PREVIEW;

    return (
        <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
            <div className="flex flex-wrap gap-1.5">
                {shown.map((val) => (
                    <button
                        key={val}
                        onClick={() => onAdd(val)}
                        className={cn(
                            "flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors",
                            "bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400"
                        )}
                    >
                        <Plus className="h-3 w-3" />
                        {val}
                    </button>
                ))}
                {!expanded && remaining > 0 && (
                    <button
                        onClick={() => setExpanded(true)}
                        className="text-xs px-2 py-1 text-slate-400 hover:text-slate-600 underline underline-offset-2"
                    >
                        +{remaining} more
                    </button>
                )}
            </div>
        </div>
    );
}

export function SuggestedFilters({ suggestions, filters, onAdd }: SuggestedFiltersProps) {
    const keys = Object.keys(suggestions) as (keyof SuggestionMap)[];
    const hasAny = keys.some((k) => (suggestions[k]?.length ?? 0) > 0);
    if (!hasAny) return null;

    return (
        <div className="bg-white border border-dashed border-indigo-200 rounded-xl px-3 py-3 flex flex-col gap-3">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Suggested Filters</p>
            {keys.map((key) => {
                const items = suggestions[key] ?? [];
                if (items.length === 0) return null;
                const activeValues = (filters[key] as string[] | undefined) ?? [];
                return (
                    <SuggestionGroup
                        key={key}
                        label={LABELS[key]}
                        items={items}
                        activeValues={activeValues}
                        onAdd={(val) => onAdd(key as keyof DemoFilterState, val)}
                    />
                );
            })}
        </div>
    );
}
