"use client";

import React, { useState, useEffect } from "react";
import { SearchForm } from "@/components/ai-search/SearchForm";
import { SearchHistory } from "@/components/ai-search/SearchHistory";
import { ResultsTable } from "@/components/ai-search/ResultsTable";
import { CandidateDetailPanel } from "@/components/ai-search/CandidateDetailPanel";
import { ConsolidatedResult } from "@/components/ai-search/types";
import { getSearchResults, getSearchJob, getSearchJobStatuses } from "@/app/actions/ai-search";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import { StatusPipeline } from "@/components/ai-search/StatusPipeline";
import { PipelineStatus } from "@/components/ai-search/types-status";

export default function AISearchPage() {
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [results, setResults] = useState<ConsolidatedResult[]>([]);
    const [loadingResults, setLoadingResults] = useState(false);
    const [selectedResult, setSelectedResult] = useState<ConsolidatedResult | null>(null);
    const [sessionStatus, setSessionStatus] = useState<string | null>(null);
    const [pipelineStatuses, setPipelineStatuses] = useState<PipelineStatus[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0); // to trigger history refresh

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
            // 1. Get Job Status
            const jobRes = await getSearchJob(sessionId);
            if (jobRes.success && jobRes.data) {
                setSessionStatus(jobRes.data.status);
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

    return (
        <div className="flex h-screen bg-slate-50/50 overflow-hidden">
            {/* Left Sidebar: Form & History */}
            <div className="w-[400px] flex flex-col gap-4 p-4 border-r bg-white h-full overflow-hidden shadow-sm z-10">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI Candidate Search</h1>
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

            {/* Right Content: Results */}
            <div className="flex-1 flex relative overflow-hidden">
                <main className="flex-1 flex flex-col p-6 overflow-hidden relative">
                    <AtsBreadcrumb
                        items={[
                            { label: 'AI Search' }
                        ]}
                    />
                    <div className="mb-4 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-slate-700">
                            Search Results
                            {activeSessionId && (
                                <span className="ml-2 text-sm font-normal text-slate-500">
                                    (Session: {activeSessionId.slice(0, 8)}...)
                                </span>
                            )}
                        </h2>
                        {userInfo(sessionStatus)}
                    </div>

                    <StatusPipeline statuses={pipelineStatuses} />

                    <div className="flex-1 overflow-hidden relative mt-2">
                        {loadingResults && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-20 rounded-xl transition-all">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Updating results...</span>
                                </div>
                            </div>
                        )}

                        <ResultsTable
                            results={results}
                            onSelectResult={setSelectedResult}
                            activeResultId={selectedResult?.id}
                        />
                    </div>
                </main>

                {/* Slide-over Detail Panel */}
                <AnimatePresence>
                    {selectedResult && (
                        <div className="absolute inset-y-0 right-0 w-[850px] z-[100] flex">
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
