"use client";

import * as React from "react";
import { AlertTriangle, Check, Minus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    compensationFieldsByGroup,
    isNumericField,
    type CompensationField,
} from "@/lib/compensation-fields";
import { computeGroupTotals, computeSalaryTotals, formatAmount, isCurrentExperience, parseAmount, type CompensationDraft } from "@/lib/compensation";
import { formatMonthYear, parseAnyDate } from "@/lib/date-utils";

/**
 * The compensation & benefits inputs, generated from COMPENSATION_FIELDS so every form that
 * collects them stays identical. Previously each form spelled the fields out by hand and they
 * had drifted — different subsets got thousand separators, and new fields had to be added in
 * three places.
 */

function formatOnType(field: CompensationField, raw: string): string {
    if (!isNumericField(field)) {
        // Free-text fields like Housing can hold either an amount ("35,000") or a note
        // ("company provides shared house"). Only add thousand separators when what's
        // been typed so far is purely numeric, so the note case is left untouched.
        if (!/^\d[\d,]*\.?\d*$/.test(raw)) return raw;
        const cleaned = raw.replace(/,/g, "");
        const [whole, ...rest] = cleaned.split(".");
        const withCommas = whole ? Number(whole).toLocaleString("en-US") : "";
        return rest.length > 0 ? `${withCommas}.${rest.join("")}` : withCommas;
    }
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
                    value === false ? "bg-red-500 text-white" : "bg-white text-slate-300 hover:text-red-500"
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

/**
 * Explains the has-it / confirmed-none / not-asked marks. Sits right under the section heading
 * (not buried below the grid) so the meaning is visible before anyone starts ticking boxes.
 */
function ProvidedLegend() {
    return (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-700">
            <span className="inline-flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-emerald-500 text-white"><Check className="h-3 w-3" /></span>
                Has this benefit
            </span>
            <span className="inline-flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-red-500 text-white"><X className="h-3 w-3" /></span>
                Confirmed none
            </span>
            <span className="inline-flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded border border-dashed border-slate-300 text-slate-400"><Minus className="h-3 w-3" /></span>
                Not asked yet
            </span>
        </div>
    );
}

export interface ExperienceOption {
    id: string | number;
    position?: string | null;
    company?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    is_current_job?: string | null;
}

function experienceLabel(exp: ExperienceOption): string {
    const isCurrent = isCurrentExperience(exp);
    const range = `${formatMonthYear(exp.start_date)} — ${isCurrent ? "Present" : formatMonthYear(exp.end_date)}`;
    return `${exp.position || "Unknown position"} at ${exp.company || "Unknown company"} (${range})`;
}

export function CurrentBadge({ className }: { className?: string }) {
    return (
        <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700", className)}>
            Current
        </span>
    );
}

/**
 * Compensation is still one record per candidate, not one per experience — but recruiters need to
 * know which job the figures below came from. This just records a pointer to one experience
 * rather than splitting every field, so it stays amber until someone picks one.
 */
function ExperiencePicker({
    experiences,
    value,
    onChange,
}: {
    experiences: ExperienceOption[];
    value: string | null | undefined;
    onChange: (id: string | null) => void;
}) {
    if (experiences.length === 0) return null;
    const isSet = !!value;
    // Same order as the Experience timeline on the candidate profile card (sortExperiences in
    // candidate-experience-utils.ts): current job(s) first, then most recent start_date first.
    const sortValue = (d: string | null | undefined) => {
        const parsed = parseAnyDate(d);
        return parsed ? parsed.getFullYear() * 100 + (parsed.getMonth() + 1) : 0;
    };
    const sortedExperiences = [...experiences].sort((a, b) => {
        const aCurrent = isCurrentExperience(a) ? 0 : 1;
        const bCurrent = isCurrentExperience(b) ? 0 : 1;
        if (aCurrent !== bCurrent) return aCurrent - bCurrent;
        return sortValue(b.start_date) - sortValue(a.start_date);
    });

    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2",
                isSet ? "border-slate-200 bg-white" : "border-amber-300 bg-amber-50"
            )}
        >
            <span
                className={cn(
                    "inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest shrink-0",
                    isSet ? "text-slate-500" : "text-amber-700"
                )}
            >
                {!isSet && <AlertTriangle className="h-3.5 w-3.5" />}
                Reported for
            </span>
            <Select value={value || undefined} onValueChange={v => onChange(v)}>
                <SelectTrigger
                    className={cn(
                        "h-8 text-xs flex-1 min-w-[220px]",
                        isSet ? "bg-white" : "bg-amber-100 border-amber-300 text-amber-800 font-bold"
                    )}
                >
                    <SelectValue placeholder="Which experience is this for? Not set yet" />
                </SelectTrigger>
                <SelectContent>
                    {sortedExperiences.map(exp => (
                        <SelectItem key={String(exp.id)} value={String(exp.id)}>
                            <span className="inline-flex items-center gap-1.5">
                                {experienceLabel(exp)}
                                {isCurrentExperience(exp) && <CurrentBadge />}
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function TotalsBar({ label, monthly, yearly }: { label: string; monthly: number | null; yearly: number | null }) {
    if (monthly === null && yearly === null) return null;
    return (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">{label}</span>
            {monthly !== null && (
                <span className="text-xs font-black text-emerald-800">
                    ฿{formatAmount(monthly)} <span className="font-bold text-emerald-600">/ month</span>
                </span>
            )}
            {yearly !== null && (
                <span className="text-xs font-black text-emerald-800">
                    ฿{formatAmount(yearly)} <span className="font-bold text-emerald-600">/ year</span>
                </span>
            )}
        </div>
    );
}

function SelectField({ field, value, onChange, disabled }: { field: CompensationField; value: string; onChange: (v: string) => void; disabled?: boolean }) {
    return (
        <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="h-9 text-sm bg-white">
                <SelectValue placeholder={disabled ? "—" : "Select..."} />
            </SelectTrigger>
            <SelectContent>
                {(field.options || []).map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export function CompensationFieldsGrid({
    draft,
    onChange,
    experiences,
    className,
}: {
    draft: CompensationDraft;
    onChange: (next: CompensationDraft) => void;
    /** This candidate's experiences, for the "reported for" picker. Omit to hide it. */
    experiences?: ExperienceOption[];
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

    const salaryTotals = computeSalaryTotals(draft);

    return (
        <div className={cn("space-y-6", className)}>
            {experiences && experiences.length > 0 && (
                <ExperiencePicker
                    experiences={experiences}
                    value={draft.experienceId}
                    onChange={id => onChange({ ...draft, experienceId: id })}
                />
            )}
            <ProvidedLegend />
            {compensationFieldsByGroup().map(group => (
                <div key={group.group} className="space-y-3">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{group.label}</h5>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {group.fields.map(field => {
                            const provided = draft.provided?.[field.key];
                            const amountDisabled = provided === false;
                            const isWide = field.type === "textarea";
                            const rawValue = draft.values[field.key] ?? "";
                            const hasValue = typeof rawValue === "string" ? rawValue.trim() !== "" : !!rawValue;
                            const isAnswered = hasValue || provided === true;

                            return (
                                <div key={field.key} className={cn("space-y-1.5", isWide && "col-span-2 lg:col-span-4")}>
                                    <div className="flex items-start justify-between gap-2 min-h-[18px]">
                                        <Label
                                            className={cn(
                                                "text-[10px] font-black uppercase tracking-widest leading-tight",
                                                isAnswered ? "text-emerald-700" : "text-slate-600"
                                            )}
                                        >
                                            {field.label}
                                            {field.unit && (
                                                <span className={cn("normal-case", isAnswered ? "text-emerald-500" : "text-slate-400")}> ({field.unit})</span>
                                            )}
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
                                    ) : field.type === "select" ? (
                                        <SelectField
                                            field={field}
                                            value={draft.values[field.key] ?? ""}
                                            onChange={v => setValue(field.key, v)}
                                            disabled={amountDisabled}
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
                                        <p className="text-[10px] text-slate-500 font-medium leading-tight">{field.hint}</p>
                                    )}
                                    {field.key === "bonus_mth" && salaryTotals.bonusAmount !== null && (
                                        <p className="text-[10px] text-emerald-600 font-bold leading-tight">
                                            = ฿{formatAmount(salaryTotals.bonusAmount)} total
                                        </p>
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

                    {group.group === "salary" && (
                        <TotalsBar label="Total Package" monthly={salaryTotals.monthly} yearly={salaryTotals.yearly} />
                    )}
                    {group.group === "allowance" && (() => {
                        const t = computeGroupTotals(group.fields, draft);
                        return <TotalsBar label="Total Allowances" monthly={t.monthly} yearly={t.yearly} />;
                    })()}
                    {group.group === "health" && (() => {
                        const t = computeGroupTotals(group.fields, draft);
                        return <TotalsBar label="Total Health & Welfare" monthly={t.monthly} yearly={t.yearly} />;
                    })()}
                </div>
            ))}
        </div>
    );
}

/** Keeps a candidate row and the grid's draft state in sync for the forms that use it. */
export function useCompensationDraft(initial: CompensationDraft) {
    const [draft, setDraft] = React.useState<CompensationDraft>(initial);
    return { draft, setDraft };
}

export { formatAmount };
