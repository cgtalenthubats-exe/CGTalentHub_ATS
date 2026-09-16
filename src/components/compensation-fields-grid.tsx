"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
    compensationFieldsByGroup,
    isNumericField,
    type CompensationField,
} from "@/lib/compensation-fields";
import { formatAmount, parseAmount, type CompensationDraft } from "@/lib/compensation";

/**
 * The compensation & benefits inputs, generated from COMPENSATION_FIELDS so every form that
 * collects them stays identical. Previously each form spelled the fields out by hand and they
 * had drifted — different subsets got thousand separators, and new fields had to be added in
 * three places.
 */

function formatOnType(field: CompensationField, raw: string): string {
    if (!isNumericField(field)) return raw;
    // Keep digits, one dot and a leading minus; everything else a user types is noise here.
    const cleaned = raw.replace(/[^\d.]/g, "");
    if (cleaned === "") return "";
    if (field.type === "int") return cleaned.split(".")[0];
    if (field.type === "percent") return cleaned;
    // Money gets thousand separators while typing, but not mid-decimal.
    const [whole, ...rest] = cleaned.split(".");
    const withCommas = whole ? Number(whole).toLocaleString("en-US") : "";
    return rest.length > 0 ? `${withCommas}.${rest.join("")}` : withCommas;
}

/**
 * Yes / No / unanswered. Clicking the active choice clears it back to unanswered, so a mis-click
 * doesn't leave a wrong fact behind — "nobody asked" is a real state we need to keep.
 */
function ProvidedToggle({ value, onChange }: { value: boolean | undefined; onChange: (v: boolean | undefined) => void }) {
    return (
        <span className="inline-flex rounded-md border border-slate-200 overflow-hidden shrink-0">
            <button
                type="button"
                title="Has this benefit"
                aria-pressed={value === true}
                onClick={() => onChange(value === true ? undefined : true)}
                className={cn(
                    "h-5 w-6 flex items-center justify-center transition-colors",
                    value === true ? "bg-emerald-500 text-white" : "bg-white text-slate-300 hover:text-emerald-500"
                )}
            >
                <Check className="h-3 w-3" />
            </button>
            <button
                type="button"
                title="Confirmed: does not have this benefit"
                aria-pressed={value === false}
                onClick={() => onChange(value === false ? undefined : false)}
                className={cn(
                    "h-5 w-6 flex items-center justify-center border-l border-slate-200 transition-colors",
                    value === false ? "bg-slate-400 text-white" : "bg-white text-slate-300 hover:text-slate-500"
                )}
            >
                <X className="h-3 w-3" />
            </button>
        </span>
    );
}

function MultiSelectField({ field, value, onChange }: { field: CompensationField; value: string; onChange: (v: string) => void }) {
    const selected = value ? value.split(",").map(s => s.trim()).filter(Boolean) : [];
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 text-sm justify-start font-normal px-3 bg-white border-slate-200 truncate w-full">
                    {value || "Select options..."}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
                <div className="space-y-3">
                    {(field.options || []).map(opt => (
                        <div key={opt} className="flex items-center space-x-2">
                            <Checkbox
                                id={`${field.key}-${opt}`}
                                checked={selected.includes(opt)}
                                onCheckedChange={checked => {
                                    const next = checked
                                        ? [...new Set([...selected, opt])]
                                        : selected.filter(o => o !== opt);
                                    onChange(next.join(", "));
                                }}
                            />
                            <label htmlFor={`${field.key}-${opt}`} className="text-xs font-bold cursor-pointer">
                                {opt}
                            </label>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function CompensationFieldsGrid({
    draft,
    onChange,
    className,
}: {
    draft: CompensationDraft;
    onChange: (next: CompensationDraft) => void;
    className?: string;
}) {
    const setValue = (key: string, value: string) =>
        onChange({ ...draft, values: { ...draft.values, [key]: value } });

    const setProvided = (key: string, value: boolean | undefined) => {
        const next = { ...draft.provided };
        if (value === undefined) delete next[key];
        else next[key] = value;
        onChange({ ...draft, provided: next });
    };

    return (
        <div className={cn("space-y-6", className)}>
            {compensationFieldsByGroup().map(group => (
                <div key={group.group} className="space-y-3">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{group.label}</h5>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {group.fields.map(field => {
                            const provided = draft.provided?.[field.key];
                            const amountDisabled = provided === false;
                            const isWide = field.type === "textarea";

                            return (
                                <div key={field.key} className={cn("space-y-1.5", isWide && "col-span-2 lg:col-span-4")}>
                                    <div className="flex items-center justify-between gap-2 min-h-[18px]">
                                        <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest truncate">
                                            {field.label}
                                            {field.unit && <span className="text-slate-300 normal-case"> ({field.unit})</span>}
                                        </Label>
                                        {field.trackProvided && (
                                            <ProvidedToggle value={provided} onChange={v => setProvided(field.key, v)} />
                                        )}
                                    </div>

                                    {field.type === "textarea" ? (
                                        <textarea
                                            value={draft.values[field.key] ?? ""}
                                            onChange={e => setValue(field.key, e.target.value)}
                                            placeholder="Anything else worth recording..."
                                            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        />
                                    ) : field.type === "multiselect" ? (
                                        <MultiSelectField
                                            field={field}
                                            value={draft.values[field.key] ?? ""}
                                            onChange={v => setValue(field.key, v)}
                                        />
                                    ) : (
                                        <Input
                                            value={draft.values[field.key] ?? ""}
                                            onChange={e => setValue(field.key, formatOnType(field, e.target.value))}
                                            placeholder={amountDisabled ? "—" : isNumericField(field) ? "0" : ""}
                                            inputMode={isNumericField(field) ? "decimal" : undefined}
                                            disabled={amountDisabled}
                                            className="h-9 text-sm"
                                        />
                                    )}

                                    {field.hint && (
                                        <p className="text-[10px] text-slate-400 font-medium leading-tight">{field.hint}</p>
                                    )}
                                    {provided === true && isNumericField(field) && parseAmount(draft.values[field.key]) === null && (
                                        <p className="text-[10px] text-emerald-600 font-bold leading-tight">
                                            Marked as provided — amount not recorded
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
            <p className="text-[10px] text-slate-400 font-medium">
                <Check className="h-3 w-3 inline text-emerald-500" /> = has this benefit ·
                <X className="h-3 w-3 inline text-slate-400 ml-1" /> = confirmed none ·
                neither = not asked yet. Tick without an amount when you know they get it but not how much.
            </p>
        </div>
    );
}

/** Keeps a candidate row and the grid's draft state in sync for the forms that use it. */
export function useCompensationDraft(initial: CompensationDraft) {
    const [draft, setDraft] = React.useState<CompensationDraft>(initial);
    return { draft, setDraft };
}

export { formatAmount };
