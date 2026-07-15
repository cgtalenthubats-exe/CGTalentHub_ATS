"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarRange, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthRangePickerProps {
    fromMonth: string; // YYYY-MM or ""
    toMonth: string;   // YYYY-MM or ""
    onFromChange: (val: string) => void;
    onToChange: (val: string) => void;
    className?: string;
}

function MonthPanel({
    label,
    value,
    onChange,
    min,
    max,
}: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    min?: string;
    max?: string;
}) {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState<number>(() => {
        if (value) return parseInt(value.split("-")[0]);
        return currentYear;
    });

    useEffect(() => {
        if (value) setYear(parseInt(value.split("-")[0]));
    }, [value]);

    const selectedMonth = value ? parseInt(value.split("-")[1]) - 1 : -1;
    const selectedYear = value ? parseInt(value.split("-")[0]) : -1;

    return (
        <div className="flex flex-col gap-2 min-w-[160px]">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
            <div className="flex items-center justify-between gap-1">
                <button
                    onClick={() => setYear(y => y - 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                    <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-sm font-black text-slate-800">{year}</span>
                <button
                    onClick={() => setYear(y => y + 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                    <ChevronRight className="h-3.5 w-3.5" />
                </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
                {MONTHS.map((m, i) => {
                    const val = `${year}-${String(i + 1).padStart(2, "0")}`;
                    const isSelected = selectedYear === year && selectedMonth === i;
                    const isDisabled = (min && val < min) || (max && val > max);
                    return (
                        <button
                            key={m}
                            disabled={!!isDisabled}
                            onClick={() => onChange(val)}
                            className={cn(
                                "text-xs font-bold px-1 py-1.5 rounded-lg transition-colors",
                                isSelected
                                    ? "bg-indigo-600 text-white"
                                    : isDisabled
                                        ? "text-slate-300 cursor-not-allowed"
                                        : "hover:bg-indigo-50 text-slate-700"
                            )}
                        >
                            {m}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function formatMonthLabel(yyyymm: string) {
    if (!yyyymm) return "";
    const [y, m] = yyyymm.split("-");
    return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

export function MonthRangePicker({
    fromMonth,
    toMonth,
    onFromChange,
    onToChange,
    className,
}: MonthRangePickerProps) {
    const hasRange = fromMonth && toMonth;

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onFromChange("");
        onToChange("");
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        "h-9 flex items-center gap-2 rounded-lg border bg-slate-50 px-3 text-xs font-bold text-slate-700 shadow-sm hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors min-w-[160px]",
                        hasRange ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200",
                        className
                    )}
                >
                    <CalendarRange className="h-3.5 w-3.5 flex-shrink-0" />
                    {hasRange
                        ? <span className="truncate">{formatMonthLabel(fromMonth)} – {formatMonthLabel(toMonth)}</span>
                        : <span>Period Range</span>
                    }
                    {hasRange && (
                        <span
                            role="button"
                            onClick={handleClear}
                            className="ml-auto p-0.5 rounded hover:bg-indigo-200 text-indigo-500"
                        >
                            <X className="h-3 w-3" />
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-4 rounded-2xl shadow-xl border-slate-100">
                <div className="flex gap-6">
                    <MonthPanel
                        label="From"
                        value={fromMonth}
                        onChange={onFromChange}
                        max={toMonth || undefined}
                    />
                    <div className="w-px bg-slate-100" />
                    <MonthPanel
                        label="To"
                        value={toMonth}
                        onChange={onToChange}
                        min={fromMonth || undefined}
                    />
                </div>
                {hasRange && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                        <button
                            onClick={() => { onFromChange(""); onToChange(""); }}
                            className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
                        >
                            Clear range
                        </button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
