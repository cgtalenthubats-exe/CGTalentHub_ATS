"use client";

import React, { useState, useEffect, DragEvent } from "react";
import { JRCandidate } from "@/types/requisition";
import { getJRCandidates } from "@/app/actions/jr-candidates";
import { getStatusMaster } from "@/app/actions/status-master";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MoreHorizontal, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateCandidateStatus } from "@/app/actions/status-updates";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CandidateAvatar } from "@/components/candidate-avatar";

interface KanbanBoardProps {
    jrId: string;
    jobTitle: string;
    bu: string;
    subBu: string;
}

type StageType = {
    status: string;
    stage_order?: number;
}

import { ConfirmPlacementDialog } from "@/components/confirm-placement-dialog";

export function KanbanBoard({ jrId, jobTitle, bu, subBu }: KanbanBoardProps) {
    const [candidates, setCandidates] = useState<JRCandidate[]>([]);
    const [stages, setStages] = useState<StageType[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [placementCandidate, setPlacementCandidate] = useState<{ id: string, name: string } | null>(null);

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
            const candidate = candidates.find(c => c.id === candidateId);
            if (candidate?.status === newStage) return;

            setUpdatingId(candidateId);

            if (newStage === 'Successful Placement') {
                if (candidate) {
                    setPlacementCandidate({
                        id: candidateId,
                        name: candidate.candidate_name || "Unknown Candidate"
                    });
                }
                return;
            }

            setUpdatingId(candidateId);

            // Persistent Update
            const { success, error } = await updateCandidateStatus(candidateId, newStage);

            if (success) {
                // Refresh data to ensure logs and everything are in sync
                const updated = await getJRCandidates(jrId);
                setCandidates(updated);
            } else {
                alert("Failed to move: " + error);
            }
            setUpdatingId(null);
        }
    };

    const handleStatusChange = async (candidateId: string, newStatus: string) => {
        if (newStatus === 'Successful Placement') {
            const candidate = candidates.find(c => c.id === candidateId);
            if (candidate) {
                setPlacementCandidate({
                    id: candidateId,
                    name: candidate.candidate_name || "Unknown Candidate"
                });
            }
            return;
        }

        setUpdatingId(candidateId);
        const { success, error } = await updateCandidateStatus(candidateId, newStatus);
        if (success) {
            const updated = await getJRCandidates(jrId);
            setCandidates(updated);
        } else {
            alert("Update error: " + error);
        }
        setUpdatingId(null);
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading board...</div>;

    return (
        <div className="flex h-[600px] gap-4 overflow-x-auto pb-4">
            {stages.map((stageObj) => {
                const stage = stageObj.status;
                const stageCandidates = candidates.filter(c => c.status === stage);

                // Option: Hide empty columns if allowed
                if (stageCandidates.length === 0) return null;

                // Header Color Mapping - Increased Contrast & Layering
                const colorMap: Record<string, string> = {
                    'Pool': 'bg-slate-100 border-slate-300 text-slate-800 border-t-4 border-t-slate-500',
                    'Screening': 'bg-blue-100 border-blue-300 text-blue-900 border-t-4 border-t-blue-600',
                    'Phone Screen': 'bg-blue-100 border-blue-300 text-blue-900 border-t-4 border-t-blue-600',
                    'Interview': 'bg-purple-100 border-purple-300 text-purple-900 border-t-4 border-t-purple-600',
                    'Offer': 'bg-orange-100 border-orange-300 text-orange-900 border-t-4 border-t-orange-600',
                    'Hired': 'bg-green-100 border-green-300 text-green-900 border-t-4 border-t-green-600',
                    'Rejected': 'bg-red-100 border-red-300 text-red-900 border-t-4 border-t-red-600',
                };
                const headerColor = colorMap[stage] || 'bg-slate-100 border-slate-300 text-slate-800 border-t-4 border-t-slate-500';

                return (
                    <div
                        key={stage}
                        className={`flex-shrink-0 w-72 flex flex-col gap-2 rounded-xl border shadow-sm ${headerColor}`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, stage)}
                    >
                        <div className="flex items-center justify-between p-3 bg-white/20 rounded-t-lg">
                            <h3 className="font-bold text-sm tracking-tight">{stage}</h3>
                            <Badge variant="secondary" className="bg-white/60 text-inherit font-bold shadow-sm backdrop-blur-sm rounded-full h-6 px-2 min-w-[24px] justify-center flex">
                                {stageCandidates.length}
                            </Badge>
                        </div>

                        <ScrollArea className="flex-1 bg-white/40 rounded-b-xl">
                            <div className="flex flex-col gap-3 p-2">
                                {stageCandidates.map((c) => (
                                    <div
                                        key={c.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, c.id)}
                                        className="bg-card p-3 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all group hover:border-primary/50"
                                    >
                                        <div className="flex justify-between items-start mb-2 group-hover:translate-x-1 transition-transform">
                                            <div className="flex items-center gap-2.5">
                                                <CandidateAvatar
                                                    src={c.candidate_image_url}
                                                    name={c.candidate_name}
                                                    className="h-12 w-12 border-2 border-white ring-1 ring-slate-100 shadow-sm hover:scale-105 transition-transform"
                                                    fallbackClassName="text-sm"
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-base font-black truncate max-w-[130px] leading-tight group-hover:text-primary transition-colors text-slate-900">{c.candidate_name}</span>
                                                    <span className="text-[11px] font-bold text-slate-500 truncate max-w-[130px]">{c.candidate_current_position}</span>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 -mr-1 text-muted-foreground hover:text-foreground">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-dashed border-slate-100">
                                            <div className="flex justify-between items-center">
                                                <Badge variant="outline" className="text-[10px] font-black uppercase px-1.5 py-0.5 bg-background text-slate-400 border-slate-200 shadow-sm">
                                                    {c.list_type || "Longlist"}
                                                </Badge>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[9px] font-black text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 uppercase tracking-tighter">
                                                            Move <ChevronDown className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-[160px] rounded-xl shadow-2xl border-slate-100">
                                                        <DropdownMenuLabel className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-3 py-2">Quick Move</DropdownMenuLabel>
                                                        {stages.map(s => (
                                                            <DropdownMenuItem
                                                                key={s.status}
                                                                className={cn(
                                                                    "py-2 font-bold text-xs cursor-pointer rounded-lg mx-1",
                                                                    c.status === s.status && "bg-indigo-50 text-indigo-600"
                                                                )}
                                                                onClick={() => handleStatusChange(c.id, s.status)}
                                                            >
                                                                {s.status}
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[12px] font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 italic">
                                                    ID: {c.candidate_id}
                                                </span>
                                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                                                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : "-"}
                                                </span>
                                            </div>
                                        </div>
                                        {updatingId === c.id && (
                                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-lg animate-in fade-in duration-200">
                                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                );
            })}
            {placementCandidate && (
                <ConfirmPlacementDialog
                    open={!!placementCandidate}
                    onOpenChange={(open) => !open && setPlacementCandidate(null)}
                    jrCandidateId={placementCandidate.id}
                    candidateName={placementCandidate.name}
                    position={jobTitle}
                    bu={bu}
                    subBu={subBu}
                    onSuccess={async () => {
                        // Refresh data
                        const updated = await getJRCandidates(jrId);
                        setCandidates(updated);
                        setPlacementCandidate(null);
                    }}
                />
            )}
        </div>
    );
}
