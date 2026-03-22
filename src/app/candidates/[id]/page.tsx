"use client";

import React, { useEffect, useState } from "react";
import {
    Mail, Phone, MapPin, Calendar, Download, Edit,
    Briefcase, GraduationCap, Globe,
    FileText, CheckCircle2, AlertCircle, UploadCloud, ChevronLeft, Plus,
    Linkedin, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { BackButton, EditButton, AddPrescreenDialog, EditPrescreenDialog, DeleteCandidateDialog, DeletePrescreenButton, RefreshProfileButton } from "@/components/candidate-client-actions";
import { AddExperienceDialog, DeleteExperienceButton, SetCurrentExperienceButton, EditExperienceDialog } from "@/components/experience-dialog";
import { formatMonthYear, parseAnyDate } from "@/lib/date-utils";
import { JobStatusDetailDialog } from "@/components/job-status-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ResumeManager } from "@/components/resume-manager";
import { CandidateLinkedinButton } from "@/components/candidate-linkedin-button";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import { formatDateForDisplay } from "@/lib/date-utils";
import { CandidateOrgChartButton } from "@/components/candidate-org-chart-button";

export default function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const [candidate, setCandidate] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchCandidate = async () => {
            try {
                const res = await fetch(`/api/candidates/${id}`);
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.details || errData.error || `Error ${res.status}: Failed to fetch candidate`);
                }
                const data = await res.json();
                setCandidate(data.data);
                // The following line is added as per user instruction.
                // Note: 'profile' and 'setCandidateName' are not defined in this scope.
                // This might indicate missing context or an incomplete change from the user.
                // To make the file syntactically correct, these would need to be defined.
                // Assuming 'profile' refers to 'data.data' and 'setCandidateName' is a new state setter.
                // For faithful reproduction of the snippet, it's inserted as provided.
                if (data.data) { // Assuming 'profile' refers to 'data.data'
                    // If setCandidateName is intended, it needs to be declared as a state variable.
                    // For now, this line is commented out to maintain syntactic correctness without further assumptions.
                    // setCandidateName((data.data as any).name);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchCandidate();
    }, [id]);

    React.useEffect(() => {
        if (!loading && typeof window !== "undefined" && window.location.hash) {
            const hashId = window.location.hash.slice(1);
            const element = document.getElementById(hashId);
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        }
    }, [loading]);

    if (loading) return <div className="p-8 text-center">Loading candidate profile...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    if (!candidate) return <div className="p-8 text-center">Candidate not found</div>;

    const enhance = candidate.enhancement || {};

    return (
        <div className="container mx-auto max-w-6xl py-8 space-y-8 animate-in fade-in duration-500">

            {/* --- TOP BAR --- */}
            <div className="flex flex-col mb-2">
                <BackButton fallbackHref="/candidates/list" />
                <AtsBreadcrumb
                    items={[
                        { label: 'Candidates', href: '/candidates' },
                        { label: 'All Candidates', href: '/candidates/list' },
                        { label: candidate.name || 'Candidate Detail' }
                    ]}
                    action={<div className="text-xs font-mono text-muted-foreground opacity-50">ID: {candidate.candidate_id}</div>}
                />
            </div>

            {/* --- HEADER HERO --- */}
            <div className="relative rounded-xl overflow-hidden bg-card border border-border/60 shadow-lg group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50 opacity-80" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-100/40 to-transparent rounded-bl-full pointer-events-none" />

                <div className="relative p-6 md:p-8 flex flex-col md:flex-row gap-8 items-start md:items-center">
                    <Avatar className="h-32 w-32 border-4 border-background shadow-xl ring-2 ring-border">
                        <AvatarImage src={candidate.photo} className="object-cover" />
                        <AvatarFallback className="text-4xl font-bold bg-secondary text-primary">
                            {candidate.name?.substring(0, 2)?.toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 space-y-3">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold tracking-tight text-foreground">{candidate.name}</h1>
                                {candidate.candidate_status && (
                                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-50/50 uppercase tracking-widest text-[10px]">
                                        {candidate.candidate_status}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xl font-mono font-bold text-muted-foreground/40 tracking-tight">#{candidate.candidate_id}</span>
                            </div>
                            <p className="text-lg text-muted-foreground font-medium mt-1">
                                {candidate.experiences?.[0]?.position || "No active position"}
                                <span className="text-muted-foreground/50 mx-2">at</span>
                                <span className="text-foreground font-semibold">{candidate.experiences?.[0]?.company || "Unknown Company"}</span>
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-foreground/80 font-medium pt-1">
                            <div className="flex items-center gap-2 bg-indigo-50/50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-full border border-indigo-100/50 dark:border-indigo-800/50 shadow-sm">
                                <Globe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                <span className="text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">Nationality:</span>
                                <span className="text-foreground font-bold">{candidate.nationality || "N/A"}</span>
                            </div>
                            <div className="flex items-center gap-2 bg-purple-50/50 dark:bg-purple-900/20 px-3 py-1.5 rounded-full border border-purple-100/50 dark:border-purple-800/50 shadow-sm">
                                <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                <span className="text-foreground font-bold">
                                    {candidate.age ? (
                                        `${candidate.age} Years - ${candidate.date_of_birth ? "DoB" : "Bachelor year"}`
                                    ) : (
                                        "Age N/A"
                                    )}
                                </span>
                            </div>
                            {(candidate.enhancement?.country || candidate.enhancement?.full_address) && (
                                <div className="flex items-center gap-2 bg-blue-50/50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full border border-blue-100/50 dark:border-blue-800/50 shadow-sm">
                                    <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <span className="text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">Address from LI:</span>
                                    <span className="text-foreground font-bold">
                                        {[candidate.enhancement?.country, candidate.enhancement?.full_address].filter(Boolean).join(", ")}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 items-end">
                        <div className="flex gap-2 items-center">
                            <CandidateOrgChartButton 
                    candidateId={candidate.candidate_id} 
                    candidateName={candidate.name}
                    linkedin={candidate.linkedin}
                />
                            <CandidateLinkedinButton checked={candidate.checked} linkedin={candidate.linkedin} candidateId={candidate.candidate_id} className="h-10 w-10 [&_svg]:h-5 [&_svg]:w-5" />
                            <ResumeManager
                                candidateId={candidate.candidate_id}
                                resumeUrl={candidate.resume_url}
                                onUpdate={() => {
                                    // Refresh logic - component handles router.refresh()
                                    // We might want to re-fetch here if needed, but router.refresh should handle server component updates or next fetch
                                }}
                            />
                            <EditButton id={candidate.candidate_id} />
                        </div>
                    </div>
                </div>
            </div>

            {/* --- BLACKLIST ALERT --- */}
            {candidate.candidate_status === "Blacklist" && candidate.blacklist_note && (
                <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-6 flex flex-col md:flex-row gap-5 items-center shadow-sm animate-in zoom-in duration-500">
                    <div className="p-4 bg-rose-500 text-white rounded-full shadow-lg shadow-rose-200">
                        <AlertCircle className="h-8 w-8 stroke-[3px]" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-xl font-black text-rose-700 uppercase tracking-tight">Candidate Blacklisted</h3>
                        <p className="mt-1 text-rose-600 font-bold leading-snug">
                            {candidate.blacklist_note}
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-12 gap-6">

                {/* --- LEFT SIDEBAR (Info) --- */}
                <div className="col-span-12 md:col-span-4 space-y-6">
                    {/* Contact Card */}
                    <Card className="border shadow-sm bg-card overflow-hidden">
                        <CardHeader className="pb-3 border-b bg-gradient-to-r from-slate-50 to-white">
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-700">
                                <span className="p-1.5 rounded-md bg-indigo-100 text-indigo-600"><Globe className="w-4 h-4" /></span> Contact Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4 text-sm">
                            <div className="group flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors border border-transparent hover:border-border/50">
                                <div className="p-2 rounded-full bg-primary/10 text-primary"><Mail className="h-4 w-4" /></div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Email</p>
                                    <p className="truncate font-medium text-foreground">{candidate.email}</p>
                                </div>
                            </div>

                            {enhance.alt_email && enhance.alt_email !== candidate.email && (
                                <div className="group flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors border border-transparent hover:border-border/50">
                                    <div className="p-2 rounded-full bg-orange-500/10 text-orange-600"><Mail className="h-4 w-4" /></div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Alt. Email</p>
                                        <p className="truncate font-medium text-foreground">{enhance.alt_email}</p>
                                    </div>
                                </div>
                            )}

                            <div className="group flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors border border-transparent hover:border-border/50">
                                <div className="p-2 rounded-full bg-green-500/10 text-green-600"><Phone className="h-4 w-4" /></div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Phone</p>
                                    <p className="truncate font-medium text-foreground">{candidate.mobile_phone || "N/A"}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Resume Upload / Documents */}
                    <Card className="border shadow-sm bg-card overflow-hidden">
                        <CardHeader className="pb-3 border-b bg-gradient-to-r from-slate-50 to-white">
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-700">
                                <span className="p-1.5 rounded-md bg-rose-100 text-rose-600"><FileText className="w-4 h-4" /></span> Documents
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-4">
                            {candidate.documents && candidate.documents.length > 0 ? (
                                candidate.documents.map((doc: any, i: number) => (
                                    <div key={i} className="flex items-center gap-3 p-2 border rounded-md hover:bg-muted/30 transition-colors">
                                        <div className="h-8 w-8 bg-red-50 text-red-600 rounded flex items-center justify-center border border-red-100">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="text-sm font-medium truncate" title={doc.document_name}>{doc.document_name}</p>
                                        </div>
                                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                            <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="h-4 w-4 text-muted-foreground" /></Button>
                                        </a>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-lg border-muted">
                                    <UploadCloud className="h-8 w-8 text-muted-foreground/50 mb-2" />
                                    <span className="text-xs text-muted-foreground">No file attached</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Skills (Enhanced) */}
                    {enhance.skills_list && (
                        <Card className="border shadow-sm bg-card overflow-hidden">
                            <CardHeader className="pb-3 border-b bg-gradient-to-r from-slate-50 to-white">
                                <CardTitle className="text-base font-bold text-slate-700 flex items-center gap-2">
                                    <span className="p-1.5 rounded-md bg-emerald-100 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></span> Skills
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="flex flex-wrap gap-2">
                                    {typeof enhance.skills_list === 'string'
                                        ? enhance.skills_list.split(',').map((s: string) => <Badge key={s} variant="secondary" className="border border-border/50 text-foreground">{s.trim()}</Badge>)
                                        : Array.isArray(enhance.skills_list)
                                            ? enhance.skills_list.map((s: string) => <Badge key={s} variant="secondary" className="border border-border/50 text-foreground">{s}</Badge>)
                                            : <p className="text-sm text-muted-foreground">No specific skills listed.</p>
                                    }
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Languages (New) */}
                    {enhance.languages && (
                        <Card className="border shadow-sm bg-card overflow-hidden">
                            <CardHeader className="pb-3 border-b bg-gradient-to-r from-slate-50 to-white">
                                <CardTitle className="text-base font-bold text-slate-700 flex items-center gap-2">
                                    <span className="p-1.5 rounded-md bg-orange-100 text-orange-600"><Globe className="w-4 h-4" /></span> Languages
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="flex flex-col gap-2">
                                    {typeof enhance.languages === 'string'
                                        ? enhance.languages.split(',').map((s: string) => (
                                            <div key={s} className="flex items-center gap-2 text-sm">
                                                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                                <span>{s.trim()}</span>
                                            </div>
                                        ))
                                        : <p className="text-sm text-muted-foreground">{enhance.languages}</p>
                                    }
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Danger Zone */}
                    <Card className="border border-destructive/20 shadow-none bg-destructive/5">
                        <CardContent className="p-4 flex flex-col gap-2">
                            <h4 className="font-semibold text-destructive text-sm flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" /> Danger Zone
                            </h4>
                            <p className="text-xs text-muted-foreground mb-2">Actions that affect this candidate's data.</p>

                            {/* Refresh Profile */}
                            <RefreshProfileButton
                                candidateId={candidate.candidate_id}
                                candidateName={candidate.name}
                                linkedinUrl={candidate.linkedin}
                            />

                            {/* Delete Candidate */}
                            <DeleteCandidateDialog id={candidate.candidate_id} name={candidate.name} />
                        </CardContent>
                    </Card>
                </div>

                {/* --- MAIN CONTENT --- */}
                <div className="col-span-12 md:col-span-8 space-y-6">

                    {/* About Section */}
                    {enhance.about && (
                        <Card className="border shadow-sm bg-card">
                            <CardHeader className="pb-3 border-b bg-muted/20"><CardTitle className="text-base font-semibold">About Summary</CardTitle></CardHeader>
                            <CardContent className="pt-4">
                                <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{enhance.about}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Experience Timeline */}
                    <Card className="border shadow-sm bg-card overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between border-b bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                                <span className="p-2 rounded-lg bg-blue-100 text-blue-600"><Briefcase className="h-5 w-5" /></span> Work Experience
                            </CardTitle>
                            <AddExperienceDialog candidateId={candidate.candidate_id} />
                        </CardHeader>
                        <CardContent className="relative pl-8 border-l-2 border-border/40 ml-8 space-y-10 py-8 pr-6">
                            {candidate.experiences
                                ?.sort((a: any, b: any) => {
                                    // 1. Present first (is_current_job === 'Current')
                                    const aCurrent = a.is_current_job === 'Current';
                                    const bCurrent = b.is_current_job === 'Current';
                                    if (aCurrent && !bCurrent) return -1;
                                    if (!aCurrent && bCurrent) return 1;

                                    // 2. start_date descending (newest first)
                                    const aDate = parseAnyDate(a.start_date)?.getTime() || 0;
                                    const bDate = parseAnyDate(b.start_date)?.getTime() || 0;
                                    return bDate - aDate;
                                })
                                .map((exp: any, i: number) => {
                                    const isCurrent = exp.is_current_job === 'Current';
                                    return (
                                        <div key={i} className="relative group">
                                            {/* Timeline Dot — filled blue if Current, grey otherwise */}
                                            <div className={`absolute -left-[2.6rem] top-1.5 h-4 w-4 rounded-full border-2 border-background shadow-sm ${isCurrent ? 'bg-primary ring-4 ring-primary/10' : 'bg-muted-foreground/30'
                                                }`} />

                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-foreground text-lg">{exp.position}</h3>
                                                        <SetCurrentExperienceButton
                                                            experienceId={exp.id}
                                                            candidateId={candidate.candidate_id}
                                                            isCurrent={isCurrent}
                                                        />
                                                    </div>
                                                    <div className="text-primary font-semibold text-base">{exp.company}</div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1 font-medium">
                                                        <MapPin className="h-3 w-3" /> {exp.country || "No Location"}
                                                        {/* Visual separator */}
                                                        <span className="text-border">|</span>
                                                        {exp.company_industry && <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px] border border-border">{exp.company_industry}</span>}
                                                    </div>
                                                    {exp.description && <p className="text-sm text-foreground/70 mt-3 p-3 bg-muted/30 rounded-lg border border-border/50">{exp.description}</p>}
                                                </div>
                                                <div className="text-right flex flex-col items-end gap-2 pl-4">
                                                    <Badge variant={isCurrent ? "default" : "secondary"} className="font-mono text-xs shadow-none border border-border/50">
                                                        {formatMonthYear(exp.start_date)} - {exp.is_current_job === 'Current' ? "Present" : formatMonthYear(exp.end_date)}
                                                    </Badge>
                                                    <div className="flex items-center gap-1">
                                                        <EditExperienceDialog experience={exp} candidateId={candidate.candidate_id} />
                                                        <DeleteExperienceButton id={exp.id} candidateId={candidate.candidate_id} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            {(!candidate.experiences || candidate.experiences.length === 0) && (
                                <div className="text-center py-8">
                                    <Briefcase className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-muted-foreground text-sm">No experience record found.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Education (Enhanced) */}
                    <Card className="border shadow-sm bg-card overflow-hidden">
                        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                                <span className="p-2 rounded-lg bg-purple-100 text-purple-600"><GraduationCap className="h-5 w-5" /></span> Education
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {enhance.education_summary ? (
                                <div className="bg-secondary/10 p-4 rounded-lg border border-border/60">
                                    <p className="text-sm text-foreground whitespace-pre-wrap">{enhance.education_summary}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No education summary available.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Compensation & Benefits */}
                    <Card className="border shadow-sm bg-card overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between border-b bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                                <span className="p-2 rounded-lg bg-emerald-100 text-emerald-600"><DollarSign className="h-5 w-5" /></span> Compensation & Benefits
                            </CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.location.href = `/candidates/${candidate.candidate_id}/edit`}
                                className="h-8 gap-2 text-muted-foreground hover:text-primary shadow-sm"
                            >
                                <Edit className="h-3.5 w-3.5" /> Edit
                            </Button>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {(candidate.gross_salary_base_b_mth || candidate.other_income || candidate.bonus_mth || candidate.car_allowance_b_mth || candidate.medical_b_annual || candidate.provident_fund_pct || candidate.gasoline_b_mth || candidate.phone_b_mth || candidate.insurance || candidate.housing_for_expat_b_mth || candidate.others_benefit) ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Gross Salary (฿/mth)</p>
                                        <p className="font-bold text-base text-emerald-700">{candidate.gross_salary_base_b_mth || "-"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Performance Bonus</p>
                                        <p className="font-semibold text-foreground/80">{candidate.bonus_mth ? `${candidate.bonus_mth} Months` : "-"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Other Income</p>
                                        <p className="font-semibold text-foreground/80">{candidate.other_income || "-"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Car Allowance (฿/mth)</p>
                                        <p className="font-semibold text-foreground/80">{candidate.car_allowance_b_mth || "-"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Gasoline (฿/mth)</p>
                                        <p className="font-semibold text-foreground/80">{candidate.gasoline_b_mth || "-"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Phone Allowance (฿/mth)</p>
                                        <p className="font-semibold text-foreground/80">{candidate.phone_b_mth || "-"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Provident Fund (%)</p>
                                        <p className="font-semibold text-foreground/80">{candidate.provident_fund_pct || "-"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Medical (Annual/Mth)</p>
                                        <p className="font-semibold text-foreground/80">{[candidate.medical_b_annual, candidate.medical_b_mth].filter(Boolean).join(" / ") || "-"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Insurance</p>
                                        <p className="font-semibold text-foreground/80">{candidate.insurance || "-"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Housing / Expat</p>
                                        <p className="font-semibold text-foreground/80">{candidate.housing_for_expat_b_mth || "-"}</p>
                                    </div>
                                    <div className="space-y-1.5 md:col-span-2">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Other Benefits</p>
                                        <p className="font-semibold text-foreground/80">{candidate.others_benefit || "-"}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-sm text-muted-foreground italic mb-4">No compensation details available.</p>
                                    <Button variant="outline" size="sm" onClick={() => window.location.href = `/candidates/${candidate.candidate_id}/edit`}>
                                        <Plus className="h-4 w-4 mr-2" /> Add Details
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>


                    {/* Job Requisition Applied */}
                    <Card className="border shadow-sm bg-card overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b px-6 py-4">
                            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                                <span className="p-2 rounded-lg bg-amber-100 text-amber-600"><Briefcase className="h-5 w-5" /></span> Job Applications
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {candidate.jobHistory && candidate.jobHistory.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/40 border-b text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                            <tr>
                                                <th className="h-10 px-4 text-left w-[100px]">JR ID</th>
                                                <th className="h-10 px-4 text-left">Position</th>
                                                <th className="h-10 px-4 text-left">Details</th>
                                                <th className="h-10 px-4 text-center">Status</th>
                                                <th className="h-10 px-4 text-left">Updated</th>
                                                <th className="h-10 px-4 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {candidate.jobHistory.map((job: any, i: number) => {
                                                const statusLabel = job.latest_status || job.status || "Applied";
                                                const statusDate = job.status_date ? new Date(job.status_date).toLocaleDateString() : "-";

                                                return (
                                                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                                                        <td className="p-4">
                                                            <Link
                                                                href={`/requisitions/manage?jr_id=${job.jr_id}`}
                                                                className="font-bold text-primary hover:underline"
                                                            >
                                                                {job.jr_id}
                                                            </Link>
                                                        </td>
                                                        <td className="p-4 font-medium text-foreground">{job.position_jr}</td>
                                                        <td className="p-4 text-xs text-muted-foreground">
                                                            {job.bu && <div><span className="font-semibold text-foreground/70">BU:</span> {job.bu}</div>}
                                                            <div className="mt-0.5">Rank: {job.rank || "-"}</div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <Badge variant="outline" className="font-normal">{statusLabel}</Badge>
                                                        </td>
                                                        <td className="p-4 text-xs text-muted-foreground">{statusDate}</td>
                                                        <td className="p-4 text-center">
                                                            <JobStatusDetailDialog log={job} status={statusLabel} date={statusDate} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">No job applications found.</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Pre-Screen Logs (Enhanced) */}
                    <Card id="pre-screen-logs" className="border shadow-sm bg-card">
                        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
                            <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Pre-Screen Logs</CardTitle>
                            <AddPrescreenDialog candidateId={candidate.candidate_id} />
                        </CardHeader>
                        <CardContent className="pt-6">
                            {candidate.prescreenLogs && candidate.prescreenLogs.length > 0 ? (
                                <div className="grid gap-4">
                                    {candidate.prescreenLogs.map((log: any, i: number) => (
                                        <PrescreenLogEntry 
                                            key={log.pre_screen_id || i} 
                                            log={log} 
                                            candidateId={candidate.candidate_id} 
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 border-2 border-dashed rounded-lg border-muted">
                                    <div className="h-12 w-12 bg-muted/50 rounded-full flex items-center justify-center">
                                        <FileText className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm font-medium text-muted-foreground">No pre-screen logs yet</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* System Data */}
                    <div className="grid grid-cols-2 gap-4 opacity-70 hover:opacity-100 transition-opacity">
                        <div className="p-4 border rounded-lg bg-muted/10 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Created</p>
                            <p className="font-mono text-xs text-foreground/70">{new Date(candidate.created_date).toLocaleDateString()}</p>
                        </div>
                        <div className="p-4 border rounded-lg bg-muted/10 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Last Modified</p>
                            <p className="font-mono text-xs text-foreground/70">{new Date(candidate.modify_date).toLocaleDateString()}</p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

function PrescreenLogEntry({ log, candidateId }: { log: any, candidateId: string }) {
    const [expanded, setExpanded] = React.useState(false);
    const isLongText = log.feedback_text?.length > 300;

    return (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground">{log.screener_Name || "Unknown Screener"}</p>
                            {log.rating_score && (
                                <Badge className={log.rating_score >= 8 ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-secondary text-secondary-foreground"}>
                                    Score: {log.rating_score}/10
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">{log.screening_date ? formatDateForDisplay(log.screening_date) : "No Date"}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {log.feedback_file && (
                        <a href={log.feedback_file} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
                                <FileText className="h-3.5 w-3.5" />
                            </Button>
                        </a>
                    )}
                    <EditPrescreenDialog candidateId={candidateId} log={log} />
                    <DeletePrescreenButton logId={log.pre_screen_id} candidateId={candidateId} />
                </div>
            </div>
            <div className={cn(
                "text-sm text-foreground/80 whitespace-pre-wrap p-3 bg-muted/20 rounded-md border border-border/30 relative",
                !expanded && isLongText && "max-h-[120px] overflow-hidden"
            )}>
                {log.feedback_text || "No feedback recorded."}
                {!expanded && isLongText && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted/50 to-transparent pointer-events-none" />
                )}
            </div>
            {isLongText && (
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-2 text-[10px] h-6 font-bold text-indigo-500 hover:text-indigo-600 p-0"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? "Show Less" : "View More"}
                </Button>
            )}
        </div>
    );
}

