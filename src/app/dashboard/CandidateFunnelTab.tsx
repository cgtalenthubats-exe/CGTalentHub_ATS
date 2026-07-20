"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
    getCandidatePopulationData, getPopulationFilterOptions, getCascadingPopulationOptions,
    PopulationData, PopulationFilterOptions, CascadingOptions, PopulationFilters, SetCompany,
} from "@/app/actions/candidate-population";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import {
    Loader2, Briefcase, Building2, ChevronRight, Globe2, Layers, RotateCcw, X, Cake, Flag, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Validated categorical palette ───────────────────────────────────────────
// 6 hues, checked with the dataviz skill's validator (CVD ΔE 9.2 worst-adjacent,
// normal-vision floor 15.5 — all pass). Slate is reserved for "Other/Unknown"
// so it never competes with a real category for a hue.
const CATEGORICAL = ["#6366f1", "#059669", "#7c3aed", "#0284c7", "#ea580c", "#f59e0b"];
const OTHER_COLOR = "#94a3b8";
const OTHER_NAMES = new Set(["other", "others", "unknown", "n/a", "not found", "undetermined", "no match found"]);

// Color follows the entity (name), never its row position — so re-filtering
// never repaints a category that's still present.
function colorForName(name: string): string {
    if (OTHER_NAMES.has(name.trim().toLowerCase())) return OTHER_COLOR;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return CATEGORICAL[hash % CATEGORICAL.length];
}

const EMPTY_FILTERS: PopulationFilters = {};
const EMPTY_CASCADE: CascadingOptions = { groups: [], industries: [], countries: [], continents: [], position_keywords: [], hotel_chains: [] };

function pct(n: number, total: number): number {
    return total > 0 ? Math.round((n / total) * 100) : 0;
}

function union(a: string[], b: string[]): string[] {
    return [...new Set([...a, ...b])].sort();
}

// ── Funnel stage card — connected sequence, % of previous stage ─────────────
function FunnelStage({
    label, value, prevValue, color, isFirst, sub,
}: { label: string; value: number; prevValue: number | null; color: string; isFirst: boolean; sub?: string }) {
    const dropPct = prevValue && prevValue > 0 ? Math.round((value / prevValue) * 100) : null;
    return (
        <div className="flex items-center gap-2 flex-1 min-w-[160px]">
            {!isFirst && <ChevronRight className="h-5 w-5 text-slate-300 shrink-0 hidden md:block" />}
            <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex-1 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: color }} />
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{label}</div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-800">{value.toLocaleString()}</span>
                    {dropPct !== null && (
                        <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: `${color}18`, color }}
                        >
                            {dropPct}%
                        </span>
                    )}
                </div>
                {sub && <div className="text-[10px] text-slate-400 font-medium mt-0.5">{sub}</div>}
            </div>
        </div>
    );
}

// ── Cross-cut metric card — NOT chained into the sequential funnel (its base
// is "Matching Filters", not the previous funnel stage) ────────────────────
function CrossCutCard({
    label, value, base, color, icon: Icon,
}: { label: string; value: number; base: number; color: string; icon: React.ElementType }) {
    return (
        <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-4 min-w-[200px] overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: color }} />
            <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="h-3 w-3" style={{ color }} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800">{value.toLocaleString()}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>
                    {pct(value, base)}% of matching filters
                </span>
            </div>
        </div>
    );
}

// ── Donut chart with side legend — used only where categories are few (≤7) ──
function DonutCard({
    title, subtitle, data, icon: Icon, selected, onSelect, interactive = true, filterTotal,
}: { title: string; subtitle?: string; data: { name: string; count: number }[]; icon: React.ElementType; selected: string[]; onSelect: (name: string) => void; interactive?: boolean; filterTotal?: number }) {
    const total = data.reduce((s, d) => s + d.count, 0);
    if (!data.length) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-center h-64 text-slate-400 text-xs font-bold uppercase tracking-widest">
                No data
            </div>
        );
    }
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
                <Icon className="h-3.5 w-3.5 text-slate-400" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h3>
                {filterTotal != null && <span className="text-xs font-black text-slate-900">· Total: {filterTotal.toLocaleString()}</span>}
                {interactive && <span className="text-xs text-indigo-500 font-bold ml-auto">click to filter</span>}
            </div>
            {subtitle && <p className="text-[10px] text-slate-400 mb-3">{subtitle}</p>}
            {!subtitle && <div className="mb-3" />}
            <div className="flex items-center gap-4">
                <div className="w-40 h-40 shrink-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data} dataKey="count" nameKey="name"
                                innerRadius={44} outerRadius={68} paddingAngle={2}
                                strokeWidth={2} stroke="#fff"
                                onClick={interactive ? (d: any) => onSelect(d.name) : undefined}
                                cursor={interactive ? "pointer" : "default"}
                            >
                                {data.map((d) => (
                                    <Cell
                                        key={d.name}
                                        fill={colorForName(d.name)}
                                        opacity={!interactive || selected.length === 0 || selected.includes(d.name) ? 1 : 0.3}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(v: any, n: any) => [`${v.toLocaleString()} (${pct(v, total)}%)`, n]}
                                contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: 700 }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-black text-slate-800">{total.toLocaleString()}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Total</span>
                    </div>
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                    {data.map(d => {
                        const isSelected = selected.includes(d.name);
                        const Row = interactive ? "button" : "div";
                        return (
                            <Row
                                key={d.name}
                                onClick={interactive ? () => onSelect(d.name) : undefined}
                                className={cn(
                                    "w-full flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors text-left",
                                    interactive && "cursor-pointer",
                                    isSelected ? "bg-indigo-50" : interactive ? "hover:bg-slate-50" : ""
                                )}
                            >
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorForName(d.name) }} />
                                <span className={cn("text-xs truncate flex-1", isSelected ? "font-black text-indigo-700" : "font-semibold text-slate-600")}>{d.name}</span>
                                <span className="text-xs font-black text-slate-700">{d.count.toLocaleString()}</span>
                                <span className="text-[10px] text-slate-400 w-8 text-right">{pct(d.count, total)}%</span>
                            </Row>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ── Badge grid — medium-cardinality categories as colored chip cards ────────
function BadgeGridCard({
    title, data, icon: Icon, selected, onSelect, filterTotal,
}: { title: string; data: { name: string; count: number }[]; icon: React.ElementType; selected: string[]; onSelect: (name: string) => void; filterTotal?: number }) {
    const total = data.reduce((s, d) => s + d.count, 0);
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
                <Icon className="h-3.5 w-3.5 text-slate-400" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h3>
                {filterTotal != null && <span className="text-xs font-black text-slate-900">· Total: {filterTotal.toLocaleString()}</span>}
                <span className="text-xs text-indigo-500 font-bold ml-auto">click to filter</span>
            </div>
            {!data.length ? (
                <div className="flex items-center justify-center h-40 text-slate-400 text-xs font-bold uppercase tracking-widest">
                    No data
                </div>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {data.map(d => {
                        const color = colorForName(d.name);
                        const isSelected = selected.includes(d.name);
                        return (
                            <button
                                key={d.name}
                                onClick={() => onSelect(d.name)}
                                className="flex items-center gap-2 rounded-xl border px-3 py-2 transition-all cursor-pointer"
                                style={{
                                    background: isSelected ? `${color}22` : `${color}0d`,
                                    borderColor: isSelected ? color : `${color}33`,
                                    borderWidth: isSelected ? 1.5 : 1,
                                }}
                            >
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                                <span className="text-xs font-bold text-slate-700">{d.name}</span>
                                <span
                                    className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                                    style={{ background: `${color}22`, color }}
                                >
                                    {d.count.toLocaleString()} · {pct(d.count, total)}%
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Ranked list — single-hue magnitude bars (not a rainbow per bar) ─────────
// Color here encodes rank/magnitude, not identity, so per the dataviz "one
// series → one hue" rule it stays one color; rank position already conveys order.
const RANK_BADGE: Record<number, string> = { 1: "#f59e0b", 2: "#94a3b8", 3: "#b45309" };

function RankedListCard({
    title, subtitle, data, icon: Icon, selected, onSelect, filterTotal,
}: { title: string; subtitle?: string; data: { name: string; count: number }[]; icon: React.ElementType; selected?: string[]; onSelect?: (name: string) => void; filterTotal?: number }) {
    const max = Math.max(...data.map(d => d.count), 1);
    const clickable = !!onSelect;
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
                <Icon className="h-3.5 w-3.5 text-slate-400" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h3>
                {filterTotal != null && <span className="text-xs font-black text-slate-900">· Total: {filterTotal.toLocaleString()}</span>}
                {clickable && <span className="text-xs text-indigo-500 font-bold ml-auto">click to filter</span>}
            </div>
            {subtitle && <p className="text-[10px] text-slate-400 mb-3">{subtitle}</p>}
            {!subtitle && <div className="mb-3" />}
            {!data.length ? (
                <div className="flex items-center justify-center h-40 text-slate-400 text-xs font-bold uppercase tracking-widest">
                    No data
                </div>
            ) : (
                <div className="space-y-1">
                    {data.map((d, i) => {
                        const isSelected = selected?.includes(d.name);
                        const Row = clickable ? "button" : "div";
                        return (
                            <Row
                                key={d.name}
                                onClick={clickable ? () => onSelect!(d.name) : undefined}
                                className={cn(
                                    "w-full flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors",
                                    clickable && "cursor-pointer",
                                    isSelected ? "bg-indigo-50" : clickable ? "hover:bg-slate-50" : ""
                                )}
                            >
                                <span
                                    className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-black text-white"
                                    style={{ background: RANK_BADGE[i + 1] ?? "#c7d2fe", color: i < 3 ? "#fff" : "#4338ca" }}
                                >
                                    {i + 1}
                                </span>
                                <span className={cn("text-xs w-36 truncate shrink-0 text-left", isSelected ? "font-black text-indigo-700" : "font-semibold text-slate-600")} title={d.name}>{d.name}</span>
                                <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[40px]">
                                    <div
                                        className="h-full rounded-full bg-indigo-500"
                                        style={{ width: `${Math.max(4, (d.count / max) * 100)}%` }}
                                    />
                                </div>
                                <span className="text-xs font-black text-slate-700 w-10 text-right shrink-0">{d.count.toLocaleString()}</span>
                            </Row>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Active filter chips ──────────────────────────────────────────────────────
const FILTER_LABELS: Record<keyof PopulationFilters, string> = {
    groups: "Industry Group",
    industries: "Industry",
    countries: "Work Country",
    continents: "Continent",
    position_keywords: "Position Keyword",
    set_symbols: "SET Company",
    hotel_chains: "Hotel Chain",
};

function ActiveFilterChips({ filters, onRemove }: { filters: PopulationFilters; onRemove: (key: keyof PopulationFilters, value: string) => void }) {
    const chips: { key: keyof PopulationFilters; value: string }[] = [];
    (Object.keys(filters) as (keyof PopulationFilters)[]).forEach(key => {
        (filters[key] || []).forEach(value => chips.push({ key, value }));
    });
    if (!chips.length) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1">Active:</span>
            {chips.map(c => (
                <button
                    key={`${c.key}-${c.value}`}
                    onClick={() => onRemove(c.key, c.value)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full pl-2.5 pr-1.5 py-0.5 hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                    <span className="text-indigo-400">{FILTER_LABELS[c.key]}:</span> {c.value}
                    <X className="h-3 w-3" />
                </button>
            ))}
        </div>
    );
}

function toggleItem<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
}

export default function CandidateFunnelTab() {
    const [filterOptions, setFilterOptions] = useState<PopulationFilterOptions | null>(null);
    const [cascade, setCascade] = useState<CascadingOptions>(EMPTY_CASCADE);
    const [data, setData] = useState<PopulationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);

    const [filters, setFilters] = useState<PopulationFilters>(EMPTY_FILTERS);
    const requestSeq = useRef(0);

    const loadData = useCallback((f: PopulationFilters) => {
        setDataLoading(true);
        const seq = ++requestSeq.current;
        Promise.all([
            getCandidatePopulationData(f),
            getCascadingPopulationOptions(f),
        ]).then(([d, c]) => {
            if (seq !== requestSeq.current) return; // stale response — a newer filter change already superseded this
            setData(d);
            setCascade(c);
        }).catch(console.error).finally(() => {
            if (seq === requestSeq.current) setDataLoading(false);
        });
    }, []);

    useEffect(() => {
        Promise.all([
            getPopulationFilterOptions(),
            getCandidatePopulationData({}),
            getCascadingPopulationOptions({}),
        ]).then(([opts, d, c]) => {
            setFilterOptions(opts);
            setData(d);
            setCascade(c);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    // NOTE: setFilters must stay a plain (non-functional) update here — calling
    // loadData (which itself calls setState) from inside a setState updater
    // callback triggers React's "Cannot update a component while rendering a
    // different component" error, since updater functions run during the
    // render/reconciliation phase, not as a normal event-handler side effect.
    const updateFilter = useCallback((key: keyof PopulationFilters, value: string) => {
        const current = (filters[key] as string[] | undefined) || [];
        const next = { ...filters, [key]: toggleItem(current, value) };
        if ((next[key] as string[]).length === 0) delete next[key];
        setFilters(next);
        loadData(next);
    }, [filters, loadData]);

    const resetFilters = () => {
        setFilters(EMPTY_FILTERS);
        loadData(EMPTY_FILTERS);
    };

    const hasFilters = Object.values(filters).some(v => Array.isArray(v) && v.length > 0);
    const activeFilterCount = Object.values(filters).reduce<number>((acc, v) => acc + (Array.isArray(v) ? v.length : 0), 0);

    if (loading) return (
        <div className="flex h-64 items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading candidate population data...
        </div>
    );

    const setSymbols = filterOptions?.set_companies.map((s: SetCompany) => `${s.symbol} — ${s.company_name}`) || [];
    const setSelected = (filters.set_symbols || []).map(sym => {
        const sc = filterOptions?.set_companies.find((s: SetCompany) => s.symbol === sym);
        return sc ? `${sc.symbol} — ${sc.company_name}` : sym;
    });
    const handleSetChange = (val: string) => {
        const sym = val.split(' — ')[0];
        updateFilter('set_symbols', sym);
    };

    return (
        <div className="space-y-6">
            {/* ── Filter Bar — options narrow (cascade) as other filters are picked ── */}
            <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <FilterMultiSelect
                        label="Industry Group"
                        options={union(cascade.groups, filters.groups || [])}
                        selected={filters.groups || []}
                        onChange={v => updateFilter('groups', v)}
                    />
                    <FilterMultiSelect
                        label="Industry"
                        options={union(cascade.industries, filters.industries || [])}
                        selected={filters.industries || []}
                        onChange={v => updateFilter('industries', v)}
                    />
                    <FilterMultiSelect
                        label="Continent"
                        options={union(cascade.continents, filters.continents || [])}
                        selected={filters.continents || []}
                        onChange={v => updateFilter('continents', v)}
                    />
                    <FilterMultiSelect
                        label="Work Country"
                        options={union(cascade.countries, filters.countries || [])}
                        selected={filters.countries || []}
                        onChange={v => updateFilter('countries', v)}
                    />
                    <FilterMultiSelect
                        label="Position Keyword"
                        options={union(cascade.position_keywords, filters.position_keywords || [])}
                        selected={filters.position_keywords || []}
                        onChange={v => updateFilter('position_keywords', v)}
                    />
                    <FilterMultiSelect
                        label="SET Company"
                        options={setSymbols}
                        selected={setSelected}
                        onChange={handleSetChange}
                    />
                    <FilterMultiSelect
                        label="Hotel Chain"
                        options={union(cascade.hotel_chains, filters.hotel_chains || [])}
                        selected={filters.hotel_chains || []}
                        onChange={v => updateFilter('hotel_chains', v)}
                    />
                    {hasFilters && (
                        <Button
                            variant="ghost" size="sm"
                            onClick={resetFilters}
                            className="gap-1 text-xs text-slate-400 hover:text-red-500"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset ({activeFilterCount})
                        </Button>
                    )}
                    {dataLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                </div>
                <ActiveFilterChips filters={filters} onRemove={updateFilter} />
            </div>

            {/* ── Funnel — Total DB → Matching Filters → Currently Employed are   */}
            {/*    genuine sequential subsets; SET Experience is a separate cut    */}
            {/*    of "Matching Filters" and is NOT chained after Currently Employed */}
            {data && (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col md:flex-row gap-2">
                        <FunnelStage label="Total in Database" value={data.total_db} prevValue={null} color="#6366f1" isFirst />
                        <FunnelStage
                            label={hasFilters ? "Matching Filters" : "In Experience Pool"}
                            value={data.total_filtered} prevValue={data.total_db} color="#0284c7" isFirst={false}
                        />
                        <FunnelStage
                            label="Currently Employed"
                            value={data.currently_employed} prevValue={data.total_filtered} color="#059669" isFirst={false}
                            sub="Flagged with a current-job experience row"
                        />
                    </div>
                    <div className="flex items-start gap-2 text-[11px] text-slate-400">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                            The {(data.total_filtered - data.currently_employed).toLocaleString()} not counted as "Currently Employed" aren't
                            necessarily unemployed — some simply don't have a job experience row flagged "Current" yet (a data-entry gap, not a confirmed status).
                        </span>
                    </div>
                    <CrossCutCard
                        label="SET Experience (by Candidate)"
                        value={data.set_experienced}
                        base={data.total_filtered}
                        color="#f59e0b"
                        icon={Building2}
                    />
                </div>
            )}

            {/* ── Overview: donut (few categories) + badge grid (medium) ───── */}
            {data && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <DonutCard
                        title="By Continent"
                        subtitle="Derived from Location (work country, else based-in)"
                        data={data.by_continent} icon={Globe2} selected={filters.continents || []} onSelect={v => updateFilter('continents', v)}
                        filterTotal={data.total_filtered}
                    />
                    <BadgeGridCard title="By Industry Group" data={data.by_group} icon={Layers} selected={filters.groups || []} onSelect={v => updateFilter('groups', v)} filterTotal={data.total_filtered} />
                </div>
            )}

            {/* ── High-cardinality breakdowns: ranked lists ─────────────────── */}
            {data && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <RankedListCard
                        title="By Location"
                        subtitle="Work country when reliably known, else based-in location"
                        data={data.by_country} icon={Globe2} selected={filters.countries || []} onSelect={v => updateFilter('countries', v)}
                        filterTotal={data.total_filtered}
                    />
                    <RankedListCard title="By Industry" data={data.by_industry} icon={Building2} selected={filters.industries || []} onSelect={v => updateFilter('industries', v)} filterTotal={data.total_filtered} />
                    <RankedListCard title="By Position Keyword" data={data.by_position_keyword} icon={Briefcase} selected={filters.position_keywords || []} onSelect={v => updateFilter('position_keywords', v)} filterTotal={data.total_filtered} />
                </div>
            )}

            {/* ── Hotel Chain + SET Company — both "ever worked there" career-history */}
            {/*    cross-cuts, not mutually-exclusive demographic buckets            */}
            {data && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <RankedListCard title="By Hotel Chain" data={data.by_hotel_chain} icon={Building2} selected={filters.hotel_chains || []} onSelect={v => updateFilter('hotel_chains', v)} filterTotal={data.total_filtered} />
                    <RankedListCard
                        title="By SET Company"
                        data={data.by_set_company}
                        icon={Building2}
                        selected={setSelected}
                        onSelect={v => updateFilter('set_symbols', v.split(' — ')[0])}
                        filterTotal={data.total_filtered}
                    />
                </div>
            )}

            {/* ── Age Range + Nationality — informational only (not filterable yet) ── */}
            {data && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <DonutCard title="By Age Range" data={data.by_age_range} icon={Cake} selected={[]} onSelect={() => {}} interactive={false} filterTotal={data.total_filtered} />
                    <RankedListCard
                        title={`By Nationality${data.nationality_unknown_count > 0 ? ` (${data.nationality_unknown_count.toLocaleString()} Unknown)` : ""}`}
                        data={data.by_nationality} icon={Flag}
                        filterTotal={data.total_filtered}
                    />
                </div>
            )}
        </div>
    );
}
