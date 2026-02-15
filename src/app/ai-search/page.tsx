"use client";

import React, { useState, useEffect } from "react";
import { SearchForm } from "@/components/ai-search/SearchForm";
import { SearchHistory } from "@/components/ai-search/SearchHistory";
import { ResultsTable } from "@/components/ai-search/ResultsTable";
import { CandidateDetailPanel } from "@/components/ai-search/CandidateDetailPanel";
import { ConsolidatedResult } from "@/components/ai-search/types";
import { getSearchResults, getSearchJob, getSearchJobStatuses } from "@/app/actions/ai-search";
import { Loader2, AlertCircle, Sparkles, Globe, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import { StatusPipeline } from "@/components/ai-search/StatusPipeline";
import { PipelineStatus } from "@/components/ai-search/types-status";

export default function AISearchPage() {
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [results, setResults] = useState<ConsolidatedResult[]>([]);
    const [loadingResults, setLoadingResults] = useState(false);
    const [selectedResult, setSelectedResult] = useState<ConsolidatedResult | null>(null);
    const [searchJob, setSearchJob] = useState<any>(null); // Store full job details

    const [sessionStatus, setSessionStatus] = useState<string | null>(null);
    const [pipelineStatuses, setPipelineStatuses] = useState<PipelineStatus[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0); // to trigger history refresh
    const [isInsightsOpen, setIsInsightsOpen] = useState(true); // Default open

    // New UI States
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [filterSource, setFilterSource] = useState<'all' | 'internal' | 'external'>('all');

    // Polling setup
    useEffect(() => {
        if (!activeSessionId || sessionStatus !== 'processing') return;

        const interval = setInterval(() => {
            fetchResults(activeSessionId, true);
        }, 5000);

        return () => clearInterval(interval);
    }, [activeSessionId, sessionStatus]);

    const handleSearchStart = () => {
        setLoadingResults(true);
        setActiveSessionId(null);
        setResults([]);
        setPipelineStatuses([]);
        setSelectedResult(null);
        setSessionStatus('processing');
    };

    const handleSearchComplete = (sessionId: string) => {
        setActiveSessionId(sessionId);
        setRefreshTrigger(prev => prev + 1);
        fetchResults(sessionId);
    };

    const handleSelectSession = (sessionId: string) => {
        setActiveSessionId(sessionId);
        fetchResults(sessionId);
    };

    const fetchResults = async (sessionId: string, isSilent = false) => {
        if (!isSilent) setLoadingResults(true);
        try {
            // 1. Get Job Status & Details
            const jobRes = await getSearchJob(sessionId);
            if (jobRes.success && jobRes.data) {
                setSessionStatus(jobRes.data.status);
                setSearchJob(jobRes.data);
            }

            // 2. Get Pipeline Statuses
            const statusRes = await getSearchJobStatuses(sessionId);
            if (statusRes.success && statusRes.data) {
                setPipelineStatuses(statusRes.data);
            }

            // 3. Get Results
            const res = await getSearchResults(sessionId);
            if (res.success && res.data) {
                setResults(res.data);
            } else if (!isSilent) {
                toast.error("Failed to load results");
            }
        } catch (error) {
            console.error(error);
            if (!isSilent) toast.error("Error fetching results");
        } finally {
            if (!isSilent) setLoadingResults(false);
        }
    };

    // Filter Logic
    const filteredResults = results.filter(r => {
        if (filterSource === 'all') return true;
        if (filterSource === 'internal') return r.source === 'internal_db';
        if (filterSource === 'external') return r.source === 'external_db'; // or others like linkedin
        return true;
    });

    return (
        <div className="flex h-screen bg-slate-50/50 overflow-hidden">
            {/* Left Sidebar: Collapsible */}
            <motion.div
                initial={false}
                animate={{ width: isSidebarOpen ? 400 : 60 }}
                className="flex flex-col border-r bg-white h-full overflow-hidden shadow-sm z-20 relative transition-all duration-300 ease-in-out"
            >
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="absolute -right-3 top-6 bg-white border shadow-sm rounded-full p-1 z-50 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors"
                >
                    {isSidebarOpen ? <ChevronDown className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b flex items-center gap-3 min-h-[60px]">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-200">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        {isSidebarOpen && (
                            <motion.h1
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap"
                            >
                                AI Candidate Search
                            </motion.h1>
                        )}
                    </div>

                    {isSidebarOpen ? (
                        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
                            <SearchForm
                                onSearchStart={handleSearchStart}
                                onSearchComplete={handleSearchComplete}
                            />
                            <SearchHistory
                                onSelectSession={handleSelectSession}
                                activeSessionId={activeSessionId}
                                refreshTrigger={refreshTrigger}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center pt-6 gap-6">
                            {/* Collapsed Icons */}
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400" title="Search">
                                <SearchIcon className="w-4 h-4" />
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400" title="History">
                                <HistoryIcon className="w-4 h-4" />
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Right Content: Scrollable */}
            <div className="flex-1 flex flex-col relative overflow-hidden h-full">
                {/* Header / Breadcrumb Area - Sticky or Fixed? Let's keep it scrollable for now or sticky */}
                <div className="bg-white/80 backdrop-blur-md border-b px-6 py-3 z-10 flex justify-between items-center sticky top-0">
                    <AtsBreadcrumb items={[{ label: 'AI Search' }]} />
                    {userInfo(sessionStatus)}
                </div>

                <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 relative">
                    <div className="max-w-7xl mx-auto space-y-6">

                        <div className="flex justify-between items-end">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                    Search Results
                                    {activeSessionId && (
                                        <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                                            {activeSessionId.slice(0, 8)}...
                                        </span>
                                    )}
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    AI-powered analysis from internal & external sources
                                </p>
                            </div>

                            {/* Source Filter Tabs */}
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setFilterSource('all')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterSource === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    All Candidates
                                </button>
                                <button
                                    onClick={() => setFilterSource('internal')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${filterSource === 'internal' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Internal
                                </button>
                                <button
                                    onClick={() => setFilterSource('external')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${filterSource === 'external' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> External
                                </button>
                            </div>
                        </div>

                        <StatusPipeline statuses={pipelineStatuses} />

                        {/* AI Insights Summary (Collapsible) */}
                        {searchJob && (searchJob.internal_db_summary || searchJob.external_db_summary) && (
                            <div className="mb-6">
                                <button
                                    onClick={() => setIsInsightsOpen(!isInsightsOpen)}
                                    className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 uppercase tracking-widest mb-3 transition-colors"
                                >
                                    {isInsightsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    AI Market & Internal Insights
                                </button>

                                <AnimatePresence>
                                    {isInsightsOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {searchJob.internal_db_summary && (
                                                    <div className="bg-gradient-to-br from-indigo-50/50 to-white border border-indigo-100 rounded-xl p-5 shadow-sm">
                                                        <h3 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                                                            <Sparkles className="w-4 h-4 text-indigo-600" />
                                                            Internal DB Insights
                                                        </h3>
                                                        {renderSummaryContent(searchJob.internal_db_summary, "text-indigo-900/80", results)}
                                                    </div>
                                                )}
                                                {searchJob.external_db_summary && (
                                                    <div className="bg-gradient-to-br from-emerald-50/50 to-white border border-emerald-100 rounded-xl p-5 shadow-sm">
                                                        <h3 className="text-sm font-bold text-emerald-900 mb-3 flex items-center gap-2">
                                                            <Globe className="w-4 h-4 text-emerald-600" />
                                                            External Market Insights
                                                        </h3>
                                                        {renderSummaryContent(searchJob.external_db_summary, "text-emerald-900/80", results)}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        <div className="relative min-h-[200px]">
                            {loadingResults && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-20 rounded-xl transition-all">
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Updating results...</span>
                                    </div>
                                </div>
                            )}

                            <ResultsTable
                                results={filteredResults}
                                onSelectResult={setSelectedResult}
                                activeResultId={selectedResult?.id}
                                disableScroll={true} // Allow page scroll
                            />
                        </div>
                    </div>
                </main>

                {/* Slide-over Detail Panel */}
                <AnimatePresence>
                    {selectedResult && (
                        <div className="absolute inset-y-0 right-0 w-[850px] z-[100] flex shadow-2xl">
                            <CandidateDetailPanel
                                result={selectedResult}
                                onClose={() => setSelectedResult(null)}
                            />
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
// Additional icons needed
function SearchIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
    )
}
function HistoryIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" /><path d="M3 3v9h9" /><path d="M12 7v5l4 2" /></svg>
    )
}

// Helper to render summary content (text or JSON)
function renderSummaryContent(content: any, textColorClass: string, results: ConsolidatedResult[] = []) {
    if (!content) return null;

    let parsed = content;
    if (typeof content === 'string') {
        try {
            parsed = JSON.parse(content);
        } catch (e) {
            return <p className={`text-xs ${textColorClass} leading-relaxed whitespace-pre-line`}>{content}</p>;
        }
    }

    if (typeof parsed === 'object' && parsed !== null) {
        // Check for specific "AI Mapping" schema
        if (parsed.executive_summary && parsed.candidates && Array.isArray(parsed.candidates)) {
            return (
                <div className="space-y-4">
                    {/* Executive Summary */}
                    <div className="bg-white/50 rounded-lg p-3 border border-indigo-100/50">
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">Executive Summary</h4>
                        <p className={`text-xs ${textColorClass} leading-relaxed`}>{parsed.executive_summary}</p>
                    </div>

                    {/* Final Insight */}
                    {parsed.final_insight && (
                        <div className="bg-white/50 rounded-lg p-3 border border-emerald-100/50">
                            <h4 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2 flex items-center gap-2">
                                <Sparkles className="w-3 h-3 text-emerald-500" /> Final Insight
                            </h4>
                            <p className="text-xs text-emerald-800 font-medium leading-relaxed italic">
                                "{parsed.final_insight}"
                            </p>
                        </div>
                    )}

                    {/* Candidate Breakdown */}
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-70">Candidate Analysis</h4>
                        <div className="grid gap-3">
                            {parsed.candidates.map((c: any, idx: number) => {
                                const result = results.find(r => r.candidate_ref_id === c.id);
                                const photoUrl = result?.photo_url;
                                return (
                                    <div key={c.id || idx} className="bg-white rounded-lg p-3 border shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-start gap-3">
                                                {/* Photo */}
                                                <div className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    {photoUrl ? (
                                                        <img src={photoUrl} alt={c.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-sm font-bold text-slate-400">
                                                            {c.name?.charAt(0)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-slate-800">{c.name}</span>
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{c.id}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">Rank #{c.rank}</span>
                                                        <span className="text-[10px] font-bold bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-100">Score: {c.score}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>


                                        <div className="space-y-2 mt-3">
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Why this candidate?</span>
                                                <p className="text-xs text-slate-700 leading-snug">{c.why}</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                <div className="bg-red-50 p-2 rounded border border-red-100">
                                                    <span className="text-[10px] uppercase font-bold text-red-400 block mb-0.5">Risk</span>
                                                    <p className="text-[10px] text-red-800 leading-snug">{c.risk}</p>
                                                </div>
                                                <div className="bg-orange-50 p-2 rounded border border-orange-100">
                                                    <span className="text-[10px] uppercase font-bold text-orange-400 block mb-0.5">Trade-off</span>
                                                    <p className="text-[10px] text-orange-800 leading-snug">{c.trade_off}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div >
            );
        }

        // Default Object Renderer
        if (Array.isArray(parsed)) {
            return (
                <ul className={`list-disc list-inside text-xs ${textColorClass} space-y-1`}>
                    {parsed.map((item, idx) => (
                        <li key={idx}>{typeof item === 'object' ? JSON.stringify(item) : item}</li>
                    ))}
                </ul>
            );
        }

        return (
            <div className={`space-y-2 text-xs ${textColorClass}`}>
                {Object.entries(parsed).map(([key, value]) => {
                    // Recursively render objects if nested, or stringify
                    const displayValue = typeof value === 'object' && value !== null
                        ? JSON.stringify(value)
                        : String(value);

                    return (
                        <div key={key} className="flex flex-col gap-1 border-b border-black/5 pb-2 last:border-0 last:pb-0">
                            <span className="font-bold uppercase opacity-70 text-[10px] tracking-wider">{key.replace(/_/g, ' ')}</span>
                            <span className="font-medium whitespace-pre-wrap">{displayValue}</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    return <p className={`text-xs ${textColorClass} leading-relaxed whitespace-pre-line`}>{String(parsed)}</p>;
}

function userInfo(status: string | null) {
    if (!status) return null;
    if (status === 'processing') {
        return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Processing... Results may update.</span>;
    }
    if (status === 'failed') {
        return <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Search Failed</span>;
    }
    return <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Completed</span>;
}
