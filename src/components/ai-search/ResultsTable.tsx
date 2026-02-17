"use client";

import React from "react";
import { ConsolidatedResult } from "./types";
import { Badge } from "@/components/ui/badge";
import {
    Building2,
    Star,
    ChevronRight,
    Briefcase,
    Globe,
    Database,
    Linkedin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    results: ConsolidatedResult[];
    onSelectResult: (result: ConsolidatedResult) => void;
    activeResultId?: string | null;
    disableScroll?: boolean;
    selectedIds?: string[];
    onToggleSelect?: (id: string) => void;
    onToggleSelectAll?: (ids: string[]) => void;
    onBulkAddToJR?: (ids: string[]) => void;
}

export function ResultsTable({
    results,
    onSelectResult,
    activeResultId,
    disableScroll = false,
    selectedIds = [],
    onToggleSelect,
    onToggleSelectAll,
    onBulkAddToJR
}: Props) {
    if (!results || results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 gap-4">
                <SearchIllustration />
                <p className="text-sm font-medium">No results found. Try running a new search.</p>
            </div>
        );
    }

    const Container = disableScroll ? 'div' : ScrollArea;
    const containerClasses = disableScroll ? 'pr-1' : 'flex-1 pr-1';

    return (
        <div className={cn("flex flex-col bg-slate-50/50 p-1 relative", !disableScroll && "h-full")}>
            <Container className={containerClasses}>
                {/* Header with Select All */}
                {results.length > 0 && onToggleSelectAll && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-white/50 border-b border-slate-200/50 sticky top-0 z-20 backdrop-blur-sm">
                        <Checkbox
                            checked={selectedIds.length === results.length && results.length > 0}
                            onCheckedChange={() => onToggleSelectAll(results.map(r => r.id))}
                            className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Select All Candidates ({results.length})
                        </span>
                    </div>
                )}
                <div className="grid gap-3 p-2">
                    <AnimatePresence mode="popLayout">
                        {results.map((result, index) => (
                            <motion.div
                                key={result.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                layout
                            >
                                <div
                                    onClick={() => onSelectResult(result)}
                                    className={cn(
                                        "group relative bg-white border rounded-xl p-4 cursor-pointer transition-all duration-300",
                                        "hover:shadow-lg hover:shadow-indigo-500/5 hover:border-indigo-200",
                                        activeResultId === result.id
                                            ? "border-indigo-500 shadow-md ring-1 ring-indigo-500/20"
                                            : "border-slate-200",
                                        selectedIds.includes(result.id) && "bg-indigo-50/30 border-indigo-200"
                                    )}
                                >
                                    {/* Checkbox Overlay */}
                                    {onToggleSelect && (
                                        <div
                                            className="absolute top-4 left-4 z-10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleSelect(result.id);
                                            }}
                                        >
                                            <Checkbox
                                                checked={selectedIds.includes(result.id)}
                                                className="h-5 w-5 border-slate-200 bg-white shadow-sm data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                            />
                                        </div>
                                    )}

                                    <div className={cn("flex items-start gap-4", onToggleSelect && "pl-8")}>
                                        {/* Candidate Photo */}
                                        <div className="flex-shrink-0">
                                            <div className="w-14 h-14 rounded-full border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center">
                                                {result.photo_url ? (
                                                    <img src={result.photo_url} alt={result.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-xl font-bold text-slate-400">
                                                        {result.name?.charAt(0)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Score Visual */}
                                        <div className="relative flex-shrink-0">
                                            <svg className="w-14 h-14 transform -rotate-90">
                                                <circle
                                                    cx="28"
                                                    cy="28"
                                                    r="24"
                                                    fill="transparent"
                                                    stroke="currentColor"
                                                    strokeWidth="3"
                                                    className="text-slate-100"
                                                />
                                                <motion.circle
                                                    cx="28"
                                                    cy="28"
                                                    r="24"
                                                    fill="transparent"
                                                    stroke="currentColor"
                                                    strokeWidth="3"
                                                    strokeDasharray={150.8}
                                                    initial={{ strokeDashoffset: 150.8 }}
                                                    animate={{ strokeDashoffset: 150.8 - (150.8 * (result.final_total_score || result.match_score || 0)) / 100 }}
                                                    transition={{ duration: 1, ease: "easeOut" }}
                                                    className={cn(
                                                        (result.final_total_score || result.match_score || 0) >= 80 ? "text-emerald-500" :
                                                            (result.final_total_score || result.match_score || 0) >= 50 ? "text-amber-500" :
                                                                "text-indigo-400"
                                                    )}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-sm font-bold text-slate-700">{result.final_total_score || result.match_score || 0}</span>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <div>
                                                    <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                                        {result.name}
                                                    </h3>
                                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mt-0.5">
                                                        <span className="truncate">{result.position}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                        <span className="flex items-center gap-1 truncate">
                                                            <Building2 className="w-3 h-3" />
                                                            {result.company}
                                                        </span>
                                                    </div>
                                                </div>

                                                <Badge variant="outline" className={cn(
                                                    "text-[10px] uppercase font-bold border-none h-5 px-2 flex items-center gap-1",
                                                    result.source === 'internal_db' ? "bg-indigo-50 text-indigo-700" :
                                                        result.source === 'external_db' ? "bg-emerald-50 text-emerald-700" :
                                                            "bg-blue-50 text-blue-700"
                                                )}>
                                                    {getSourceIcon(result.source)}
                                                    {result.source.replace('_db', '')}
                                                </Badge>
                                            </div>

                                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-2 italic px-2 border-l-2 border-slate-100">
                                                {result.executive_summary || "No executive summary available."}
                                            </p>

                                            <div className="flex flex-wrap gap-1.5 mt-3">
                                                {result.company_tier && (
                                                    <Badge className="text-[9px] h-4 bg-slate-900 hover:bg-slate-900 text-white border-none py-0">
                                                        {result.company_tier}
                                                    </Badge>
                                                )}
                                                {result.demographic_tag && (
                                                    <Badge variant="secondary" className="text-[9px] h-4 text-slate-600 bg-slate-100 border-none py-0">
                                                        {result.demographic_tag}
                                                    </Badge>
                                                )}
                                                {result.business_model && (
                                                    <Badge variant="outline" className="text-[9px] h-4 text-slate-500 border-slate-200 py-0">
                                                        {result.business_model}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center self-stretch">
                                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </Container >
            <div className="bg-white/50 backdrop-blur-sm border-t p-2.5 text-[10px] font-medium text-center text-slate-400 flex items-center justify-center gap-2">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                Found {results.length} qualified candidates for this search
            </div>

            {/* Selection Toolbar */}
            <AnimatePresence>
                {selectedIds.length > 0 && onBulkAddToJR && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/10 ring-1 ring-black/50"
                    >
                        <div className="flex flex-col">
                            <span className="text-xs font-bold">{selectedIds.length} Candidates Selected</span>
                            <span className="text-[10px] text-slate-400 font-medium">Bulk Action</span>
                        </div>
                        <div className="w-px h-8 bg-white/10 mx-2" />
                        <Button
                            onClick={() => onBulkAddToJR(selectedIds)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-6 font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" /> Add to Job Requisition
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}

function getSourceIcon(source: string) {
    if (source === 'internal_db') return <Database className="w-2.5 h-2.5" />;
    if (source === 'linkedin_db') return <Linkedin className="w-2.5 h-2.5" />;
    return <Globe className="w-2.5 h-2.5" />;
}

function SearchIllustration() {
    return (
        <svg
            className="w-16 h-16 text-slate-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
    )
}
