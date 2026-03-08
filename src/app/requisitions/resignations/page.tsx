"use client";

import React, { useEffect, useState } from "react";
import { getEmploymentRecords } from "@/app/actions/employment";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    LogOut,
    Search,
    Building2,
    Calendar,
    ArrowLeft,
    ScrollText,
    History,
    Briefcase
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pencil, PieChart, Users } from "lucide-react";
import { EditResignationDialog } from "@/components/edit-resignation-dialog";
import { getEmploymentCounts } from "@/app/actions/employment";
import {
    PieChart as RePieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as ReTooltip,
    Legend
} from "recharts";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

function calculateYoS(hireDate: string, resignDate: string) {
    if (!hireDate || !resignDate) return "N/A";
    const start = new Date(hireDate);
    const end = new Date(resignDate);
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    if (months < 0) {
        years--;
        months += 12;
    }
    return `${years}y ${months}m`;
}

export default function ResignationsPage() {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [buFilter, setBuFilter] = useState("all");
    const [reasonFilter, setReasonFilter] = useState("all");

    const [counts, setCounts] = useState({ active: 0, resigned: 0 });

    const router = useRouter();

    const loadRecords = async () => {
        setLoading(true);
        const [data, stats] = await Promise.all([
            getEmploymentRecords('Resigned'),
            getEmploymentCounts()
        ]);
        setRecords(data);
        setCounts(stats);
        setLoading(false);
    };

    useEffect(() => {
        loadRecords();
    }, []);

    const filteredRecords = records.filter(r => {
        const matchesSearch = r.candidate_name?.toLowerCase().includes(search.toLowerCase()) ||
            r.position?.toLowerCase().includes(search.toLowerCase()) ||
            r.jr_id?.toLowerCase().includes(search.toLowerCase());

        const matchesBU = buFilter === "all" || r.bu === buFilter;
        const matchesReason = reasonFilter === "all" || (r.resignation_reason || "Other") === reasonFilter;

        return matchesSearch && matchesBU && matchesReason;
    });

    const uniqueBUs = Array.from(new Set(records.map(r => r.bu).filter(Boolean))).sort();
    const uniqueReasons = Array.from(new Set(records.map(r => r.resignation_reason || "Other"))).sort();

    return (
        <div className="mx-auto p-6 space-y-8 w-full max-w-[95%] animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <AtsBreadcrumb
                        items={[
                            { label: 'Job Requisition Menu', href: '/requisitions' },
                            { label: 'Resignation Table' }
                        ]}
                    />
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-xl">
                            <LogOut className="w-8 h-8 text-red-600" />
                        </div>
                        Resignation Table
                    </h1>
                    <p className="text-slate-500 font-medium">History of employee resignations and departure reasons.</p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-3">
                    {/* BU Filter */}
                    <div className="w-full md:w-48">
                        <Select value={buFilter} onValueChange={setBuFilter}>
                            <SelectTrigger className="h-12 bg-white border-slate-200 rounded-2xl shadow-sm font-medium">
                                <SelectValue placeholder="All Business Units" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                <SelectItem value="all" className="font-bold text-slate-400">All Business Units</SelectItem>
                                {uniqueBUs.map(bu => (
                                    <SelectItem key={bu} value={bu} className="font-medium text-slate-700">{bu}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Reason Filter */}
                    <div className="w-full md:w-48">
                        <Select value={reasonFilter} onValueChange={setReasonFilter}>
                            <SelectTrigger className="h-12 bg-white border-slate-200 rounded-2xl shadow-sm font-medium">
                                <SelectValue placeholder="All Reasons" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                <SelectItem value="all" className="font-bold text-slate-400">All Reasons</SelectItem>
                                {uniqueReasons.map(reason => (
                                    <SelectItem key={reason} value={reason} className="font-medium text-slate-700">{reason}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Search name, position..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-12 bg-white border-slate-200 rounded-2xl shadow-sm focus:ring-primary/20 transition-all font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Stats Summary & Dashboard — 3-column row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="md:col-span-4 border-none shadow-xl shadow-slate-200/50 bg-white rounded-[2.5rem] p-6">
                    <div className="flex flex-col lg:flex-row gap-6 items-stretch">

                        {/* Col 1: Total Resigned — horizontal banner */}
                        <div className="lg:flex-[1] flex items-center gap-5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl px-8 py-6 shadow-lg min-h-[100px]">
                            <div className="p-3 bg-white/10 rounded-xl">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Resigned</p>
                                <h2 className="text-5xl font-black text-white leading-none">{records.length}</h2>
                            </div>
                        </div>

                        {/* Col 2: Resigned Reason vs Tenure table */}
                        <div className="lg:flex-[2] space-y-3">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <History className="w-4 h-4 text-indigo-600" />
                                Resigned Reason vs Tenure
                            </h3>
                            <div className="bg-slate-50/50 rounded-[1.5rem] border border-slate-100 overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-slate-100">
                                            <TableHead className="py-2 px-4 font-black text-slate-600 text-[13px] tracking-widest uppercase">Resigned Reason</TableHead>
                                            <TableHead className="py-2 font-black text-center text-slate-600 text-[13px] tracking-widest uppercase">{'<1Y'}</TableHead>
                                            <TableHead className="py-2 font-black text-center text-slate-600 text-[13px] tracking-widest uppercase">1-2Y</TableHead>
                                            <TableHead className="py-2 font-black text-center text-slate-600 text-[13px] tracking-widest uppercase">3-5Y</TableHead>
                                            <TableHead className="py-2 font-black text-center text-slate-600 text-[13px] tracking-widest uppercase">6-9Y</TableHead>
                                            <TableHead className="py-2 font-black text-center text-slate-600 text-[13px] tracking-widest uppercase">10Y+</TableHead>
                                            <TableHead className="py-2 pr-4 font-black text-center text-indigo-600 text-[13px] tracking-widest uppercase">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {getResignationBreakdown(records)
                                            .slice()
                                            .sort((a: any, b: any) => a.reason.localeCompare(b.reason))
                                            .map((row: any, idx: number) => (
                                                <TableRow key={idx} className="hover:bg-slate-50/50 border-slate-50">
                                                    <TableCell className="py-2 px-4 font-semibold text-slate-700 text-[15px]">{row.reason}</TableCell>
                                                    <TableCell className="py-2 text-center text-slate-500 font-medium text-[15px]">{row.lessThan1 || '—'}</TableCell>
                                                    <TableCell className="py-2 text-center text-slate-500 font-medium text-[15px]">{row.oneToTwo || '—'}</TableCell>
                                                    <TableCell className="py-2 text-center text-slate-500 font-medium text-[15px]">{row.threeToFive || '—'}</TableCell>
                                                    <TableCell className="py-2 text-center text-slate-500 font-medium text-[15px]">{row.sixToNine || '—'}</TableCell>
                                                    <TableCell className="py-2 text-center text-slate-500 font-medium text-[15px]">{row.tenPlus || '—'}</TableCell>
                                                    <TableCell className="py-2 pr-4 text-center font-black text-indigo-600 text-[16px]">{row.total}</TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Col 3: Pie Chart — legend right, pie shifted right */}
                        <div className="lg:flex-[2] space-y-3">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <PieChart className="w-4 h-4 text-indigo-600" />
                                Resigned Reason Distribution
                            </h3>
                            <div className="h-[300px] w-full bg-slate-50/50 rounded-[1.5rem] border border-slate-100">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RePieChart>
                                        <Pie
                                            data={(() => {
                                                const breakdown = getResignationBreakdown(records)
                                                    .slice()
                                                    .sort((a: any, b: any) => a.reason.localeCompare(b.reason));
                                                return breakdown.map(b => ({ name: b.reason, value: b.total }));
                                            })()}
                                            cx="42%"
                                            cy="50%"
                                            innerRadius={65}
                                            outerRadius={100}
                                            paddingAngle={3}
                                            dataKey="value"
                                            label={({ value }) => `${value}`}
                                            labelLine={true}
                                        >
                                            {[
                                                "#6366f1",
                                                "#10b981",
                                                "#f59e0b",
                                                "#ef4444",
                                                "#8b5cf6",
                                                "#3b82f6"
                                            ].map((color, idx) => (
                                                <Cell key={`cell-${idx}`} fill={color} />
                                            ))}
                                        </Pie>
                                        <ReTooltip
                                            formatter={(value: any, name: any) => [value, name]}
                                            contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 20px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '12px' }}
                                        />
                                        <Legend
                                            layout="vertical"
                                            align="right"
                                            verticalAlign="middle"
                                            formatter={(value: any, entry: any) => (
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                                                    {value} <span style={{ color: entry.color, fontWeight: 900 }}>({entry.payload?.value})</span>
                                                </span>
                                            )}
                                        />
                                    </RePieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                    </div>
                </Card>
            </div>

            {/* Table Area */}
            <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="hover:bg-transparent border-slate-100">
                                    <TableHead className="font-black text-slate-600 uppercase text-xs tracking-widest py-6 pl-8">Name & Position</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-xs tracking-widest py-6">Business Unit</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-xs tracking-widest py-6 text-indigo-600">YoS</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-xs tracking-widest py-6">Resigned Date</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-xs tracking-widest py-6">Reason</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-xs tracking-widest py-6">Company Destination</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-xs tracking-widest py-6">New Position</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-xs tracking-widest py-6">Track Status</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-xs tracking-widest py-6">Notes</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-xs tracking-widest py-6 pr-8 text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={10} className="h-64 text-center text-slate-400 font-bold uppercase tracking-widest">Loading Records...</TableCell></TableRow>
                                ) : filteredRecords.length === 0 ? (
                                    <TableRow><TableCell colSpan={10} className="h-64 text-center text-slate-400 font-bold uppercase tracking-widest">No resignation history found</TableCell></TableRow>
                                ) : filteredRecords.map((r) => (
                                    <TableRow key={r.employment_record_id} className="group hover:bg-slate-50/50 transition-colors border-slate-100">
                                        <TableCell className="py-6 pl-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold shadow-sm">
                                                    {r.candidate_name?.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-800 text-sm mb-1">{r.candidate_name}</span>
                                                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                                        <Briefcase className="w-3.5 h-3.5" /> {r.position} ({r.jr_id})
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-sm uppercase">{r.bu || 'N/A'}</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{r.sub_bu}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {r.hire_date && r.resign_date ? (
                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 uppercase">
                                                    {calculateYoS(r.hire_date, r.resign_date)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 text-xs font-bold italic">N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <Calendar className="w-4 h-4 text-red-400" />
                                                <span className="text-sm font-bold">{r.resign_date ? new Date(r.resign_date).toLocaleDateString() : 'N/A'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[120px]">
                                                <Badge variant="outline" className="border-slate-200 text-slate-600 font-bold text-[10px] uppercase py-1 px-2">
                                                    {r.resignation_reason || 'Unspecified'}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col max-w-[150px]">
                                                {r.company_destination ? (
                                                    <span className="font-bold text-slate-700 text-sm truncate">{r.company_destination}</span>
                                                ) : (
                                                    <span className="text-slate-300 font-bold text-xs italic">Awaiting Update</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col max-w-[150px]">
                                                {r.new_position ? (
                                                    <span className="text-xs font-black text-slate-400 uppercase tracking-tighter truncate">{r.new_position}</span>
                                                ) : (
                                                    <span className="text-slate-300 font-bold text-[10px] italic">—</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Badge className={cn(
                                                    "w-fit text-[9px] font-black px-2 py-0.5 uppercase tracking-tighter shadow-none border-none",
                                                    r.tracking_status === 'manual' ? "bg-emerald-100 text-emerald-700" :
                                                        r.tracking_status === 'auto' ? "bg-amber-100 text-amber-700 animate-pulse" :
                                                            r.tracking_status === 'ref_set' ? "bg-blue-100 text-blue-700" :
                                                                "bg-slate-100 text-slate-400"
                                                )}>
                                                    {r.tracking_status || 'pending'}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-start gap-2 max-w-[150px]">
                                                <ScrollText className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
                                                <p className="text-xs text-slate-500 font-medium line-clamp-1 italic">
                                                    {r.resign_note || 'No notes'}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="pr-8 text-right">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => {
                                                    setSelectedRecord(r);
                                                    setIsEditDialogOpen(true);
                                                }}
                                                className="border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 rounded-xl transition-all h-8 w-8"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            <EditResignationDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                initialData={selectedRecord}
                onSuccess={() => {
                    loadRecords();
                    setSelectedRecord(null);
                }}
            />
        </div>
    );
}

function getTopReason(records: any[]) {
    if (records.length === 0) return "N/A";
    const counts = records.reduce((acc: any, curr: any) => {
        const reason = curr.resignation_reason || "Unspecified";
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts).sort((a: any, b: any) => b[1] - a[1])[0][0];
}

function getAvgTenure(records: any[]) {
    if (records.length === 0) return "N/A";
    const tenures = records.map(r => {
        if (!r.hire_date || !r.resign_date) return 0;
        const start = new Date(r.hire_date);
        const end = new Date(r.resign_date);
        return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    }).filter(t => t > 0);

    if (tenures.length === 0) return "N/A";
    const avg = tenures.reduce((a, b) => a + b, 0) / tenures.length;
    return `${avg.toFixed(1)} Years`;
}

function getResignationBreakdown(records: any[]) {
    const reasons = Array.from(new Set(records.map(r => r.resignation_reason || "Other")));
    return reasons.map(reason => {
        const filtered = records.filter(r => (r.resignation_reason || "Other") === reason);
        const getTenure = (r: any) => {
            if (!r.hire_date || !r.resign_date) return 0;
            return (new Date(r.resign_date).getTime() - new Date(r.hire_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        };

        return {
            reason,
            lessThan1: filtered.filter(r => getTenure(r) < 1).length,
            oneToTwo: filtered.filter(r => getTenure(r) >= 1 && getTenure(r) < 3).length,
            threeToFive: filtered.filter(r => getTenure(r) >= 3 && getTenure(r) < 6).length,
            sixToNine: filtered.filter(r => getTenure(r) >= 6 && getTenure(r) < 10).length,
            tenPlus: filtered.filter(r => getTenure(r) >= 10).length,
            total: filtered.length
        };
    }).sort((a, b) => b.total - a.total);
}
