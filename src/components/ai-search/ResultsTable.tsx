"use client";

import React from "react";
import { ConsolidatedResult } from "./types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, UserCircle2, Building2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

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
                <p>No results found. Try running a new search.</p>
            </div>
        );
    }

    return (
        <div className="rounded-md border bg-white shadow-sm overflow-hidden flex flex-col h-full">
            <div className="overflow-auto flex-1">
                <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="w-[80px] text-center">Score</TableHead>
                            <TableHead className="w-[250px]">Candidate / Position</TableHead>
                            <TableHead className="w-[200px]">Company</TableHead>
                            <TableHead className="w-[300px]">AI Highlights</TableHead>
                            <TableHead className="w-[80px]">Source</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {results.map((result) => (
                            <TableRow
                                key={result.result_id}
                                className={cn(
                                    "cursor-pointer hover:bg-slate-50 transition-colors",
                                    activeResultId === result.result_id ? "bg-indigo-50 hover:bg-indigo-50" : ""
                                )}
                                onClick={() => onSelectResult(result)}
                            >
                                <TableCell className="text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <Badge
                                            variant="secondary"
                                            className={cn(
                                                "font-bold text-lg px-2 h-8 min-w-[3rem] justify-center",
                                                result.match_score >= 80 ? "bg-emerald-100 text-emerald-700" :
                                                    result.match_score >= 50 ? "bg-amber-100 text-amber-700" :
                                                        "bg-slate-100 text-slate-600"
                                            )}
                                        >
                                            {result.match_score}
                                        </Badge>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-bold text-slate-900 text-base">{result.name}</span>
                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                            <BriefcaseIcon className="w-3 h-3" />
                                            {result.position}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-medium text-slate-800 flex items-center gap-1">
                                            <Building2 className="w-3 h-3 text-slate-400" />
                                            {result.company}
                                        </span>
                                        <div className="flex gap-1 flex-wrap">
                                            {result.company_tag && (
                                                <Badge variant="outline" className="text-[10px] h-4 px-1 text-slate-500 bg-slate-50">{result.company_tag}</Badge>
                                            )}
                                            {result.company_rating && (
                                                <Badge variant="outline" className="text-[10px] h-4 px-1 text-amber-600 bg-amber-50 border-amber-200">
                                                    <Star className="w-2 h-2 mr-0.5 fill-current" /> {result.company_rating}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                                        {result.key_highlights || result.reason_for_match || "No highlights available."}
                                    </p>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={result.source === 'Internal' ? 'default' : 'outline'} className={cn(
                                        result.source === 'Internal' ? "bg-indigo-600" : "text-slate-500 border-slate-300"
                                    )}>
                                        {result.source}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="bg-slate-50 border-t p-2 text-xs text-center text-slate-400">
                Showing {results.length} matched candidates
            </div>
        </div>
    );
}

function SearchIllustration() {
    return (
        <svg
            className="w-24 h-24 text-slate-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
    )
}

function BriefcaseIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
    )
}
