"use client";

import React, { useState } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, ChevronUp, MapPin, Trash2, RefreshCw, History } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

interface Experience {
    id: number;
    company: string;
    position: string;
    start_date: string;
    end_date: string;
    country: string;
    company_industry?: string;
    is_current_job?: boolean;
}

interface Candidate {
    candidate_id: string;
    name: string;
    email: string;
    mobile_phone: string;
    nationality: string;
    age: number | null;
    gender?: string;
    candidate_status?: string[] | null;
    job_grouping?: string;
    job_function?: string;
    photo?: string;
    linkedin?: string;
    created_date: string;
    modify_date: string;
    experiences: Experience[];
}

interface AgingCandidateTableProps {
    candidates: Candidate[];
    loading: boolean;
    selectedIds: string[];
    onSelectAll: (checked: boolean) => void;
    onSelectOne: (id: string, checked: boolean) => void;
    onDelete?: () => void;
    onRefresh?: () => void;
}

function sortExperiences(exps: Experience[]) {
    if (!exps) return [];
    return [...exps].sort((a, b) => {
        const isAPresent = !a.end_date || a.end_date.toLowerCase() === 'present';
        const isBPresent = !b.end_date || b.end_date.toLowerCase() === 'present';
        if (isAPresent && !isBPresent) return -1;
        if (!isAPresent && isBPresent) return 1;
        if (isAPresent && isBPresent) return 0;
        const dateA = new Date(a.end_date);
        const dateB = new Date(b.end_date);
        return dateB.getTime() - dateA.getTime();
    });
}

const CandidateRow = ({ candidate, selected, onSelect }: { candidate: Candidate, selected: boolean, onSelect: (c: boolean) => void }) => {
    const [expanded, setExpanded] = useState(false);
    const sortedExperiences = sortExperiences(candidate.experiences);
    const latestExp = sortedExperiences.find(e => e.is_current_job) || sortedExperiences[0];

    return (
        <>
            <TableRow className={cn("hover:bg-slate-50/80 transition-colors", expanded && "bg-slate-50/50", selected && "bg-indigo-50/30")}>
                <TableCell className="w-[40px]">
                    <Checkbox checked={selected} onCheckedChange={onSelect} />
                </TableCell>
                <TableCell className="w-[40px]">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setExpanded(!expanded)}>
                        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                </TableCell>
                <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-slate-200">
                            <AvatarImage src={candidate.photo} />
                            <AvatarFallback className="text-xs bg-indigo-50 text-indigo-600">
                                {candidate.name?.substring(0, 2)?.toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <Link href={`/candidates/${candidate.candidate_id}`} className="hover:underline font-semibold text-slate-800 flex items-center gap-1">
                                {candidate.name}
                                <span className="text-sm text-slate-600 dark:text-slate-300 font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
                                    {candidate.candidate_id}
                                </span>
                            </Link>
                            <span className="text-[11px] text-slate-500">
                                {candidate.nationality} • {candidate.age} yrs • {candidate.gender}
                            </span>
                        </div>
                    </div>
                </TableCell>
                <TableCell>
                    {candidate.candidate_status && candidate.candidate_status.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {candidate.candidate_status.map((s: string) => (
                                <Badge key={s} variant="secondary" className={cn("text-[10px] font-bold uppercase tracking-wider border",
                                    s === 'Blacklist' ? "bg-rose-50 text-rose-600 border-rose-100" :
                                    s === 'Over-aged' ? "bg-orange-50 text-orange-600 border-orange-100" :
                                    "bg-slate-100 text-slate-600 border-slate-200")}>
                                    {s}
                                </Badge>
                            ))}
                        </div>
                    ) : <span className="text-slate-400">-</span>}
                </TableCell>
                <TableCell className="max-w-[200px]">
                    {latestExp ? (
                        <div className="flex flex-col">
                            <span className="font-medium text-sm text-slate-700 truncate" title={latestExp.company}>{latestExp.company}</span>
                            <span className="text-xs text-slate-500 truncate" title={latestExp.position}>{latestExp.position}</span>
                            <span className="text-[10px] text-slate-400 flex items-center mt-0.5">
                                <MapPin className="w-3 h-3 mr-0.5" />
                                {latestExp.country}
                            </span>
                        </div>
                    ) : <span className="text-slate-400 italic text-xs">No experience</span>}
                </TableCell>
                <TableCell className="text-xs text-slate-500 font-mono">
                    {candidate.modify_date ? new Date(candidate.modify_date).toLocaleDateString('en-GB') : '-'}
                </TableCell>
            </TableRow>
            {expanded && (
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableCell colSpan={8} className="p-0">
                        <div className="p-4 pl-14">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                Experience History
                            </h4>
                            <div className="border rounded-md bg-white overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow className="hover:bg-slate-50 border-b-slate-100">
                                            <TableHead className="h-8 text-[11px] font-bold uppercase">Position</TableHead>
                                            <TableHead className="h-8 text-[11px] font-bold uppercase">Company</TableHead>
                                            <TableHead className="h-8 text-[11px] font-bold uppercase">Country</TableHead>
                                            <TableHead className="h-8 text-[11px] font-bold uppercase text-right">Period</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedExperiences.map((exp) => (
                                            <TableRow key={exp.id} className="hover:bg-slate-50 border-b-slate-50">
                                                <TableCell className="py-2 text-xs font-medium text-slate-700">{exp.position}</TableCell>
                                                <TableCell className="py-2 text-xs text-slate-600">{exp.company}</TableCell>
                                                <TableCell className="py-2 text-xs text-slate-500">{exp.country}</TableCell>
                                                <TableCell className="py-2 text-xs text-right font-mono text-slate-500">{exp.start_date} - {exp.end_date}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
};

export function AgingCandidateTable({ candidates, loading, selectedIds, onSelectAll, onSelectOne, onDelete, onRefresh }: AgingCandidateTableProps) {
    if (loading) return <div className="p-8 text-center text-slate-400">Loading candidates...</div>;
    if (candidates.length === 0) return <div className="p-20 text-center text-slate-400 border border-dashed rounded-lg bg-slate-50">No candidates found in this category.</div>;

    const allSelected = candidates.length > 0 && selectedIds.length === candidates.length;

    return (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col">
            {/* Action Bar */}
            {selectedIds.length > 0 && (
                <div className="bg-indigo-50 px-4 py-2 flex items-center justify-between border-b border-indigo-100 animate-in slide-in-from-top-2">
                    <span className="text-sm font-medium text-indigo-700">{selectedIds.length} Selected</span>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="bg-white hover:bg-white text-emerald-600 border-emerald-200 hover:border-emerald-300" onClick={onRefresh}>
                            <RefreshCw className="h-4 w-4 mr-2" /> Refresh Data
                        </Button>
                        <Button size="sm" variant="destructive" onClick={onDelete}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </Button>
                    </div>
                </div>
            )}

            <Table>
                <TableHeader className="bg-slate-50/80">
                    <TableRow>
                        <TableHead className="w-[40px]"><Checkbox checked={allSelected} onCheckedChange={(c) => onSelectAll(!!c)} /></TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Latest Company</TableHead>
                        <TableHead className="w-[150px]">Last Modified</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {candidates.map((candidate) => (
                        <CandidateRow
                            key={candidate.candidate_id}
                            candidate={candidate}
                            selected={selectedIds.includes(candidate.candidate_id)}
                            onSelect={(c) => onSelectOne(candidate.candidate_id, c)}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
