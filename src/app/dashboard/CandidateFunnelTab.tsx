"use client";

import React, { useEffect, useState, useMemo } from "react";
import { getCandidateFunnelData, FunnelData, FunnelFilters, FunnelIndustry } from "@/app/actions/candidate-funnel";
import { Loader2, ChevronRight, ChevronLeft, Users, Building, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const INDUSTRY_COLORS = [
    "#6366f1","#0ea5e9","#10b981","#f59e0b","#ec4899","#8b5cf6",
    "#14b8a6","#f97316","#3b82f6","#84cc16","#ef4444","#a855f7",
];

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.max(4, Math.round(value / max * 100)) : 0;
    return (
        <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            <span className="text-xs font-black text-slate-700 w-12 text-right shrink-0">{value.toLocaleString()}</span>
        </div>
    );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-100">
            {label}
            <button onClick={onRemove} className="ml-0.5 hover:text-indigo-900"><X className="h-3 w-3" /></button>
        </span>
    );
}

export default function CandidateFunnelTab() {
    const [data, setData] = useState<FunnelData | null>(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<FunnelFilters>({});
    const [drillIndustry, setDrillIndustry] = useState<FunnelIndustry | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Pending filter state (applied on "Apply")
    const [pendingCountries, setPendingCountries] = useState<string[]>([]);
    const [pendingKeywords, setPendingKeywords] = useState<string[]>([]);
    const [pendingAgeMin, setPendingAgeMin] = useState("");
    const [pendingAgeMax, setPendingAgeMax] = useState("");
    const [pendingCurrentOnly, setPendingCurrentOnly] = useState(false);

    const loadData = (f: FunnelFilters) => {
        setLoading(true);
        setDrillIndustry(null);
        getCandidateFunnelData(f)
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadData({}); }, []);

    const applyFilters = () => {
        const f: FunnelFilters = {
            countries: pendingCountries.length ? pendingCountries : undefined,
            position_keywords: pendingKeywords.length ? pendingKeywords : undefined,
            age_min: pendingAgeMin ? parseInt(pendingAgeMin) : undefined,
            age_max: pendingAgeMax ? parseInt(pendingAgeMax) : undefined,
            current_only: pendingCurrentOnly || undefined,
        };
        setFilters(f);
        setShowFilters(false);
        loadData(f);
    };

    const resetFilters = () => {
        setPendingCountries([]); setPendingKeywords([]);
        setPendingAgeMin(""); setPendingAgeMax("");
        setPendingCurrentOnly(false);
        setFilters({});
        loadData({});
    };

    const hasFilters = !!(filters.countries?.length || filters.position_keywords?.length || filters.age_min || filters.age_max || filters.current_only);

    const displayList = drillIndustry
        ? drillIndustry.groups.map((g, i) => ({ name: g.name, count: g.count, colorIdx: i }))
        : (data?.industries || []).map((ind, i) => ({ name: ind.name, count: ind.count, colorIdx: i }));

    const maxCount = Math.max(...displayList.map(d => d.count), 1);

    const topCountries = data?.filter_options.countries.slice(0, 50) || [];
    const topKeywords = data?.filter_options.position_keywords.slice(0, 60) || [];

    return (
        <div className="space-y-5">
            {/* ── Header + Filter toggle ───────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    {drillIndustry ? (
                        <button
                            onClick={() => setDrillIndustry(null)}
                            className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" /> All Industries
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                            <Building className="h-4 w-4" />
                            <span>Candidate pool breakdown by industry</span>
                        </div>
                    )}
                    {drillIndustry && (
                        <div className="flex items-center gap-2 text-slate-700">
                            <ChevronRight className="h-4 w-4 text-slate-300" />
                            <span className="font-black text-sm">{drillIndustry.name}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {hasFilters && (
                        <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-xs text-slate-400 hover:text-red-500">
                            <RotateCcw className="h-3 w-3" /> Reset
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)} className={cn("gap-1.5 text-xs", hasFilters && "border-indigo-300 text-indigo-600 bg-indigo-50")}>
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Filters
                        {hasFilters && <span className="bg-indigo-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5">{[filters.countries?.length || 0, filters.position_keywords?.length || 0, filters.age_min || filters.age_max ? 1 : 0, filters.current_only ? 1 : 0].reduce((a,b)=>a+b,0)}</span>}
                    </Button>
                </div>
            </div>

            {/* ── Active filter pills ─────────────────────────────── */}
            {hasFilters && (
                <div className="flex flex-wrap gap-2">
                    {filters.countries?.map(c => <FilterPill key={c} label={`Country: ${c}`} onRemove={() => { const f = {...filters, countries: filters.countries?.filter(x=>x!==c)}; setFilters(f); loadData(f); }} />)}
                    {filters.position_keywords?.map(k => <FilterPill key={k} label={`Keyword: ${k}`} onRemove={() => { const f = {...filters, position_keywords: filters.position_keywords?.filter(x=>x!==k)}; setFilters(f); loadData(f); }} />)}
                    {(filters.age_min || filters.age_max) && <FilterPill label={`Age: ${filters.age_min||""}–${filters.age_max||""}`} onRemove={() => { const f = {...filters, age_min: undefined, age_max: undefined}; setFilters(f); loadData(f); }} />}
                    {filters.current_only && <FilterPill label="Current job only" onRemove={() => { const f = {...filters, current_only: undefined}; setFilters(f); loadData(f); }} />}
                </div>
            )}

            {/* ── Filter panel ────────────────────────────────────── */}
            {showFilters && (
                <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Countries */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Work Country</label>
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                {topCountries.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setPendingCountries(prev => prev.includes(c) ? prev.filter(x=>x!==c) : [...prev, c])}
                                        className={cn("text-xs font-bold px-2.5 py-1 rounded-full border transition-colors", pendingCountries.includes(c) ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300")}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Position Keywords */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Position Keyword</label>
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                {topKeywords.map(k => (
                                    <button
                                        key={k}
                                        onClick={() => setPendingKeywords(prev => prev.includes(k) ? prev.filter(x=>x!==k) : [...prev, k])}
                                        className={cn("text-xs font-bold px-2.5 py-1 rounded-full border transition-colors", pendingKeywords.includes(k) ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-300")}
                                    >
                                        {k}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-4 pt-2 border-t border-slate-50">
                        {/* Age range */}
                        <div className="flex items-center gap-2">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Age Min</label>
                                <input type="number" value={pendingAgeMin} onChange={e => setPendingAgeMin(e.target.value)} placeholder="20" className="w-20 h-8 text-sm border border-slate-200 rounded-lg px-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                            </div>
                            <span className="text-slate-300 text-sm mt-4">–</span>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Age Max</label>
                                <input type="number" value={pendingAgeMax} onChange={e => setPendingAgeMax(e.target.value)} placeholder="60" className="w-20 h-8 text-sm border border-slate-200 rounded-lg px-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                            </div>
                        </div>
                        {/* Current only */}
                        <label className="flex items-center gap-2 cursor-pointer mt-4">
                            <input type="checkbox" checked={pendingCurrentOnly} onChange={e => setPendingCurrentOnly(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300" />
                            <span className="text-xs font-bold text-slate-600">Current job only</span>
                        </label>
                        <div className="flex gap-2 ml-auto">
                            <Button variant="outline" size="sm" onClick={() => setShowFilters(false)} className="text-xs">Cancel</Button>
                            <Button size="sm" onClick={applyFilters} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white">Apply Filters</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Total badge ──────────────────────────────────────── */}
            {!loading && data && (
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-4 py-2 shadow-sm">
                        <Users className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm font-black text-slate-800">{data.total.toLocaleString()}</span>
                        <span className="text-xs text-slate-400 font-medium">total candidates</span>
                    </div>
                    {drillIndustry && (
                        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2">
                            <span className="text-sm font-black text-indigo-700">{drillIndustry.count.toLocaleString()}</span>
                            <span className="text-xs text-indigo-400 font-medium">in {drillIndustry.name}</span>
                        </div>
                    )}
                </div>
            )}

            {/* ── Bar list ─────────────────────────────────────────── */}
            {loading ? (
                <div className="flex h-64 items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading candidate pool data...
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    {displayList.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No data</div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {displayList.map((item, idx) => {
                                const color = INDUSTRY_COLORS[item.colorIdx % INDUSTRY_COLORS.length];
                                const isDrillable = !drillIndustry;
                                const industryObj = isDrillable ? data?.industries.find(i => i.name === item.name) : null;
                                return (
                                    <div
                                        key={item.name}
                                        className={cn("flex items-center gap-4 px-5 py-3.5 group transition-colors", isDrillable && industryObj?.groups?.length && "cursor-pointer hover:bg-slate-50/50")}
                                        onClick={() => { if (isDrillable && industryObj?.groups?.length) setDrillIndustry(industryObj); }}
                                    >
                                        {/* Rank + color dot */}
                                        <div className="flex items-center gap-3 w-8 shrink-0">
                                            <span className="text-[10px] font-black text-slate-300 w-4 text-right">{idx + 1}</span>
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                        </div>

                                        {/* Name */}
                                        <div className="w-48 shrink-0">
                                            <span className="text-sm font-bold text-slate-700 leading-tight">{item.name}</span>
                                            {isDrillable && industryObj?.groups?.length && (
                                                <div className="text-[10px] text-slate-400 font-medium">{industryObj.groups.length} group{industryObj.groups.length !== 1 ? "s" : ""}</div>
                                            )}
                                        </div>

                                        {/* Bar */}
                                        <MiniBar value={item.count} max={maxCount} color={color} />

                                        {/* Pct of total */}
                                        <div className="w-12 text-right shrink-0">
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {data?.total ? Math.round(item.count / data.total * 100) : 0}%
                                            </span>
                                        </div>

                                        {isDrillable && industryObj?.groups?.length ? (
                                            <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
                                        ) : <div className="w-3.5 shrink-0" />}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
