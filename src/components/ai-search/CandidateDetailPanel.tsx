"use client";

import React, { useEffect, useState } from "react";
import { ExternalCandidateDetail, ConsolidatedResult } from "./types";
import { getExternalCandidateDetails } from "@/app/actions/ai-search";
import {
    Loader2,
    User,
    Briefcase,
    Linkedin,
    Mail,
    X,
    Building2,
    ShieldAlert,
    FileText,
    Zap,
    Globe,
    Lightbulb,
    Trophy,
    Zap as ZapIcon,
    Scale,
    Palette,
    Heart,
    Plus
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalExperienceTable } from "./ExternalExperienceTable";
import { motion, AnimatePresence } from "framer-motion";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface Props {
    result: ConsolidatedResult;
    onClose: () => void;
}

export function CandidateDetailPanel({ result, onClose }: Props) {
    const [detail, setDetail] = useState<ExternalCandidateDetail | null>(null);
    const [loading, setLoading] = useState(true);

    // Robust parsing for JSON fields
    const safeParse = (data: any) => {
        if (!data) return null;
        if (typeof data === 'object') return data;
        try {
            return JSON.parse(data);
        } catch (e) {
            return data; // Return as is if it's just a string
        }
    };

    const parsedScoring = safeParse(result.scoring_breakdown);
    const parsedInsights = safeParse(result.inferred_insights);

    useEffect(() => {
        const fetchDetail = async () => {
            if (result.source !== 'internal_db') {
                setLoading(true);
                const res = await getExternalCandidateDetails(result.candidate_ref_id);
                if (res.success && res.data) {
                    setDetail(res.data);
                }
                setLoading(false);
            } else {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [result]);

    const displayData = detail || {
        candidate_id: result.candidate_ref_id,
        name: result.name,
        current_position: result.position,
        experiences: []
    } as Partial<ExternalCandidateDetail>;

    const radarData = parsedScoring ? Object.entries(parsedScoring)
        .filter(([k]) => ['leadership', 'scale', 'innovation', 'culture', 'resilience'].includes(k))
        .map(([key, val]) => ({
            subject: key.charAt(0).toUpperCase() + key.slice(1),
            A: typeof val === 'number' ? val : parseInt(val as string) || 0,
            fullMark: 100,
        })) : [];

    return (
        <motion.div
            initial={{ x: 800 }}
            animate={{ x: 0 }}
            exit={{ x: 800 }}
            transition={{ type: "spring", damping: 30, stiffness: 200 }}
            className="h-full flex flex-col bg-white border-l shadow-2xl w-full max-w-4xl overflow-hidden"
        >
            {/* Premium Header */}
            <div className="relative p-10 border-b bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-950 text-white overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Zap className="w-48 h-48" />
                </div>

                <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-8">
                        <Avatar className="w-24 h-24 border-4 border-white/20 shadow-2xl sticky top-0">
                            <AvatarImage src={displayData.photo_url || ""} />
                            <AvatarFallback className="bg-white/10 text-white text-3xl font-bold backdrop-blur-md">
                                {displayData.name?.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <motion.h2
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-3xl font-bold tracking-tight mb-2"
                            >
                                {displayData.name}
                            </motion.h2>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-indigo-100 font-semibold text-lg">
                                    <Briefcase className="w-5 h-5 text-indigo-300" />
                                    <span>{displayData.current_position || "Position Unknown"}</span>
                                </div>
                                {result.company && (
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 text-indigo-200/80">
                                            <Building2 className="w-4 h-4" />
                                            <span className="font-bold">{result.company}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {result.company_tier && (
                                                <Badge variant="outline" className="text-[10px] h-5 px-2 border-indigo-400/30 bg-white/10 text-white font-bold uppercase tracking-wider">
                                                    {result.company_tier}
                                                </Badge>
                                            )}
                                            {result.business_model && (
                                                <Badge variant="outline" className="text-[10px] h-5 px-2 border-slate-400/50 bg-white/5 text-slate-100 uppercase tracking-wider">
                                                    {result.business_model}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="rounded-full hover:bg-white/10 text-white/70 hover:text-white -mt-4 -mr-4"
                    >
                        <X className="w-8 h-8" />
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <ScrollArea className="flex-1 bg-slate-50/30">
                <div className="p-10 space-y-12">
                    {/* Top Action Links - Handle Multiline source_url */}
                    <div className="flex flex-wrap gap-4 items-center">
                        {(result.link_url || displayData.linkedin) && (
                            <a
                                href={result.link_url || displayData.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2.5 px-6 py-3 bg-[#0077b5] text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all hover:-translate-y-1"
                            >
                                <Linkedin className="w-5 h-5" />
                                LinkedIn Profile
                            </a>
                        )}

                        {/* Parse multiline source_urls */}
                        {result.source_url?.split(/[\n,;]/).filter(url => url.trim().startsWith('http')).map((url, idx) => (
                            <a
                                key={idx}
                                href={url.trim()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2.5 px-6 py-3 bg-slate-800 text-white rounded-2xl text-sm font-bold shadow-lg shadow-slate-500/20 hover:shadow-slate-500/40 transition-all hover:-translate-y-1"
                            >
                                <Globe className="w-5 h-5" />
                                Source {idx + 1}
                            </a>
                        ))}

                        {displayData.email && (
                            <div className="inline-flex items-center gap-2.5 px-5 py-3 bg-white text-slate-700 rounded-2xl text-sm font-bold border border-slate-200 shadow-sm">
                                <Mail className="w-5 h-5 text-slate-400" />
                                {displayData.email}
                            </div>
                        )}
                    </div>

                    {/* Adaptive Strategic Insights Section */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 px-1">
                            <Lightbulb className="w-6 h-6 text-amber-500" />
                            <h3 className="text-xl font-bold text-slate-900">Strategic Profile Intelligence</h3>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                {/* Career Narrative / Description Moved from Header */}
                                {result.position && result.position.length > 50 && (
                                    <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-500/10 relative overflow-hidden group">
                                        <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                            <Trophy className="w-24 h-24" />
                                        </div>
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-4 text-indigo-200">Executive Narrative</h4>
                                        <p className="text-base leading-relaxed font-semibold italic opacity-90">
                                            "{result.position}"
                                        </p>
                                    </div>
                                )}

                                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                            <FileText className="w-4 h-4" /> AI Executive Summary
                                        </h4>
                                    </div>
                                    <p className="text-base text-slate-700 leading-relaxed font-medium">
                                        {result.executive_summary || "No detailed summary available."}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Score Breakdown as Blocks of Numbers */}
                                <div className="bg-slate-900 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-8">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Match Efficiency</h4>
                                        <div className="text-4xl font-black text-white">
                                            {result.match_score}<span className="text-xl text-indigo-500">%</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {parsedScoring && Object.entries(parsedScoring).map(([key, val]: [string, any]) => (
                                            <div key={key} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 hover:bg-white/10 transition-colors">
                                                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest text-center">{key.replace('_', ' ')}</span>
                                                <span className="text-2xl font-black text-white">{val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {result.red_flags && (
                                    <div className="bg-red-50 p-8 rounded-[2rem] border border-red-100 relative overflow-hidden group">
                                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:rotate-12 transition-transform duration-500">
                                            <ShieldAlert className="w-24 h-24 text-red-600" />
                                        </div>
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-red-900 mb-4 flex items-center gap-2">
                                            <ShieldAlert className="w-4 h-4" /> Risk Assessment
                                        </h4>
                                        <p className="text-sm text-red-800 leading-relaxed font-bold italic">
                                            "{result.red_flags}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* AI Inferred Insights - Text or Tags */}
                    {parsedInsights && (
                        <div className="pt-8 border-t border-slate-200">
                            <h3 className="text-sm font-black text-slate-400 mb-6 uppercase tracking-[0.2em]">Contextual Intelligence</h3>
                            {typeof parsedInsights === 'object' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {Object.entries(parsedInsights).map(([k, v]: [string, any]) => (
                                        <div key={k} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-indigo-200 transition-all hover:shadow-md">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{k}</span>
                                            <span className="text-sm font-bold text-slate-800 leading-snug">{v}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-indigo-50/40 p-10 rounded-[2.5rem] border border-indigo-100/50 relative">
                                    <p className="text-lg text-indigo-950/80 leading-relaxed font-semibold text-justify">
                                        {parsedInsights}
                                    </p>
                                </div>
                            )}

                            {result.demographic_tag && (
                                <div className="mt-8 inline-flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                        <User className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Candidate Archetype</span>
                                        <span className="text-sm font-black text-slate-900">{result.demographic_tag}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pro Summary */}
                    {displayData.ai_summary && (
                        <div className="relative">
                            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-transparent rounded-full" />
                            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-emerald-500" /> Career Trajectory Summary
                            </h3>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50/50 p-6 rounded-2xl border border-dashed text-justify">
                                {displayData.ai_summary}
                            </p>
                        </div>
                    )}

                    <Separator className="opacity-50" />

                    {/* Experience Section */}
                    <div className="space-y-8">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-3">
                                <Briefcase className="w-6 h-6 text-indigo-600" />
                                <h3 className="text-xl font-bold text-slate-900">Professional Journey</h3>
                            </div>
                            {displayData.experiences && (
                                <Badge variant="secondary" className="bg-slate-200 text-slate-600 font-bold px-4 py-1.5 rounded-full border-none">
                                    {displayData.experiences.length} Milestones
                                </Badge>
                            )}
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="animate-spin text-indigo-600 w-10 h-10" />
                                <span className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Synching deep profile...</span>
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
                                <ExternalExperienceTable experiences={displayData.experiences || []} />
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>

            {/* Premium Footer Actions */}
            <div className="p-8 border-t bg-white flex items-center justify-end gap-4 relative z-20 shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.05)]">
                <Button variant="ghost" onClick={onClose} className="rounded-2xl font-black text-slate-400 h-14 px-8 uppercase tracking-widest text-xs hover:text-slate-600 hover:bg-slate-50 transition-colors">
                    Close Profile
                </Button>
                {result.source !== 'internal_db' && (
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-3 shadow-2xl shadow-indigo-500/30 rounded-2xl h-14 px-12 font-black uppercase tracking-widest text-xs border-b-4 border-indigo-900 active:border-b-0 active:translate-y-1 transition-all">
                        <Plus className="w-5 h-5" /> Import to Requisition
                    </Button>
                )}
            </div>
        </motion.div>
    );
}
