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
import { ChevronDown, ChevronUp, ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

// --- Types (Duplicated from page.tsx to avoid circular deps or complex refactor) ---
export interface Experience {
    id: number;
    company: string;
    position: string;
    start_date: string;
    end_date: string;
    country: string;
    company_industry?: string;
    is_current_job?: boolean;
}

export interface Candidate {
    candidate_id: string;
    name: string;
    email: string;
    mobile_phone: string;
    nationality: string;
    age: number;
    gender?: string;
    candidate_status?: string;
    job_grouping?: string;
    job_function?: string;
    photo?: string;
    linkedin?: string;
    created_date: string;
    modify_date: string;
    experiences: Experience[];
}

interface CandidateTableViewProps {
    candidates: Candidate[];
    loading: boolean;
    selectedIds?: string[];
    onToggleSelect?: (id: string) => void;
    onToggleSelectAll?: (ids: string[]) => void;
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

const CandidateRow = ({
    candidate,
    isSelected,
    onToggleSelect
}: {
    candidate: Candidate;
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
}) => {
    const [expanded, setExpanded] = useState(false);

    // Sort experiences
    const sortedExperiences = sortExperiences(candidate.experiences);
    const latestExp = sortedExperiences.find(e => e.is_current_job) || sortedExperiences[0];

    return (
        <>
            <TableRow className={cn(
                "hover:bg-slate-50/80 transition-colors",
                expanded && "bg-slate-50/50",
                isSelected && "bg-indigo-50/40 hover:bg-indigo-50/60"
            )}>
                <TableCell className="w-[40px] px-2 text-center">
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect?.(candidate.candidate_id)}
                        className="translate-y-[2px] border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 shadow-sm"
                    />
                </TableCell>
                <TableCell className="w-[50px]">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setExpanded(!expanded)}
                    >
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
                    {candidate.candidate_status ? (
                        <Badge variant="secondary" className={cn(
                            "text-[10px] font-bold uppercase tracking-wider border",
                            candidate.candidate_status === 'Active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                "bg-slate-100 text-slate-600 border-slate-200"
                        )}>
                            {candidate.candidate_status}
                        </Badge>
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
                <TableCell>
                    <div className="flex flex-col gap-1.5">
                        {candidate.job_grouping && (
                            <Badge variant="outline" className="w-fit text-[10px] h-5 bg-blue-50 text-blue-700 border-blue-100 truncate max-w-[150px]">
                                {candidate.job_grouping}
                            </Badge>
                        )}
                        {candidate.job_function && (
                            <Badge variant="outline" className="w-fit text-[10px] h-5 bg-purple-50 text-purple-700 border-purple-100 truncate max-w-[150px]">
                                {candidate.job_function}
                            </Badge>
                        )}
                        {!candidate.job_grouping && !candidate.job_function && <span className="text-slate-300">-</span>}
                    </div>
                </TableCell>
                <TableCell className="text-xs text-slate-500 font-mono">
                    {new Date(candidate.created_date).toLocaleDateString('th-TH')}
                </TableCell>
                <TableCell className="text-xs text-slate-500 font-mono">
                    {candidate.modify_date ? new Date(candidate.modify_date).toLocaleDateString('th-TH') : '-'}
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
                                            <TableHead className="h-8 text-[11px] font-bold uppercase">Industry</TableHead>
                                            <TableHead className="h-8 text-[11px] font-bold uppercase">Country</TableHead>
                                            <TableHead className="h-8 text-[11px] font-bold uppercase text-right">Period</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedExperiences.map((exp) => (
                                            <TableRow key={exp.id} className="hover:bg-slate-50 border-b-slate-50">
                                                <TableCell className="py-2 text-xs font-medium text-slate-700">{exp.position}</TableCell>
                                                <TableCell className="py-2 text-xs text-slate-600">{exp.company}</TableCell>
                                                <TableCell className="py-2 text-xs text-slate-500">{exp.company_industry || '-'}</TableCell>
                                                <TableCell className="py-2 text-xs text-slate-500">{exp.country}</TableCell>
                                                <TableCell className="py-2 text-xs text-right font-mono text-slate-500">
                                                    {exp.start_date} - {exp.end_date}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {sortedExperiences.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-4 text-xs text-muted-foreground">No experience recorded.</TableCell>
                                            </TableRow>
                                        )}
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

export function CandidateTableView({
    candidates,
    loading,
    selectedIds = [],
    onToggleSelect,
    onToggleSelectAll
}: CandidateTableViewProps) {
    if (loading) {
        return (
            <div className="bg-white rounded-lg border shadow-sm p-8 space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex gap-4 items-center animate-pulse">
                        <div className="w-8 h-8 bg-slate-100 rounded-full" />
                        <div className="h-4 w-32 bg-slate-100 rounded" />
                        <div className="h-4 w-full bg-slate-100 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    if (candidates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-dashed">
                <p className="text-muted-foreground text-sm">No candidates found.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <Table>
                <TableHeader className="bg-slate-50/80">
                    <TableRow>
                        <TableHead className="w-[40px] px-2 text-center">
                            <Checkbox
                                checked={candidates.length > 0 && selectedIds.length === candidates.length}
                                onCheckedChange={() => onToggleSelectAll?.(candidates.map(c => c.candidate_id))}
                                className="translate-y-[2px] border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 shadow-sm"
                            />
                        </TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Latest Company</TableHead>
                        <TableHead>Job Group/Function</TableHead>
                        <TableHead className="w-[100px]">Created</TableHead>
                        <TableHead className="w-[100px]">Modified</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {candidates.map((candidate) => (
                        <CandidateRow
                            key={candidate.candidate_id}
                            candidate={candidate}
                            isSelected={selectedIds.includes(candidate.candidate_id)}
                            onToggleSelect={onToggleSelect}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
