"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { ConsolidatedResult } from "./types";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import {
    UserPlus,
    Plus,
    ChevronLeft,
    ChevronRight,
    Search,
    XCircle,
    Clock,
    CheckCircle2,
    Linkedin,
} from "lucide-react";

const PAGE_SIZE = 50;

interface Props {
    results: ConsolidatedResult[];
    onSelectResult: (result: ConsolidatedResult) => void;
    activeResultId?: string | null;
    disableScroll?: boolean;
    selectedIds?: string[];
    onToggleSelect?: (id: string) => void;
    onToggleSelectAll?: (ids: string[]) => void;
    onBulkAddToJR?: (ids: string[]) => void;
    onOnboard?: (id: string, name: string) => void;
    onBulkOnboard?: (ids: string[]) => void;
    onboardingIds?: string[];
    filterSource?: "all" | "internal" | "external";
    onFilterSourceChange?: (source: "all" | "internal" | "external") => void;
    onOnboardAll?: () => void;
    // which section this table is in (affects rank display)
    section?: "top" | "other" | "pending" | "failed";
}

export function ResultsTable({
    results,
    onSelectResult,
    activeResultId,
    selectedIds = [],
    onToggleSelect,
    onToggleSelectAll,
    onBulkAddToJR,
    onOnboard,
    onBulkOnboard,
    onboardingIds = [],
    filterSource = "all",
    onFilterSourceChange,
    onOnboardAll,
    section = "top",
}: Props) {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return results;
        return results.filter(
            (r) =>
                r.name?.toLowerCase().includes(q) ||
                r.position?.toLowerCase().includes(q) ||
                r.company?.toLowerCase().includes(q) ||
                r.candidate_ref_id?.toLowerCase().includes(q)
        );
    }, [results, search]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // reset page when search/filter changes
    React.useEffect(() => { setPage(1); }, [search, filterSource, results.length]);

    if (!results || results.length === 0) {
        return (
            <div className="flex items-center justify-center py-10 text-slate-400">
                <p className="text-sm">No candidates in this group.</p>
            </div>
        );
    }

    const allPageIds = paginated.map((r) => r.id);
    const allSelected = allPageIds.every((id) => selectedIds.includes(id)) && allPageIds.length > 0;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 flex-wrap">
                {/* Select all on page */}
                {onToggleSelectAll && (
                    <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => onToggleSelectAll(allPageIds)}
                        className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                    />
                )}

                {/* Search */}
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, position, company..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                </div>

                {/* Source filter */}
                {onFilterSourceChange && (
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        {(["all", "internal", "external"] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => onFilterSourceChange(s)}
                                className={cn(
                                    "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-tight",
                                    filterSource === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex-1" />

                {/* Bulk actions */}
                <AnimatePresence>
                    {selectedIds.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="flex items-center gap-2"
                        >
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                {selectedIds.length} selected
                            </span>
                            {onBulkAddToJR && (
                                <Button
                                    size="sm"
                                    onClick={() => onBulkAddToJR(selectedIds)}
                                    className="h-7 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] gap-1"
                                >
                                    <Plus className="w-3 h-3" /> Add to JR
                                </Button>
                            )}
                            {onBulkOnboard && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onBulkOnboard(selectedIds)}
                                    className="h-7 text-[10px] font-bold gap-1"
                                >
                                    <UserPlus className="w-3 h-3" /> Onboard
                                </Button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Count */}
                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                    {filtered.length} candidates
                </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/40">
                            <th className="w-10 px-4 py-2.5" />
                            <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 w-16">Rank</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 w-16">Score</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 w-12">P</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 w-28">ID</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 w-10">LI</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Candidate Details</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 w-24">Sex / Age</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 w-28">Screening</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginated.map((r, i) => {
                            const globalIndex = (page - 1) * PAGE_SIZE + i + 1;
                            const rank = r.stage3_rank ?? (section === "top" ? globalIndex : null);
                            const isActive = activeResultId === r.id;
                            const isSelected = selectedIds.includes(r.id);
                            return (
                                <tr
                                    key={r.id}
                                    onClick={() => onSelectResult(r)}
                                    className={cn(
                                        "cursor-pointer transition-colors hover:bg-indigo-50/40 group",
                                        isActive && "bg-indigo-50 border-l-2 border-l-indigo-500",
                                        isSelected && "bg-indigo-50/60",
                                        r.stage2_pass === false && "bg-red-50/30 hover:bg-red-50/50"
                                    )}
                                >
                                    {/* Checkbox */}
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                        {onToggleSelect && (
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => onToggleSelect(r.id)}
                                                className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                            />
                                        )}
                                    </td>

                                    {/* Rank */}
                                    <td className="px-3 py-3">
                                        {rank != null ? (
                                            <span className={cn(
                                                "text-[11px] font-black px-2 py-1 rounded-lg inline-block",
                                                rank === 1 ? "bg-amber-400 text-white" :
                                                rank <= 3 ? "bg-slate-800 text-white" :
                                                rank <= 10 ? "bg-indigo-100 text-indigo-700" :
                                                "bg-slate-100 text-slate-500"
                                            )}>
                                                #{rank}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-xs">—</span>
                                        )}
                                    </td>

                                    {/* Score */}
                                    <td className="px-3 py-3">
                                        {r.stage3_score != null ? (
                                            <span className={cn(
                                                "text-[11px] font-black px-2 py-1 rounded-lg inline-block",
                                                r.stage3_score >= 80 ? "bg-emerald-100 text-emerald-700" :
                                                r.stage3_score >= 60 ? "bg-amber-100 text-amber-700" :
                                                "bg-slate-100 text-slate-600"
                                            )}>
                                                {r.stage3_score}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-xs">—</span>
                                        )}
                                    </td>

                                    {/* Photo */}
                                    <td className="px-3 py-3">
                                        <div className={cn(
                                            "w-9 h-9 rounded-full border-2 overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0",
                                            rank === 1 ? "border-amber-400" : rank != null && rank <= 3 ? "border-slate-700" : "border-slate-200"
                                        )}>
                                            {r.photo_url ? (
                                                <img src={r.photo_url} alt={r.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-sm font-bold text-slate-400">{r.name?.charAt(0)}</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Candidate ID */}
                                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                                        <Link href={`/candidates/${r.candidate_ref_id}`}>
                                            <span className="font-mono text-[11px] font-black py-1 px-2 bg-indigo-50 rounded-lg text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-colors cursor-pointer inline-block whitespace-nowrap">
                                                {r.candidate_ref_id}
                                            </span>
                                        </Link>
                                    </td>

                                    {/* LinkedIn */}
                                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                                        {r.linkedin_url ? (
                                            <a href={r.linkedin_url} target="_blank" rel="noopener noreferrer">
                                                <button className="h-7 w-7 flex items-center justify-center text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all">
                                                    <Linkedin className="h-4 w-4" />
                                                </button>
                                            </a>
                                        ) : (
                                            <span className="text-slate-200">
                                                <Linkedin className="h-4 w-4" />
                                            </span>
                                        )}
                                    </td>

                                    {/* Candidate Details */}
                                    <td className="px-3 py-3 max-w-[280px]">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                                                {r.name}
                                            </p>
                                            <p className="text-xs text-slate-500 truncate mt-0.5">
                                                {r.position}{r.company ? ` · ${r.company}` : ""}
                                            </p>
                                            {(r.stage3_tradeoff || r.highlight_project) && (
                                                <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 italic">
                                                    {r.stage3_tradeoff || r.highlight_project}
                                                </p>
                                            )}
                                        </div>
                                    </td>

                                    {/* Sex / Age */}
                                    <td className="px-3 py-3">
                                        {(r.sex || r.age) ? (
                                            <span className="text-xs text-slate-600">
                                                {[r.sex, r.age].filter(Boolean).join(", ")}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-xs">—</span>
                                        )}
                                    </td>

                                    {/* Screening */}
                                    <td className="px-3 py-3">
                                        {r.stage2_pass === true ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg w-fit">
                                                <CheckCircle2 className="w-3 h-3" /> Passed
                                            </span>
                                        ) : r.stage2_pass === false ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded-lg w-fit">
                                                <XCircle className="w-3 h-3" /> Failed
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg w-fit">
                                                <Clock className="w-3 h-3" /> Pending
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/40">
                    <span className="text-[10px] text-slate-400">
                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-lg"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={cn(
                                        "h-7 w-7 rounded-lg text-[11px] font-bold transition-colors",
                                        page === p ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
                                    )}
                                >
                                    {p}
                                </button>
                            );
                        })}
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-lg"
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
