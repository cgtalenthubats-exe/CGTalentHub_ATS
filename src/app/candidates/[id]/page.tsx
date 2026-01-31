"use client";

import React, { useEffect, useState } from "react";
import {
    Mail, Phone, MapPin, Calendar, Download, Edit,
    Briefcase, GraduationCap, Globe,
    FileText, CheckCircle2, AlertCircle, UploadCloud, ChevronLeft, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { BackButton, EditButton, AddPrescreenDialog } from "@/components/candidate-client-actions";
import { AddExperienceDialog, DeleteExperienceButton } from "@/components/experience-dialog";
import { JobStatusDetailDialog } from "@/components/job-status-dialog";
import { Checkbox } from "@/components/ui/checkbox"; // Added for completeness if needed elsewhere

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
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchCandidate();
    }, [id]);

    if (loading) return <div className="p-8 text-center">Loading candidate profile...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    if (!candidate) return <div className="p-8 text-center">Candidate not found</div>;

    const enhance = candidate.enhancement || {};

    return (
        <div className="container mx-auto max-w-6xl py-8 space-y-8 animate-in fade-in duration-500">

            {/* --- TOP BAR --- */}
            <div className="flex items-center justify-between mb-2">
                <BackButton />
                <div className="text-xs font-mono text-muted-foreground opacity-50">ID: {candidate.candidate_id}</div>
            </div>

            {/* --- HEADER HERO --- */}
            <div className="relative rounded-2xl overflow-hidden bg-card border shadow-sm group">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/5 opacity-50" />

                <div className="relative p-8 flex flex-col md:flex-row gap-8 items-start md:items-center">
                    <Avatar className="h-32 w-32 border-4 border-background shadow-xl ring-4 ring-primary/10">
                        <AvatarImage src={candidate.photo} className="object-cover" />
                        <AvatarFallback className="text-4xl font-bold bg-primary/20 text-primary">
                            {candidate.name?.substring(0, 2)?.toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 space-y-3">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold tracking-tight text-foreground">{candidate.name}</h1>
                                {candidate.candidate_status && (
                                    <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20 uppercase tracking-widest text-[10px]">
                                        {candidate.candidate_status}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-2xl font-mono font-bold text-muted-foreground/40 tracking-tight">#{candidate.candidate_id}</span>
                            </div>
                            <p className="text-xl text-muted-foreground font-medium mt-1">
                                {candidate.experiences?.[0]?.position || "No active position"}
                                <span className="text-muted-foreground/50 mx-2">at</span>
                                <span className="text-primary">{candidate.experiences?.[0]?.company_name_text || candidate.experiences?.[0]?.company || "Unknown Company"}</span>
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary/70" /> {candidate.nationality || "N/A"}</div>
                            <div className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-primary/70" /> {candidate.age ? `${candidate.age} Years` : "N/A"}</div>
                            <div className="flex items-center gap-1.5"><Briefcase className="h-4 w-4 text-primary/70" /> {candidate.total_years_exp ? `${candidate.total_years_exp} Years Exp` : "Exp N/A"}</div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 items-end">
                        <div className="flex gap-2">
                            <Button variant="outline" className="gap-2">
                                <Download className="h-4 w-4" /> Download Resume
                            </Button>
                            <EditButton id={candidate.candidate_id} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">

                {/* --- LEFT SIDEBAR (Info) --- */}
                <div className="col-span-12 md:col-span-4 space-y-6">
                    {/* Contact Card */}
                    <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
                        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-primary" /> Contact Info</CardTitle></CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="group flex items-center gap-3 p-2 hover:bg-accent rounded-lg transition-colors">
                                <div className="p-2 rounded-full bg-primary/10 text-primary"><Mail className="h-4 w-4" /></div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-xs text-muted-foreground font-medium">Email</p>
                                    <p className="truncate font-medium">{candidate.email}</p>
                                </div>
                            </div>

                            {enhance.alt_email && enhance.alt_email !== candidate.email && (
                                <div className="group flex items-center gap-3 p-2 hover:bg-accent rounded-lg transition-colors">
                                    <div className="p-2 rounded-full bg-orange-500/10 text-orange-600"><Mail className="h-4 w-4" /></div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs text-muted-foreground font-medium">Alt. Email</p>
                                        <p className="truncate font-medium">{enhance.alt_email}</p>
                                    </div>
                                </div>
                            )}

                            <div className="group flex items-center gap-3 p-2 hover:bg-accent rounded-lg transition-colors">
                                <div className="p-2 rounded-full bg-green-500/10 text-green-600"><Phone className="h-4 w-4" /></div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-xs text-muted-foreground font-medium">Phone</p>
                                    <p className="truncate font-medium">{candidate.mobile_phone || "N/A"}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Resume Upload / Documents */}
                    <Card className="border shadow-none bg-background">
                        <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Attached Resume</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            {candidate.documents && candidate.documents.length > 0 ? (
                                candidate.documents.map((doc: any, i: number) => (
                                    <div key={i} className="flex items-center gap-4 group">
                                        <div className="h-10 w-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="text-sm font-medium truncate" title={doc.document_name}>{doc.document_name}</p>
                                            <p className="text-xs text-muted-foreground">{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "Unknown date"}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity"><Download className="h-4 w-4 text-muted-foreground" /></Button>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-4 border-2 border-dashed rounded-lg border-muted">
                                    <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                                    <span className="text-xs text-muted-foreground">No resume attached</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Skills (Enhanced) */}
                    {enhance.skills_list && (
                        <Card className="border-none shadow-md">
                            <CardHeader><CardTitle className="text-lg">Skills</CardTitle></CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {typeof enhance.skills_list === 'string'
                                        ? enhance.skills_list.split(',').map((s: string) => <Badge key={s} variant="secondary">{s.trim()}</Badge>)
                                        : Array.isArray(enhance.skills_list)
                                            ? enhance.skills_list.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)
                                            : <p className="text-sm text-muted-foreground">No specific skills listed.</p>
                                    }
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Languages (New) */}
                    {enhance.languages && (
                        <Card className="border-none shadow-md">
                            <CardHeader><CardTitle className="text-lg">Languages</CardTitle></CardHeader>
                            <CardContent>
                                <div className="flex flex-col gap-2">
                                    {typeof enhance.languages === 'string'
                                        ? enhance.languages.split(',').map((s: string) => (
                                            <div key={s} className="flex items-center justify-between text-sm">
                                                <span>{s.trim()}</span>
                                            </div>
                                        ))
                                        : <p className="text-sm text-muted-foreground">{enhance.languages}</p>
                                    }
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* --- MAIN CONTENT --- */}
                <div className="col-span-12 md:col-span-8 space-y-6">

                    {/* About Section */}
                    {enhance.about && (
                        <Card className="border-none shadow-sm">
                            <CardHeader className="pb-2"><CardTitle className="text-lg">About</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{enhance.about}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Experience Timeline */}
                    <Card className="border-none shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> Experience</CardTitle>
                            <AddExperienceDialog candidateId={candidate.candidate_id} />
                        </CardHeader>
                        <CardContent className="relative pl-6 border-l-2 border-border/50 ml-6 space-y-8 pb-10">
                            {candidate.experiences?.map((exp: any, i: number) => (
                                <div key={i} className="relative group">
                                    {/* Timeline Dot */}
                                    <div className={`absolute -left-[2.1rem] top-1 h-4 w-4 rounded-full border-2 border-background ${i === 0 ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted-foreground/30'}`} />

                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-foreground text-lg">{exp.position}</h3>
                                            <div className="text-primary font-medium">{exp.company_name_text || exp.company}</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                                <MapPin className="h-3 w-3" /> {exp.country}
                                                {exp.company_industry && <span className="px-1.5 py-0.5 rounded-full bg-secondary text-[10px]">{exp.company_industry}</span>}
                                            </div>
                                            {exp.description && <p className="text-sm text-muted-foreground mt-2">{exp.description}</p>}
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-2">
                                            <Badge variant={i === 0 ? "default" : "secondary"} className="font-mono text-xs">
                                                {exp.start_date} - {exp.end_date || "Present"}
                                            </Badge>
                                            <DeleteExperienceButton id={exp.experience_id} candidateId={candidate.candidate_id} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!candidate.experiences || candidate.experiences.length === 0) && (
                                <p className="text-muted-foreground text-sm italic">No experience record found. Add one above.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Education (Enhanced) */}
                    <Card className="border-none shadow-md">
                        <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" /> Education</CardTitle></CardHeader>
                        <CardContent>
                            {enhance.education_summary ? (
                                <div className="bg-secondary/20 p-4 rounded-lg border border-border/50">
                                    <p className="text-sm text-foreground whitespace-pre-wrap">{enhance.education_summary}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No education summary available.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Job Requisition Applied - Redesigned Table */}
                    <Card className="border-none shadow-md overflow-hidden">
                        <CardHeader className="bg-muted/30"><CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> Job Requisitions Applied</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            {candidate.jobHistory && candidate.jobHistory.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 border-b">
                                            <tr>
                                                <th className="h-10 px-4 text-left font-semibold text-muted-foreground w-[100px]">JR ID</th>
                                                <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Position</th>
                                                <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Info</th>
                                                <th className="h-10 px-4 text-left font-semibold text-muted-foreground">List Type</th>
                                                <th className="h-10 px-4 text-center font-semibold text-muted-foreground">Rank</th>
                                                <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Latest Status</th>
                                                <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Status Date</th>
                                                <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {candidate.jobHistory.map((job: any, i: number) => {
                                                const statusDate = job.status_date ? new Date(job.status_date).toLocaleDateString() : (job.time_stamp ? new Date(job.time_stamp).toLocaleDateString() : "-");
                                                const statusLabel = job.latest_status || job.status || "Applied";

                                                return (
                                                    <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors group">
                                                        <td className="p-4 font-medium text-primary cursor-pointer hover:underline">{job.jr_id}</td>
                                                        <td className="p-4 font-medium">
                                                            <div>{job.position_jr}</div>
                                                        </td>
                                                        <td className="p-4 text-xs text-muted-foreground">
                                                            {job.bu && <div><span className="font-semibold">BU:</span> {job.bu}</div>}
                                                            {job.sub_bu && <div><span className="font-semibold">Sub:</span> {job.sub_bu}</div>}
                                                        </td>
                                                        <td className="p-4 text-muted-foreground">{job.list_type || "-"}</td>
                                                        <td className="p-4 text-center">{job.rank ? <Badge variant="outline">{job.rank}</Badge> : "-"}</td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="secondary" className="w-fit">{statusLabel}</Badge>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-muted-foreground text-xs whitespace-nowrap">
                                                            {statusDate}
                                                        </td>
                                                        <td className="p-4">
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
                    <Card className="border-none shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Pre-Screen Logs</CardTitle>
                            <AddPrescreenDialog candidateId={candidate.candidate_id} />
                        </CardHeader>
                        <CardContent>
                            {/* Inputs for New Log (Mockup/Visual) */}
                            {/*
                            <div className="mb-6 p-4 border rounded-lg bg-muted/20 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label>Screener Name</Label>
                                        <Input placeholder="Enter name" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Date</Label>
                                        <Input type="date" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label>Feedback</Label>
                                    <div className="border rounded-md p-2 bg-background min-h-[100px] text-sm text-muted-foreground">
                                        Target for Rich Text Editor...
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label>Feedback File (PDF)</Label>
                                    <Input type="file" accept=".pdf" />
                                </div>
                                <Button size="sm">Save Log</Button>
                            </div> 
                            */}

                            {candidate.prescreenLogs && candidate.prescreenLogs.length > 0 ? (
                                <div className="space-y-4">
                                    {candidate.prescreenLogs.map((log: any, i: number) => (
                                        <div key={i} className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                                            {log.screener_name ? log.screener_name.substring(0, 2).toUpperCase() : "SC"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-medium">{log.screener_name || "Unknown Screener"}</p>
                                                        <p className="text-xs text-muted-foreground">{log.screening_date || "No Date"}</p>
                                                    </div>
                                                </div>
                                                {log.rating_score && (
                                                    <Badge variant={log.rating_score >= 8 ? "default" : "secondary"}>
                                                        Score: {log.rating_score}/10
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Feedback Text - Render as HTML if possible or whitespace-pre-wrap */}
                                            <div className="text-sm text-foreground whitespace-pre-wrap p-3 bg-muted/10 rounded-md border border-border/50">
                                                {log.feedback_text || "No feedback recorded."}
                                            </div>

                                            {log.feedback_file && (
                                                <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 p-2 rounded-md w-fit cursor-pointer hover:bg-primary/10 transition-colors">
                                                    <FileText className="h-3 w-3" />
                                                    <span className="truncate max-w-[200px]">{log.feedback_file}</span>
                                                    <Download className="h-3 w-3 ml-1" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-center space-y-3 border-2 border-dashed rounded-lg border-muted-foreground/20">
                                    <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
                                        <FileText className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">No pre-screen logs yet</p>
                                        <p className="text-xs text-muted-foreground/70">Add a new log to track screening progress.</p>
                                    </div>
                                    <Button variant="outline" size="sm" className="h-8">
                                        Add First Log
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* System Data */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="border-none bg-secondary/10">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Created Date</p>
                                <p className="font-mono text-sm">{new Date(candidate.created_date).toLocaleDateString()}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-none bg-secondary/10">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Last Modified</p>
                                <p className="font-mono text-sm">{new Date(candidate.modify_date).toLocaleDateString()}</p>
                            </CardContent>
                        </Card>
                    </div>

                </div>
            </div>
        </div>
    );
}
