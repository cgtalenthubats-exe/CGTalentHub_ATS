"use client";

import { useEffect, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Loader2, Mail, Phone, Globe, MapPin, GraduationCap,
    ExternalLink, AlertCircle, Trash2, Edit3, Download,
} from "lucide-react";
import { cn, formatNumberWithCommas } from "@/lib/utils";
import { formatMonthYear } from "@/lib/date-utils";
import { CandidateAvatar } from "@/components/candidate-avatar";
import {
    AddExperienceDialog, EditExperienceDialog,
    DeleteExperienceButton, SetCurrentExperienceButton,
} from "@/components/experience-dialog";
import { bulkDeleteExperiences } from "@/app/actions/candidate";
import { CandidateEditSheet } from "@/components/candidate-edit-sheet";
import { StatusSelect } from "@/components/ui/status-select";
import { RefreshProfileButton } from "@/components/candidate-client-actions";

interface Props {
    candidateId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const GENDER_OPTIONS = ['Male', 'Female', 'N/A'];

function QuickEditBar({ data, onSave }: { data: any; onSave: (fields: Record<string, any>) => Promise<void> }) {
    const [linkedin, setLinkedin] = useState(data?.linkedin || '');
    const [age, setAge] = useState(String(data?.age || ''));
    const [gender, setGender] = useState(data?.gender || '');
    const [statuses, setStatuses] = useState<string[]>(data?.candidate_status || []);
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        setLinkedin(data?.linkedin || '');
        setAge(String(data?.age || ''));
        setGender(data?.gender || '');
        setStatuses(data?.candidate_status || []);
    }, [data]);

    const save = async (field: string, value: any) => {
        setSaving(field);
        await onSave({ [field]: value });
        setSaving(null);
    };

    return (
        <div className="bg-gradient-to-r from-indigo-50/60 to-slate-50/60 rounded-2xl p-5 ring-1 ring-indigo-100/60 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
                <Edit3 className="h-3 w-3" /> Quick Edit
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* LinkedIn */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">LinkedIn URL</label>
                    <div className="flex gap-2">
                        <input
                            value={linkedin}
                            onChange={e => setLinkedin(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') save('linkedin', linkedin); }}
                            placeholder="linkedin.com/in/..."
                            className="flex-1 h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                        <Button size="sm" variant="outline" className="h-8 px-3 text-xs font-black"
                            disabled={saving === 'linkedin'}
                            onClick={() => save('linkedin', linkedin)}>
                            {saving === 'linkedin' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                        </Button>
                    </div>
                </div>
                {/* Gender */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gender</label>
                    <select
                        value={gender}
                        onChange={e => { setGender(e.target.value); save('gender', e.target.value); }}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                        <option value="">— Select —</option>
                        {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
                {/* Age */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Age (manual override)</label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={age}
                            onChange={e => setAge(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') save('age', parseInt(age) || null); }}
                            placeholder="e.g. 45"
                            className="flex-1 h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                        <Button size="sm" variant="outline" className="h-8 px-3 text-xs font-black"
                            disabled={saving === 'age'}
                            onClick={() => save('age', parseInt(age) || null)}>
                            {saving === 'age' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                        </Button>
                    </div>
                </div>
                {/* Remark / candidate_status */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Remark (Status Tags)</label>
                    <div className="flex items-center gap-2">
                        <StatusSelect
                            value={statuses}
                            onChange={(next) => { setStatuses(next); save('candidate_status', next); }}
                            className="h-8 text-xs bg-white"
                            disabled={saving === 'candidate_status'}
                        />
                        {saving === 'candidate_status' && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400 flex-shrink-0" />}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function CandidatePreviewSheet({ candidateId, open, onOpenChange }: Props) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [selectedExpIds, setSelectedExpIds] = useState<string[]>([]);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const fetchData = useCallback(async (id: string, silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await fetch(`/api/candidates/${id}`);
            const json = await res.json();
            setData(json.data ?? json);
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open || !candidateId) { setData(null); return; }
        fetchData(candidateId);
    }, [open, candidateId, fetchData]);

    const handleRefresh = () => { if (candidateId) fetchData(candidateId, true); };

    const patchCandidate = async (fields: Record<string, any>) => {
        if (!candidateId) return;
        await fetch(`/api/candidates/${candidateId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields),
        });
        handleRefresh();
    };

    const enhance: any = data?.enhancement ?? {};

    const sortedExps = [...(data?.experiences ?? [])].sort((a, b) => {
        const aCurr = a.is_current_job === 'Current' || a.end_date?.toLowerCase() === 'present';
        const bCurr = b.is_current_job === 'Current' || b.end_date?.toLowerCase() === 'present';
        if (aCurr !== bCurr) return aCurr ? -1 : 1;
        const parseDate = (d: string) => {
            if (!d) return 0;
            const p = d.split('-');
            return p.length === 2 ? parseInt(p[1]) * 100 + parseInt(p[0]) : new Date(d).getTime() || 0;
        };
        return parseDate(b.start_date) - parseDate(a.start_date);
    });

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent
                    side="right"
                    className="w-full sm:max-w-[850px] p-0 overflow-hidden flex flex-col bg-[#f8fafc] border-l shadow-2xl"
                >
                    <SheetHeader className="sr-only">
                        <SheetTitle>{data?.name ?? 'Candidate Profile'}</SheetTitle>
                    </SheetHeader>

                    {/* ── Header ──────────────────────────────────────────────── */}
                    <div className="z-20 bg-white border-b shadow-sm px-8 py-6 flex-shrink-0">
                        {loading || !data ? (
                            <div className="flex items-center gap-4 py-2">
                                <div className="h-16 w-16 rounded-full bg-slate-100 animate-pulse" />
                                <div className="space-y-2">
                                    <div className="h-5 w-48 bg-slate-100 animate-pulse rounded" />
                                    <div className="h-3 w-32 bg-slate-100 animate-pulse rounded" />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-5">
                                    <CandidateAvatar
                                        src={data.photo}
                                        name={data.name}
                                        className="h-16 w-16 border-4 border-white shadow-xl ring-2 ring-indigo-50"
                                        fallbackClassName="text-xl"
                                    />
                                    <div className="flex flex-col gap-1.5">
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none flex items-center gap-2">
                                            {data.name}
                                            {data.linkedin && (
                                                <a href={data.linkedin} target="_blank" rel="noreferrer" className="text-slate-300 hover:text-indigo-600 transition-colors">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            )}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline" className="font-mono text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border-indigo-100">
                                                {data.candidate_id}
                                            </Badge>
                                            {data.candidate_status?.map((s: string) => (
                                                <Badge key={s} variant="outline" className={cn(
                                                    "text-[10px] font-black uppercase tracking-widest",
                                                    s === 'Internal Candidate' ? "text-indigo-700 border-indigo-300 bg-indigo-50" :
                                                    s === 'Ex-Central' ? "text-slate-600 border-slate-300 bg-slate-50" :
                                                    s === 'Blacklist' ? "text-rose-700 border-rose-200 bg-rose-100" :
                                                    s === 'Over-aged' ? "text-orange-700 border-orange-200 bg-orange-100" :
                                                    "text-emerald-700 border-emerald-200 bg-emerald-100"
                                                )}>{s}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Button variant="outline" size="sm" className="h-9 gap-2 font-bold shadow-sm border-slate-200 text-slate-600 hover:bg-slate-50"
                                        onClick={() => setIsEditOpen(true)}>
                                        <Edit3 className="h-4 w-4" /> Edit Profile
                                    </Button>
                                    {data.resume_url && (
                                        <a href={data.resume_url} target="_blank" rel="noreferrer">
                                            <Button variant="outline" size="sm" className="h-9 gap-2 font-bold shadow-sm border-indigo-100 text-indigo-600 hover:bg-indigo-50">
                                                <Download className="h-4 w-4" /> Resume
                                            </Button>
                                        </a>
                                    )}
                                    <a href={`/candidates/${candidateId}`} target="_blank" rel="noreferrer">
                                        <Button variant="outline" size="sm" className="h-9 px-3 font-bold border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/50">
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Body ────────────────────────────────────────────────── */}
                    {!loading && data && (
                        <div className="flex-1 overflow-y-auto p-8 space-y-8">

                            {/* Quick Edit Bar */}
                            <QuickEditBar data={data} onSave={patchCandidate} />

                            {/* Contact Intel Ribbon */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-slate-100 flex flex-wrap gap-8 items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 shadow-sm"><Mail className="h-5 w-5" /></div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Email Address</span>
                                        <span className="text-sm font-bold text-slate-700">{data.email || "N/A"}</span>
                                        {enhance?.alt_email && enhance.alt_email !== data.email && (
                                            <span className="text-[10px] font-bold text-slate-400">Alt: {enhance.alt_email}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="h-10 w-px bg-slate-100 hidden md:block" />
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 shadow-sm"><Phone className="h-5 w-5" /></div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Mobile Phone</span>
                                        <span className="text-sm font-bold text-slate-700">{data.mobile_phone || "N/A"}</span>
                                    </div>
                                </div>
                                <div className="h-10 w-px bg-slate-100 hidden md:block" />
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 shadow-sm"><Globe className="h-5 w-5" /></div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Candidate Intel</span>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-black text-indigo-500 uppercase tracking-tight">Nationality:</span>
                                                <span className="text-sm font-bold text-slate-700">{data.nationality || "N/A"}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                                                <span className={cn("text-[11px] font-black uppercase tracking-tight", data.age_source === 'estimated' ? "text-red-500" : "text-purple-500")}>Age:</span>
                                                <span className={cn("text-sm font-bold", data.age_source === 'estimated' ? "text-red-500" : "text-slate-700")}>
                                                    {data.age ? `${data.age} Years${data.age_source === 'dob' ? ' - DoB' : ''}` : 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {(enhance?.country || enhance?.full_address) && (
                                    <>
                                        <div className="h-10 w-px bg-slate-100 hidden lg:block" />
                                        <div className="flex items-center gap-4 min-w-0 flex-1">
                                            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 shadow-sm flex-shrink-0"><MapPin className="h-5 w-5" /></div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Address from LI</span>
                                                <span className="text-sm font-bold text-slate-700 truncate">
                                                    {[enhance?.country, enhance?.full_address].filter(Boolean).join(", ")}
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                )}
                                {data.blacklist_note && data.blacklist_note !== 'null' && (
                                    <div className="flex items-center gap-4 bg-rose-50 px-4 py-2 rounded-xl ring-1 ring-rose-100 w-full">
                                        <div className="p-1.5 bg-rose-500 rounded-lg text-white shadow-sm"><AlertCircle className="h-4 w-4" /></div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] uppercase font-black text-rose-500 tracking-widest">Blacklist Alert</span>
                                            <span className="text-[11px] font-bold text-rose-700 leading-tight">{data.blacklist_note}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Professional Summary */}
                            {enhance?.about && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Professional Summary</h3>
                                    <p className="text-[15px] leading-relaxed text-slate-700 font-medium bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-100 whitespace-pre-line">
                                        {enhance.about}
                                    </p>
                                </div>
                            )}

                            {/* Work Experience */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Work Experience</h3>
                                    <div className="flex items-center gap-2">
                                        {selectedExpIds.length > 0 && (
                                            <Button size="sm" variant="destructive" className="h-7 px-3 text-[11px] font-black gap-1.5"
                                                disabled={isDeletingBulk}
                                                onClick={async () => {
                                                    if (!confirm(`Delete ${selectedExpIds.length} experience(s)? This cannot be undone.`)) return;
                                                    setIsDeletingBulk(true);
                                                    await bulkDeleteExperiences(selectedExpIds, candidateId!);
                                                    setSelectedExpIds([]);
                                                    setIsDeletingBulk(false);
                                                    handleRefresh();
                                                }}>
                                                {isDeletingBulk ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                                Delete {selectedExpIds.length} selected
                                            </Button>
                                        )}
                                        <AddExperienceDialog candidateId={candidateId!} onSuccess={handleRefresh} />
                                    </div>
                                </div>
                                <div className="relative border-l-2 border-slate-100 ml-4 pl-8 space-y-10 py-4">
                                    {sortedExps.length > 0 ? sortedExps.map((exp: any, i: number) => {
                                        const isCurrent = exp.is_current_job === 'Current' || exp.end_date?.toLowerCase() === 'present';
                                        const isSelected = selectedExpIds.includes(exp.id);
                                        return (
                                            <div key={i} className={cn("relative group", isSelected && "opacity-70")}>
                                                <div className={cn(
                                                    "absolute -left-[2.6rem] top-1.5 h-4 w-4 rounded-full border-4 border-white shadow-md ring-2 ring-slate-100",
                                                    isCurrent ? "bg-indigo-600 scale-125 ring-indigo-50" : "bg-slate-300"
                                                )} />
                                                <div className={cn(
                                                    "absolute -left-[3.8rem] top-1 transition-opacity",
                                                    selectedExpIds.length > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                                )}>
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={(checked) =>
                                                            setSelectedExpIds(prev => checked ? [...prev, exp.id] : prev.filter(id => id !== exp.id))
                                                        }
                                                        className="h-4 w-4 border-slate-300"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex items-center gap-3">
                                                            <h4 className="text-base font-black text-slate-900 tracking-tight">{exp.position}</h4>
                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                                <EditExperienceDialog experience={exp} candidateId={candidateId!} onSuccess={handleRefresh} />
                                                                <DeleteExperienceButton id={exp.id} candidateId={candidateId!} onSuccess={handleRefresh} />
                                                            </div>
                                                        </div>
                                                        <span className={cn(
                                                            "text-[11px] font-black font-mono px-2 py-0.5 rounded shadow-sm",
                                                            isCurrent ? "bg-indigo-600 text-white border-indigo-600" : "text-slate-400 bg-slate-50 border-slate-100 border"
                                                        )}>
                                                            {formatMonthYear(exp.start_date)} — {isCurrent ? "Present" : formatMonthYear(exp.end_date)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <p className="text-sm font-black text-indigo-600 tracking-tight uppercase">{exp.company}</p>
                                                        <SetCurrentExperienceButton
                                                            experienceId={exp.id}
                                                            candidateId={candidateId!}
                                                            isCurrent={isCurrent}
                                                            onSuccess={handleRefresh}
                                                        />
                                                    </div>
                                                    {exp.description && (
                                                        <p className="text-sm text-slate-500 font-medium leading-relaxed mt-2 p-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                                            {exp.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }) : (
                                        <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed text-slate-400 font-bold text-sm">
                                            No experience records available.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Skills & Languages */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {enhance?.skills && (
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Technical Expertise</h3>
                                        <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-100 flex flex-wrap gap-2">
                                            {(typeof enhance.skills === 'string' ? enhance.skills.split(',') : enhance.skills).map((s: string) => (
                                                <Badge key={s} variant="secondary" className="bg-slate-50 text-slate-600 border-none font-bold text-[10px] uppercase py-1 px-3 rounded-lg">
                                                    {s.trim()}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {enhance?.languages && (
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Linguistic Proficiency</h3>
                                        <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-100 space-y-2">
                                            {(typeof enhance.languages === 'string' ? enhance.languages.split(',') : enhance.languages).map((l: string) => (
                                                <div key={l} className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                                                    {l.trim()}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Education */}
                            {enhance?.education_summary && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Academic Background</h3>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-100 flex gap-4 items-start">
                                        <div className="p-3 bg-purple-50 rounded-xl text-purple-600 shadow-sm"><GraduationCap className="h-6 w-6" /></div>
                                        <p className="text-sm leading-relaxed text-slate-600 font-medium whitespace-pre-wrap">{enhance.education_summary}</p>
                                    </div>
                                </div>
                            )}

                            {/* Compensation Grid */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Financial Profile & Benefits</h3>
                                <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100/50">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5 text-sm">
                                        {[
                                            { label: "Salary (฿/M)", value: data.gross_salary_base_b_mth ? `฿${formatNumberWithCommas(data.gross_salary_base_b_mth)}` : "-", className: "text-emerald-600" },
                                            { label: "Bonus (m)", value: data.bonus_mth ? `${data.bonus_mth} m` : "-" },
                                            { label: "Other Inc.", value: data.other_income || "-" },
                                            { label: "Car (฿/M)", value: data.car_allowance_b_mth ? `฿${formatNumberWithCommas(data.car_allowance_b_mth)}` : "-" },
                                            { label: "Gas (฿/M)", value: data.gasoline_b_mth ? `฿${formatNumberWithCommas(data.gasoline_b_mth)}` : "-" },
                                            { label: "Phone (฿/M)", value: data.phone_b_mth ? `฿${formatNumberWithCommas(data.phone_b_mth)}` : "-" },
                                            { label: "PFund (%)", value: data.provident_fund_pct ? `${data.provident_fund_pct}%` : "-" },
                                            { label: "Med (฿/Yr)", value: data.medical_b_annual ? `฿${formatNumberWithCommas(data.medical_b_annual)}` : "-" },
                                            { label: "Med (฿/M)", value: data.medical_b_mth ? `฿${formatNumberWithCommas(data.medical_b_mth)}` : "-" },
                                        ].map(({ label, value, className }) => (
                                            <div key={label} className="space-y-1">
                                                <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">{label}</p>
                                                <p className={cn("font-bold", className || "text-slate-700")}>{value}</p>
                                            </div>
                                        ))}
                                        {/* Insurance */}
                                        <div className="space-y-1">
                                            <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">Insurance</p>
                                            <div className="flex flex-wrap gap-1">
                                                {data.insurance ? data.insurance.split(',').map((item: string, i: number) => (
                                                    <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold border border-indigo-100 uppercase">{item.trim()}</span>
                                                )) : "-"}
                                            </div>
                                        </div>
                                        {/* Housing */}
                                        <div className="space-y-1 md:col-span-2">
                                            <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">Housing / Expat</p>
                                            <p className="font-bold text-slate-700 truncate">{data.housing_for_expat_b_mth || "-"}</p>
                                        </div>
                                    </div>
                                    {data.others_benefit && (
                                        <div className="mt-6 pt-5 border-t border-slate-200/50">
                                            <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest block mb-2">Additional Benefits</p>
                                            <p className="text-xs font-medium text-slate-600 leading-relaxed italic">&ldquo;{data.others_benefit}&rdquo;</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Danger Zone */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-rose-400 flex items-center gap-2">
                                    <AlertCircle className="h-3 w-3" /> Danger Zone
                                </h3>
                                <div className="bg-rose-50/40 rounded-2xl p-5 ring-1 ring-rose-100/60 space-y-3">
                                    <p className="text-xs text-slate-500 font-medium">Actions that affect this candidate's data.</p>
                                    <RefreshProfileButton
                                        candidateId={candidateId!}
                                        candidateName={data.name}
                                        linkedinUrl={data.linkedin}
                                    />
                                </div>
                            </div>

                        </div>
                    )}
                </SheetContent>
            </Sheet>

            <CandidateEditSheet
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                candidateId={candidateId}
                onSuccess={handleRefresh}
            />
        </>
    );
}
