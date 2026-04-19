"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Search,
    Trash2,
    RefreshCw,
    UserCircle2,
    Briefcase,
    Building2,
    ExternalLink
} from "lucide-react";
import Link from "next/link";
import { toast } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { deleteCandidates, refreshCandidate } from "@/app/actions/report-actions";

interface ReportCandidateTableProps {
    candidates: any[];
    title: string;
    onDataChanged: () => void;
    // Optional controlled search
    search?: string;
    onSearch?: (term: string) => void;
}

export function ReportCandidateTable({ candidates, title, onDataChanged, search, onSearch }: ReportCandidateTableProps) {
    const [localFilterText, setLocalFilterText] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loadingAction, setLoadingAction] = useState(false);

    // Use controlled search if provided, else local
    const filterText = search !== undefined ? search : localFilterText;
    const handleSearchChange = (val: string) => {
        if (onSearch) onSearch(val);
        else setLocalFilterText(val);
    };

    // Filtering: If controlled (server-side), we assume 'candidates' is already filtered.
    // If local, we filter here.
    const displayCandidates = onSearch ? candidates : candidates.filter(c => {
        const text = filterText.toLowerCase();
        return (
            (c.candidate_name || "").toLowerCase().includes(text) ||
            (c.candidate_id || "").toLowerCase().includes(text) ||
            (c.candidate_email || "").toLowerCase().includes(text) ||
            (c.candidate_current_company || "").toLowerCase().includes(text)
        );
    });

    // Selection
    const toggleSelectAll = () => {
        if (selectedIds.length === displayCandidates.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(displayCandidates.map(c => c.candidate_id));
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    // Actions
    const handleDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Are you sure you want to PERMANENTLY DELETE ${selectedIds.length} candidate(s)? This cannot be undone.`)) return;

        setLoadingAction(true);
        const { success, error } = await deleteCandidates(selectedIds);
        if (success) {
            toast.success(`Deleted ${selectedIds.length} candidates`);
            setSelectedIds([]);
            onDataChanged(); // Refresh parent
        } else {
            toast.error("Delete failed: " + error);
        }
        setLoadingAction(false);
    };

    const handleRefresh = async () => {
        if (selectedIds.length === 0) return;

        // Filter candidates with LinkedIn
        const candidatesToRefresh = displayCandidates.filter(c => selectedIds.includes(c.candidate_id));
        const validCandidates = candidatesToRefresh.filter(c => c.linkedin && c.linkedin.includes('linkedin.com'));
        const invalidCount = candidatesToRefresh.length - validCandidates.length;

        if (validCandidates.length === 0) {
            toast.error("None of the selected candidates have a valid LinkedIn URL.");
            return;
        }

        if (invalidCount > 0) {
            if (!confirm(`${invalidCount} candidates do not have a LinkedIn URL and will be skipped. Continue refreshing ${validCandidates.length} candidates?`)) return;
        } else {
            if (!confirm(`Confirm refresh for ${validCandidates.length} candidates? This will re-scrape their data.`)) return;
        }

        setLoadingAction(true);
        let successCount = 0;

        for (const c of validCandidates) {
            const { success } = await refreshCandidate(c.candidate_id, c.candidate_name, c.linkedin);
            if (success) successCount++;
        }

        toast.success(`Queued ${successCount} candidates for refresh.`);
        setSelectedIds([]);
        setLoadingAction(false);
    };

    return (
        <Card>
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                    <CardTitle className="text-lg font-semibold">{title} ({displayCandidates.length})</CardTitle>
                    {selectedIds.length > 0 && (
                        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-md border border-slate-200">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider pr-2 border-r border-slate-200">
                                {selectedIds.length} Selected
                            </span>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[10px] font-black text-blue-600 hover:bg-blue-50 gap-1.5 uppercase tracking-wide"
                                onClick={handleRefresh}
                                disabled={loadingAction}
                            >
                                <RefreshCw className={`h-3 w-3 ${loadingAction ? 'animate-spin' : ''}`} /> Refresh Data
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[10px] font-black text-rose-600 hover:bg-rose-50 gap-1.5 uppercase tracking-wide"
                                onClick={handleDelete}
                                disabled={loadingAction}
                            >
                                <Trash2 className="h-3 w-3" /> Delete
                            </Button>
                        </div>
                    )}
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                        className="h-9 w-[220px] rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                        placeholder="Search..."
                        value={filterText}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-3 w-[40px]">
                                <Checkbox
                                    checked={displayCandidates.length > 0 && selectedIds.length === displayCandidates.length}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </th>
                            <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-4 py-3">ID</th>
                            <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-4 py-3">Candidate</th>
                            <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-4 py-3">Last Modified</th>
                            <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-4 py-3">LinkedIn</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayCandidates.map((c) => (
                            <tr key={c.candidate_id} className={`border-b hover:bg-slate-50 ${selectedIds.includes(c.candidate_id) ? 'bg-indigo-50/30' : ''}`}>
                                <td className="px-4 py-3">
                                    <Checkbox
                                        checked={selectedIds.includes(c.candidate_id)}
                                        onCheckedChange={() => toggleSelect(c.candidate_id)}
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <Link href={`/candidates/${c.candidate_id}`} className="font-mono text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                        {c.candidate_id}
                                    </Link>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={c.candidate_image_url} />
                                            <AvatarFallback className="text-[10px] font-bold">{c.candidate_name?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 text-xs">{c.candidate_name}</span>
                                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                <Building2 className="h-3 w-3" /> {c.candidate_current_company || "-"}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-600">
                                    {c.modify_date ? new Date(c.modify_date).toLocaleDateString() : (c.created_date ? new Date(c.created_date).toLocaleDateString() : '-')}
                                </td>
                                <td className="px-4 py-3">
                                    {c.linkedin ? (
                                        <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    ) : (
                                        <span className="text-slate-300">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {displayCandidates.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-sm">No candidates found in this category.</div>
                )}
            </CardContent>
        </Card>
    );
}
