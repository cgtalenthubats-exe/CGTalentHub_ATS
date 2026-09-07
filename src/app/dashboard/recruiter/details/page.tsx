"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getRecruiterKPIDetails, KPIDetailResult, KPIDetailCandidate, KPIDetailExperience } from "@/app/actions/kpi-details-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CandidateProfileSheet } from "@/components/candidate-profile-sheet";

// --- Helpers ---
function parseMonthYearDate(dateStr: string | null | undefined): number {
    if (!dateStr || dateStr.toLowerCase() === 'present') return Infinity;
    const parts = dateStr.split('-');
    if (parts.length === 2) {
        const month = parseInt(parts[0], 10);
        const year = parseInt(parts[1], 10);
        if (!isNaN(month) && !isNaN(year)) return year * 100 + month;
    }
    const ts = new Date(dateStr).getTime();
    return isNaN(ts) ? 0 : ts;
}

function sortExperiences(exps: KPIDetailExperience[]) {
    return [...exps].sort((a, b) => {
        const aCurrent = a.end_date?.toLowerCase() === 'present' || a.is_current_job === 'Current';
        const bCurrent = b.end_date?.toLowerCase() === 'present' || b.is_current_job === 'Current';
        if (aCurrent && !bCurrent) return -1;
        if (!aCurrent && bCurrent) return 1;
        return parseMonthYearDate(b.start_date) - parseMonthYearDate(a.start_date);
    });
}

function formatDate(dateString: string) {
    if (!dateString) return "-";
    try { return format(new Date(dateString), "dd MMM yyyy"); } catch { return dateString; }
}

// --- Candidate ID chip ---
function CandidateIdChip({ candidateId, onClick }: { candidateId: string; onClick: (id: string) => void }) {
    if (!candidateId) return null;
    return (
        <button
            onClick={() => onClick(candidateId)}
            className="text-xs font-mono font-bold bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 px-1.5 py-0.5 rounded border border-slate-200 hover:border-indigo-200 transition-colors shadow-sm"
        >
            {candidateId}
        </button>
    );
}

// --- Expandable sourcing row ---
function SourcingRow({ candidate, onOpenSheet }: { candidate: KPIDetailCandidate; onOpenSheet: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const sorted = sortExperiences(candidate.experiences);
    const latest = sorted.find(e => e.is_current_job === 'Current' || e.end_date?.toLowerCase() === 'present') || sorted[0];
    const initials = candidate.name?.substring(0, 2)?.toUpperCase() || '??';

    return (
        <>
            <TableRow className={cn("hover:bg-slate-50/80 transition-colors", expanded && "bg-slate-50/50")}>
                <TableCell className="w-[40px] px-2">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpanded(!expanded)}>
                        {expanded
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                </TableCell>
                <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-slate-200 shrink-0">
                            <AvatarImage src={candidate.photo} />
                            <AvatarFallback className="text-xs bg-indigo-50 text-indigo-600">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-800 text-sm">{candidate.name}</span>
                                <CandidateIdChip candidateId={candidate.candidate_id} onClick={onOpenSheet} />
                            </div>
                            <span className="text-[11px] text-slate-400">
                                {[candidate.nationality, candidate.age ? `${candidate.age} yrs` : null, candidate.gender].filter(Boolean).join(' • ')}
                            </span>
                        </div>
                    </div>
                </TableCell>
                <TableCell className="max-w-[180px]">
                    {latest?.position
                        ? <span className="text-sm text-slate-700 truncate block" title={latest.position}>{latest.position}</span>
                        : <span className="text-slate-300 text-xs">-</span>}
                </TableCell>
                <TableCell className="max-w-[160px]">
                    {latest?.company
                        ? <span className="text-sm text-slate-700 truncate block font-medium" title={latest.company}>{latest.company}</span>
                        : <span className="text-slate-300 text-xs">-</span>}
                </TableCell>
                <TableCell>
                    {latest?.country
                        ? <span className="text-xs text-slate-500 flex items-center gap-0.5"><MapPin className="w-3 h-3 shrink-0" />{latest.country}</span>
                        : <span className="text-slate-300 text-xs">-</span>}
                </TableCell>
                <TableCell>
                    <div className="flex flex-col gap-1">
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
                        {!candidate.job_grouping && !candidate.job_function && <span className="text-slate-300 text-xs">-</span>}
                    </div>
                </TableCell>
                <TableCell className="text-xs text-slate-500 font-mono">{formatDate(candidate.created_date)}</TableCell>
            </TableRow>
            {expanded && (
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableCell colSpan={7} className="p-0">
                        <div className="p-4 pl-14">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Experience History</h4>
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
                                        {sorted.map((exp) => {
                                            const isCurrent = exp.is_current_job === 'Current' || exp.end_date?.toLowerCase() === 'present';
                                            return (
                                                <TableRow key={exp.id} className={cn("border-b-slate-50", isCurrent ? "bg-blue-50/50 hover:bg-blue-50/70" : "hover:bg-slate-50")}>
                                                    <TableCell className="py-2 text-xs font-medium text-slate-700">
                                                        <span className="flex items-center gap-2">
                                                            {exp.position}
                                                            {isCurrent && <Badge variant="default" className="text-[9px] h-3.5 px-1 bg-blue-600">Current</Badge>}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-slate-600">{exp.company}</TableCell>
                                                    <TableCell className="py-2 text-xs text-slate-500">{exp.company_industry || '-'}</TableCell>
                                                    <TableCell className="py-2 text-xs text-slate-500">{exp.country}</TableCell>
                                                    <TableCell className="py-2 text-xs text-right font-mono text-slate-500">
                                                        <Badge variant={isCurrent ? "default" : "secondary"} className="font-mono text-[10px] px-1.5 py-0 h-5 shadow-none border border-border/50">
                                                            {exp.start_date} – {isCurrent ? 'Present' : exp.end_date}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {sorted.length === 0 && (
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
}

// --- Main page content ---
function KPIDetailContent() {
    const searchParams = useSearchParams();
    const recruiter = searchParams.get('recruiter') || '';
    const fyParam = searchParams.get('fy');
    const fys = fyParam ? fyParam.split(',').map(Number).filter(n => !isNaN(n)) : undefined;

    const [details, setDetails] = useState<KPIDetailResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileId, setProfileId] = useState<string | null>(null);

    useEffect(() => {
        if (recruiter) {
            setLoading(true);
            getRecruiterKPIDetails(recruiter, fys).then(data => {
                setDetails(data);
                setLoading(false);
            });
        }
    }, [recruiter, fyParam]);

    if (!recruiter) return <div className="p-8">No recruiter selected.</div>;

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard?tab=recruiter"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">{recruiter}'s KPI Details</h1>
                    <p className="text-gray-500 mt-1">
                        {fys?.length ? fys.map(y => `FY${y}`).join(", ") + " • " : "All Time • "}Detailed breakdown of performance metrics
                    </p>
                </div>
            </div>

            {loading || !details ? (
                <div className="flex h-64 items-center justify-center text-gray-500">Loading details...</div>
            ) : (
                <Tabs defaultValue="sourcing" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-8">
                        <TabsTrigger value="sourcing">Profiles Sourced ({details.sourcing.length})</TabsTrigger>
                        <TabsTrigger value="prescreens">Pre-Screens ({details.prescreens.length})</TabsTrigger>
                        <TabsTrigger value="interviews">Interviews ({details.interviews.length})</TabsTrigger>
                        <TabsTrigger value="jrs">JRs Owned ({details.jrs.length})</TabsTrigger>
                    </TabsList>

                    {/* Profiles Sourced */}
                    <TabsContent value="sourcing">
                        <Card>
                            <CardHeader>
                                <CardTitle>Profiles Sourced</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="border-t">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50">
                                                <TableHead className="w-[48px]"></TableHead>
                                                <TableHead>Candidate</TableHead>
                                                <TableHead>Position</TableHead>
                                                <TableHead>Company</TableHead>
                                                <TableHead>Country</TableHead>
                                                <TableHead>Job Group / Function</TableHead>
                                                <TableHead>Created</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {details.sourcing.length === 0 ? (
                                                <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No candidates sourced</TableCell></TableRow>
                                            ) : (
                                                details.sourcing.map(c => (
                                                    <SourcingRow key={c.candidate_id} candidate={c} onOpenSheet={setProfileId} />
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Pre-Screens */}
                    <TabsContent value="prescreens">
                        <Card>
                            <CardHeader><CardTitle>Pre-Screens Conducted</CardTitle></CardHeader>
                            <CardContent>
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50">
                                                <TableHead>Candidate</TableHead>
                                                <TableHead>Screening Date</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {details.prescreens.length === 0 ? (
                                                <TableRow><TableCell colSpan={3} className="text-center py-8 text-gray-500">No pre-screens found</TableCell></TableRow>
                                            ) : (
                                                details.prescreens.map((item, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-sm">{item.first_name} {item.last_name}</span>
                                                                <CandidateIdChip candidateId={item.candidate_id} onClick={setProfileId} />
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{formatDate(item.screening_date)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="sm" asChild>
                                                                <Link href={`/candidates/${item.candidate_id}`} target="_blank">
                                                                    View <ExternalLink className="ml-2 h-4 w-4" />
                                                                </Link>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Interviews */}
                    <TabsContent value="interviews">
                        <Card>
                            <CardHeader><CardTitle>Interviews Conducted (As Recruiter)</CardTitle></CardHeader>
                            <CardContent>
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50">
                                                <TableHead>Candidate</TableHead>
                                                <TableHead>Job Requisition</TableHead>
                                                <TableHead>Interview Date</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {details.interviews.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">No interviews found</TableCell></TableRow>
                                            ) : (
                                                details.interviews.map((item, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-sm">{item.candidate_first_name} {item.candidate_last_name}</span>
                                                                <CandidateIdChip candidateId={item.candidate_id} onClick={setProfileId} />
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{item.jr_title}</TableCell>
                                                        <TableCell>{formatDate(item.interview_date)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="sm" asChild>
                                                                <Link href={`/requisitions/manage/candidate/${item.jr_candidate_id}`} target="_blank">
                                                                    View <ExternalLink className="ml-2 h-4 w-4" />
                                                                </Link>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* JRs Owned */}
                    <TabsContent value="jrs">
                        <Card>
                            <CardHeader><CardTitle>Job Requisitions Owned</CardTitle></CardHeader>
                            <CardContent>
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50">
                                                <TableHead>JR Title</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Created Date</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {details.jrs.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">No JRs found</TableCell></TableRow>
                                            ) : (
                                                details.jrs.map((item, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-medium">{item.position_jr}</TableCell>
                                                        <TableCell>{item.status_jr}</TableCell>
                                                        <TableCell>{formatDate(item.created_at)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="sm" asChild>
                                                                <Link href={`/requisitions/manage/${item.jr_id}`} target="_blank">
                                                                    View <ExternalLink className="ml-2 h-4 w-4" />
                                                                </Link>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}

            {/* Profile slide panel */}
            <CandidateProfileSheet
                candidateId={profileId}
                open={!!profileId}
                onOpenChange={(open) => { if (!open) setProfileId(null); }}
            />
        </div>
    );
}

export default function KPIDetailPage() {
    return (
        <Suspense fallback={<div className="p-8">Loading details...</div>}>
            <KPIDetailContent />
        </Suspense>
    );
}
