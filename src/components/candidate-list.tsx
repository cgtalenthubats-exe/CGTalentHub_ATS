"use client";

import { useEffect, useState } from "react";
import { JRCandidate } from "@/types/requisition";
import { getJRCandidates } from "@/app/actions/jr-candidates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    MoreHorizontal,
    MessageSquare,
    ArrowRight,
    UserMinus,
    Copy,
    Trash2,

    Search,
    Filter,
    ChevronDown,
    Loader2,
    Building2,
    UserCircle2,
    Briefcase,
    History
} from "lucide-react";
import { getStatusMaster } from "@/app/actions/status-master";
import {
    updateCandidateStatus,
    batchUpdateCandidateStatus,
    updateJRCandidateMetadata,
    removeFromJR,
    copyCandidatesToJR
} from "@/app/actions/status-updates";
import { getJobRequisitions } from "@/app/actions/requisitions";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { AddFeedbackDialog } from "@/components/add-feedback-dialog";
import { CandidateAvatar } from "@/components/candidate-avatar";

interface CandidateListProps {
    jrId: string;
    jobTitle: string;
    bu: string;
    subBu: string;
}

import { ConfirmPlacementDialog } from "@/components/confirm-placement-dialog";

export function CandidateList({ jrId, jobTitle, bu, subBu }: CandidateListProps) {
    const [candidates, setCandidates] = useState<JRCandidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
    const [filterText, setFilterText] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("All");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [statusOptions, setStatusOptions] = useState<any[]>([]);
    const [allJRs, setAllJRs] = useState<any[]>([]);



    // Feedback Dialog State
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedbackCandidate, setFeedbackCandidate] = useState<{ id: string, name: string } | null>(null);
    const [placementCandidate, setPlacementCandidate] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [candData, masters, jrs] = await Promise.all([
                    getJRCandidates(jrId),
                    getStatusMaster(),
                    getJobRequisitions()
                ]);
                setCandidates(candData);
                setStatusOptions(masters);
                setAllJRs(jrs.filter(j => j.id !== jrId));
            } catch (error) {
                console.error("Failed to load data", error);
            }
            setLoading(false);
        }
        if (jrId) load();
        console.log("ATS System: CandidateList Loaded (Safe Version - Fix Applied) ✅");
    }, [jrId]);

    const handleStatusChange = async (jrCandId: string, newStatus: string) => {
        if (newStatus === 'Successful Placement') {
            const candidate = candidates.find(c => c.id === jrCandId);
            if (candidate) {
                setPlacementCandidate({
                    id: jrCandId,
                    name: candidate.candidate_name || "Unknown Candidate"
                });
            }
            return;
        }

        setStatusUpdating(jrCandId);
        const { success, error } = await updateCandidateStatus(jrCandId, newStatus);
        if (success) {
            // Optimistic update or just refresh
            const updated = await getJRCandidates(jrId);
            setCandidates(updated);
        } else {
            alert("Error: " + error);
        }
        setStatusUpdating(null);
    };

    const handleBatchStatusChange = async (newStatus: string) => {
        if (selectedIds.length === 0) return;
        setLoading(true);
        const { success, error } = await batchUpdateCandidateStatus(selectedIds, newStatus);
        if (success) {
            const updated = await getJRCandidates(jrId);
            setCandidates(updated);
            setSelectedIds([]);
        } else {
            alert("Batch error: " + error);
        }
        setLoading(false);
    };

    const handleMetadataUpdate = async (jrCandId: string, updates: any) => {
        const { success, error } = await updateJRCandidateMetadata(jrCandId, updates);
        if (success) {
            const updated = await getJRCandidates(jrId);
            setCandidates(updated);
        } else {
            alert("Update error: " + error);
        }
    };

    const handleRemove = async (ids: string[]) => {
        if (!confirm(`Are you sure you want to remove ${ids.length} candidate(s)?`)) return;
        setLoading(true);
        const { success, error } = await removeFromJR(ids);
        if (success) {
            const updated = await getJRCandidates(jrId);
            setCandidates(updated);
            setSelectedIds([]);
        } else {
            alert("Remove error: " + error);
        }
        setLoading(false);
    };

    const handleCopy = async (ids: string[], targetJrId: string) => {
        setLoading(true);
        const { success, error } = await copyCandidatesToJR(ids, targetJrId);
        if (success) {
            alert("Candidates copied successfully!");
        } else {
            alert("Copy error: " + error);
        }
        setLoading(false);
    };

    // Status Definitions
    const greyStatuses = ["Not fit", "Not Open", "Not Pass Interview", "Too Senior"];
    const redStatuses = ["Rejected"];

    // Default Filters
    return candidates.filter(c => {
        try {
            const filter = (filterText || "").toLowerCase();
            const matchesText =
                (c.candidate_name || "").toLowerCase().includes(filter) ||
                (c.candidate_id || "").toLowerCase().includes(filter) ||
                (c.candidate_current_position || "").toLowerCase().includes(filter) ||
                (c.candidate_current_company || "").toLowerCase().includes(filter);

            const matchesStatus = statusFilter === "All" || c.status === statusFilter;

            return matchesText && matchesStatus;
        } catch (e) {
            return false;
        }
    });

    // Custom Sorting: Active > Grey > Red
    const sortedCandidates = [...filteredCandidates].sort((a, b) => {
        const getScore = (s: string) => {
            if (redStatuses.includes(s)) return 3;
            if (greyStatuses.includes(s)) return 2;
            return 1;
        };

        const scoreA = getScore(a.status);
        const scoreB = getScore(b.status);

        if (scoreA !== scoreB) return scoreA - scoreB;

        // Secondary Sort: Rank (Asc) or Name
        return (parseInt(a.rank || "999") - parseInt(b.rank || "999"));
    });

    // Row Style Helper
    const getRowClass = (status: string, isSelected: boolean) => {
        if (redStatuses.includes(status)) return "bg-red-50/40 hover:bg-red-50/80 transition-colors border-b";
        if (greyStatuses.includes(status)) return "bg-slate-50/50 hover:bg-slate-100/80 transition-colors border-b";
        return cn(
            "border-b last:border-0 hover:bg-slate-50/80 transition-all",
            isSelected && "bg-indigo-50/30"
        );
    };

    const uniqueStatuses = Array.from(new Set(candidates.map(c => c.status)));

    // Selection Logic
    const toggleSelectAll = () => {
        if (selectedIds.length === filteredCandidates.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredCandidates.map(c => c.id));
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading candidates...</div>;
    // Keep showing table even if filtered empty, so user can clear filter

    return (
        <Card>
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                    <CardTitle className="text-lg font-semibold">Active Candidates ({filteredCandidates.length})</CardTitle>
                    {selectedIds.length > 0 && (
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md animate-in fade-in slide-in-from-left-2 shadow-sm border border-slate-200">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider pr-2 border-r border-slate-200">{selectedIds.length} Selected</span>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] font-black text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1.5 uppercase tracking-wide">
                                        <ArrowRight className="h-3 w-3" /> Status
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[180px] rounded-xl shadow-2xl border-slate-100">
                                    <DropdownMenuLabel className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-3 py-2">Batch Status Update</DropdownMenuLabel>
                                    {statusOptions.map(opt => (
                                        <DropdownMenuItem
                                            key={opt.status}
                                            className="py-2 font-bold text-xs cursor-pointer rounded-lg mx-1"
                                            onClick={() => handleBatchStatusChange(opt.status)}
                                        >
                                            {opt.status}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600" title="Copy to JR">
                                        <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-2 shadow-xl border-slate-100 rounded-xl" align="start">
                                    <div className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Copy to other JR</span>
                                        <ScrollArea className="h-[200px] pr-2">
                                            <div className="flex flex-col gap-1">
                                                {allJRs.map(j => (
                                                    <button
                                                        key={j.id}
                                                        className="text-left py-2 px-3 rounded-lg hover:bg-slate-50 text-[11px] font-bold border border-transparent hover:border-slate-100 transition-all group"
                                                        onClick={() => handleCopy(selectedIds, j.id)}
                                                    >
                                                        <div className="text-slate-800 group-hover:text-primary">{j.job_title}</div>
                                                        <div className="text-slate-400 text-[9px] uppercase tracking-tighter">{j.id} • {j.department}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                                title="Delete"
                                onClick={() => handleRemove(selectedIds)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </div>
                <div className="flex gap-2.5">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                            className="h-9 w-[220px] rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs shadow-sm transition-all placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50"
                            placeholder="Find by name, ID, or company..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <select
                            className="h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="All">All Statuses</option>
                            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <th className="px-4 py-3.5 w-[40px]">
                                <Checkbox
                                    checked={filteredCandidates.length > 0 && selectedIds.length === filteredCandidates.length}
                                    onCheckedChange={toggleSelectAll}
                                    className="border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                            </th>
                            <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-4 py-3.5 w-[70px]">Rank</th>
                            <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-4 py-3.5 w-[120px]">Type</th>
                            <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-4 py-3.5 w-[160px]">Status</th>
                            <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-4 py-3.5 w-[65px]">P</th>
                            <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-4 py-3.5 w-[100px]">ID</th>
                            <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-4 py-3.5 w-[240px]">Candidate Details</th>
                            <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-4 py-3.5 w-[100px]">Sex/Age</th>
                            <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-4 py-3.5">Experience & Talent Metadata</th>
                            <th className="text-right font-black text-slate-500 text-[10px] uppercase tracking-widest px-4 py-3.5 w-[80px]">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedCandidates.map((c) => {
                            const isSelected = selectedIds.includes(c.id);
                            const isUpdating = statusUpdating === c.id;
                            const isTopProfile = c.list_type === "Top profile";

                            return (
                                <tr key={c.id} className={getRowClass(c.status, isSelected)}>
                                    <td className="px-4 py-4">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleSelect(c.id)}
                                            className="border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button className={cn(
                                                    "font-black text-xs h-7 w-7 flex items-center justify-center rounded-md border transition-all hover:scale-110",
                                                    isTopProfile ? "bg-amber-50 text-amber-600 border-amber-200 shadow-sm" : "bg-white text-slate-400 border-slate-100 hover:border-primary/30"
                                                )}>
                                                    {c.rank || (isTopProfile ? "?" : "-")}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-40 p-2" align="start">
                                                <div className="flex flex-col gap-2">
                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Set Rank</span>
                                                    <div className="flex gap-1">
                                                        <input
                                                            type="number"
                                                            placeholder="0-99"
                                                            className="h-8 w-16 text-xs border rounded px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                                                            defaultValue={c.rank || ""}
                                                            onKeyDown={(e: any) => {
                                                                if (e.key === 'Enter') {
                                                                    handleMetadataUpdate(c.id, { rank: e.target.value || null });
                                                                }
                                                            }}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            className="h-8 px-2 text-[10px] font-bold"
                                                            onClick={(e: any) => {
                                                                const input = e.currentTarget.previousSibling;
                                                                handleMetadataUpdate(c.id, { rank: input.value || null });
                                                            }}
                                                        >
                                                            Set
                                                        </Button>
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </td>
                                    <td className="px-4 py-4">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="flex items-center">
                                                    {isTopProfile ? (
                                                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none font-black text-[10px] px-2 py-0.5 rounded-lg shadow-sm transition-all">
                                                            ★ TOP PROFILE
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="border-slate-200 text-slate-500 hover:bg-slate-50 font-bold text-[10px] px-2 py-0.5 rounded-lg transition-all">
                                                            {c.list_type || "Longlist"}
                                                        </Badge>
                                                    )}
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-32 p-1">
                                                <DropdownMenuItem
                                                    className="text-[10px] font-black uppercase rounded-lg cursor-pointer"
                                                    onClick={() => handleMetadataUpdate(c.id, { list_type: 'Top profile' })}
                                                >
                                                    Top profile
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-[10px] font-black uppercase rounded-lg cursor-pointer"
                                                    onClick={() => handleMetadataUpdate(c.id, { list_type: 'Longlist' })}
                                                >
                                                    Longlist
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="relative group/status flex items-center gap-2">
                                            {isUpdating ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            ) : (
                                                <select
                                                    className={cn(
                                                        "text-[11px] font-black h-8 pl-3 pr-8 rounded-xl border appearance-none focus:outline-none transition-all cursor-pointer w-full bg-white max-w-[140px]",
                                                        getRowStatusClass(c.status)
                                                    )}
                                                    value={c.status}
                                                    onChange={(e) => handleStatusChange(c.id, e.target.value)}
                                                >
                                                    {statusOptions.length > 0 ? (
                                                        statusOptions.map(opt => (
                                                            <option key={opt.status} value={opt.status} className="bg-white text-slate-800 font-bold py-1">
                                                                {opt.status}
                                                            </option>
                                                        ))
                                                    ) : (
                                                        <option>{c.status}</option>
                                                    )}
                                                </select>
                                            )}
                                            {!isUpdating && <ChevronDown className="absolute right-3 h-3 w-3 text-current pointer-events-none opacity-50" />}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <CandidateAvatar
                                            src={c.candidate_image_url}
                                            name={c.candidate_name}
                                            className="h-14 w-14 ring-4 ring-white shadow-lg transition-transform hover:scale-105 border-2 border-slate-100"
                                            fallbackClassName="text-lg"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <Link href={`/candidates/${c.candidate_id}`}>
                                            <span className="font-mono text-[13px] font-black py-1 px-2.5 bg-indigo-50 rounded-lg text-indigo-700 border border-indigo-100 shadow-sm hover:bg-indigo-100 transition-colors cursor-pointer">
                                                {c.candidate_id}
                                            </span>
                                        </Link>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-lg text-slate-900 hover:text-primary cursor-pointer transition-colors leading-none tracking-tight">
                                                {c.candidate_name}
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-400 mt-0.5 truncate max-w-[200px]">
                                                {c.candidate_email || "No email recorded"}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2 font-black text-[12px] text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                            {(c.candidate_gender || "-")}
                                            {c.candidate_age || "-"}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 text-[11px] font-black text-slate-700">
                                                <Briefcase className="h-3 w-3 text-primary/60" />
                                                <span className="truncate max-w-[200px]" title={c.candidate_current_position}>
                                                    {c.candidate_current_position || "Unspecified Role"}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                                <Building2 className="h-3 w-3 text-slate-300" />
                                                <span className="truncate max-w-[200px]" title={c.candidate_current_company}>
                                                    {c.candidate_current_company || "N/A"}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100 hover:text-primary transition-all">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-[200px] rounded-xl shadow-2xl border-slate-100">
                                                <DropdownMenuLabel className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-3 py-2">Quick Actions</DropdownMenuLabel>

                                                <Link href={`/requisitions/manage/candidate/${c.id}`}>
                                                    <DropdownMenuItem className="py-2.5 font-bold text-xs cursor-pointer rounded-lg mx-1 group">
                                                        <History className="mr-2 h-4 w-4 text-indigo-500 group-hover:scale-110 transition-transform" /> Full Activity & Logs
                                                    </DropdownMenuItem>
                                                </Link>

                                                <Link href={`/candidates/${c.candidate_id}`}>
                                                    <DropdownMenuItem className="py-2.5 font-bold text-xs cursor-pointer rounded-lg mx-1 group">
                                                        <UserCircle2 className="mr-2 h-4 w-4 text-slate-400 group-hover:text-primary" /> View Global Profile
                                                    </DropdownMenuItem>
                                                </Link>
                                                <DropdownMenuItem
                                                    className="py-2.5 font-bold text-xs cursor-pointer rounded-lg mx-1"
                                                    onClick={() => {
                                                        setFeedbackCandidate({ id: c.id, name: c.candidate_name || "Unknown" });
                                                        setIsFeedbackOpen(true);
                                                    }}
                                                >
                                                    <MessageSquare className="mr-2 h-4 w-4 text-primary" /> Add Feedback
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="py-2.5 font-bold text-xs cursor-pointer rounded-lg mx-1">
                                                    <ArrowRight className="mr-2 h-4 w-4 text-primary" /> Move Stage
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-slate-50" />
                                                <DropdownMenuItem
                                                    className="py-2.5 font-bold text-xs cursor-pointer text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg mx-1"
                                                    onClick={() => handleRemove([c.id])}
                                                >
                                                    <UserMinus className="mr-2 h-4 w-4" /> Remove from JR
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </CardContent>

            {feedbackCandidate && (
                <AddFeedbackDialog
                    open={isFeedbackOpen}
                    onOpenChange={setIsFeedbackOpen}
                    jrCandidateId={feedbackCandidate.id}
                    candidateName={feedbackCandidate.name}
                    onSuccess={() => {
                        // Optionally refresh list or analytics? 
                        // Feedback doesn't change list status usually, but maybe good to know
                    }}
                />
            )}
            {placementCandidate && (
                <ConfirmPlacementDialog
                    open={!!placementCandidate}
                    onOpenChange={(open) => !open && setPlacementCandidate(null)}
                    jrCandidateId={placementCandidate.id}
                    candidateName={placementCandidate.name}
                    position={jobTitle}
                    bu={bu}
                    subBu={subBu}
                    onSuccess={async () => {
                        // Refresh data
                        const updated = await getJRCandidates(jrId);
                        setCandidates(updated);
                        setPlacementCandidate(null);
                    }}
                />
            )}
        </Card>
    );
}

// Helper for safe string comparison
const safeLower = (s: any) => (typeof s === 'string' ? s : String(s || "")).toLowerCase();

function getRowStatusClass(status: string) {
    const s = safeLower(status);
    if (s.includes('pool')) return 'bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300';
    if (s.includes('screen')) return 'bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-200';
    if (s.includes('interview')) return 'bg-purple-50 text-purple-600 border-purple-100 hover:border-purple-200';
    if (s.includes('offer')) return 'bg-amber-50 text-amber-600 border-amber-100 hover:border-amber-200';
    if (s.includes('hired')) return 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-200';
    if (s.includes('reject') || s.includes('not fit')) return 'bg-rose-50 text-rose-600 border-rose-100 hover:border-rose-200';
    return 'bg-slate-50 text-slate-500 border-slate-100';
}
