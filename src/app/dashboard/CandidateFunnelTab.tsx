"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
    getCandidatePopulationData, getPopulationFilterOptions,
    PopulationData, PopulationFilterOptions, PopulationFilters, SetCompany,
} from "@/app/actions/candidate-population";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { Loader2, Users, Briefcase, MapPin, TrendingUp, RotateCcw, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CHART_COLORS = [
    "#6366f1", "#3b82f6", "#0ea5e9", "#10b981", "#f59e0b",
    "#f97316", "#ec4899", "#8b5cf6", "#14b8a6", "#84cc16",
    "#ef4444", "#a855f7", "#06b6d4", "#d97706", "#65a30d",
];

const EMPTY_FILTERS: PopulationFilters = {};

function KpiCard({
    label, value, sub, icon: Icon, color,
}: { label: string; value: number; sub?: string; icon: React.ElementType; color: string }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <div className={cn("p-2 rounded-xl")} style={{ background: `${color}18` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                </div>
            </div>
            <div className="text-3xl font-black text-slate-800">{value.toLocaleString()}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</div>
            {sub && <div className="text-[10px] text-slate-300 font-medium mt-0.5">{sub}</div>}
        </div>
    );
}

function HBarChart({ data, label }: { data: { name: string; count: number }[]; label: string }) {
    if (!data.length) return (
        <div className="flex items-center justify-center h-48 text-slate-400 text-xs font-bold uppercase tracking-widest">
            No data
        </div>
    );
    const height = Math.max(180, data.length * 28 + 40);
    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false} tickLine={false}
                    allowDecimals={false}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    width={148}
                    tick={{ fontSize: 10, fill: "#475569", fontWeight: 600 }}
                    axisLine={false} tickLine={false}
                />
                <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: 700 }}
                    formatter={(v: any) => [v.toLocaleString(), label]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {data.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">{title}</h3>
            {children}
        </div>
    );
}

function toggleItem<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
}

export default function CandidateFunnelTab() {
    const [filterOptions, setFilterOptions] = useState<PopulationFilterOptions | null>(null);
    const [data, setData] = useState<PopulationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);

    const [filters, setFilters] = useState<PopulationFilters>(EMPTY_FILTERS);

    const loadData = useCallback((f: PopulationFilters) => {
        setDataLoading(true);
        getCandidatePopulationData(f)
            .then(setData)
            .catch(console.error)
            .finally(() => setDataLoading(false));
    }, []);

    useEffect(() => {
        Promise.all([
            getPopulationFilterOptions(),
            getCandidatePopulationData({}),
        ]).then(([opts, d]) => {
            setFilterOptions(opts);
            setData(d);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const updateFilter = (key: keyof PopulationFilters, value: string) => {
        const current = (filters[key] as string[] | undefined) || [];
        const next = { ...filters, [key]: toggleItem(current, value) };
        if ((next[key] as string[]).length === 0) delete next[key];
        setFilters(next);
        loadData(next);
    };

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
            {/* ── Filter Bar ──────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
                <FilterMultiSelect
                    label="Industry Group"
                    options={filterOptions?.groups || []}
                    selected={filters.groups || []}
                    onChange={v => updateFilter('groups', v)}
                />
                <FilterMultiSelect
                    label="Industry"
                    options={filterOptions?.industries || []}
                    selected={filters.industries || []}
                    onChange={v => updateFilter('industries', v)}
                />
                <FilterMultiSelect
                    label="Continent"
                    options={filterOptions?.continents || []}
                    selected={filters.continents || []}
                    onChange={v => updateFilter('continents', v)}
                />
                <FilterMultiSelect
                    label="Work Country"
                    options={filterOptions?.countries || []}
                    selected={filters.countries || []}
                    onChange={v => updateFilter('countries', v)}
                />
                <FilterMultiSelect
                    label="Position Keyword"
                    options={filterOptions?.position_keywords || []}
                    selected={filters.position_keywords || []}
                    onChange={v => updateFilter('position_keywords', v)}
                />
                <FilterMultiSelect
                    label="SET Company"
                    options={setSymbols}
                    selected={setSelected}
                    onChange={handleSetChange}
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

            {/* ── KPI Cards ────────────────────────────────────────── */}
            {data && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                        label="Total in Database"
                        value={data.total_db}
                        sub="All candidates in system"
                        icon={Users}
                        color="#6366f1"
                    />
                    <KpiCard
                        label={hasFilters ? "Matching Filters" : "In Experience Pool"}
                        value={data.total_filtered}
                        sub={hasFilters ? "Unique candidates matched" : "Candidates with company data"}
                        icon={TrendingUp}
                        color="#3b82f6"
                    />
                    <KpiCard
                        label="Currently Employed"
                        value={data.currently_employed}
                        sub="Active in current role"
                        icon={Briefcase}
                        color="#10b981"
                    />
                    <KpiCard
                        label="SET Experience"
                        value={data.set_experienced}
                        sub="Exp. at SET-listed companies"
                        icon={Building2}
                        color="#f59e0b"
                    />
                </div>
            )}

            {/* ── Charts (2×2 grid) ────────────────────────────────── */}
            {data && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <ChartCard title="By Industry Group">
                        <HBarChart data={data.by_group} label="Candidates" />
                    </ChartCard>
                    <ChartCard title="By Work Country (Top 15)">
                        <HBarChart data={data.by_country} label="Candidates" />
                    </ChartCard>
                    <ChartCard title="By Industry (Top 15)">
                        <HBarChart data={data.by_industry} label="Candidates" />
                    </ChartCard>
                    <ChartCard title="By Position Keyword (Top 15)">
                        <HBarChart data={data.by_position_keyword} label="Candidates" />
                    </ChartCard>
                </div>
            )}

            {/* ── Continent + Group summary row ────────────────────── */}
            {data && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <ChartCard title="By Continent">
                        <HBarChart data={data.by_continent} label="Candidates" />
                    </ChartCard>
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Summary</h3>
                        <div className="space-y-2">
                            {data.by_group.map((g, i) => {
                                const pct = data.total_filtered > 0 ? Math.round(g.count / data.total_filtered * 100) : 0;
                                return (
                                    <div key={g.name} className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                        <span className="text-xs font-bold text-slate-600 flex-1 truncate">{g.name}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                            </div>
                                            <span className="text-xs font-black text-slate-700 w-10 text-right">{g.count.toLocaleString()}</span>
                                            <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
