"use client";

import React, { useState, useEffect, DragEvent } from "react";
import { JRCandidate } from "@/types/requisition";
import { getJRCandidates } from "@/app/actions/jr-candidates";
import { getStatusMaster, StatusMaster } from "@/app/actions/status-master";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KanbanBoardProps {
    jrId: string;
}

export function KanbanBoard({ jrId }: KanbanBoardProps) {
    const [candidates, setCandidates] = useState<JRCandidate[]>([]);
    const [stages, setStages] = useState<StatusMaster[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [dCandidates, dStages] = await Promise.all([
                    getJRCandidates(jrId),
                    getStatusMaster()
                ]);
                setCandidates(dCandidates);
                setStages(dStages);
            } catch (error) {
                console.error("Failed to load kanban data", error);
            }
            setLoading(false);
        }
        if (jrId) load();
    }, [jrId]);

    // --- HTML5 DnD Logic ---
    const handleDragStart = (e: DragEvent<HTMLDivElement>, candidateId: string) => {
        e.dataTransfer.setData("candidateId", candidateId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: DragEvent<HTMLDivElement>, newStage: string) => {
        e.preventDefault();
        const candidateId = e.dataTransfer.getData("candidateId");

        if (candidateId) {
            // Optimistic Update
            setCandidates((prev) =>
                prev.map((c) => c.status === newStage ? c : (c.id === candidateId ? { ...c, status: newStage } : c))
            );

            // TODO: Call Server Action to persist change to DB
            console.log(`Moved ${candidateId} to ${newStage}`);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading board...</div>;

    return (
        <div className="flex h-[600px] gap-4 overflow-x-auto pb-4">
            {stages.map((stageObj) => {
                const stage = stageObj.status;
                // Filter candidates for this stage. 
                // Note: DB status strings must match status_master strings exactly.
                const stageCandidates = candidates.filter(c => c.status === stage);

                // Header Color Mapping
                const headerColor = {
                    'Pool': 'bg-slate-100 border-slate-200 text-slate-700',
                    'Screening': 'bg-blue-50 border-blue-200 text-blue-700', // Mapped from 'Phone Screen' if needed, or check status master
                    'Phone Screen': 'bg-blue-50 border-blue-200 text-blue-700',
                    'Interview': 'bg-purple-50 border-purple-200 text-purple-700',
                    'Offer': 'bg-orange-50 border-orange-200 text-orange-700',
                    'Hired': 'bg-green-50 border-green-200 text-green-700',
                    'Rejected': 'bg-red-50 border-red-200 text-red-700',
                }[stage] || 'bg-slate-100 border-slate-200 text-slate-700';

                return (
                    <div
                        key={stage}
                        className={`flex-shrink-0 w-72 flex flex-col gap-2 rounded-xl border p-2 ${headerColor}`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, stage)}
                    >
                        <div className="flex items-center justify-between p-2">
                            <h3 className="font-semibold text-sm opacity-90">{stage}</h3>
                            <Badge variant="secondary" className="bg-white/50 text-inherit rounded-full h-5 px-1.5 min-w-[20px] justify-center flex">
                                {stageCandidates.length}
                            </Badge>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="flex flex-col gap-2 p-1">
                                {stageCandidates.map((c) => (
                                    <div
                                        key={c.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, c.id)}
                                        className="bg-white p-3 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all group"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={c.candidate_image_url} />
                                                    <AvatarFallback className="text-[10px]">{c.candidate_name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm font-semibold truncate max-w-[120px]">{c.candidate_name}</span>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 -mr-1">
                                                <MoreHorizontal className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="text-xs text-muted-foreground mb-2">
                                            {c.candidate_current_position}
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <Badge variant="outline" className="text-[10px] font-normal px-1 py-0 h-4 bg-slate-50">
                                                {c.source}
                                            </Badge>
                                            <span className="text-[10px] text-slate-400">
                                                {/* Placeholder for days in stage */}
                                                2d
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                );
            })}
        </div>
    );
}
