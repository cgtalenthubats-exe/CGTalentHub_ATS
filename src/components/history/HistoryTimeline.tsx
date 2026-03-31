"use client";

import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Briefcase } from "lucide-react";
import { FeedbackSection } from "@/components/feedback-section";
import { CandidateActivityLog } from "@/components/candidate-activity-log";
import { Search } from "lucide-react";

interface HistoryRecord {
    jr_id: string;
    jr_candidate_id: string;
    position: string;
    logs: any[];
    feedback: any[];
}

interface HistoryTimelineProps {
    history: HistoryRecord[];
    candidateName: string;
}

export function HistoryTimeline({ history, candidateName }: HistoryTimelineProps) {
    if (!history || history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="p-4 bg-slate-50 rounded-full">
                    <Search className="h-8 w-8 text-slate-300" />
                </div>
                <div className="space-y-1">
                    <p className="text-lg font-black text-slate-900 tracking-tight">No History Found</p>
                    <p className="text-sm font-medium text-slate-400">This candidate's journey is just beginning with us.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-16 py-4">
            {history.map((record) => (
                <div key={record.jr_candidate_id} className="space-y-6">
                    {/* JR Header Section */}
                    <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm ring-1 ring-slate-100/50">
                        <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-100">
                            <Briefcase className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em]">{record.jr_id}</span>
                                <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-400 border-slate-200 font-bold px-2 py-0">ARCHIVED JR RECORD</Badge>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">{record.position}</h3>
                        </div>
                    </div>

                    {/* Mirrored Layout Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left: Feedback */}
                        <div className="lg:col-span-2">
                            <FeedbackSection
                                jrCandidateId={record.jr_candidate_id}
                                candidateName={candidateName}
                                feedback={record.feedback}
                                isReadOnly={true}
                            />
                        </div>

                        {/* Right: Activity Log */}
                        <div className="lg:col-span-1">
                            <CandidateActivityLog
                                logs={record.logs}
                                jrCandidateId={record.jr_candidate_id}
                                isReadOnly={true}
                            />
                        </div>
                    </div>
                    
                    {/* Separator for multiple JRs */}
                    <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent pt-8" />
                </div>
            ))}
        </div>
    );
}
