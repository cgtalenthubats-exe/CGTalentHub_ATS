"use client";

import React, { useEffect, useState } from "react";
import { ExternalCandidateDetail, ConsolidatedResult } from "./types";
import { getExternalCandidateDetails } from "@/app/actions/ai-search";
import { Loader2, User, Briefcase, MapPin, Linkedin, Mail, Phone, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalExperienceTable } from "./ExternalExperienceTable";

interface Props {
    result: ConsolidatedResult;
    onClose: () => void;
}

export function CandidateDetailPanel({ result, onClose }: Props) {
    const [detail, setDetail] = useState<ExternalCandidateDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetail = async () => {
            if (result.source === 'External' && result.ext_candidate_id) {
                setLoading(true);
                const res = await getExternalCandidateDetails(result.ext_candidate_id);
                if (res.success && res.data) {
                    setDetail(res.data);
                }
                setLoading(false);
            } else {
                // For internal, we might want to fetch from candidate_profile or just show what we have
                // For now, let's just use the result data as a fallback for basic info
                setLoading(false);
            }
        };

        fetchDetail();
    }, [result]);

    const displayData = detail || {
        candidate_id: result.candidate_id || result.ext_candidate_id || '',
        name: result.name,
        current_position: result.position,
        experiences: []
    } as Partial<ExternalCandidateDetail>;

    return (
        <div className="h-full flex flex-col bg-white border-l shadow-xl w-full max-w-2xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 border-b flex items-start justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16 border-2 border-white shadow-sm">
                        <AvatarImage src={displayData.photo_url || ""} />
                        <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xl font-bold">
                            {displayData.name?.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{displayData.name}</h2>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Briefcase className="w-4 h-4" />
                            <span>{displayData.current_position || "Position Unknown"}</span>
                        </div>
                        {result.company && (
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <MapPin className="w-4 h-4" />
                                <span>{result.company}</span>
                            </div>
                        )}
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-200">
                    <X className="w-5 h-5 text-slate-500" />
                </Button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                    {/* Match Info */}
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-indigo-900">AI Match Analysis</h3>
                            <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold px-3">
                                {result.match_score}%
                            </Badge>
                        </div>
                        <p className="text-sm text-indigo-800 leading-relaxed">
                            {result.reason_for_match || "No analysis available."}
                        </p>

                        {result.key_highlights && (
                            <div className="mt-3">
                                <p className="text-xs font-bold text-indigo-900 uppercase tracking-wide mb-1">Key Highlights</p>
                                <p className="text-sm text-indigo-700">{result.key_highlights}</p>
                            </div>
                        )}
                    </div>

                    {/* AI Summary (from Enhance) */}
                    {displayData.ai_summary && (
                        <div>
                            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                <User className="w-4 h-4 text-emerald-500" /> Professional Summary
                            </h3>
                            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-md border">
                                {displayData.ai_summary}
                            </p>
                        </div>
                    )}

                    {/* Contact & Links */}
                    <div className="flex flex-wrap gap-3">
                        {displayData.linkedin && (
                            <a href={displayData.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-[#0077b5] text-white rounded-md text-sm hover:opacity-90 transition-opacity">
                                <Linkedin className="w-4 h-4" /> LinkedIn Profile
                            </a>
                        )}
                        {result.link_url && result.link_url !== displayData.linkedin && (
                            <a href={result.link_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded-md text-sm hover:opacity-90 transition-opacity">
                                <User className="w-4 h-4" /> Source Profile
                            </a>
                        )}
                        {displayData.email && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-sm border">
                                <Mail className="w-4 h-4 text-slate-400" /> {displayData.email}
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Experience */}
                    <div>
                        <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-blue-500" /> Work Experience
                        </h3>
                        {loading ? (
                            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-300" /></div>
                        ) : (
                            <ExternalExperienceTable experiences={displayData.experiences || []} />
                        )}
                    </div>
                </div>
            </ScrollArea>

            {/* Footer Actions */}
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                {result.source === 'External' && (
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm">
                        <User className="w-4 h-4" /> Import to Candidate Pool
                    </Button>
                )}
                <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
        </div>
    );
}
