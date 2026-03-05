"use client";

import React, { useEffect, useState } from "react";
import { getEmploymentRecords, markAsResigned } from "@/app/actions/employment";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    CheckCircle2,
    UserMinus,
    Search,
    Building2,
    Briefcase,
    BadgeDollarSign,
    Calendar,
    ArrowLeft,
    Filter
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EditPlacementDialog } from "@/components/edit-placement-dialog";
import { Pencil } from "lucide-react";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import Link from "next/link";

export default function PlacementsPage() {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [buFilter, setBuFilter] = useState("All");
    const [subBuFilter, setSubBuFilter] = useState("All");
    const [positionFilter, setPositionFilter] = useState("All");
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [isResignDialogOpen, setIsResignDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    // Resignation form state
    const [resignData, setResignData] = useState({
        resign_date: new Date().toISOString().split('T')[0],
        resign_note: "",
        resignation_reason: ""
    });

    const router = useRouter();

    const loadRecords = async () => {
        setLoading(true);
        const data = await getEmploymentRecords('Active');
        setRecords(data);
        setLoading(false);
    };

    useEffect(() => {
        loadRecords();
    }, []);

    const handleResign = async () => {
        if (!selectedRecord) return;
        const res = await markAsResigned(selectedRecord.employment_record_id, resignData);
        if (res.success) {
            setIsResignDialogOpen(false);
            setSelectedRecord(null);
            setResignData({
                resign_date: new Date().toISOString().split('T')[0],
                resign_note: "",
                resignation_reason: ""
            });
            loadRecords();
        } else {
            alert("Error: " + res.error);
        }
    };

    const filteredRecords = records.filter(r => {
        const matchesSearch = r.candidate_name?.toLowerCase().includes(search.toLowerCase()) ||
            r.position?.toLowerCase().includes(search.toLowerCase()) ||
            r.jr_id?.toLowerCase().includes(search.toLowerCase()) ||
            r.bu?.toLowerCase().includes(search.toLowerCase());

        const matchesBU = buFilter === "All" || r.bu === buFilter;
        const matchesSubBU = subBuFilter === "All" || r.sub_bu === subBuFilter;
        const matchesPosition = positionFilter === "All" || r.position === positionFilter;

        return matchesSearch && matchesBU && matchesSubBU && matchesPosition;
    });

    const uniqueBUs = Array.from(new Set(records.map(r => r.bu).filter(Boolean)));
    const uniqueSubBUs = Array.from(new Set(records.map(r => r.sub_bu).filter(Boolean)));
    const uniquePositions = Array.from(new Set(records.map(r => r.position).filter(Boolean)));

    const isFiltered = search !== "" || buFilter !== "All" || subBuFilter !== "All" || positionFilter !== "All";

    return (
        <div className="mx-auto p-6 space-y-8 max-w-[95%] animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <AtsBreadcrumb
                        items={[
                            { label: 'Job Requisition Menu', href: '/requisitions' },
                            { label: 'Successful Placement Table' }
                        ]}
                    />
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-xl">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        Successful Placement Table
                    </h1>
                    <p className="text-slate-500 font-medium">Manage active employees and track successful recruitment placements.</p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Search name, position, JR ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-10 bg-white border-slate-200 rounded-xl shadow-sm focus:ring-primary/20 transition-all font-medium text-xs"
                        />
                    </div>
                </div>
            </div>

            {/* Filters Area */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 items-center">
                <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest mr-2">
                    <Filter className="w-4 h-4" /> Filters
                </div>
                <select
                    value={buFilter}
                    onChange={(e) => setBuFilter(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-primary/20 min-w-[140px]"
                >
                    <option value="All">All Business Units</option>
                    {uniqueBUs.map(bu => <option key={String(bu)} value={String(bu)}>{String(bu)}</option>)}
                </select>
                <select
                    value={subBuFilter}
                    onChange={(e) => setSubBuFilter(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-primary/20 min-w-[140px]"
                >
                    <option value="All">All Sub BUs / Depts</option>
                    {uniqueSubBUs.map(sub => <option key={String(sub)} value={String(sub)}>{String(sub)}</option>)}
                </select>
                <select
                    value={positionFilter}
                    onChange={(e) => setPositionFilter(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-primary/20 min-w-[140px]"
                >
                    <option value="All">All Positions</option>
                    {uniquePositions.map(pos => <option key={String(pos)} value={String(pos)}>{String(pos)}</option>)}
                </select>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-xl shadow-slate-200/50 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-[2rem] overflow-hidden">
                    <CardContent className="p-8 flex items-center justify-between">
                        <div>
                            <p className="text-green-100 text-xs font-black uppercase tracking-widest mb-1">
                                {isFiltered ? "Filtered Placements" : "Total Placements"}
                            </p>
                            <h3 className="text-4xl font-black">
                                {isFiltered ? `${filteredRecords.length} / ${records.length}` : records.length}
                            </h3>
                        </div>
                        <CheckCircle2 className="w-16 h-16 text-white/20 -rotate-12" />
                    </CardContent>
                </Card>
                {/* Visual Placeholder for design balance */}
                <div className="hidden md:block col-span-2 bg-[#f8fafc] rounded-[2rem] border-2 border-dashed border-slate-200" />
            </div>

            {/* Table Area */}
            <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="hover:bg-transparent border-slate-100">
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6 pl-8">JR ID & Position</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">Candidate Name</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">DOB | Age</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">Business Unit</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">Salary Info</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">Fee (20%)</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">Job Grade</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">Emp. ID</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">Hire Date</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">Status</TableHead>
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6 pr-8 text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={7} className="h-64 text-center text-slate-400 font-bold uppercase tracking-widest">Loading Records...</TableCell></TableRow>
                                ) : filteredRecords.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="h-64 text-center text-slate-400 font-bold uppercase tracking-widest">No active placements found</TableCell></TableRow>
                                ) : filteredRecords.map((r) => (
                                    <TableRow key={r.employment_record_id} className="group hover:bg-slate-50/50 transition-colors border-slate-100">
                                        <TableCell className="py-5 pl-8">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-primary mb-0.5">{r.jr_id}</span>
                                                <span className="font-bold text-slate-700">{r.position}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs ring-2 ring-white shadow-sm flex-shrink-0">
                                                    {r.candidate_name?.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800">{r.candidate_name}</span>
                                                    {r.candidate_id && (
                                                        <Link href={`/candidates/${r.candidate_id}`} target="_blank" rel="noopener noreferrer" className="text-xs font-mono font-bold text-black hover:text-black hover:underline">
                                                            {r.candidate_id}
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-700">
                                                    {r.date_of_birth ? new Date(r.date_of_birth).toLocaleDateString('en-GB') : '-'}
                                                </span>
                                                <span className="text-xs font-bold text-black">
                                                    {r.date_of_birth ? `${new Date().getFullYear() - new Date(r.date_of_birth).getFullYear()} yrs` : ''}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-slate-600 font-medium">
                                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                {r.bu} <span className="text-slate-300">/</span> {r.sub_bu}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                                    <BadgeDollarSign className="w-3 h-3" /> Base: ฿{r.base_salary?.toLocaleString()}
                                                </span>
                                                <span className="font-bold text-slate-800 text-[10px]">Annual: ฿{r.annual_salary?.toLocaleString()}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-bold text-slate-700">฿{r.outsource_fee_20_percent?.toLocaleString()}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-bold text-slate-700">{r.job_grade || "-"}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{r.employee_id || "-"}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-slate-600 font-bold text-xs">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                {r.hire_date}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none px-3 py-1 rounded-lg font-bold text-[10px] uppercase">
                                                Active
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="pr-8 text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedRecord(r);
                                                    setIsResignDialogOpen(true);
                                                }}
                                                className="border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 rounded-xl font-bold text-[11px] uppercase transition-all"
                                            >
                                                <UserMinus className="w-3.5 h-3.5 mr-2" /> Mark Resigned
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => {
                                                    setSelectedRecord(r);
                                                    setIsEditDialogOpen(true);
                                                }}
                                                className="ml-2 border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 rounded-xl transition-all"
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

            {/* Resignation Dialog */}
            <Dialog open={isResignDialogOpen} onOpenChange={setIsResignDialogOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-slate-900">Confirm Resignation</DialogTitle>
                        <DialogDescription className="font-medium text-slate-500">
                            You are marking <b>{selectedRecord?.candidate_name}</b> as resigned. This action will move the record to the Resignation Table.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Resignation Date</Label>
                            <Input
                                type="date"
                                value={resignData.resign_date}
                                onChange={(e) => setResignData({ ...resignData, resign_date: e.target.value })}
                                className="h-11 rounded-xl bg-slate-50 border-slate-200 transition-all focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Resignation Reason</Label>
                            <Input
                                placeholder="e.g. Career Growth, Personal Reason"
                                value={resignData.resignation_reason}
                                onChange={(e) => setResignData({ ...resignData, resignation_reason: e.target.value })}
                                className="h-11 rounded-xl bg-slate-50 border-slate-200 transition-all focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Note</Label>
                            <Textarea
                                placeholder="Additional details..."
                                value={resignData.resign_note}
                                onChange={(e) => setResignData({ ...resignData, resign_note: e.target.value })}
                                className="min-h-[100px] rounded-xl bg-slate-50 border-slate-200 transition-all focus:ring-primary/20"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setIsResignDialogOpen(false)} className="rounded-xl font-bold uppercase text-[11px] tracking-widest">Cancel</Button>
                        <Button onClick={handleResign} className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase text-[11px] tracking-widest px-8 shadow-lg shadow-red-500/20">Confirm Resignation</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <EditPlacementDialog
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
