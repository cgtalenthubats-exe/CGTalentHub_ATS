"use client";

import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
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
                <SheetHeader className="px-6 py-4 border-b bg-slate-50/50 flex flex-row items-center justify-between space-y-0">
                    <SheetTitle className="text-xl font-black text-slate-900 tracking-tight">
                        Edit Candidate Profile
                    </SheetTitle>
                    <div className="flex items-center gap-3 pr-8">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => onOpenChange(false)} 
                            className="font-bold text-slate-500 hover:bg-slate-100"
                        >
                            Cancel
                        </Button>
                        <Button 
                            form="candidate-edit-form"
                            type="submit" 
                            size="sm"
                            className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100 px-4"
                        >
                            <Save className="h-4 w-4" /> Save Changes
                        </Button>
                    </div>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-6 transition-all duration-300 custom-scrollbar">
                    <CandidateEditForm 
                        candidateId={candidateId} 
                        onSuccess={handleSuccess}
                        onCancel={() => onOpenChange(false)}
                        hideFooter={true}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
}
