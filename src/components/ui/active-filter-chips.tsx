"use client";

import { X } from "lucide-react";

export interface FilterChipGroup {
    label: string;
    values: string[];
    onRemove: (value: string) => void;
}

export function ActiveFilterChips({ groups }: { groups: FilterChipGroup[] }) {
    const chips = groups.flatMap(g => g.values.map(value => ({ label: g.label, value, onRemove: g.onRemove })));
    if (!chips.length) return null;

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1">Active:</span>
            {chips.map((c, i) => (
                <button
                    key={`${c.label}-${c.value}-${i}`}
                    onClick={() => c.onRemove(c.value)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full pl-2.5 pr-1.5 py-0.5 hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                    <span className="text-indigo-400">{c.label}:</span> {c.value}
                    <X className="h-3 w-3" />
                </button>
            ))}
        </div>
    );
}
