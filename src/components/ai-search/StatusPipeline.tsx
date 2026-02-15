
"use client";

import React from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { PipelineStatus } from "./types-status";
import { Card, CardContent } from "@/components/ui/card";

interface StatusPipelineProps {
    statuses: PipelineStatus[];
}

export function StatusPipeline({ statuses }: StatusPipelineProps) {
    if (!statuses || statuses.length === 0) return null;

    const filteredStatuses = statuses.filter(s => s.source.toLowerCase() !== 'linkedin_db');

    if (filteredStatuses.length === 0) return null;

    const agents = [
        { key: "summary_agent_1", label: "Agent 1" },
        { key: "summary_agent_2", label: "Agent 2" },
        { key: "summary_agent_3", label: "Agent 3" },
        { key: "summary_agent_4", label: "Agent 4" },
    ];

    const getSourceLabel = (source: string) => {
        switch (source) {
            case 'Internal_db': return 'Internal DB';
            case 'external_db': return 'External DB';
            default: return source;
        }
    };

    return (
        <Card className="mb-6 border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-4 flex flex-col gap-4">
                {filteredStatuses.map((status) => (
                    <div key={status.source} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-700 min-w-[100px]">
                                {getSourceLabel(status.source)}
                            </span>
                            <div className="flex-1 h-px bg-slate-100" />
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            {agents.map((agent, index) => {
                                const value = status[agent.key as keyof PipelineStatus] as string | null;
                                const isWaiting = value === 'Waiting...';
                                const isEmpty = !value || isWaiting;

                                // Logic for "Active": current is processing, or it's the first empty one
                                // But for now, let's keep it simple: 
                                // - Has custom text -> Completed
                                // - Is "Waiting..." -> Processing
                                // - Is null -> Pending

                                return (
                                    <div key={agent.key} className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                            {isEmpty ? (
                                                isWaiting ? (
                                                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                                ) : (
                                                    <Circle className="w-4 h-4 text-slate-300" />
                                                )
                                            ) : (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            )}
                                            <span className={`text-xs font-medium ${isEmpty ? 'text-slate-400' : 'text-slate-700'}`}>
                                                {agent.label}
                                            </span>
                                        </div>
                                        {value && !isWaiting && (
                                            <div className="bg-slate-50 p-2 rounded border border-slate-100 min-h-[40px]">
                                                <p className="text-[11px] text-slate-600 leading-tight">
                                                    {value}
                                                </p>
                                            </div>
                                        )}
                                        {isWaiting && (
                                            <div className="bg-blue-50/50 p-2 rounded border border-blue-100 border-dashed min-h-[40px] flex items-center justify-center">
                                                <p className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold">
                                                    Processing
                                                </p>
                                            </div>
                                        )}
                                        {!value && (
                                            <div className="bg-slate-50/30 p-2 rounded border border-slate-100 border-dashed min-h-[40px] flex items-center justify-center">
                                                <p className="text-[10px] text-slate-300 uppercase tracking-wider">
                                                    Pending
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
