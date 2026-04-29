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
    Linkedin,
    UserPlus,
    CheckCircle,
    XCircle
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
    onOnboard?: (id: string, name: string) => void;
    onBulkOnboard?: (ids: string[]) => void;
    onboardingIds?: string[]; // IDs currently being processed
    filterSource?: 'all' | 'internal' | 'external';
    onFilterSourceChange?: (source: 'all' | 'internal' | 'external') => void;
    onOnboardAll?: () => void;
}

export function ResultsTable({
    results,
    onSelectResult,
    activeResultId,
    disableScroll = false,
    selectedIds = [],
    onToggleSelect,
    onToggleSelectAll,
    onBulkAddToJR,
    onOnboard,
    onBulkOnboard,
    onboardingIds = [],
    filterSource = 'all',
    onFilterSourceChange,
    onOnboardAll
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
    const containerClasses = disableScroll ? 'w-full px-1' : 'flex-1 w-full px-1';

    return (
        <div className={cn("flex flex-col bg-slate-50/50 p-1 relative", !disableScroll && "h-full")}>
            <Container className={containerClasses}>
                {/* Header with Select All */}
                {results.length > 0 && onToggleSelectAll && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200/50">
                        <div className="flex items-center gap-3">
                            <Checkbox
                                checked={selectedIds.length === results.length && results.length > 0}
                                onCheckedChange={() => onToggleSelectAll(results.map(r => r.id))}
                                className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                            />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Select All ({results.length})
                            </span>
                        </div>

                        {/* Bulk Actions at Top */}
                        <AnimatePresence>
                            {selectedIds.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="flex items-center gap-2"
                                >
                                    <div className="h-6 w-px bg-slate-200 mx-1" />
                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded truncate">
                                        {selectedIds.length} Selected
                                    </span>
                                    {onBulkAddToJR && (
                                        <Button
                                            size="sm"
                                            onClick={() => onBulkAddToJR(selectedIds)}
                                            className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wide gap-1.5"
                                        >
                                            <Plus className="w-3 h-3" /> Add to JR
                                        </Button>
                                    )}
                                    {onBulkOnboard && results.some(r => selectedIds.includes(r.id) && r.source === 'external_db' && !r.onboarded_id) && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => onBulkOnboard(selectedIds.filter(id => {
                                                const r = results.find(res => res.id === id);
                                                return r?.source === 'external_db' && !r.onboarded_id;
                                            }))}
                                            className="h-8 border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wide gap-1.5"
                                        >
                                            <UserPlus className="w-3 h-3" /> Onboard
                                        </Button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex-1" />

                        {/* Source Filters & Onboard All */}
                        <div className="flex items-center gap-3">
                            {onOnboardAll && results.some(r => r.source === 'external_db' && !r.onboarded_id) && (
                                <Button
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOnboardAll();
                                    }}
                                    disabled={onboardingIds.length > 0}
                                    className="h-8 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] uppercase tracking-wide border border-emerald-100 gap-1.5 shadow-none"
                                >
                                    <UserPlus className="w-3 h-3" /> Onboard All Market
                                </Button>
                            )}

                            {onFilterSourceChange && (
                                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                    <button
                                        onClick={() => onFilterSourceChange('all')}
                                        className={cn(
                                            "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-tight",
                                            filterSource === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => onFilterSourceChange('internal')}
                                        className={cn(
                                            "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-tight flex items-center gap-1",
                                            filterSource === 'internal' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Internal
                                    </button>
                                    <button
                                        onClick={() => onFilterSourceChange('external')}
                                        className={cn(
                                            "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-tight flex items-center gap-1",
                                            filterSource === 'external' ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> External
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
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
                                        "group relative bg-white border rounded-xl p-4 cursor-pointer transition-all duration-300 w-full overflow-hidden",
                                        result.stage2_pass === false
                                            ? "border-red-200 bg-red-50/30 hover:shadow-lg hover:shadow-red-500/5 hover:border-red-300"
                                            : "hover:shadow-lg hover:shadow-indigo-500/5 hover:border-indigo-200",
                                        activeResultId === result.id
                                            ? "border-indigo-500 shadow-md ring-1 ring-indigo-500/20"
                                            : result.stage2_pass !== false && "border-slate-200",
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
                                    {/* Rank Badge */}
                                    {result.stage3_rank != null && result.stage3_rank <= 20 && (
                                        <div className="absolute top-3 right-3 z-10">
                                            <span className={cn(
                                                "text-[9px] font-black px-1.5 py-0.5 rounded-full",
                                                result.stage3_rank === 1 ? "bg-amber-400 text-white" :
                                                result.stage3_rank <= 3 ? "bg-slate-700 text-white" :
                                                "bg-slate-100 text-slate-500"
                                            )}>
                                                #{result.stage3_rank}
                                            </span>
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

                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <div className="mb-1">
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

                                            <div className="mt-2 space-y-1.5">
                                                {(result.highlight_project || result.stage3_tradeoff) ? (
                                                    <>
                                                        {result.highlight_project && (
                                                            <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed font-medium">
                                                                {result.highlight_project}
                                                            </p>
                                                        )}
                                                        {result.stage3_tradeoff && (
                                                            <p className="text-[10px] text-amber-700 line-clamp-2 leading-relaxed">
                                                                <span className="font-black">↔</span> {result.stage3_tradeoff}
                                                            </p>
                                                        )}
                                                    </>
                                                ) : (
                                                    <p className="text-[10px] text-slate-400 italic">Pending Stage 3 analysis...</p>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-1.5 mt-3">
                                                <Badge variant="outline" className={cn(
                                                    "text-[9px] uppercase font-black border-none h-4 px-1.5 flex items-center gap-1",
                                                    result.source === 'internal_db' ? "bg-indigo-600 text-white shadow-sm" :
                                                        result.source === 'external_db' ? "bg-emerald-600 text-white shadow-sm" :
                                                            "bg-blue-600 text-white shadow-sm"
                                                )}>
                                                    {getSourceIcon(result.source)}
                                                    {result.source.replace('_db', '')}
                                                </Badge>
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
                                                {result.stage2_pass === false && (
                                                    <Badge className="text-[9px] bg-red-100 hover:bg-red-100 text-red-700 border border-red-200 py-0.5 px-1.5 h-auto flex items-center gap-1 whitespace-normal">
                                                        <XCircle className="w-2.5 h-2.5 flex-shrink-0" />
                                                        Not qualified{result.stage2_reason ? ` · ${result.stage2_reason}` : ""}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center justify-center gap-2 self-stretch ml-2">
                                            {result.source === 'external_db' && onOnboard && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    disabled={!!result.onboarded_id || onboardingIds.includes(result.id)}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onOnboard(result.id, result.name);
                                                    }}
                                                    className={cn(
                                                        "h-8 w-8 rounded-lg transition-all",
                                                        result.onboarded_id
                                                            ? "text-emerald-500 bg-emerald-50 cursor-default"
                                                            : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                    )}
                                                >
                                                    {onboardingIds.includes(result.id) ? (
                                                        <Plus className="w-4 h-4 animate-spin" />
                                                    ) : result.onboarded_id ? (
                                                        <CheckCircle className="w-4 h-4" />
                                                    ) : (
                                                        <UserPlus className="w-4 h-4" />
                                                    )}
                                                </Button>
                                            )}
                                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </Container>
            <div className="bg-white/50 backdrop-blur-sm border-t p-2.5 text-[10px] font-medium text-center text-slate-400 flex items-center justify-center gap-2">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                Found {results.length} qualified candidates for this search
            </div>

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
