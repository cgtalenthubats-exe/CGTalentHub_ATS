"use client";

import React, { useEffect, useState, useMemo } from "react";
import { getKPIData, KPIRawData } from "@/app/actions/kpi-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2, Search, ClipboardCheck, MessageSquare, FolderOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// ─── Constants ─────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];


// ─── Helpers ───────────────────────────────────────────────────────

function parseDate(d: string | null): Date | null {
    if (!d) return null;
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date;
}

// ─── Main Component ────────────────────────────────────────────────

export default function RecruiterPerformanceTab() {
    const [rawData, setRawData] = useState<KPIRawData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedFY, setSelectedFY] = useState<number>(new Date().getFullYear());
    const [selectedRecruiters, setSelectedRecruiters] = useState<string[]>([]);


    useEffect(() => {
        getKPIData().then(data => {
            setRawData(data);
            setLoading(false);
        });
    }, []);

    // ─── Recruiter Name Resolution ─────────────────────────────────

    const profileMap = useMemo(() => {
        const map = new Map<string, string>();
        if (rawData?.profiles) {
            rawData.profiles.forEach(p => {
                if (p.email) map.set(p.email.toLowerCase().trim(), p.real_name);
                if (p.real_name) map.set(p.real_name.toLowerCase().trim(), p.real_name);
            });
        }
        return map;
    }, [rawData]);

    const customAliases: Record<string, string> = {
        "system import": "Admin2",
        "admin@cgtalent.com": "Admin2",
        "admin2": "Admin2"
    };

    const resolveRecruiter = (identifier: string | null): string => {
        const safe = (identifier || "Unknown").toLowerCase().trim();
        if (customAliases[safe]) return customAliases[safe];
        let displayName = profileMap.get(safe) || identifier || "Unknown";
        if (!displayName.includes('@') && displayName !== "Unknown") {
            displayName = displayName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }
        return displayName;
    };

    // ─── Auto-detect FYs ───────────────────────────────────────────

    const availableFYs = useMemo(() => {
        if (!rawData) return [new Date().getFullYear()];
        const dates = [
            ...rawData.sourcing.map(s => s.created_date),
            ...rawData.prescreens.map(p => p.screening_date),
            ...rawData.interviews.map(i => i.interview_date),
            ...rawData.jrs.map(j => j.created_at),
        ].filter(Boolean);
        const years = [...new Set(dates.map(d => {
            const parsed = parseDate(d);
            return parsed ? parsed.getFullYear() : null;
        }).filter(Boolean))] as number[];
        return years.sort((a, b) => b - a);
    }, [rawData]);

    // ─── All recruiter names (for filter options) ──────────────────

    const allRecruiterNames = useMemo(() => {
        if (!rawData) return [];
        const names = new Set<string>();
        rawData.sourcing.forEach(s => names.add(resolveRecruiter(s.created_by)));
        rawData.prescreens.forEach(p => names.add(resolveRecruiter(p.screener_Name)));
        rawData.interviews.filter(i => i.Interviewer_type === 'Recruiter').forEach(i => names.add(resolveRecruiter(i.Interviewer_name)));
        rawData.jrs.forEach(j => names.add(resolveRecruiter(j.create_by)));
        return Array.from(names).sort();
    }, [rawData]);

    // ─── Filter by FY ──────────────────────────────────────────────

    const isInFY = (dateStr: string | null): boolean => {
        const d = parseDate(dateStr);
        return d !== null && d.getFullYear() === selectedFY;
    };

    // ─── Filter by Recruiter ───────────────────────────────────────

    const matchRecruiter = (identifier: string | null): boolean => {
        if (selectedRecruiters.length === 0) return true;
        return selectedRecruiters.includes(resolveRecruiter(identifier));
    };

    // ─── Filtered data ─────────────────────────────────────────────

    const filteredSourcing = useMemo(() =>
        rawData?.sourcing.filter(s => isInFY(s.created_date) && matchRecruiter(s.created_by)) || [],
        [rawData, selectedFY, selectedRecruiters]);

    const filteredPrescreens = useMemo(() =>
        rawData?.prescreens.filter(p => isInFY(p.screening_date) && matchRecruiter(p.screener_Name)) || [],
        [rawData, selectedFY, selectedRecruiters]);

    const filteredInterviews = useMemo(() =>
        rawData?.interviews.filter(i => i.Interviewer_type === 'Recruiter' && isInFY(i.interview_date) && matchRecruiter(i.Interviewer_name)) || [],
        [rawData, selectedFY, selectedRecruiters]);

    const filteredJRs = useMemo(() =>
        rawData?.jrs.filter(j => isInFY(j.created_at) && matchRecruiter(j.create_by)) || [],
        [rawData, selectedFY, selectedRecruiters]);

    // ─── Build monthly chart data (Jan-Dec) ─────────────────────────

    const buildMonthlyData = (items: any[], dateKey: string): { label: string; count: number }[] => {
        const data = MONTH_NAMES.map(m => ({ label: m, count: 0 }));
        items.forEach(item => {
            const d = parseDate(item[dateKey]);
            if (d) data[d.getMonth()].count++;
        });
        return data;
    };

    const sourcingChart = useMemo(() => buildMonthlyData(filteredSourcing, 'created_date'), [filteredSourcing]);
    const interviewChart = useMemo(() => buildMonthlyData(filteredInterviews, 'interview_date'), [filteredInterviews]);
    const prescreenChart = useMemo(() => buildMonthlyData(filteredPrescreens, 'screening_date'), [filteredPrescreens]);
    const jrChart = useMemo(() => buildMonthlyData(filteredJRs, 'created_at'), [filteredJRs]);

    // ─── Table data (per recruiter, no ranking) ────────────────────

    const tableData = useMemo(() => {
        const map = new Map<string, { name: string; sourced: number; prescreens: number; interviews: number; jrs: number }>();
        const ensure = (name: string) => {
            if (!map.has(name)) map.set(name, { name, sourced: 0, prescreens: 0, interviews: 0, jrs: 0 });
            return map.get(name)!;
        };
        filteredSourcing.forEach(s => ensure(resolveRecruiter(s.created_by)).sourced++);
        filteredPrescreens.forEach(p => ensure(resolveRecruiter(p.screener_Name)).prescreens++);
        filteredInterviews.forEach(i => ensure(resolveRecruiter(i.Interviewer_name)).interviews++);
        filteredJRs.forEach(j => ensure(resolveRecruiter(j.create_by)).jrs++);
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
    }, [filteredSourcing, filteredPrescreens, filteredInterviews, filteredJRs]);

    // ─── Render ────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center text-gray-500 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading Recruiter Performance Data...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ── Filters ─────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3">
                <Select value={selectedFY.toString()} onValueChange={v => setSelectedFY(parseInt(v))}>
                    <SelectTrigger className="w-[130px] text-sm">
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
                    onChange={(val) => {
                        setSelectedRecruiters(prev =>
                            prev.includes(val) ? prev.filter(i => i !== val) : [...prev, val]
                        );
                    }}
                />

                {(selectedRecruiters.length > 0 || selectedFY !== new Date().getFullYear()) && (
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedRecruiters([]); setSelectedFY(new Date().getFullYear()); }} className="gap-1 text-xs">
                        <RotateCcw className="h-3 w-3" /> Reset
                    </Button>
                )}
            </div>

            {/* ── Summary Cards ────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard icon={<Search className="h-3.5 w-3.5" />} label="Profiles Sourced" value={filteredSourcing.length} color="blue" />
                <SummaryCard icon={<ClipboardCheck className="h-3.5 w-3.5" />} label="Pre-Screens" value={filteredPrescreens.length} color="amber" />
                <SummaryCard icon={<MessageSquare className="h-3.5 w-3.5" />} label="Interviews" value={filteredInterviews.length} color="emerald" />
                <SummaryCard icon={<FolderOpen className="h-3.5 w-3.5" />} label="JRs Created" value={filteredJRs.length} color="purple" />
            </div>

            {/* ── 4 Metric Charts (2x2 grid) ──────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MetricChart title={`Profiles Sourced — FY${selectedFY}`} data={sourcingChart} color="#3b82f6" />
                <MetricChart title={`Interviews — FY${selectedFY}`} data={interviewChart} color="#10b981" />
                <MetricChart title={`Pre-Screens — FY${selectedFY}`} data={prescreenChart} color="#f59e0b" />
                <MetricChart title={`JRs Created — FY${selectedFY}`} data={jrChart} color="#8b5cf6" />
            </div>

            {/* ── Recruiter Table ──────────────────────────────────── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Recruiter Activity — FY{selectedFY}</CardTitle>
                    <p className="text-xs text-muted-foreground">{tableData.length} recruiters • Click name to view details</p>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead>Recruiter</TableHead>
                                    <TableHead className="text-right">Sourced</TableHead>
                                    <TableHead className="text-right">Pre-Screens</TableHead>
                                    <TableHead className="text-right">Interviews</TableHead>
                                    <TableHead className="text-right">JRs</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tableData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-gray-500 py-12">
                                            No data found for FY{selectedFY}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    tableData.map(row => (
                                        <TableRow key={row.name} className="hover:bg-slate-50/50">
                                            <TableCell className="font-medium">
                                                <Link
                                                    href={`/dashboard/recruiter/details?recruiter=${encodeURIComponent(row.name)}`}
                                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                                >
                                                    {row.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-blue-600">{row.sourced.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-semibold text-amber-600">{row.prescreens}</TableCell>
                                            <TableCell className="text-right font-semibold text-emerald-600">{row.interviews}</TableCell>
                                            <TableCell className="text-right font-semibold text-purple-600">{row.jrs}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Sub-Components ────────────────────────────────────────────────

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
    const colorMap: Record<string, { border: string; bg: string; text: string; value: string }> = {
        blue:    { border: "border-l-blue-500",    bg: "from-blue-50/50",    text: "text-blue-600/80",    value: "text-blue-700" },
        amber:   { border: "border-l-amber-500",   bg: "from-amber-50/50",   text: "text-amber-600/80",   value: "text-amber-700" },
        emerald: { border: "border-l-emerald-500", bg: "from-emerald-50/50", text: "text-emerald-600/80", value: "text-emerald-700" },
        purple:  { border: "border-l-purple-500",  bg: "from-purple-50/50",  text: "text-purple-600/80",  value: "text-purple-700" },
    };
    const c = colorMap[color] || colorMap.blue;
    return (
        <Card className={`border-l-4 ${c.border} bg-gradient-to-r ${c.bg} to-transparent`}>
            <CardHeader className="pb-1 pt-4 px-5">
                <CardTitle className={`text-xs font-medium ${c.text} uppercase tracking-wider flex items-center gap-2`}>
                    {icon} {label}
                </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-5">
                <div className={`text-3xl font-black ${c.value}`}>{value.toLocaleString()}</div>
            </CardContent>
        </Card>
    );
}

function MetricChart({ title, data, color }: { title: string; data: { label: string; count: number }[]; color: string }) {
    return (
        <Card>
            <CardHeader className="pb-1">
                <CardTitle className="text-sm font-bold">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 600 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                            formatter={(value: number) => [value.toLocaleString(), "Count"]}
                        />
                        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
