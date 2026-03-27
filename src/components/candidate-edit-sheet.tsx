"use client";

import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CandidateEditForm } from "./candidate-edit-form";

interface CandidateEditSheetProps {
    candidateId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function CandidateEditSheet({ candidateId, open, onOpenChange, onSuccess }: CandidateEditSheetProps) {
    if (!candidateId) return null;

    const handleSuccess = () => {
        if (onSuccess) onSuccess();
        onOpenChange(false);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col border-l-slate-200 shadow-2xl">
                <SheetHeader className="px-6 py-6 border-b bg-slate-50/50">
                    <SheetTitle className="text-xl font-black text-slate-900 tracking-tight">
                        Edit Candidate Profile
                    </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-6 transition-all duration-300 custom-scrollbar">
                    <CandidateEditForm 
                        candidateId={candidateId} 
                        onSuccess={handleSuccess}
                        onCancel={() => onOpenChange(false)}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
}
