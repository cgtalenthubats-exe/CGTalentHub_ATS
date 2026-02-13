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

interface Props {
    results: ConsolidatedResult[];
    onSelectResult: (result: ConsolidatedResult) => void;
    activeResultId?: string | null;
}

export function ResultsTable({ results, onSelectResult, activeResultId }: Props) {
    if (!results || results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 gap-4">
                <SearchIllustration />
                <p className="text-sm font-medium">No results found. Try running a new search.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50 p-1">
            <ScrollArea className="flex-1 pr-1">
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
                                            : "border-slate-200"
                                    )}
                                >
                                    <div className="flex items-start gap-4">
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
                                                    animate={{ strokeDashoffset: 150.8 - (150.8 * result.match_score) / 100 }}
                                                    transition={{ duration: 1, ease: "easeOut" }}
                                                    className={cn(
                                                        result.match_score >= 80 ? "text-emerald-500" :
                                                            result.match_score >= 50 ? "text-amber-500" :
                                                                "text-indigo-400"
                                                    )}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-sm font-bold text-slate-700">{result.match_score}</span>
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
            </ScrollArea>
            <div className="bg-white/50 backdrop-blur-sm border-t p-2.5 text-[10px] font-medium text-center text-slate-400 flex items-center justify-center gap-2">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                Found {results.length} qualified candidates for this search
            </div>
        </div>
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
