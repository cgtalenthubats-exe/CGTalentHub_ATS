"use client";

import React, { useEffect, useState } from "react";
import { ExternalCandidateDetail, ConsolidatedResult } from "./types";
import { getExternalCandidateDetails, getInternalCandidateDetails } from "@/app/actions/ai-search";
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
    Plus
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalExperienceTable } from "./ExternalExperienceTable";
import { motion } from "framer-motion";

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


    const parsedInsights = safeParse(result.inferred_insights);

    useEffect(() => {
        const fetchDetail = async () => {
            setLoading(true);
            if (result.source?.toLowerCase() !== 'internal_db') {
                const res = await getExternalCandidateDetails(result.candidate_ref_id);
                if (res.success && res.data) {
                    setDetail(res.data);
                }
            } else {
                const res = await getInternalCandidateDetails(result.candidate_ref_id);
                if (res.success && res.data) {
                    // Map internal data to interface if needed, or if types match mostly
                    setDetail(res.data as any);
                }
            }
            setLoading(false);
        };

        fetchDetail();
    }, [result]);

    const displayData = detail || {
        candidate_id: result.candidate_ref_id,
        name: result.name,
        current_position: result.position,
        experiences: []
    } as Partial<ExternalCandidateDetail>;

    return (
        <motion.div
            initial={{ x: 800 }}
            animate={{ x: 0 }}
            exit={{ x: 800 }}
            transition={{ type: "spring", damping: 30, stiffness: 200 }}
            className="h-full flex flex-col bg-white border-l shadow-2xl w-full max-w-4xl overflow-hidden"
        >
            {/* Premium Header */}
            <div className="relative p-8 border-b bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-950 text-white overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Zap className="w-48 h-48" />
                </div>

                <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-6">
                        <Avatar className="w-20 h-20 border-4 border-white/20 shadow-2xl">
                            <AvatarImage src={displayData.photo_url || undefined} className="object-cover" />
                            <AvatarFallback className="bg-white/10 text-white text-2xl font-bold backdrop-blur-md">
                                {displayData.name?.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <motion.h2
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="text-2xl font-bold tracking-tight"
                                >
                                    {displayData.name}
                                </motion.h2>
                                <Badge variant="outline" className="text-[10px] h-5 px-2 border-indigo-200/30 bg-indigo-500/20 text-indigo-200 uppercase tracking-wider font-mono">
                                    ID: {result.candidate_ref_id}
                                </Badge>
                            </div>

                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-indigo-100 font-medium text-sm">
                                    <Briefcase className="w-4 h-4 text-indigo-300" />
                                    <span>{displayData.current_position || "Position Unknown"}</span>
                                </div>
                                {result.company && (
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 text-indigo-200/80 text-sm">
                                            <Building2 className="w-4 h-4" />
                                            <span className="font-bold">{result.company}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {result.company_tier && (
                                                <Badge variant="outline" className="text-[10px] h-5 px-2 border-indigo-400/30 bg-white/10 text-white font-bold uppercase tracking-wider">
                                                    {result.company_tier}
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
                        className="rounded-full hover:bg-white/10 text-white/70 hover:text-white -mr-2 -mt-2"
                    >
                        <X className="w-6 h-6" />
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <ScrollArea className="flex-1 bg-slate-50/50">
                <div className="p-8 space-y-8">

                    {/* 1. Horizontal Score Dashboard */}
                    <div className="bg-slate-900 rounded-2xl p-6 shadow-xl flex flex-wrap md:flex-nowrap items-center justify-between gap-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Zap className="w-32 h-32 text-indigo-500" />
                        </div>

                        {/* Total */}
                        <div className="flex items-center gap-4 z-10 min-w-[200px]">
                            <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center border-4 border-indigo-500/30 shadow-lg">
                                <span className="text-xl font-black">{result.final_total_score}</span>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold mb-1">Total Score</div>
                                <div className="h-2 w-32 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500" style={{ width: `${result.final_total_score}%` }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="hidden md:block w-px h-12 bg-white/10"></div>

                        {/* Parts */}
                        <div className="flex gap-8 z-10 flex-1 justify-around">
                            <div className="text-center">
                                <div className="text-2xl font-bold">{result.score_part_a}</div>
                                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Profile Score (A)</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold">{result.score_part_b}</div>
                                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Criteria Score (B)</div>
                            </div>
                        </div>
                    </div>


                    {/* 2. Stacked Layout for Core Intelligence */}
                    <div className="space-y-6">

                        {/* Executive Summary & Highlights */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-4">
                                <FileText className="w-4 h-4 text-indigo-500" /> Executive Summary
                            </h4>
                            <p className="text-sm text-slate-700 leading-relaxed font-medium text-justify">
                                {result.executive_summary || "No detailed summary available."}
                            </p>
                        </div>

                        {result.highlight_project && (
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                                <h3 className="text-xs font-black text-blue-900 mb-3 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Zap className="w-4 h-4" /> Key Project Highlight
                                </h3>
                                <p className="text-sm text-blue-800 leading-relaxed font-medium">
                                    {result.highlight_project}
                                </p>
                            </div>
                        )}

                        {/* Gap & Vision */}
                        {result.gap_analysis && (
                            <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 shadow-sm">
                                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-orange-900 mb-4 flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4" /> Gap Analysis
                                </h4>
                                <p className="text-sm text-orange-800 leading-relaxed font-bold italic">
                                    "{result.gap_analysis}"
                                </p>
                            </div>
                        )}

                        {result.vision_strategy && (
                            <div className="bg-purple-50/50 p-6 rounded-2xl border border-purple-100">
                                <h3 className="text-xs font-black text-purple-900 mb-3 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4" /> Vision & Strategy
                                </h3>
                                <p className="text-sm text-purple-800 leading-relaxed font-medium">
                                    {result.vision_strategy}
                                </p>
                            </div>
                        )}
                    </div>


                    {/* 3. Contextual Intelligence (Full Width) */}
                    {parsedInsights && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                            <h3 className="text-xs font-black text-slate-400 mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Globe className="w-4 h-4" /> Contextual Intelligence
                            </h3>
                            {typeof parsedInsights === 'object' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {Object.entries(parsedInsights).map(([k, v]: [string, any]) => (
                                        <div key={k} className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{k}</span>
                                            <span className="text-xs font-bold text-slate-700">{v}</span>
                                        </div>
                                    ))}
                                    {result.demographic_tag && (
                                        <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                                <User className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Archetype</span>
                                                <span className="text-xs font-bold text-slate-900">{result.demographic_tag}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-600 leading-relaxed">{parsedInsights}</p>
                            )}
                        </div>
                    )}

                    <Separator className="opacity-50" />

                    {/* 4. Professional Journey Table */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Briefcase className="w-5 h-5 text-indigo-600" />
                                <h3 className="text-lg font-bold text-slate-900">Professional Journey</h3>
                            </div>
                            {displayData.experiences && displayData.experiences.length > 0 && (
                                <Badge variant="secondary" className="bg-slate-200 text-slate-600 font-bold px-3 py-1 rounded-full">
                                    {displayData.experiences.length} Roles
                                </Badge>
                            )}
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                                <Loader2 className="animate-spin text-indigo-500 w-8 h-8" />
                                <span className="text-[10px] uppercase tracking-widest">Loading History...</span>
                            </div>
                        ) : (
                            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                                <ExternalExperienceTable experiences={displayData.experiences || []} />
                            </div>
                        )}
                    </div>


                    {/* Links Footer */}
                    <div className="flex flex-wrap gap-3 items-center pt-4">
                        {/* Reference Links */}
                        {displayData.reference_link && (
                            <div className="w-full flex flex-col gap-2 mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                <span className="text-[10px] font-black uppercase text-slate-400">Reference Sources</span>
                                <div className="flex flex-col gap-1">
                                    {displayData.reference_link.split('\n').filter(l => l.trim().length > 0).map((link, idx) => (
                                        <a
                                            key={idx}
                                            href={link.trim()}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-medium text-blue-600 hover:underline hover:text-blue-800 flex items-center gap-1.5 truncate"
                                        >
                                            <Globe className="w-3 h-3 shrink-0" />
                                            {link.trim()}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-3 items-center pt-2">
                            {(result.link_url || displayData.linkedin) && (
                                <a href={result.link_url || displayData.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                                    <Linkedin className="w-3 h-3" /> LinkedIn Profile
                                </a>
                            )}
                            {displayData.email && (
                                <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                    <Mail className="w-3 h-3" /> {displayData.email}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </ScrollArea>

            {/* Footer Actions */}
            <div className="p-6 border-t bg-white flex items-center justify-end gap-3 z-20 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)] shrink-0">
                <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold text-slate-500 h-12 px-6 hover:bg-slate-50">
                    Close
                </Button>
                {result.source !== 'internal_db' && (
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-500/20 rounded-xl h-12 px-8 font-bold">
                        <Plus className="w-4 h-4" /> Import to Requisition
                    </Button>
                )}
            </div>
        </motion.div>
    );
}
