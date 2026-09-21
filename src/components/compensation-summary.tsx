"use client";

import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPENSATION_FIELDS, isNumericField, type CompensationField } from "@/lib/compensation-fields";
import { benefitState, formatAmount, readCompensation } from "@/lib/compensation";

/**
 * Read-only view of a candidate's compensation, generated from the same field list as the entry
 * form so the two can't disagree about what exists or what it's called.
 *
 * A benefit with no amount is no longer just a dash: "provided, amount unknown" and "confirmed
 * none" are now distinguishable from "nobody asked".
 */

function StateBadge({ state }: { state: "provided" | "none" | "unknown" }) {
    if (state === "provided") {
        return (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
                <Check className="h-3 w-3" /> Provided
            </span>
        );
    }
    if (state === "none") {
        return (
            <span className="inline-flex items-center gap-1 text-slate-400 font-bold text-xs">
                <X className="h-3 w-3" /> None
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-slate-300 font-bold text-xs">
            <Minus className="h-3 w-3" /> Not asked
        </span>
    );
}

function displayValue(field: CompensationField, candidate: any) {
    const raw = candidate?.[field.key];
    if (raw === null || raw === undefined || raw === "") return null;
    if (field.type === "multiselect") {
        return (
            <div className="flex flex-wrap gap-1">
                {String(raw).split(",").map((item, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold border border-indigo-100 uppercase">
                        {item.trim()}
                    </span>
                ))}
            </div>
        );
    }
    if (isNumericField(field)) {
        const formatted = formatAmount(raw);
        if (!formatted) return null;
        const prefix = field.unit?.startsWith("฿") ? "฿" : "";
        const suffix = field.unit && !field.unit.startsWith("฿") ? ` ${field.unit}` : "";
        return <span className="font-bold text-slate-700">{prefix}{formatted}{suffix}</span>;
    }
    return <span className="font-bold text-slate-700 truncate" title={String(raw)}>{String(raw)}</span>;
}

export function CompensationSummary({ candidate, className }: { candidate: any; className?: string }) {
    const { provided } = readCompensation(candidate);

    // Retired fields stay visible only where an old value exists, so nothing silently disappears.
    const fields = COMPENSATION_FIELDS.filter(f => !f.retired || !!candidate?.[f.key]);
    const note = candidate?.others_benefit;

    return (
        <div className={cn("space-y-5", className)}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5 text-sm">
                {fields.filter(f => f.type !== "textarea").map(field => {
                    const value = displayValue(field, candidate);
                    const state = benefitState(field, candidate, provided);
                    return (
                        <div key={field.key} className="space-y-1 min-w-0">
                            <p className="text-[9px] uppercase font-black tracking-widest text-slate-400 leading-tight">
                                {field.label}
                                {field.unit && <span className="text-slate-300 normal-case"> ({field.unit})</span>}
                            </p>
                            {value ?? <StateBadge state={state === "amount" ? "provided" : state} />}
                        </div>
                    );
                })}
            </div>

            {note && (
                <div className="pt-4 border-t border-slate-200/50">
                    <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-2">Note</p>
                    <p className="text-xs font-medium text-slate-600 leading-relaxed italic">&ldquo;{note}&rdquo;</p>
                </div>
            )}
        </div>
    );
}
