import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    MessageSquare, Loader2, Mail, Phone, MapPin, 
    Globe, Briefcase, GraduationCap, DollarSign, 
    FileText, Calendar, ExternalLink, Download,
    UserCog, Edit3, AlertCircle
} from "lucide-react";
import { 
    AddExperienceDialog, 
    EditExperienceDialog, 
    DeleteExperienceButton, 
    SetCurrentExperienceButton 
} from "@/components/experience-dialog";
import { CandidateEditSheet } from "./candidate-edit-sheet";
import { getJRCandidateDetails } from "@/app/actions/jr-candidate-logs";
import { FeedbackSection } from "@/components/feedback-section";
import { CandidateActivityLog } from "@/components/candidate-activity-log";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatNumberWithCommas } from "@/lib/utils";
import { formatMonthYear } from "@/lib/date-utils";

interface JRCandidateSheetProps {
    jrCandidateId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function JRCandidateSheet({ jrCandidateId, open, onOpenChange }: JRCandidateSheetProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("recruitment");
    const [isEditOpen, setIsEditOpen] = useState(false);

    const fetchData = useCallback(async (id: string, isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const result = await getJRCandidateDetails(id);
            setData(result);
        } catch (err) {
            console.error("Error fetching details:", err);
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open || !jrCandidateId) {
            setData(null);
            return;
        }
        fetchData(jrCandidateId);
    }, [jrCandidateId, open, fetchData]);

    const handleRefresh = () => {
        if (jrCandidateId) fetchData(jrCandidateId, true);
    };

    const meta = data?.meta;
    const logs = data?.logs ?? [];
    const feedback = data?.feedback ?? [];
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
                    <SheetTitle className={loading || !data ? "sr-only" : "sr-only"}>
                        {loading || !data ? "Candidate Details" : candidate?.name}
                    </SheetTitle>
                    
                    {loading || !data ? (
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
                                    fallbackClassName="text-xl font-black"
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
                                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 border-slate-200 py-0.5">
                                            JR: {meta?.jr_id}
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border-indigo-100 py-0.5 font-mono">
                                            Candidate ID: {meta?.candidate_id}
                                        </Badge>
                                        {candidate?.candidate_status && (
                                            <Badge className={cn(
                                                "text-[10px] font-black uppercase tracking-widest py-0.5",
                                                candidate.candidate_status === 'Blacklist' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                            )}>
                                                {candidate.candidate_status}
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

                {/* Tabs Selector */}
                <div className="bg-white border-b px-8 py-2">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="bg-slate-100/50 p-1 h-11">
                            <TabsTrigger value="recruitment" className="font-black text-xs uppercase tracking-widest px-6 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                                Recruitment
                            </TabsTrigger>
                            <TabsTrigger value="profile" className="font-black text-xs uppercase tracking-widest px-6 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                                Candidate Profile
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading && !data ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
                            <Loader2 className="h-10 w-10 animate-spin text-indigo-500 opacity-50" />
                            <div className="space-y-1">
                                <p className="text-lg font-black text-slate-900 tracking-tight">Gathering Intelligence...</p>
                                <p className="text-sm font-medium text-slate-400">We're fetching the complete candidate data for you.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8">
                            {activeTab === "recruitment" ? (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Left: Summary + Feedback */}
                                    <div className="lg:col-span-2 space-y-8">
                                        <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-white ring-1 ring-slate-100">
                                            <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                                            <CardHeader className="pb-4 pt-6">
                                                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                                                    <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><MessageSquare className="h-3.5 w-3.5" /></span> Recruitment Recap
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100/50">
                                                    <span className="text-[10px] font-black uppercase text-indigo-500 mb-3 block tracking-[0.1em]">Hiring Manager Notes</span>
                                                    <p className="text-[15px] text-slate-700 font-medium leading-relaxed italic">
                                                        "{meta?.temp_note || "No requisition-specific notes available."}"
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-8 items-center px-2">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Candidate Rank</span>
                                                        <span className="text-2xl font-black text-slate-900">{meta?.rank || "Unranked"}</span>
                                                    </div>
                                                    <div className="h-10 w-px bg-slate-100" />
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sourcing Channel</span>
                                                        <Badge className="w-fit bg-slate-100 text-slate-600 hover:bg-slate-200 border-none font-bold uppercase py-1 px-3 mt-1 rounded-full">
                                                            {meta?.list_type || "Standard Sourcing"}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <FeedbackSection
                                            jrCandidateId={meta?.jr_candidate_id || jrCandidateId!}
                                            candidateName={candidate?.name}
                                            feedback={feedback}
                                        />
                                    </div>

                                    {/* Right: Activity Log */}
                                    <div className="lg:col-span-1">
                                        <CandidateActivityLog
                                            logs={logs}
                                            jrCandidateId={jrCandidateId!}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                                                        <span className="text-sm font-bold text-slate-700">{candidate?.age ? `${candidate.age} Years - ${candidate.date_of_birth ? "DoB" : "Bachelor year"}` : "N/A"}</span>
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
                                        {candidate?.blacklist_note && (
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

                                        {/* About & Experience Content */}
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
                                                    <AddExperienceDialog 
                                                        candidateId={meta?.candidate_id} 
                                                        onSuccess={handleRefresh}
                                                    />
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
                                                        return (
                                                            <div key={i} className="relative group">
                                                                <div className={cn(
                                                                    "absolute -left-[2.6rem] top-1.5 h-4 w-4 rounded-full border-4 border-white shadow-md ring-2 ring-slate-100",
                                                                    isCurrent ? "bg-indigo-600 scale-125 ring-indigo-50" : "bg-slate-300"
                                                                )} />
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
                                            <div className="space-y-3">
                                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                                    Financial Profile
                                                </h3>
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                    <Card className="border-none bg-emerald-50 shadow-none rounded-2xl p-4">
                                                        <span className="text-[9px] font-black uppercase text-emerald-600 opacity-70 tracking-widest block mb-1 text-center">Base Salary (฿)</span>
                                                        <span className="text-lg font-black text-emerald-700 tracking-tight block text-center">
                                                            {candidate?.gross_salary_base_b_mth ? `฿${formatNumberWithCommas(candidate.gross_salary_base_b_mth)}` : "N/A"}
                                                        </span>
                                                        <span className="text-[8px] font-bold text-emerald-600/60 block mt-1 uppercase tracking-tighter text-center">Monthly Base</span>
                                                    </Card>
                                                    <Card className="border-none bg-indigo-50 shadow-none rounded-2xl p-4">
                                                        <span className="text-[9px] font-black uppercase text-indigo-600 opacity-70 tracking-widest block mb-1 text-center">Performance Bonus</span>
                                                        <span className="text-lg font-black text-indigo-700 tracking-tight block text-center">
                                                            {candidate?.bonus_mth ? `${candidate.bonus_mth} Months` : "N/A"}
                                                        </span>
                                                        <span className="text-[8px] font-bold text-indigo-600/60 block mt-1 uppercase tracking-tighter text-center">Annual Variable</span>
                                                    </Card>
                                                    <Card className="border-none bg-amber-50 shadow-none rounded-2xl p-4">
                                                        <span className="text-[9px] font-black uppercase text-amber-600 opacity-70 tracking-widest block mb-1 text-center">Alt. Income / Benefits</span>
                                                        <span className="text-sm font-bold text-amber-700 tracking-tight block text-center h-7 items-center flex justify-center truncate">
                                                            {candidate?.other_income || "N/A"}
                                                        </span>
                                                        <span className="text-[8px] font-bold text-amber-600/60 block mt-1 uppercase tracking-tighter text-center">Misc Monthly</span>
                                                    </Card>
                                                    <Card className="border-none bg-purple-50 shadow-none rounded-2xl p-4">
                                                        <span className="text-[9px] font-black uppercase text-purple-600 opacity-70 tracking-widest block mb-1 text-center">Allowance / Gas</span>
                                                        <span className="text-sm font-bold text-purple-700 tracking-tight block text-center h-7 items-center flex justify-center truncate">
                                                            {[candidate?.car_allowance_b_mth, candidate?.gasoline_b_mth].filter(Boolean).map(formatNumberWithCommas).join(" / ") || "N/A"}
                                                        </span>
                                                        <span className="text-[8px] font-bold text-purple-600/60 block mt-1 uppercase tracking-tighter text-center">Standard Perks</span>
                                                    </Card>
                                                </div>
                                                {candidate?.others_benefit && (
                                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest block mb-1">Additional Benefits Pool</span>
                                                        <p className="text-xs font-bold text-slate-600">{candidate.others_benefit}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
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
