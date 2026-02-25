"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import { getRawPlacementData, PlacementRecord, JRRecord } from "@/app/actions/placement-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, TrendingUp, Target, Coins, Search, RefreshCw } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#4f46e5", "#7c3aed", "#0891b2", "#0d9488", "#dc2626", "#ea580c", "#ca8a04", "#15803d"];

// Parse mixed date formats → year
function parseYear(dateStr: string | null): number | null {
    if (!dateStr) return null;
    if (dateStr.includes('-') && dateStr.length >= 7) {
        const y = parseInt(dateStr.split('-')[0]);
        return isNaN(y) ? null : y;
    }
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const y = parseInt(parts[2]);
        return isNaN(y) ? null : y;
    }
    return null;
}

function formatMillion(val: number): string {
    if (!val) return "-";
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return val.toString();
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
    return (
        <Card className={`border-none shadow-lg bg-gradient-to-br ${color} text-white`}>
            <CardContent className="p-5 flex items-center gap-4">
                <div className="bg-white/20 rounded-xl p-3">
                    <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                    <p className="text-white/70 text-xs font-medium uppercase tracking-wider">{label}</p>
                    <p className="text-2xl font-bold text-white">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

export default function PlacementPage() {
    // Raw data — fetched ONCE
    const [rawPlacements, setRawPlacements] = useState<PlacementRecord[]>([]);
    const [rawJRs, setRawJRs] = useState<JRRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters (client-side only)
    const [selectedBU, setSelectedBU] = useState("all");
    const [selectedSubBU, setSelectedSubBU] = useState("all");
    const [selectedYear, setSelectedYear] = useState("all");
    const [selectedStatus, setSelectedStatus] = useState("all");

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { placements, jrs } = await getRawPlacementData();
        setRawPlacements(placements);
        setRawJRs(jrs);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // --- Filter options derived from raw data ---
    const buOptions = useMemo(() => {
        const s = new Set<string>();
        rawPlacements.forEach(r => r.bu && s.add(r.bu));
        rawJRs.forEach(r => r.bu && s.add(r.bu));
        return Array.from(s).sort();
    }, [rawPlacements, rawJRs]);

    const subBuOptions = useMemo(() => {
        if (selectedBU === "all") return [];
        const s = new Set<string>();
        rawPlacements.filter(r => r.bu === selectedBU).forEach(r => r.sub_bu && s.add(r.sub_bu));
        rawJRs.filter(r => r.bu === selectedBU).forEach(r => r.sub_bu && s.add(r.sub_bu));
        return Array.from(s).sort();
    }, [rawPlacements, rawJRs, selectedBU]);

    const yearOptions = useMemo(() => {
        const s = new Set<number>();
        rawPlacements.forEach(r => { const y = parseYear(r.hire_date); if (y) s.add(y); });
        rawJRs.forEach(r => { const y = parseYear(r.request_date); if (y) s.add(y); });
        return Array.from(s).sort((a, b) => b - a);
    }, [rawPlacements, rawJRs]);

    // --- Filtered data (instant, no server call) ---
    const filteredPlacements = useMemo(() => {
        return rawPlacements.filter(r => {
            if (selectedBU !== "all" && r.bu !== selectedBU) return false;
            if (selectedSubBU !== "all" && r.sub_bu !== selectedSubBU) return false;
            if (selectedYear !== "all" && parseYear(r.hire_date) !== parseInt(selectedYear)) return false;
            if (selectedStatus !== "all" && r.hiring_status !== selectedStatus) return false;
            return true;
        });
    }, [rawPlacements, selectedBU, selectedSubBU, selectedYear, selectedStatus]);

    const filteredJRs = useMemo(() => {
        return rawJRs.filter(r => {
            if (selectedBU !== "all" && r.bu !== selectedBU) return false;
            if (selectedSubBU !== "all" && r.sub_bu !== selectedSubBU) return false;
            if (selectedYear !== "all" && parseYear(r.request_date) !== parseInt(selectedYear)) return false;
            return true;
        });
    }, [rawJRs, selectedBU, selectedSubBU, selectedYear]);

    // --- Aggregated metrics (also instant) ---
    const buList = useMemo(() => {
        const s = new Set<string>();
        filteredPlacements.forEach(r => r.bu && s.add(r.bu));
        filteredJRs.forEach(r => r.bu && s.add(r.bu));
        return Array.from(s).sort();
    }, [filteredPlacements, filteredJRs]);

    const yearList = useMemo(() => {
        // Use raw for year list (to show all years in table)
        const s = new Set<number>();
        rawPlacements.forEach(r => { const y = parseYear(r.hire_date); if (y) s.add(y); });
        rawJRs.forEach(r => { const y = parseYear(r.request_date); if (y) s.add(y); });
        return Array.from(s).sort((a, b) => b - a);
    }, [rawPlacements, rawJRs]);

    const byBU = useMemo(() => {
        const result: Record<string, { search: number; placement: number; saving: number }> = {};
        buList.forEach(bu => result[bu] = { search: 0, placement: 0, saving: 0 });
        filteredJRs.forEach(jr => { if (jr.bu && result[jr.bu]) result[jr.bu].search++; });
        filteredPlacements.forEach(er => {
            if (er.bu && result[er.bu]) {
                result[er.bu].placement++;
                result[er.bu].saving += er.outsource_fee_20_percent;
            }
        });
        return result;
    }, [buList, filteredJRs, filteredPlacements]);

    const byYearBU = useMemo(() => {
        const result: Record<number, Record<string, { search: number; placement: number; saving: number }>> = {};
        yearList.forEach(y => {
            result[y] = {};
            buList.forEach(bu => result[y][bu] = { search: 0, placement: 0, saving: 0 });
        });
        rawJRs.forEach(jr => {
            const y = parseYear(jr.request_date);
            if (!y || !jr.bu) return;
            if (!result[y]) result[y] = {};
            if (!result[y][jr.bu]) result[y][jr.bu] = { search: 0, placement: 0, saving: 0 };
            result[y][jr.bu].search++;
        });
        rawPlacements.forEach(er => {
            const y = parseYear(er.hire_date);
            if (!y || !er.bu) return;
            if (!result[y]) result[y] = {};
            if (!result[y][er.bu]) result[y][er.bu] = { search: 0, placement: 0, saving: 0 };
            result[y][er.bu].placement++;
            result[y][er.bu].saving += er.outsource_fee_20_percent;
        });
        return result;
    }, [yearList, buList, rawJRs, rawPlacements]);

    const allBUStats = useMemo(() => {
        const result: Record<number, { search: number; placement: number; saving: number }> = {};
        yearList.forEach(y => {
            const yJRs = rawJRs.filter(r => {
                const yr = parseYear(r.request_date);
                if (yr !== y) return false;
                if (selectedBU !== "all" && r.bu !== selectedBU) return false;
                if (selectedSubBU !== "all" && r.sub_bu !== selectedSubBU) return false;
                return true;
            });
            const yERs = rawPlacements.filter(r => {
                const yr = parseYear(r.hire_date);
                if (yr !== y) return false;
                if (selectedBU !== "all" && r.bu !== selectedBU) return false;
                if (selectedSubBU !== "all" && r.sub_bu !== selectedSubBU) return false;
                if (selectedStatus !== "all" && r.hiring_status !== selectedStatus) return false;
                return true;
            });
            result[y] = {
                search: yJRs.length,
                placement: yERs.length,
                saving: yERs.reduce((s, r) => s + r.outsource_fee_20_percent, 0),
            };
        });
        return result;
    }, [yearList, rawJRs, rawPlacements, selectedBU, selectedSubBU, selectedStatus]);

    const byJobGrade = useMemo(() => {
        const result: Record<string, number> = {};
        filteredPlacements.forEach(er => {
            const jg = er.job_grade ? `JG ${er.job_grade}` : null;
            if (!jg) return;
            result[jg] = (result[jg] || 0) + 1;
        });
        return result;
    }, [filteredPlacements]);

    const totalSearch = filteredJRs.length;
    const totalPlacement = filteredPlacements.length;
    const totalSaving = useMemo(() => filteredPlacements.reduce((s, r) => s + r.outsource_fee_20_percent, 0), [filteredPlacements]);
    const activeJR = useMemo(() => filteredJRs.filter(r => r.is_active === 'Active').length, [filteredJRs]);

    const buChartData = Object.entries(byBU).filter(([, v]) => v.placement > 0).map(([bu, v]) => ({ name: bu, value: v.placement }));
    const jgChartData = Object.entries(byJobGrade).map(([jg, count]) => ({ name: jg, value: count }));

    const handleReset = () => {
        setSelectedBU("all");
        setSelectedSubBU("all");
        setSelectedYear("all");
        setSelectedStatus("all");
    };

    return (
        <div className="container mx-auto p-6 space-y-6 max-w-[1600px]">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <AtsBreadcrumb items={[{ label: "Summary Search & Placement" }]} />
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">
                            Summary Search & Placement
                        </h1>
                        <p className="text-muted-foreground mt-1">Cost saving analytics from in-house recruitment vs 3rd party agency</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-lg border">
                        <Coins className="w-3 h-3" />
                        <span>Saving = 20% of Annual Salary (3rd party fee avoided)</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <Select value={selectedBU} onValueChange={v => { setSelectedBU(v); setSelectedSubBU("all"); }}>
                            <SelectTrigger className="w-[140px] bg-white border-slate-200 text-sm">
                                <SelectValue placeholder="BU" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All BU</SelectItem>
                                {buOptions.map(bu => <SelectItem key={bu} value={bu}>{bu}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={selectedSubBU} onValueChange={setSelectedSubBU} disabled={selectedBU === "all"}>
                            <SelectTrigger className="w-[140px] bg-white border-slate-200 text-sm">
                                <SelectValue placeholder="Sub BU" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sub BU</SelectItem>
                                {subBuOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[120px] bg-white border-slate-200 text-sm">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Years</SelectItem>
                                {yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger className="w-[140px] bg-white border-slate-200 text-sm">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Resigned">Resigned</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button variant="outline" size="sm" onClick={handleReset} className="gap-2 text-slate-500 hover:text-red-500 hover:border-red-200">
                            <RotateCcw className="h-3 w-3" /> Reset
                        </Button>

                        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2 text-slate-500 ml-auto">
                            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        <span className="text-sm text-slate-400">Loading data...</span>
                    </div>
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Total Search (JR)" value={totalSearch} icon={Search} color="from-indigo-600 to-indigo-500" />
                        <StatCard label="Successful Placement" value={totalPlacement} icon={Target} color="from-emerald-600 to-emerald-500" />
                        <StatCard label="Active JR" value={activeJR} icon={TrendingUp} color="from-amber-500 to-orange-500" />
                        <StatCard label="Total Cost Saving" value={formatMillion(totalSaving)} icon={Coins} color="from-purple-600 to-purple-500" />
                    </div>

                    {/* Summary Table */}
                    <Card className="border-none shadow-lg bg-white overflow-hidden">
                        <CardHeader className="bg-slate-900 text-white py-4 px-6">
                            <CardTitle className="text-base font-bold tracking-wide">Search & Placement Summary by BU</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-800 text-slate-200">
                                        <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider w-[100px]">Year</th>
                                        <th className="text-center px-2 py-2 text-xs font-bold text-indigo-300 border-l border-slate-600" colSpan={3}>All BU</th>
                                        {buList.map(bu => (
                                            <th key={bu} className="text-center px-2 py-2 text-xs font-bold text-slate-300 border-l border-slate-600" colSpan={3}>{bu}</th>
                                        ))}
                                    </tr>
                                    <tr className="bg-slate-700 text-slate-300 text-[10px] uppercase tracking-wider">
                                        <th className="px-4 py-2"></th>
                                        {["Search", "PPL.", "Saving"].map(h => (
                                            <th key={`all-${h}`} className="px-2 py-2 text-center font-medium text-indigo-300 border-l border-slate-600/50">{h}</th>
                                        ))}
                                        {buList.flatMap(bu => ["Search", "PPL.", "Saving"].map(h => (
                                            <th key={`${bu}-${h}`} className="px-2 py-2 text-center font-medium border-l border-slate-600/50">{h}</th>
                                        )))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Total row */}
                                    <tr className="bg-indigo-950/10 border-b border-slate-200 font-bold">
                                        <td className="px-4 py-3 text-xs font-bold text-indigo-700 uppercase">Total</td>
                                        <td className="px-2 py-3 text-center border-l border-slate-100">
                                            <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold text-sm">{totalSearch}</span>
                                        </td>
                                        <td className="px-2 py-3 text-center">
                                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-sm">{totalPlacement}</span>
                                        </td>
                                        <td className="px-2 py-3 text-center text-purple-700 font-bold text-sm">{formatMillion(totalSaving)}</td>
                                        {buList.map(bu => {
                                            const s = byBU[bu] || { search: 0, placement: 0, saving: 0 };
                                            return (
                                                <React.Fragment key={bu}>
                                                    <td className="px-2 py-3 text-center border-l border-slate-100">
                                                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-sm">{s.search || "-"}</span>
                                                    </td>
                                                    <td className="px-2 py-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded text-sm font-bold ${s.placement > 0 ? "bg-slate-800 text-white" : "text-slate-300"}`}>{s.placement || "-"}</span>
                                                    </td>
                                                    <td className="px-2 py-3 text-center text-purple-700 font-semibold text-sm">{s.saving > 0 ? formatMillion(s.saving) : "-"}</td>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                    {/* Per year rows */}
                                    {yearList.map((year, idx) => {
                                        const allStat = allBUStats[year] || { search: 0, placement: 0, saving: 0 };
                                        return (
                                            <tr key={year} className={`border-b border-slate-100 hover:bg-slate-50/70 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-600">{year}</td>
                                                <td className="px-2 py-3 text-center border-l border-slate-100 text-indigo-700 font-semibold">{allStat.search || "-"}</td>
                                                <td className="px-2 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded font-bold text-sm ${allStat.placement > 0 ? "bg-slate-800 text-white" : "text-slate-300"}`}>{allStat.placement || "-"}</span>
                                                </td>
                                                <td className="px-2 py-3 text-center text-purple-600 font-medium text-sm">{allStat.saving > 0 ? formatMillion(allStat.saving) : "-"}</td>
                                                {buList.map(bu => {
                                                    const s = (byYearBU[year] || {})[bu] || { search: 0, placement: 0, saving: 0 };
                                                    return (
                                                        <React.Fragment key={bu}>
                                                            <td className="px-2 py-3 text-center border-l border-slate-100 text-slate-600">{s.search || "-"}</td>
                                                            <td className="px-2 py-3 text-center">
                                                                <span className={`px-2 py-0.5 rounded text-sm font-bold ${s.placement > 0 ? "bg-slate-700 text-white" : "text-slate-300"}`}>{s.placement || "-"}</span>
                                                            </td>
                                                            <td className="px-2 py-3 text-center text-purple-600 text-sm">{s.saving > 0 ? formatMillion(s.saving) : "-"}</td>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>

                    {/* Charts + Lists */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Donut: by BU */}
                        <Card className="border-none shadow-lg bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold text-slate-700">Placement by BU</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {buChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={260}>
                                        <PieChart>
                                            <Pie data={buChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                                                dataKey="value" nameKey="name" paddingAngle={3}
                                                label={({ name, percent }) => `${name} (${(percent! * 100).toFixed(0)}%)`}
                                                labelLine={false}>
                                                {buChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v: any) => [`${v} PPL.`]} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">No placement data</div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Donut: by JG */}
                        <Card className="border-none shadow-lg bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold text-slate-700">Placement by Job Grade</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {jgChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={260}>
                                        <PieChart>
                                            <Pie data={jgChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                                                dataKey="value" nameKey="name" paddingAngle={3}
                                                label={({ name, percent }) => `${name} (${(percent! * 100).toFixed(0)}%)`}
                                                labelLine={false}>
                                                {jgChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v: any) => [`${v} PPL.`]} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">No JG data</div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Detail lists */}
                        <div className="flex flex-col gap-4">
                            <Card className="border-none shadow-lg bg-white flex-1">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold text-slate-700">Placement Position</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y max-h-[150px] overflow-y-auto">
                                        {filteredPlacements.slice(0, 10).map((p, i) => (
                                            <div key={i} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50">
                                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                                                <span className="text-xs text-slate-700 truncate">{p.position}</span>
                                            </div>
                                        ))}
                                        {filteredPlacements.length === 0 && <p className="text-xs text-slate-400 px-4 py-3">No data</p>}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-lg bg-white flex-1">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold text-slate-700">
                                        Executive Name
                                        <Badge variant="secondary" className="ml-2 text-[10px]">{totalPlacement}</Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y max-h-[150px] overflow-y-auto">
                                        {filteredPlacements.slice(0, 10).map((p, i) => (
                                            <div key={i} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50">
                                                <span className="text-xs text-slate-700 truncate">{p.candidate_name}</span>
                                                <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{p.bu}</Badge>
                                            </div>
                                        ))}
                                        {filteredPlacements.length === 0 && <p className="text-xs text-slate-400 px-4 py-3">No data</p>}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
