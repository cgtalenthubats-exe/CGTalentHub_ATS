"use client";

import React, { useEffect, useState } from "react";
import { getSearchHistory } from "@/app/actions/ai-search";
import { SearchJob } from "./types";
import { Loader2, Clock, CheckCircle2, XCircle, ChevronRight, RefreshCw, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface SearchHistoryProps {
    onSelectSession: (sessionId: string) => void;
    activeSessionId?: string | null;
    refreshTrigger?: number; // Prop to trigger refresh from parent
}

export function SearchHistory({ onSelectSession, activeSessionId, refreshTrigger }: SearchHistoryProps) {
    const [history, setHistory] = useState<SearchJob[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        setLoading(true);
        const res = await getSearchHistory();
        if (res.success && res.data) {
            setHistory(res.data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchHistory();
    }, [refreshTrigger]); // re-fetch when new search is submitted

    return (
        <Card className="flex-1 flex flex-col border-none shadow-sm bg-white overflow-hidden min-h-0">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between bg-slate-50/50">
                <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    Search History
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchHistory} title="Refresh History">
                    <RefreshCw className={cn("w-3 h-3 text-slate-400", loading && "animate-spin")} />
                </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    {loading && history.length === 0 ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
                    ) : history.length === 0 ? (
                        <div className="text-center p-8 text-xs text-slate-400">No search history found.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {history.map((job) => (
                                <div
                                    key={job.session_id}
                                    className={cn(
                                        "p-3 cursor-pointer hover:bg-slate-50 transition-colors group relative border-l-4 border-transparent",
                                        activeSessionId === job.session_id ? "bg-indigo-50 border-indigo-500" : ""
                                    )}
                                    onClick={() => onSelectSession(job.session_id)}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={cn("text-xs font-medium truncate max-w-[180px]", activeSessionId === job.session_id ? "text-indigo-700" : "text-slate-700")}>
                                            {job.original_query}
                                        </span>
                                        {job.status === 'completed' ? (
                                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                        ) : job.status === 'processing' ? (
                                            <Loader2 className="w-3 h-3 text-blue-500 animate-spin shrink-0" />
                                        ) : (
                                            <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                                        <span>{new Date(job.timestamp).toLocaleString()}</span>
                                        <span className="truncate max-w-[80px]">{job.user_email || 'Unknown'}</span>
                                    </div>

                                    {job.report && (
                                        <div className="mt-1 flex items-center gap-1 text-[10px] text-indigo-500">
                                            <FileText className="w-3 h-3" />
                                            <span className="truncate max-w-[200px]">Result Available</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
