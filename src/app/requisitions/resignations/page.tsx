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
import { Pencil, PieChart, BarChart3, TrendingUp, Users } from "lucide-react";
import { EditResignationDialog } from "@/components/edit-resignation-dialog";

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

    const router = useRouter();

    const loadRecords = async () => {
        setLoading(true);
        const data = await getEmploymentRecords('Resigned');
        setRecords(data);
        setLoading(false);
    };

    useEffect(() => {
        loadRecords();
    }, []);

    const filteredRecords = records.filter(r =>
        r.candidate_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.position?.toLowerCase().includes(search.toLowerCase()) ||
        r.jr_id?.toLowerCase().includes(search.toLowerCase())
    );

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

            {/* Stats Summary & Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="border-none shadow-xl shadow-slate-200/50 bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-[2rem] overflow-hidden md:col-span-1">
                    <CardContent className="p-8 flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Total Resignations</p>
                            <h3 className="text-4xl font-black">{records.length}</h3>
                        </div>
                        <History className="w-16 h-16 text-white/10 -rotate-12" />
                    </CardContent>
                </Card>

                <Card className="md:col-span-3 border-none shadow-xl shadow-slate-200/50 bg-white rounded-[2rem] p-6">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <div className="flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-indigo-500" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Resignation Insights</h3>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-1.5">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                                <span className="text-xs font-bold text-slate-500">Tracking: {records.filter(r => r.tracking_status === 'manual' || r.tracking_status === 'auto').length} Found</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Placeholder for real charts if needed, but for now summary text/metrics */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                            <div className="p-3 bg-red-100 rounded-xl">
                                <BarChart3 className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">Top Reason</p>
                                <p className="text-sm font-bold text-slate-700 truncate max-w-[120px]">
                                    {getTopReason(records)}
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                            <div className="p-3 bg-indigo-100 rounded-xl">
                                <Users className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">Avg. Tenure</p>
                                <p className="text-sm font-bold text-slate-700">{getAvgTenure(records)}</p>
                            </div>
                        </div>

                        <div className="hidden lg:flex bg-indigo-600 p-4 rounded-2xl border border-indigo-700 items-center justify-center text-center">
                            <p className="text-white text-xs font-bold leading-tight">View Full Analytics Report →</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
                        {/* Breakdown Table (Reason vs YoS) */}
                        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Reason vs Year of Service</h4>
                            <div className="overflow-x-auto">
                                <Table className="text-[10px]">
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-slate-100 italic">
                                            <TableHead className="h-8 py-0 font-bold">Reason</TableHead>
                                            <TableHead className="h-8 py-0 font-bold text-center">{'<1y'}</TableHead>
                                            <TableHead className="h-8 py-0 font-bold text-center">1-2y</TableHead>
                                            <TableHead className="h-8 py-0 font-bold text-center">3-5y</TableHead>
                                            <TableHead className="h-8 py-0 font-bold text-center">6-9y</TableHead>
                                            <TableHead className="h-8 py-0 font-bold text-center">10y+</TableHead>
                                            <TableHead className="h-8 py-0 font-bold text-center text-indigo-600">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {getResignationBreakdown(records).map((row: any, idx: number) => (
                                            <TableRow key={idx} className="hover:bg-transparent border-slate-50">
                                                <TableCell className="py-1.5 font-bold text-slate-700">{row.reason}</TableCell>
                                                <TableCell className="py-1.5 text-center text-slate-500">{row.lessThan1}</TableCell>
                                                <TableCell className="py-1.5 text-center text-slate-500">{row.oneToTwo}</TableCell>
                                                <TableCell className="py-1.5 text-center text-slate-500">{row.threeToFive}</TableCell>
                                                <TableCell className="py-1.5 text-center text-slate-500">{row.sixToNine}</TableCell>
                                                <TableCell className="py-1.5 text-center text-slate-500">{row.tenPlus}</TableCell>
                                                <TableCell className="py-1.5 text-center font-black text-indigo-600 bg-indigo-50/30 rounded-md">{row.total}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Summary metrics or chart placeholder */}
                        <div className="space-y-4 font-bold">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                                    <p className="text-[10px] text-emerald-600 uppercase tracking-widest">Retention Rate</p>
                                    <h4 className="text-2xl font-black text-emerald-700">84.2%</h4>
                                    <p className="text-[9px] text-emerald-600/70 mt-1 italic">*Past 12 months</p>
                                </div>
                                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                                    <p className="text-[10px] text-amber-600 uppercase tracking-widest">Avg. Replacement</p>
                                    <h4 className="text-2xl font-black text-amber-700">42 Days</h4>
                                    <p className="text-[9px] text-amber-600/70 mt-1 italic">*Time-to-fill</p>
                                </div>
                            </div>
                            <div className="p-5 bg-slate-900 rounded-3xl text-white relative overflow-hidden h-[120px] flex flex-col justify-end">
                                <TrendingUp className="absolute top-4 right-4 w-12 h-12 text-white/10" />
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Impact Analysis</p>
                                <p className="text-xs text-slate-300 leading-relaxed max-w-[80%] italic">
                                    "Competitor hiring is the primary driver for exits between 1-2 years of service."
                                </p>
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
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6 pl-8">Name & Position</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">Business Unit</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">Resigned Date</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">Reason</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">Destination</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">Track Status</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6 pr-8 text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={6} className="h-64 text-center text-slate-400 font-bold uppercase tracking-widest">Loading Records...</TableCell></TableRow>
                                ) : filteredRecords.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="h-64 text-center text-slate-400 font-bold uppercase tracking-widest">No resignation history found</TableCell></TableRow>
                                ) : filteredRecords.map((r) => (
                                    <TableRow key={r.employment_record_id} className="group hover:bg-slate-50/50 transition-colors border-slate-100">
                                        <TableCell className="py-6 pl-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold shadow-sm">
                                                    {r.candidate_name?.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-800 leading-none mb-1">{r.candidate_name}</span>
                                                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                                        <Briefcase className="w-3 h-3" /> {r.position}
                                                    </span>
                                                    {r.hire_date && r.resign_date && (
                                                        <span className="text-[10px] font-black text-indigo-500 uppercase mt-1">
                                                            YoS: {calculateYoS(r.hire_date, r.resign_date)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-sm">{r.bu}</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{r.sub_bu}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-red-600 font-black text-xs bg-red-50 w-fit px-3 py-1.5 rounded-lg border border-red-100">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {r.resign_date || 'N/A'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col max-w-[150px]">
                                                {r.company_destination ? (
                                                    <>
                                                        <span className="font-bold text-slate-700 text-sm truncate">{r.company_destination}</span>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate">{r.new_position || 'Position N/A'}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-slate-300 font-bold text-xs italic">Awaiting Update</span>
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
                                                {r.last_scraped_at && (
                                                    <span className="text-[9px] text-slate-400 font-medium">Scraped: {new Date(r.last_scraped_at).toLocaleDateString()}</span>
                                                )}
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
        const reason = curr.resignation_reason_test || "Unspecified";
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
    const reasons = Array.from(new Set(records.map(r => r.resignation_reason_test || "Other")));
    return reasons.map(reason => {
        const filtered = records.filter(r => (r.resignation_reason_test || "Other") === reason);
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
