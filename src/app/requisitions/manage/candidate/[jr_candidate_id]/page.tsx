import Link from "next/link";
import { ArrowLeft, History, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getJRCandidateDetails } from "@/app/actions/jr-candidate-logs";
import { cn } from "@/lib/utils";
import { FeedbackSection } from "@/components/feedback-section";
import { CandidateAvatar } from "@/components/candidate-avatar";

export default async function CandidateLogPage({ params }: { params: Promise<{ jr_candidate_id: string }> }) {
    const { jr_candidate_id } = await params;
    const data = await getJRCandidateDetails(jr_candidate_id);

    if (!data) {
        return <div className="p-8 text-center">Candidate data not found</div>;
    }

    const { meta, logs, feedback } = data;
    const candidate = meta.candidate_profile;

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">
            {/* Header */}
            <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur-md shadow-sm">
                <div className="flex h-24 items-center px-8 gap-8 max-w-[95%] mx-auto w-full">
                    <Link href="/requisitions/manage">
                        <Button variant="ghost" size="sm" className="gap-2 text-slate-500 hover:text-slate-900">
                            <ArrowLeft className="h-4 w-4" /> Back to JR
                        </Button>
                    </Link>
                    <div className="flex items-center gap-5">
                        <CandidateAvatar
                            src={candidate?.photo_url}
                            name={candidate?.name}
                            className="h-16 w-16 border-4 border-white shadow-md ring-2 ring-indigo-50"
                            fallbackClassName="text-xl"
                        />
                        <div className="flex flex-col gap-1">
                            <h1 className="text-2xl font-black text-slate-900 leading-none tracking-tight">
                                {candidate?.name}
                            </h1>
                            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                                    JR: {meta.jr_id}
                                </span>
                                <span className="bg-indigo-50 px-2 py-0.5 rounded text-indigo-700 border border-indigo-100 font-mono text-sm">
                                    ID: {meta.candidate_id}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 py-8 px-8 max-w-[95%] mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Details & Feedback */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Summary Card */}
                        <Card className="rounded-2xl border-none shadow-sm shadow-indigo-100 overflow-hidden">
                            <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />
                            <CardHeader className="pb-4">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" /> Recruitment Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <span className="text-[10px] font-black uppercase text-indigo-500 mb-2 block tracking-wider">Note from JR</span>
                                    <p className="text-sm text-slate-700 font-medium leading-relaxed">
                                        {meta.temp_note || "No notes recorded for this JR requisition."}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-4 pt-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase text-slate-400">Rank</span>
                                        <span className="text-lg font-black text-slate-900">{meta.rank || "-"}</span>
                                    </div>
                                    <div className="flex flex-col border-l border-slate-100 pl-4">
                                        <span className="text-[10px] font-black uppercase text-slate-400">List Type</span>
                                        <Badge className="w-fit bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100 font-black uppercase tracking-tighter mt-1">
                                            {meta.list_type || "Longlist"}
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Interview Feedback Section */}
                        <FeedbackSection
                            jrCandidateId={meta.jr_candidate_id || jr_candidate_id}
                            candidateName={candidate?.name}
                            feedback={feedback}
                        />
                    </div>

                    {/* Right Column: Status Timeline */}
                    <div className="lg:col-span-1">
                        <Card className="rounded-2xl border-none shadow-sm shadow-indigo-100 h-fit sticky top-24">
                            <CardHeader className="pb-4 border-b border-slate-50">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <History className="h-4 w-4" /> Activity Log
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 relative">
                                <div className="absolute left-[35px] top-6 bottom-6 w-0.5 bg-slate-100" />
                                <div className="space-y-8">
                                    {logs.map((log: any, idx: number) => (
                                        <div key={log.log_id} className="relative flex gap-4 pr-2">
                                            <div className={cn(
                                                "z-10 h-3 w-3 rounded-full shrink-0 mt-1 border-2 border-white ring-2 ring-slate-50",
                                                idx === 0 ? "bg-indigo-500 ring-indigo-50 scale-125" : "bg-slate-300"
                                            )} />
                                            <div className="flex flex-col gap-1">
                                                <span className={cn(
                                                    "text-xs font-black leading-none",
                                                    idx === 0 ? "text-indigo-700" : "text-slate-800"
                                                )}>
                                                    {log.status}
                                                </span>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                                    <span>{log.timestamp}</span>
                                                    <span>•</span>
                                                    <span className="text-slate-500">{log.updated_By}</span>
                                                </div>
                                                {log.note && (
                                                    <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2 mt-1 font-medium border border-slate-100">
                                                        {log.note}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
