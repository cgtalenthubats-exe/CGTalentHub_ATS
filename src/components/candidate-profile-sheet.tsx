import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
    Loader2, Mail, Phone, MapPin,
    Globe, Briefcase, GraduationCap,
    FileText, Calendar, ExternalLink, Download,
    UserCog, Edit3, AlertCircle, Trash2, CheckSquare,
    ShieldCheck, User, Building2
} from "lucide-react";
import {
    AddExperienceDialog,
    EditExperienceDialog,
    DeleteExperienceButton,
    SetCurrentExperienceButton
} from "@/components/experience-dialog";
import { CandidateEditSheet } from "./candidate-edit-sheet";
import { RefreshProfileButton } from "@/components/candidate-client-actions";
import { StatusSelect } from "@/components/ui/status-select";
import { getCandidateProfileDetails, getReferenceChecks, type ReferenceCheck } from "@/app/actions/jr-candidate-logs";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatNumberWithCommas } from "@/lib/utils";
import { formatMonthYear } from "@/lib/date-utils";
import { HistoryTimeline } from "@/components/history/HistoryTimeline";
import { History as HistoryIcon } from "lucide-react";
import { bulkDeleteExperiences } from "@/app/actions/candidate";

interface CandidateProfileSheetProps {
    candidateId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CandidateProfileSheet({ candidateId, open, onOpenChange }: CandidateProfileSheetProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("profile");
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedExpIds, setSelectedExpIds] = useState<string[]>([]);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);
    const [referenceChecks, setReferenceChecks] = useState<ReferenceCheck[] | null>(null);
    const [referenceLoading, setReferenceLoading] = useState(false);

    const fetchData = useCallback(async (id: string, isSilent = false) => {
        if (!isSilent) { setLoading(true); setFetchError(null); }
        try {
            const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 20000));
            const result = await Promise.race([getCandidateProfileDetails(id), timeout]);
            if (result === "timeout") {
                setFetchError("โหลดข้อมูลใช้เวลานานเกินไป กรุณาลองใหม่");
            } else if (!result) {
                setFetchError("ไม่พบข้อมูล candidate นี้");
            } else {
                setData(result);
            }
        } catch (err) {
            console.error("Error fetching candidate details:", err);
            setFetchError("เกิดข้อผิดพลาดระหว่างโหลดข้อมูล");
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open || !candidateId) {
            setData(null);
            setFetchError(null);
            setActiveTab("profile");
            setReferenceChecks(null);
            return;
        }
        setData(null);
        setReferenceChecks(null);
        fetchData(candidateId);
    }, [candidateId, open, fetchData]);

    useEffect(() => {
        if (activeTab !== "reference" || !candidateId || referenceChecks !== null) return;
        setReferenceLoading(true);
        getReferenceChecks(candidateId)
            .then(setReferenceChecks)
            .finally(() => setReferenceLoading(false));
    }, [activeTab, candidateId, referenceChecks]);

    const handleRefresh = () => {
        if (candidateId) fetchData(candidateId, true);
    };

    const patchCandidate = async (fields: Record<string, any>) => {
        if (!candidateId) return;
        await fetch(`/api/candidates/${candidateId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields),
        });
        handleRefresh();
    };

    const meta = data?.meta;
    const history = data?.history ?? [];
    const candidate = meta?.candidate_profile;
    const experiences = candidate?.experiences ?? [];
    const enhance = candidate?.enhancement ?? {};

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-[850px] p-0 overflow-hidden flex flex-col bg-[#f8fafc] border-l shadow-2xl"
            >
                {/* Header */}
                <SheetHeader className="z-20 bg-white border-b shadow-sm px-8 py-6 flex-shrink-0">
                    <SheetTitle className="sr-only">
                        {loading || !data ? "Candidate Details" : candidate?.name}
                    </SheetTitle>

                    {fetchError ? (
                        <div className="flex items-center gap-4 py-2">
                            <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-400">
                                <AlertCircle className="h-5 w-5" />
                            </div>
                            <p className="text-sm font-bold text-slate-500">Candidate Details</p>
                        </div>
                    ) : loading || !data ? (
                        <div className="flex items-center gap-4 py-2">
                            <div className="h-12 w-12 rounded-full bg-slate-100 animate-pulse" />
                            <div className="space-y-2">
                                <div className="h-4 w-48 bg-slate-100 animate-pulse rounded" />
                                <div className="h-3 w-32 bg-slate-100 animate-pulse rounded" />
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-5">
                                <CandidateAvatar
                                    src={candidate?.photo_url}
                                    name={candidate?.name}
                                    className="h-16 w-16 border-4 border-white shadow-xl ring-2 ring-indigo-50"
                                />
                                <div className="flex flex-col gap-1.5">
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none group flex items-center gap-2">
                                        {candidate?.name}
                                        {candidate?.linkedin && (
                                            <a href={candidate.linkedin} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-indigo-600 transition-colors">
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        )}
                                    </h2>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border-indigo-100 py-0.5 font-mono">
                                            Candidate ID: {meta?.candidate_id}
                                        </Badge>
                                        {candidate?.candidate_status?.map((s: string) => (
                                            <Badge key={s} className={cn(
                                                "text-[10px] font-black uppercase tracking-widest py-0.5",
                                                s === 'Blacklist' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                                                s === 'Over-aged' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                'bg-emerald-100 text-emerald-700 border-emerald-200'
                                            )}>
                                                {s}
                                            </Badge>
                                        ))}
                                        {meta?.history_count > 0 && (
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border-amber-200 py-0.5 gap-1.5 cursor-pointer hover:bg-amber-100 transition-colors shadow-sm"
                                                onClick={() => setActiveTab("history")}
                                            >
                                                <HistoryIcon className="h-3 w-3" />
                                                {meta.history_count} Past {meta.history_count === 1 ? 'Record' : 'Records'} Detected
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Link href={`/candidates/${meta?.candidate_id}`} target="_blank">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 px-3 font-bold border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/50"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                </Link>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 gap-2 font-bold shadow-sm border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                    onClick={() => setIsEditOpen(true)}
                                >
                                    <UserCog className="h-4 w-4" /> Edit Profile
                                </Button>
                                {candidate?.resume_url && (
                                    <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" size="sm" className="h-9 gap-2 font-bold shadow-sm border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700">
                                            <Download className="h-4 w-4" /> Resume
                                        </Button>
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </SheetHeader>

                <div className="bg-white border-b px-8 py-2">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="bg-slate-100/50 p-1 h-11">
                            <TabsTrigger value="profile" className="font-black text-xs uppercase tracking-widest px-6 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                                Candidate Profile
                            </TabsTrigger>
                            <TabsTrigger value="history" className="font-black text-xs uppercase tracking-widest px-6 data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-sm flex gap-2">
                                <HistoryIcon className="h-3 w-3" />
                                History Record {meta?.history_count > 0 && `(${meta.history_count})`}
                            </TabsTrigger>
                            <TabsTrigger value="reference" className="font-black text-xs uppercase tracking-widest px-6 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm flex gap-2">
                                <ShieldCheck className="h-3 w-3" />
                                Reference Check
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {fetchError ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
                            <div className="p-4 bg-rose-50 rounded-2xl text-rose-400">
                                <AlertCircle className="h-8 w-8" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-lg font-black text-slate-900 tracking-tight">โหลดข้อมูลไม่สำเร็จ</p>
                                <p className="text-sm font-medium text-slate-400">{fetchError}</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="font-bold"
                                onClick={() => candidateId && fetchData(candidateId)}
                            >
                                ลองใหม่
                            </Button>
                        </div>
                    ) : !data ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
                            <Loader2 className="h-10 w-10 animate-spin text-indigo-500 opacity-50" />
                            <div className="space-y-1">
                                <p className="text-lg font-black text-slate-900 tracking-tight">Gathering Intelligence...</p>
                                <p className="text-sm font-medium text-slate-400">We're fetching the complete candidate data for you.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8">
                            {activeTab === "profile" && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        {/* Quick Edit Bar */}
                                        <QuickEditBar candidate={candidate} onSave={patchCandidate} />

                                        {/* Contact Intel Ribbon */}
                                        <div className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-slate-100 flex flex-wrap gap-8 items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 shadow-sm"><Mail className="h-5 w-5" /></div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Email Address</span>
                                                    <span className="text-sm font-bold text-slate-700">{candidate?.email || "N/A"}</span>
                                                    {enhance?.alt_email && enhance.alt_email !== candidate?.email && (
                                                        <span className="text-[10px] font-bold text-slate-400">Alt: {enhance.alt_email}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="h-10 w-px bg-slate-100 hidden md:block" />
                                            <div className="flex items-center gap-4">
                                                <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 shadow-sm"><Phone className="h-5 w-5" /></div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Mobile Phone</span>
                                                    <span className="text-sm font-bold text-slate-700">{candidate?.mobile_phone || "N/A"}</span>
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
                                                            <span className="text-sm font-bold text-slate-700">{candidate?.nationality || "N/A"}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                                                            <span className="text-[11px] font-black text-purple-500 uppercase tracking-tight">Age:</span>
                                                            <span className={`text-sm font-bold ${candidate?.age_source === 'estimated' ? 'text-red-500' : 'text-slate-700'}`}>
                                                                {candidate?.age ? `${candidate.age} Years${candidate.age_source === 'dob' ? ' - DoB' : candidate.age_source === 'estimated' ? ' - Est.' : candidate.year_of_bachelor_education ? ' - Bachelor year' : ''}` : 'N/A'}
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
                                            {candidate?.blacklist_note && candidate.blacklist_note !== 'null' && (
                                                <div className="flex items-center gap-4 bg-rose-50 px-4 py-2 rounded-xl ring-1 ring-rose-100">
                                                    <div className="p-1.5 bg-rose-500 rounded-lg text-white shadow-sm"><AlertCircle className="h-4 w-4" /></div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] uppercase font-black text-rose-500 tracking-widest">Blacklist Alert</span>
                                                        <span className="text-[11px] font-bold text-rose-700 leading-tight">{candidate.blacklist_note}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Main Content Area */}
                                        <div className="space-y-8">
                                            {/* About Section */}
                                            {enhance?.about && (
                                                <div className="space-y-3">
                                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                                        Professional Summary
                                                    </h3>
                                                    <p className="text-[15px] leading-relaxed text-slate-700 font-medium bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-100 whitespace-pre-line">
                                                        {enhance.about}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Experience Section */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                                        Work Experience
                                                    </h3>
                                                    <div className="flex items-center gap-2">
                                                        {selectedExpIds.length > 0 && (
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                className="h-7 px-3 text-[11px] font-black gap-1.5"
                                                                disabled={isDeletingBulk}
                                                                onClick={async () => {
                                                                    if (!confirm(`Delete ${selectedExpIds.length} experience${selectedExpIds.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
                                                                    setIsDeletingBulk(true);
                                                                    await bulkDeleteExperiences(selectedExpIds, meta?.candidate_id);
                                                                    setSelectedExpIds([]);
                                                                    setIsDeletingBulk(false);
                                                                    handleRefresh();
                                                                }}
                                                            >
                                                                {isDeletingBulk ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                                                Delete {selectedExpIds.length} selected
                                                            </Button>
                                                        )}
                                                        <AddExperienceDialog
                                                            candidateId={meta?.candidate_id}
                                                            onSuccess={handleRefresh}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="relative border-l-2 border-slate-100 ml-4 pl-8 space-y-10 py-4">
                                                    {experiences.length > 0 ? [...experiences]
                                                        .sort((a, b) => {
                                                            const aCurrent = (a.end_date?.toLowerCase() === 'present') || a.is_current_job === 'Current';
                                                            const bCurrent = (b.end_date?.toLowerCase() === 'present') || b.is_current_job === 'Current';
                                                            if (aCurrent && !bCurrent) return -1;
                                                            if (!aCurrent && bCurrent) return 1;
                                                            const parseYearMonth = (d: string) => {
                                                                if (!d) return 0;
                                                                const p = d.split('-');
                                                                return p.length === 2 ? parseInt(p[1]) * 100 + parseInt(p[0]) : new Date(d).getTime() || 0;
                                                            };
                                                            return parseYearMonth(b.start_date) - parseYearMonth(a.start_date);
                                                        })
                                                        .map((exp: any, i: number) => {
                                                        const isCurrent = exp.is_current_job === 'Current' || (exp.end_date?.toLowerCase() === 'present');
                                                        const isSelected = selectedExpIds.includes(exp.id);
                                                        return (
                                                            <div key={i} className={cn("relative group", isSelected && "opacity-70")}>
                                                                <div className={cn(
                                                                    "absolute -left-[2.6rem] top-1.5 h-4 w-4 rounded-full border-4 border-white shadow-md ring-2 ring-slate-100",
                                                                    isCurrent ? "bg-indigo-600 scale-125 ring-indigo-50" : "bg-slate-300"
                                                                )} />
                                                                {/* Checkbox — visible on hover or when any selected */}
                                                                <div className={cn(
                                                                    "absolute -left-[3.8rem] top-1 transition-opacity",
                                                                    selectedExpIds.length > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                                                )}>
                                                                    <Checkbox
                                                                        checked={isSelected}
                                                                        onCheckedChange={(checked) => {
                                                                            setSelectedExpIds(prev =>
                                                                                checked ? [...prev, exp.id] : prev.filter(id => id !== exp.id)
                                                                            );
                                                                        }}
                                                                        className="h-4 w-4 border-slate-300"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                        <div className="flex items-center gap-3">
                                                                            <h4 className="text-base font-black text-slate-900 tracking-tight">{exp.position}</h4>
                                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                                                <EditExperienceDialog
                                                                                    experience={exp}
                                                                                    candidateId={meta?.candidate_id}
                                                                                    onSuccess={handleRefresh}
                                                                                />
                                                                                <DeleteExperienceButton
                                                                                    id={exp.id}
                                                                                    candidateId={meta?.candidate_id}
                                                                                    onSuccess={handleRefresh}
                                                                                />
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
                                                                            candidateId={meta?.candidate_id}
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
                                                {enhance?.skills_list && (
                                                    <div className="space-y-3">
                                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                                            Technical Expertise
                                                        </h3>
                                                        <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-100 flex flex-wrap gap-2">
                                                            {(typeof enhance.skills_list === 'string' ? enhance.skills_list.split(',') : enhance.skills_list).map((s: string) => (
                                                                <Badge key={s} variant="secondary" className="bg-slate-50 text-slate-600 border-none font-bold text-[10px] uppercase py-1 px-3 rounded-lg">
                                                                    {s.trim()}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {enhance?.languages && (
                                                    <div className="space-y-3">
                                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                                            Linguistic Proficiency
                                                        </h3>
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

                                            {/* Education Section */}
                                            {enhance?.education_summary && (
                                                <div className="space-y-3">
                                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                                        Academic Background
                                                    </h3>
                                                    <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-100 flex gap-4 items-start">
                                                        <div className="p-3 bg-purple-50 rounded-xl text-purple-600 shadow-sm"><GraduationCap className="h-6 w-6" /></div>
                                                        <p className="text-sm leading-relaxed text-slate-600 font-medium whitespace-pre-wrap">
                                                            {enhance.education_summary}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            {/* Compensation Grid */}
                                            <div className="space-y-4">
                                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                                    Financial Profile & Benefits
                                                </h3>
                                                <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100/50">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5 text-sm">
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest text-slate-400">Salary (฿/M)</p>
                                                            <p className="font-bold text-base text-emerald-600">
                                                                {candidate?.gross_salary_base_b_mth ? `฿${formatNumberWithCommas(candidate.gross_salary_base_b_mth)}` : "-"}
                                                            </p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest text-slate-400">Bonus (m)</p>
                                                            <p className="font-bold text-slate-700">{candidate?.bonus_mth ? `${candidate.bonus_mth} m` : "-"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest text-slate-400">Other Inc.</p>
                                                            <p className="font-bold text-slate-700 truncate" title={candidate?.other_income}>{candidate?.other_income || "-"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest text-slate-400">Car (฿/M)</p>
                                                            <p className="font-bold text-slate-700">{candidate?.car_allowance_b_mth ? `฿${formatNumberWithCommas(candidate.car_allowance_b_mth)}` : "-"}</p>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest text-slate-400">Gas (฿/M)</p>
                                                            <p className="font-bold text-slate-700">{candidate?.gasoline_b_mth ? `฿${formatNumberWithCommas(candidate.gasoline_b_mth)}` : "-"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest text-slate-400">Phone (฿/M)</p>
                                                            <p className="font-bold text-slate-700">{candidate?.phone_b_mth ? `฿${formatNumberWithCommas(candidate.phone_b_mth)}` : "-"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest text-slate-400">PFund (%)</p>
                                                            <p className="font-bold text-slate-700">{candidate?.provident_fund_pct ? `${candidate.provident_fund_pct}%` : "-"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest text-slate-400">Insurance</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {candidate?.insurance ? (
                                                                    candidate.insurance.split(',').map((item: string, i: number) => (
                                                                        <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold border border-indigo-100 uppercase">
                                                                            {item.trim()}
                                                                        </span>
                                                                    ))
                                                                ) : "-"}
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest text-slate-400">Med (฿/Yr)</p>
                                                            <p className="font-bold text-slate-700">{candidate?.medical_b_annual ? `฿${formatNumberWithCommas(candidate.medical_b_annual)}` : "-"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest text-slate-400">Med (฿/M)</p>
                                                            <p className="font-bold text-slate-700">{candidate?.medical_b_mth ? `฿${formatNumberWithCommas(candidate.medical_b_mth)}` : "-"}</p>
                                                        </div>
                                                        <div className="space-y-1 md:col-span-2">
                                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest text-slate-400">Housing / Expat</p>
                                                            <p className="font-bold text-slate-700 truncate" title={candidate?.housing_for_expat_b_mth}>{candidate?.housing_for_expat_b_mth || "-"}</p>
                                                        </div>
                                                    </div>

                                                    {candidate?.others_benefit && (
                                                        <div className="mt-6 pt-5 border-t border-slate-200/50">
                                                            <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest block mb-2">Additional Benefits Pool</p>
                                                            <p className="text-xs font-medium text-slate-600 leading-relaxed italic">
                                                                &ldquo;{candidate.others_benefit}&rdquo;
                                                            </p>
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
                                                        candidateId={meta?.candidate_id}
                                                        candidateName={candidate?.name}
                                                        linkedinUrl={candidate?.linkedin}
                                                    />
                                                </div>
                                            </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "history" && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex flex-col gap-1 mb-2">
                                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Historical Journey</h2>
                                        <p className="text-xs font-medium text-slate-400 italic">Timeline of activities and feedback from previous job requisitions.</p>
                                    </div>
                                    <HistoryTimeline
                                        history={history}
                                        candidateName={candidate?.name || "Candidate"}
                                    />
                                </div>
                            )}

                            {activeTab === "reference" && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex flex-col gap-1 mb-2">
                                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Reference Check</h2>
                                        <p className="text-xs font-medium text-slate-400 italic">ผลการตรวจสอบ reference ของ candidate คนนี้</p>
                                    </div>
                                    {referenceLoading ? (
                                        <div className="flex items-center justify-center py-16">
                                            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                                        </div>
                                    ) : referenceChecks && referenceChecks.length > 0 ? (
                                        <div className="space-y-4">
                                            {referenceChecks.map((rc) => (
                                                <div key={rc.id} className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-slate-100 space-y-3">
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 shadow-sm">
                                                                <User className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black text-slate-900">{rc.referee_name || "Unknown Referee"}</p>
                                                                <p className="text-xs font-bold text-slate-400">
                                                                    {[rc.referee_position, rc.referee_company].filter(Boolean).join(" @ ") || "-"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {rc.overall_rating && (
                                                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-black uppercase tracking-widest py-1">
                                                                {rc.overall_rating}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {rc.relationship && (
                                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                                            <Building2 className="h-3.5 w-3.5" />
                                                            Relationship: {rc.relationship}
                                                        </div>
                                                    )}
                                                    {rc.summary && (
                                                        <p className="text-sm text-slate-600 font-medium leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-200 whitespace-pre-line">
                                                            {rc.summary}
                                                        </p>
                                                    )}
                                                    {rc.sources && rc.sources.length > 0 && (
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {rc.sources.map((url, idx) => (
                                                                <a
                                                                    key={idx}
                                                                    href={url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors truncate max-w-[220px]"
                                                                    title={url}
                                                                >
                                                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                                                    <span className="truncate">{url}</span>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                                        <Calendar className="h-3 w-3" />
                                                        {rc.checked_at ? new Date(rc.checked_at).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }) : "-"}
                                                        {rc.checked_by && ` · by ${rc.checked_by}`}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-center py-16 bg-white rounded-2xl shadow-sm ring-1 ring-slate-100">
                                            <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-400 mb-4">
                                                <ShieldCheck className="h-8 w-8" />
                                            </div>
                                            <p className="text-sm font-black text-slate-700">ยังไม่มีข้อมูล Reference Check</p>
                                            <p className="text-xs font-medium text-slate-400 mt-1">candidate คนนี้ยังไม่มีการตรวจสอบ reference</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </SheetContent>
            <CandidateEditSheet
                candidateId={meta?.candidate_id}
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                onSuccess={handleRefresh}
            />
        </Sheet>
    );
}

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

function QuickEditBar({ candidate, onSave }: { candidate: any; onSave: (fields: Record<string, any>) => Promise<void> }) {
    const [linkedin, setLinkedin] = useState(candidate?.linkedin || '');
    const [age, setAge] = useState(String(candidate?.age || ''));
    const [gender, setGender] = useState(candidate?.gender || '');
    const [statuses, setStatuses] = useState<string[]>(candidate?.candidate_status || []);
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        setLinkedin(candidate?.linkedin || '');
        setAge(String(candidate?.age || ''));
        setGender(candidate?.gender || '');
        setStatuses(candidate?.candidate_status || []);
    }, [candidate]);

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
