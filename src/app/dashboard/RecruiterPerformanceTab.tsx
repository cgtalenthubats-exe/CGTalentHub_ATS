"use client";

import React, { useEffect, useState, useMemo } from "react";
import { getKPIData, KPIRawData } from "@/app/actions/kpi-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2, Search, ClipboardCheck, MessageSquare, FolderOpen, RotateCcw, ArrowUpRight, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(d: string | null): Date | null {
    if (!d) return null;
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date;
}

const METRICS = [
    { key: "sourced",    label: "Profiles Sourced", color: "#3b82f6", icon: Search },
    { key: "prescreens", label: "Pre-Screens",       color: "#f59e0b", icon: ClipboardCheck },
    { key: "interviews", label: "Interviews",         color: "#10b981", icon: MessageSquare },
    { key: "jrs",        label: "JRs Created",        color: "#8b5cf6", icon: FolderOpen },
] as const;
type MetricKey = typeof METRICS[number]["key"];

export default function RecruiterPerformanceTab() {
    const [rawData, setRawData] = useState<KPIRawData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedFY, setSelectedFY] = useState<number>(new Date().getFullYear());
    const [selectedRecruiters, setSelectedRecruiters] = useState<string[]>([]);
    const [activeMetric, setActiveMetric] = useState<MetricKey>("sourced");

    useEffect(() => {
        getKPIData().then(data => { setRawData(data); setLoading(false); });
    }, []);

    // ── Name resolution ─────────────────────────────────────────────

    const profileMap = useMemo(() => {
        const map = new Map<string, string>();
        rawData?.profiles?.forEach(p => {
            if (p.email) map.set(p.email.toLowerCase().trim(), p.real_name);
            if (p.real_name) map.set(p.real_name.toLowerCase().trim(), p.real_name);
        });
        return map;
    }, [rawData]);

    const ALIASES: Record<string, string> = { "system import": "Admin2", "admin@cgtalent.com": "Admin2", "admin2": "Admin2" };

    const resolve = (id: string | null): string => {
        const s = (id || "Unknown").toLowerCase().trim();
        if (ALIASES[s]) return ALIASES[s];
        let name = profileMap.get(s) || id || "Unknown";
        if (!name.includes("@") && name !== "Unknown")
            name = name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        return name;
    };

    // ── FY list ─────────────────────────────────────────────────────

    const availableFYs = useMemo(() => {
        if (!rawData) return [new Date().getFullYear()];
        const years = new Set<number>();
        [...rawData.sourcing.map(s => s.created_date),
         ...rawData.prescreens.map(p => p.screening_date),
         ...rawData.interviews.map(i => i.interview_date),
         ...rawData.jrs.map(j => j.created_at)].forEach(d => {
            const parsed = parseDate(d);
            if (parsed) years.add(parsed.getFullYear());
        });
        return [...years].sort((a, b) => b - a);
    }, [rawData]);

    const allRecruiterNames = useMemo(() => {
        if (!rawData) return [];
        const s = new Set<string>();
        rawData.sourcing.forEach(x => s.add(resolve(x.created_by)));
        rawData.prescreens.forEach(x => s.add(resolve(x.screener_Name)));
        rawData.interviews.filter(i => i.Interviewer_type === "Recruiter").forEach(x => s.add(resolve(x.Interviewer_name)));
        rawData.jrs.forEach(x => s.add(resolve(x.create_by)));
        return [...s].sort();
    }, [rawData]);

    // ── Filtered slices ──────────────────────────────────────────────

    const inFY = (d: string | null) => { const p = parseDate(d); return p !== null && p.getFullYear() === selectedFY; };
    const matchR = (id: string | null) => selectedRecruiters.length === 0 || selectedRecruiters.includes(resolve(id));

    const fSourcing   = useMemo(() => rawData?.sourcing.filter(s => inFY(s.created_date) && matchR(s.created_by)) || [], [rawData, selectedFY, selectedRecruiters]);
    const fPrescreens = useMemo(() => rawData?.prescreens.filter(p => inFY(p.screening_date) && matchR(p.screener_Name)) || [], [rawData, selectedFY, selectedRecruiters]);
    const fInterviews = useMemo(() => rawData?.interviews.filter(i => i.Interviewer_type === "Recruiter" && inFY(i.interview_date) && matchR(i.Interviewer_name)) || [], [rawData, selectedFY, selectedRecruiters]);
    const fJRs        = useMemo(() => rawData?.jrs.filter(j => inFY(j.created_at) && matchR(j.create_by)) || [], [rawData, selectedFY, selectedRecruiters]);

    // ── Monthly chart data for active metric ────────────────────────

    const chartData = useMemo(() => {
        const base = MONTH_NAMES.map(m => ({ label: m, count: 0 }));
        const [items, dateKey] = activeMetric === "sourced"    ? [fSourcing,   "created_date"]
                               : activeMetric === "prescreens" ? [fPrescreens, "screening_date"]
                               : activeMetric === "interviews" ? [fInterviews, "interview_date"]
                               :                                 [fJRs,        "created_at"];
        items.forEach((item: any) => {
            const d = parseDate(item[dateKey]);
            if (d) base[d.getMonth()].count++;
        });
        return base;
    }, [fSourcing, fPrescreens, fInterviews, fJRs, activeMetric]);

    const activeMetricMeta = METRICS.find(m => m.key === activeMetric)!;

    // ── Per-recruiter table data ────────────────────────────────────

    const tableData = useMemo(() => {
        const map = new Map<string, { name: string; sourced: number; prescreens: number; interviews: number; jrs: number }>();
        const ensure = (name: string) => {
            if (!map.has(name)) map.set(name, { name, sourced: 0, prescreens: 0, interviews: 0, jrs: 0 });
            return map.get(name)!;
        };
        fSourcing.forEach(s => ensure(resolve(s.created_by)).sourced++);
        fPrescreens.forEach(p => ensure(resolve(p.screener_Name)).prescreens++);
        fInterviews.forEach(i => ensure(resolve(i.Interviewer_name)).interviews++);
        fJRs.forEach(j => ensure(resolve(j.create_by)).jrs++);
        return [...map.values()]
            .map(r => ({ ...r, total: r.sourced + r.prescreens + r.interviews + r.jrs }))
            .sort((a, b) => b.sourced - a.sourced);
    }, [fSourcing, fPrescreens, fInterviews, fJRs]);

    const maxSourced = Math.max(...tableData.map(r => r.sourced), 1);

    if (loading) return (
        <div className="flex h-64 items-center justify-center text-gray-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading KPI data...
        </div>
    );

    const totals = { sourced: fSourcing.length, prescreens: fPrescreens.length, interviews: fInterviews.length, jrs: fJRs.length };
    const topPerformer = tableData[0];

    return (
        <div className="space-y-6">
            {/* ── Filters ─────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3">
                <Select value={selectedFY.toString()} onValueChange={v => setSelectedFY(parseInt(v))}>
                    <SelectTrigger className="w-[130px] text-sm font-bold">
                        <SelectValue placeholder="FY" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableFYs.map(y => (
                            <SelectItem key={y} value={y.toString()}>FY {y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <FilterMultiSelect
                    label="Recruiter"
                    options={allRecruiterNames}
                    selected={selectedRecruiters}
                    onChange={val => setSelectedRecruiters(prev => prev.includes(val) ? prev.filter(i => i !== val) : [...prev, val])}
                />

                {(selectedRecruiters.length > 0 || selectedFY !== new Date().getFullYear()) && (
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedRecruiters([]); setSelectedFY(new Date().getFullYear()); }} className="gap-1 text-xs">
                        <RotateCcw className="h-3 w-3" /> Reset
                    </Button>
                )}
            </div>

            {/* ── KPI Summary Cards ────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {METRICS.map(m => {
                    const val = totals[m.key];
                    const isActive = activeMetric === m.key;
                    return (
                        <button
                            key={m.key}
                            onClick={() => setActiveMetric(m.key)}
                            className={cn(
                                "text-left rounded-2xl p-5 border-2 transition-all",
                                isActive
                                    ? "border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100"
                                    : "border-slate-100 bg-white hover:border-slate-200 shadow-sm"
                            )}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className={cn("p-2 rounded-xl", isActive ? "bg-indigo-100" : "bg-slate-100")}>
                                    <m.icon className={cn("h-4 w-4", isActive ? "text-indigo-600" : "text-slate-500")} />
                                </div>
                                {isActive && <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-full">Viewing</span>}
                            </div>
                            <div className={cn("text-3xl font-black", isActive ? "text-indigo-700" : "text-slate-800")}>{val.toLocaleString()}</div>
                            <div className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{m.label}</div>
                        </button>
                    );
                })}
            </div>

            {/* ── Monthly Chart + Top Performer ───────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{activeMetricMeta.label} — Monthly FY{selectedFY}</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData} barSize={28}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 600, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: 700 }}
                                formatter={(value: any) => [value.toLocaleString(), activeMetricMeta.label]}
                            />
                            <Bar dataKey="count" fill={activeMetricMeta.color} radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {topPerformer && (
                    <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 text-white flex flex-col justify-between shadow-md shadow-amber-100">
                        <div className="flex items-center gap-2 mb-4">
                            <Trophy className="h-5 w-5 text-white/80" />
                            <span className="text-xs font-black uppercase tracking-widest text-white/80">Top Sourcer — FY{selectedFY}</span>
                        </div>
                        <div>
                            <div className="text-2xl font-black leading-tight">{topPerformer.name}</div>
                            <div className="text-4xl font-black mt-2">{topPerformer.sourced.toLocaleString()}</div>
                            <div className="text-sm text-white/70 font-bold mt-1">profiles sourced</div>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                            <div><div className="text-lg font-black">{topPerformer.prescreens}</div><div className="text-[10px] text-white/70 font-bold">Pre-screens</div></div>
                            <div><div className="text-lg font-black">{topPerformer.interviews}</div><div className="text-[10px] text-white/70 font-bold">Interviews</div></div>
                            <div><div className="text-lg font-black">{topPerformer.jrs}</div><div className="text-[10px] text-white/70 font-bold">JRs</div></div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Recruiter Ranking Table ──────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Recruiter Activity — FY{selectedFY}</h3>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">{tableData.length} recruiters · sorted by profiles sourced · click name for drill-down</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/80">
                                <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 px-4 w-10">#</th>
                                <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 px-4">Recruiter</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-blue-400 py-3 px-4 text-right w-36">Sourced</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-amber-400 py-3 px-4 text-right w-28">Pre-Screens</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-emerald-400 py-3 px-4 text-right w-28">Interviews</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-purple-400 py-3 px-4 text-right w-24">JRs</th>
                                <th className="w-12 py-3 px-4"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-16 text-slate-400 text-xs font-bold uppercase tracking-widest">No data for FY{selectedFY}</td></tr>
                            ) : tableData.map((row, idx) => (
                                <tr key={row.name} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                    <td className="py-4 px-4">
                                        {idx === 0
                                            ? <Trophy className="h-4 w-4 text-amber-400" />
                                            : <span className="text-xs font-black text-slate-300">{idx + 1}</span>
                                        }
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className="font-bold text-slate-800">{row.name}</span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-2 justify-end">
                                            <div className="flex-1 max-w-[80px] bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.round(row.sourced / maxSourced * 100)}%` }} />
                                            </div>
                                            <span className="font-black text-blue-600 w-8 text-right">{row.sourced}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-right font-bold text-amber-600">{row.prescreens}</td>
                                    <td className="py-4 px-4 text-right font-bold text-emerald-600">{row.interviews}</td>
                                    <td className="py-4 px-4 text-right font-bold text-purple-600">{row.jrs}</td>
                                    <td className="py-4 px-4">
                                        <Link
                                            href={`/dashboard/recruiter/details?recruiter=${encodeURIComponent(row.name)}&fy=${selectedFY}`}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center"
                                        >
                                            <ArrowUpRight className="h-3.5 w-3.5" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
