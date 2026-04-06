"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getJRHistoryOverview } from "@/app/actions/jr-candidates";
import { Loader2, MessageSquare, Star, ArrowRight, History, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";

interface HistoryInsightsProps {
    jrId: string;
}

export function HistoryInsights({ jrId }: HistoryInsightsProps) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const res = await getJRHistoryOverview(jrId);
                setData(res);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [jrId]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-sm font-bold text-slate-500 animate-pulse uppercase tracking-widest">Aggregating Cross-JR Insights...</p>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-200 text-center animate-in fade-in duration-500">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <History className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-900">No History Detected</h3>
                <p className="text-sm text-slate-400 font-bold max-w-sm mx-auto mt-2">None of the candidates in this JR have prior interview records in other requisitions.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Cross-JR History Matrix</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">High-level overview of candidate performance in other requisitions</p>
                </div>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-black px-3 py-1 shadow-sm">
                    {data.length} Candidates with History
                </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {data.map((cand) => {
                    // Collect all other JR IDs
                    const otherJrs = cand.histories.map((h: any) => h.jr_id).join(', ');
                    
                    return (
                        <Card key={cand.candidate_id} className="rounded-2xl border-none shadow-sm shadow-indigo-100 overflow-hidden group hover:shadow-md transition-all">
                            <div className="flex flex-col md:flex-row">
                                {/* Candidate Info Column */}
                                <div className="w-full md:w-72 p-6 bg-slate-50/50 border-r border-slate-100 flex flex-col items-center text-center">
                                    <Avatar className="h-20 w-20 border-4 border-white shadow-md mb-4 ring-2 ring-indigo-50">
                                        <AvatarImage src={cand.photo} />
                                        <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xl font-black">{cand.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <h4 className="font-black text-slate-900 leading-tight mb-1">{cand.name}</h4>
                                    <div className="flex items-center gap-2 mb-4">
                                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter bg-white text-slate-500">
                                            Current: {cand.current_status}
                                        </Badge>
                                    </div>
                                    <div className="mb-6 space-y-1">
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">History In</span>
                                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">{otherJrs}</span>
                                    </div>
                                    <Link href={`/requisitions/manage/candidate/${cand.jr_candidate_id}?jr_id=${jrId}`}>
                                        <button className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 transition-all group-hover:gap-2.5 bg-white px-4 py-2.5 rounded-xl border border-indigo-100 shadow-sm">
                                            Full Logs <ArrowRight className="h-3 w-3" />
                                        </button>
                                    </Link>
                                </div>

                                {/* History Journey Column */}
                                <div className="flex-1 p-6 bg-white">
                                    <ScrollArea className="w-full">
                                        <div className="flex flex-col gap-4">
                                            {cand.histories.map((hist: any, idx: number) => (
                                                <div key={`${hist.jr_id}-${idx}`} className="flex flex-col md:flex-row gap-6 p-5 rounded-2xl bg-white border border-slate-100 hover:border-indigo-200 transition-all relative overflow-hidden group/item">
                                                    {/* Left: JR Info */}
                                                    <div className="md:w-48 flex flex-col pr-4 md:border-r border-slate-50 shrink-0">
                                                        <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider leading-none mb-1.5">{hist.jr_id}</span>
                                                        <span className="text-[13px] font-black text-slate-900 leading-tight mb-3 line-clamp-2" title={hist.position}>{hist.position}</span>
                                                        <div className="flex flex-col gap-2">
                                                            <Badge className={cn(
                                                                "w-fit text-[9px] font-black uppercase tracking-widest px-2.5 py-1 shadow-none border-none",
                                                                hist.final_status.toLowerCase().includes('successful') ? 'bg-emerald-50 text-emerald-700' :
                                                                hist.final_status.toLowerCase().includes('reject') ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-700'
                                                            )}>
                                                                {hist.final_status}
                                                            </Badge>
                                                            <Link href={`/requisitions/manage/candidate/${hist.jr_candidate_id}?jr_id=${hist.jr_id}`}>
                                                                <button className="text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-tighter flex items-center gap-1 transition-all opacity-0 group-hover/item:opacity-100">
                                                                    View Journey <ArrowRight className="h-2.5 w-2.5" />
                                                                </button>
                                                            </Link>
                                                        </div>
                                                    </div>

                                                    {/* Right: Insights & Feedback */}
                                                    <div className="flex-1 flex flex-col gap-3">
                                                        {hist.latest_feedback ? (
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2.5">
                                                                        <div className="flex gap-0.5">
                                                                            {[...Array(5)].map((_, i) => {
                                                                                const score = hist.latest_feedback.rating_score || 0;
                                                                                const filled = i < Math.floor(score / 2);
                                                                                return (
                                                                                    <Star key={i} className={cn("h-3 w-3", filled ? "fill-amber-400 text-amber-400" : "text-slate-200")} />
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">Score: {hist.latest_feedback.rating_score}/10</span>
                                                                    </div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{hist.latest_feedback.interview_date}</span>
                                                                </div>
                                                                <div className="relative bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/50 group-hover/item:bg-indigo-50/50 transition-colors">
                                                                    <MessageSquare className="h-10 w-10 text-indigo-100/50 absolute bottom-1 right-1" />
                                                                    <p className="text-xs text-slate-700 font-medium leading-relaxed italic relative z-10">
                                                                        &quot;{hist.latest_feedback.feedback_text}&quot;
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-2.5">
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Recommendation:</span>
                                                                    <Badge variant="outline" className={cn(
                                                                        "text-[9px] font-black uppercase tracking-widest px-2 shadow-none",
                                                                        ['Strong Recommend', 'Hire', 'Recommend'].some(rec => hist.latest_feedback.overall_recommendation?.includes(rec))
                                                                            ? 'text-emerald-600 border-emerald-100 bg-emerald-50/50' 
                                                                            : 'text-rose-600 border-rose-100 bg-rose-50/50'
                                                                    )}>
                                                                        {hist.latest_feedback.overall_recommendation}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center p-6 h-full bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                                                <p className="text-[10px] font-bold text-slate-400 italic uppercase tracking-wider">No detailed feedback recorded for this journey</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
