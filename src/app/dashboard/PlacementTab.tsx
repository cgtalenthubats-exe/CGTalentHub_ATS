"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { getRawPlacementData, PlacementRecord, JRRecord } from "@/app/actions/placement-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, TrendingUp, Target, Coins, Search, RefreshCw, Download } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { ActiveFilterChips } from "@/components/ui/active-filter-chips";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { generatePlacementReportPPTX } from "@/app/actions/export-placement-report";
import { toast } from "sonner";

const COLORS = ["#4f46e5", "#7c3aed", "#0891b2", "#0d9488", "#dc2626", "#ea580c", "#ca8a04", "#15803d"];

// Pie label as a solid box (slice color fill, black border, white text) instead
// of plain colored text — mirrors the same box style applied to the PPTX export.
function ColoredPieLabel(props: any) {
    const { cx, cy, midAngle, outerRadius, percent, name, index } = props;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 28;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const text = `${name} (${(percent * 100).toFixed(0)}%)`;
    const boxW = text.length * 6.2 + 14;
    const boxH = 18;
    return (
        <g>
            <rect
                x={x - boxW / 2} y={y - boxH / 2} width={boxW} height={boxH} rx={4}
                fill={COLORS[index % COLORS.length]} stroke="#000000" strokeWidth={1}
            />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize={11} fontWeight={700}>
                {text}
            </text>
        </g>
    );
}

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

function formatHireDate(dateStr: string | null): string {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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

export default function PlacementTab() {
    const [rawPlacements, setRawPlacements] = useState<PlacementRecord[]>([]);
    const [rawJRs, setRawJRs] = useState<JRRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedBU, setSelectedBU] = useState<string[]>([]);
    const [selectedSubBU, setSelectedSubBU] = useState<string[]>([]);
    const [selectedYear, setSelectedYear] = useState<string[]>([]);
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [exportingPPTX, setExportingPPTX] = useState(false);
    const [defaultYearSet, setDefaultYearSet] = useState(false);

    const handleExportPPTX = async () => {
        setExportingPPTX(true);
        try {
            const { base64, filename } = await generatePlacementReportPPTX({
                selectedBU,
                selectedSubBU,
                selectedYear,
                selectedStatus,
            });
            const link = document.createElement("a");
            link.href = `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${base64}`;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Report ready — downloading now.");
        } catch (err: any) {
            toast.error(`Export failed: ${err?.message ?? "Unknown error"}`);
        } finally {
            setExportingPPTX(false);
        }
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { placements, jrs } = await getRawPlacementData();
        setRawPlacements(placements);
        setRawJRs(jrs);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const buOptions = useMemo(() => {
        const s = new Set<string>();
        rawPlacements.forEach(r => r.bu && s.add(r.bu));
        rawJRs.forEach(r => r.bu && s.add(r.bu));
        return Array.from(s).sort();
    }, [rawPlacements, rawJRs]);

    const subBuOptions = useMemo(() => {
        if (selectedBU.length === 0) return [];
        const s = new Set<string>();
        rawPlacements.filter(r => selectedBU.includes(r.bu)).forEach(r => r.sub_bu && s.add(r.sub_bu));
        rawJRs.filter(r => selectedBU.includes(r.bu)).forEach(r => r.sub_bu && s.add(r.sub_bu));
        return Array.from(s).sort();
    }, [rawPlacements, rawJRs, selectedBU]);

    const yearOptions = useMemo(() => {
        const s = new Set<number>();
        rawPlacements.forEach(r => { const y = parseYear(r.hire_date); if (y) s.add(y); });
        rawJRs.forEach(r => { const y = parseYear(r.request_date); if (y) s.add(y); });
        return Array.from(s).sort((a, b) => b - a);
    }, [rawPlacements, rawJRs]);

    // Set latest year as default once yearOptions are available
    useEffect(() => {
        if (!defaultYearSet && yearOptions.length > 0) {
            setSelectedYear([yearOptions[0].toString()]);
            setDefaultYearSet(true);
        }
    }, [yearOptions, defaultYearSet]);

    const filteredPlacements = useMemo(() => rawPlacements.filter(r => {
        if (selectedBU.length > 0 && !selectedBU.includes(r.bu)) return false;
        if (selectedSubBU.length > 0 && !selectedSubBU.includes(r.sub_bu)) return false;
        const y = parseYear(r.hire_date);
        if (selectedYear.length > 0 && (!y || !selectedYear.includes(y.toString()))) return false;
        if (selectedStatus !== "all" && r.hiring_status !== selectedStatus) return false;
        return true;
    }), [rawPlacements, selectedBU, selectedSubBU, selectedYear, selectedStatus]);

    const filteredJRs = useMemo(() => rawJRs.filter(r => {
        if (selectedBU.length > 0 && !selectedBU.includes(r.bu)) return false;
        if (selectedSubBU.length > 0 && !selectedSubBU.includes(r.sub_bu)) return false;
        const y = parseYear(r.request_date);
        if (selectedYear.length > 0 && (!y || !selectedYear.includes(y.toString()))) return false;
        return true;
    }), [rawJRs, selectedBU, selectedSubBU, selectedYear]);

    const buList = useMemo(() => {
        const s = new Set<string>();
        // If BU is selected, only show those BUs in table columns
        if (selectedBU.length > 0) {
            selectedBU.forEach(bu => s.add(bu));
        } else {
            rawPlacements.forEach(r => r.bu && s.add(r.bu));
            rawJRs.forEach(r => r.bu && s.add(r.bu));
        }
        return Array.from(s).sort();
    }, [rawPlacements, rawJRs, selectedBU]);

    const yearList = useMemo(() => {
        const s = new Set<number>();
        // If Year is selected, only show those years in table rows
        if (selectedYear.length > 0) {
            selectedYear.forEach(y => s.add(parseInt(y)));
        } else {
            rawPlacements.forEach(r => { const y = parseYear(r.hire_date); if (y) s.add(y); });
            rawJRs.forEach(r => { const y = parseYear(r.request_date); if (y) s.add(y); });
        }
        return Array.from(s).sort((a, b) => b - a);
    }, [rawPlacements, rawJRs, selectedYear]);

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

        filteredJRs.forEach(jr => {
            const y = parseYear(jr.request_date);
            if (!y || !jr.bu || !result[y] || !result[y][jr.bu]) return;
            result[y][jr.bu].search++;
        });

        filteredPlacements.forEach(er => {
            const y = parseYear(er.hire_date);
            if (!y || !er.bu || !result[y] || !result[y][er.bu]) return;
            result[y][er.bu].placement++;
            result[y][er.bu].saving += er.outsource_fee_20_percent;
        });
        return result;
    }, [yearList, buList, filteredJRs, filteredPlacements]);

    const allBUStats = useMemo(() => {
        const result: Record<number, { search: number; placement: number; saving: number }> = {};
        yearList.forEach(y => {
            const yJRs = rawJRs.filter(r => {
                const yr = parseYear(r.request_date);
                if (yr !== y) return false;
                if (selectedBU.length > 0 && !selectedBU.includes(r.bu)) return false;
                if (selectedSubBU.length > 0 && !selectedSubBU.includes(r.sub_bu)) return false;
                return true;
            });
            const yERs = rawPlacements.filter(r => {
                const yr = parseYear(r.hire_date);
                if (yr !== y) return false;
                if (selectedBU.length > 0 && !selectedBU.includes(r.bu)) return false;
                if (selectedSubBU.length > 0 && !selectedSubBU.includes(r.sub_bu)) return false;
                if (selectedStatus !== "all" && r.hiring_status !== selectedStatus) return false;
                return true;
            });
            result[y] = { search: yJRs.length, placement: yERs.length, saving: yERs.reduce((s, r) => s + r.outsource_fee_20_percent, 0) };
        });
        return result;
    }, [yearList, rawJRs, rawPlacements, selectedBU, selectedSubBU, selectedStatus]);

    const byJobGrade = useMemo(() => {
        const result: Record<string, number> = {};
        filteredPlacements.forEach(er => {
            const jg = er.job_grade ? `JG ${er.job_grade}` : null;
            if (jg) result[jg] = (result[jg] || 0) + 1;
        });
        return result;
    }, [filteredPlacements]);

    const totalSearch = filteredJRs.length;
    const totalPlacement = filteredPlacements.length;
    const totalSaving = useMemo(() => filteredPlacements.reduce((s, r) => s + r.outsource_fee_20_percent, 0), [filteredPlacements]);
    const activeJR = filteredJRs.length; // Deprecated status filtering; count all.

    const buChartData = Object.entries(byBU).filter(([, v]) => v.placement > 0).map(([bu, v]) => ({ name: bu, value: v.placement }));
    const jgChartData = Object.entries(byJobGrade).map(([jg, count]) => ({ name: jg, value: count }));

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="text-sm text-slate-400">Loading placement data...</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Info bar */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Coins className="w-4 h-4 text-purple-500" />
                    Cost Saving = 20% of Annual Salary avoided by recruiting in-house instead of 3rd party
                </p>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline" size="sm"
                        onClick={handleExportPPTX}
                        disabled={exportingPPTX || loading}
                        className="gap-2 text-slate-500"
                    >
                        {exportingPPTX
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Download className="h-3 w-3" />}
                        Export PPTX
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2 text-slate-500">
                        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center p-4 bg-muted/30 rounded-lg border">
                <FilterMultiSelect
                    label="BU"
                    options={buOptions}
                    selected={selectedBU}
                    onChange={(val) => {
                        setSelectedBU(prev => prev.includes(val) ? prev.filter(i => i !== val) : [...prev, val]);
                    }}
                />
                <FilterMultiSelect
                    label="Sub BU"
                    options={subBuOptions}
                    selected={selectedSubBU}
                    onChange={(val) => {
                        setSelectedSubBU(prev => prev.includes(val) ? prev.filter(i => i !== val) : [...prev, val]);
                    }}
                    disabled={selectedBU.length === 0}
                />
                <FilterMultiSelect
                    label="Year"
                    options={yearOptions.map(y => y.toString())}
                    selected={selectedYear}
                    onChange={(val) => {
                        setSelectedYear(prev => prev.includes(val) ? prev.filter(i => i !== val) : [...prev, val]);
                    }}
                />
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[130px] text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Resigned">Resigned</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedBU([]); setSelectedSubBU([]); setSelectedYear([]); setSelectedStatus("all"); }}
                    className="gap-2 text-slate-500 hover:text-red-500">
                    <RotateCcw className="h-3 w-3" /> Reset
                </Button>
            </div>

            <ActiveFilterChips groups={[
                { label: "BU", values: selectedBU, onRemove: v => setSelectedBU(prev => prev.filter(i => i !== v)) },
                { label: "Sub BU", values: selectedSubBU, onRemove: v => setSelectedSubBU(prev => prev.filter(i => i !== v)) },
                { label: "Year", values: selectedYear, onRemove: v => setSelectedYear(prev => prev.filter(i => i !== v)) },
            ]} />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="Total Search (JR)" value={totalSearch} icon={Search} color="from-indigo-600 to-indigo-500" />
                <StatCard label="Successful Placement" value={totalPlacement} icon={Target} color="from-emerald-600 to-emerald-500" />
                <StatCard label="Total Cost Saving" value={formatMillion(totalSaving)} icon={Coins} color="from-purple-600 to-purple-500" />
            </div>

            {/* Summary Table */}
            <Card className="border-none shadow-lg overflow-hidden">
                <CardHeader className="bg-slate-900 text-white py-4 px-6">
                    <CardTitle className="text-base font-bold">Search & Placement Summary by BU</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-800 text-slate-200">
                                <th className="text-left px-4 py-3 text-xs font-semibold uppercase w-[100px]">Year</th>
                                <th className="text-center px-2 py-2 text-xs font-bold text-indigo-300 border-l-2 border-indigo-400" colSpan={3}>All BU</th>
                                {buList.map(bu => (
                                <th key={bu} className="text-center px-2 py-6 text-xs font-bold text-slate-300 border-l-2 border-slate-500" colSpan={3}>
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-32 h-16 relative bg-white/5 rounded-lg flex items-center justify-center overflow-hidden border border-white/10 group">
                                                <img 
                                                    src={`/images/bu-logos/${bu.toLowerCase()}.png`} 
                                                    alt={bu}
                                                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110"
                                                    onError={(e: any) => {
                                                        const target = e.target as HTMLImageElement;
                                                        if (!target.src.endsWith('.jpg')) {
                                                            target.src = `/images/bu-logos/${bu.toLowerCase()}.jpg`;
                                                        } else {
                                                            target.style.display = 'none';
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <span className="uppercase tracking-[0.25em] text-[13px] font-black text-slate-400">{bu}</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                            <tr className="bg-slate-700 text-[10px] uppercase tracking-wider text-slate-300">
                                <th className="px-4 py-2"></th>
                                {["Search", "Place", "Saving"].map(h => (
                                    <th key={`all-${h}`} className={cn("px-3 py-3 text-center font-medium text-indigo-300", h === "Search" ? "border-l-2 border-indigo-400" : "border-l border-slate-500", h === "Saving" ? "w-[100px]" : "w-[80px]")}>{h}</th>
                                ))}
                                {buList.flatMap(bu => ["Search", "Place", "Saving"].map(h => (
                                    <th key={`${bu}-${h}`} className={cn("px-3 py-3 text-center font-medium", h === "Search" ? "border-l-2 border-slate-500" : "border-l border-slate-600", h === "Saving" ? "w-[100px]" : "w-[80px]")}>{h}</th>
                                )))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="bg-indigo-950/10 border-b-2 border-slate-300 font-bold">
                                <td className="px-4 py-3 text-xs font-bold text-indigo-700 uppercase">Total</td>
                                <td className="px-2 py-3 text-center border-l-2 border-indigo-300"><span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold text-sm">{totalSearch}</span></td>
                                <td className="px-2 py-3 text-center border-l border-slate-200"><span className="text-emerald-700 font-bold text-sm">{totalPlacement}</span></td>
                                <td className="px-2 py-3 text-center border-l border-slate-200"><span className="bg-purple-600 text-white px-2 py-1 rounded-lg font-bold text-sm shadow-sm">{formatMillion(totalSaving)}</span></td>
                                {buList.map(bu => {
                                    const s = byBU[bu] || { search: 0, placement: 0, saving: 0 };
                                    return (
                                        <React.Fragment key={bu}>
                                            <td className="px-2 py-3 text-center border-l-2 border-slate-300"><span className="text-slate-600 font-medium text-sm">{s.search || "-"}</span></td>
                                            <td className="px-2 py-3 text-center border-l border-slate-200"><span className={`text-sm font-bold ${s.placement > 0 ? "text-slate-800" : "text-slate-400"}`}>{s.placement || "-"}</span></td>
                                            <td className="px-2 py-3 text-center border-l border-slate-200">
                                                {s.saving > 0 ? (
                                                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold text-sm">{formatMillion(s.saving)}</span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                        </React.Fragment>
                                    );
                                })}
                            </tr>
                            {yearList.map((year, idx) => {
                                const allStat = allBUStats[year] || { search: 0, placement: 0, saving: 0 };
                                return (
                                    <tr key={year} className={`border-b border-slate-200 hover:bg-slate-50/70 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                                        <td className="px-4 py-3 text-xs font-bold text-slate-600">{year}</td>
                                        <td className="px-2 py-3 text-center border-l-2 border-indigo-200 text-indigo-700 font-medium">{allStat.search || "-"}</td>
                                        <td className="px-2 py-3 text-center border-l border-slate-200"><span className={`font-bold text-sm ${allStat.placement > 0 ? "text-slate-700" : "text-slate-400"}`}>{allStat.placement || "-"}</span></td>
                                        <td className="px-2 py-3 text-center border-l border-slate-200">
                                            {allStat.saving > 0 ? (
                                                <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded font-bold text-sm">{formatMillion(allStat.saving)}</span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        {buList.map(bu => {
                                            const s = (byYearBU[year] || {})[bu] || { search: 0, placement: 0, saving: 0 };
                                            return (
                                                <React.Fragment key={bu}>
                                                    <td className="px-2 py-3 text-center border-l-2 border-slate-200 text-slate-500">{s.search || "-"}</td>
                                                    <td className="px-2 py-3 text-center border-l border-slate-200"><span className={`text-sm font-semibold ${s.placement > 0 ? "text-slate-700" : "text-slate-400"}`}>{s.placement || "-"}</span></td>
                                                    <td className="px-2 py-3 text-center border-l border-slate-200">
                                                        {s.saving > 0 ? (
                                                            <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded font-bold text-xs">{formatMillion(s.saving)}</span>
                                                        ) : (
                                                            <span className="text-slate-400">-</span>
                                                        )}
                                                    </td>
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

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-slate-700">Placement by BU</CardTitle></CardHeader>
                    <CardContent>
                        {buChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie data={buChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value"
                                        label={ColoredPieLabel} labelLine={false} paddingAngle={3}>
                                        {buChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: any) => [`${v} PPL.`]} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm">No placement data</div>}
                    </CardContent>
                </Card>

                <Card className="border shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-slate-700">Placement by Job Grade</CardTitle></CardHeader>
                    <CardContent>
                        {jgChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie data={jgChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value"
                                        label={ColoredPieLabel} labelLine={false} paddingAngle={3}>
                                        {jgChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: any) => [`${v} PPL.`]} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm">No JG data</div>}
                    </CardContent>
                </Card>
            </div>

            {/* Placement List — Position + Executive Name were the same row split */}
            {/* across two cards; merged here with JR ID added, full width since it's long */}
            <Card className="border shadow-sm overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-slate-700">
                        Placement List <Badge variant="secondary" className="ml-2 text-[10px]">{totalPlacement}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[400px] overflow-auto">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-500">
                                <tr>
                                    <th className="text-left px-4 py-2 font-semibold w-10">#</th>
                                    <th className="text-left px-4 py-2 font-semibold">JR ID</th>
                                    <th className="text-left px-4 py-2 font-semibold">Position</th>
                                    <th className="text-left px-4 py-2 font-semibold">Executive Name</th>
                                    <th className="text-left px-4 py-2 font-semibold">BU</th>
                                    <th className="text-left px-4 py-2 font-semibold">Hiring Date</th>
                                    <th className="text-left px-4 py-2 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredPlacements.map((p, i) => (
                                    <tr key={`${p.jr_id}-${i}`} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 text-slate-400">
                                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                                        </td>
                                        <td className="px-4 py-2 text-slate-500 font-mono">{p.jr_id || "-"}</td>
                                        <td className="px-4 py-2 text-slate-700">{p.position}</td>
                                        <td className="px-4 py-2 text-slate-700 font-medium">{p.candidate_name}</td>
                                        <td className="px-4 py-2"><Badge variant="outline" className="text-[10px]">{p.bu}</Badge></td>
                                        <td className="px-4 py-2 text-slate-500">{formatHireDate(p.hire_date)}</td>
                                        <td className="px-4 py-2">
                                            <Badge variant={p.hiring_status === "Resigned" ? "destructive" : "secondary"} className="text-[10px]">
                                                {p.hiring_status || "-"}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                                {filteredPlacements.length === 0 && (
                                    <tr><td colSpan={7} className="text-center text-slate-400 px-4 py-6">No data</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
