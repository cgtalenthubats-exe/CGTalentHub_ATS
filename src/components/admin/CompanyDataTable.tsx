"use client";

import React, { useState } from "react";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { 
    ChevronLeft, 
    ChevronRight, 
    Edit, 
    MoreVertical, 
    Trash2, 
    Building2,
    RefreshCw,
    CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import CompanyDetailDialog from "./CompanyDetailDialog";
import BulkEditDialog from "./BulkEditDialog";

interface Company {
    company_id: number;
    company_master: string;
    industry: string;
    group: string;
}

interface CompanyDataTableProps {
    data: Company[];
    isLoading: boolean;
    total: number;
    page: number;
    pageSize: number;
    setPage: (page: number) => void;
    onRefresh: () => void;
}

export default function CompanyDataTable({
    data,
    isLoading,
    total,
    page,
    pageSize,
    setPage,
    onRefresh
}: CompanyDataTableProps) {
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === data.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(data.map(c => c.company_id));
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="flex flex-col h-full relative">
            <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                        <TableHead className="w-[50px]">
                            <Checkbox 
                                checked={selectedIds.length > 0 && selectedIds.length === data.length} 
                                onCheckedChange={toggleSelectAll}
                            />
                        </TableHead>
                        <TableHead className="w-[400px]">Company Name</TableHead>
                        <TableHead>Industry</TableHead>
                        <TableHead>Group</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><div className="h-4 w-4 bg-slate-100 animate-pulse rounded" /></TableCell>
                                <TableCell><div className="h-4 w-[250px] bg-slate-100 animate-pulse rounded" /></TableCell>
                                <TableCell><div className="h-4 w-[150px] bg-slate-100 animate-pulse rounded" /></TableCell>
                                <TableCell><div className="h-4 w-[150px] bg-slate-100 animate-pulse rounded" /></TableCell>
                                <TableCell />
                            </TableRow>
                        ))
                    ) : data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-[400px] text-center">
                                <Building2 className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-500 font-medium">No companies found in this selection.</p>
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((company) => (
                            <TableRow 
                                key={company.company_id} 
                                className={cn(
                                    "group transition-colors",
                                    selectedIds.includes(company.company_id) ? "bg-indigo-50/30" : "hover:bg-slate-50/50"
                                )}
                            >
                                <TableCell>
                                    <Checkbox 
                                        checked={selectedIds.includes(company.company_id)} 
                                        onCheckedChange={() => toggleSelect(company.company_id)}
                                    />
                                </TableCell>
                                <TableCell className="font-bold text-slate-800">
                                    {company.company_master}
                                </TableCell>
                                <TableCell className="text-slate-500 text-sm">{company.industry}</TableCell>
                                <TableCell className="text-slate-500 text-sm whitespace-nowrap">{company.group}</TableCell>
                                <TableCell className="text-right">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                        onClick={() => setEditingCompany(company)}
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {/* Sticky Footer / Pagination */}
            <div className="mt-auto p-4 border-t flex items-center justify-between bg-white z-20">
                <div className="text-sm text-slate-500">
                    Showing <span className="font-bold text-slate-900">{data.length}</span> of <span className="font-bold text-slate-900">{total}</span> companies
                </div>
                
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={page === 0 || isLoading}
                        onClick={() => setPage(page - 1)}
                        className="gap-2"
                    >
                        <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <div className="flex items-center gap-1 px-4">
                        <span className="text-sm font-medium">Page {page + 1} of {totalPages || 1}</span>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={page >= totalPages - 1 || isLoading}
                        onClick={() => setPage(page + 1)}
                        className="gap-2"
                    >
                        Next <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Floating Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-300 z-50 border border-slate-700">
                    <div className="flex items-center gap-3 border-r border-slate-700 pr-6">
                        <div className="bg-indigo-500 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold">
                            {selectedIds.length}
                        </div>
                        <span className="text-sm font-semibold tracking-wide">COMPANIES SELECTED</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white border-none h-9 px-4 rounded-full font-bold"
                            onClick={() => setIsBulkEditOpen(true)}
                        >
                            Bulk Edit Classification
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-slate-400 hover:text-white"
                            onClick={() => setSelectedIds([])}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {/* Dialogs */}
            {editingCompany && (
                <CompanyDetailDialog 
                    company={editingCompany} 
                    onClose={() => setEditingCompany(null)}
                    onSuccess={onRefresh}
                />
            )}
            {isBulkEditOpen && (
                <BulkEditDialog 
                    ids={selectedIds}
                    onClose={() => {
                        setIsBulkEditOpen(false);
                        setSelectedIds([]);
                    }}
                    onSuccess={onRefresh}
                />
            )}
        </div>
    );
}
