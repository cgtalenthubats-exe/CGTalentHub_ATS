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
import { Pencil } from "lucide-react";
import { EditResignationDialog } from "@/components/edit-resignation-dialog";

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

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-xl shadow-slate-200/50 bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-[2rem] overflow-hidden">
                    <CardContent className="p-8 flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Total Resignations</p>
                            <h3 className="text-4xl font-black">{records.length}</h3>
                        </div>
                        <History className="w-16 h-16 text-white/10 -rotate-12" />
                    </CardContent>
                </Card>
                <div className="hidden md:block col-span-2 bg-[#f8fafc] rounded-[2rem] border-2 border-dashed border-slate-200" />
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
                                    <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest py-6">Notes</TableHead>
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
                                                        <Briefcase className="w-3 h-3" /> {r.position} ({r.jr_id})
                                                    </span>
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
                                            <div className="max-w-[150px]">
                                                <Badge variant="outline" className="border-slate-200 text-slate-600 font-bold text-[10px] uppercase py-0.5">
                                                    {r.resignation_reason_test || 'Unspecified'}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col max-w-[150px]">
                                                <span className="font-bold text-slate-700 text-sm truncate">{r.company_destination || 'N/A'}</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate">{r.new_position}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-start gap-2 max-w-[200px]">
                                                <ScrollText className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
                                                <p className="text-xs text-slate-500 font-medium line-clamp-2">
                                                    {r.resign_note || 'No notes added'}
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
