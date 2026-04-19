"use client";

import React, { useState } from "react";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Layers, Briefcase, AlertTriangle } from "lucide-react";
import { bulkUpdateCompanies } from "@/app/actions/company-mgmt";
import { toast } from "sonner";

interface BulkEditDialogProps {
    ids: number[];
    onClose: () => void;
    onSuccess: () => void;
}

export default function BulkEditDialog({
    ids,
    onClose,
    onSuccess
}: BulkEditDialogProps) {
    const [group, setGroup] = useState("");
    const [industry, setIndustry] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!group && !industry) {
            toast.error("Please provide at least one field to update");
            return;
        }

        setIsSaving(true);
        const updates: any = {};
        if (group) updates.group = group;
        if (industry) updates.industry = industry;

        const result = await bulkUpdateCompanies(ids, updates);

        if (result.success) {
            toast.success(`Updated ${ids.length} companies successfully`);
            onSuccess();
            onClose();
        } else {
            toast.error(result.error || "Failed to bulk update companies");
        }
        setIsSaving(false);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-[450px]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-100 p-2 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <DialogTitle className="text-xl font-bold">Bulk Edit Classification</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="py-6 space-y-6">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-center gap-4">
                        <div className="text-xs text-slate-500 font-medium">YOU ARE EDITING</div>
                        <div className="bg-slate-900 text-white px-3 py-1 rounded-full font-bold text-xs ring-4 ring-slate-100">
                            {ids.length} RECORDS
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-slate-500 uppercase font-bold tracking-tight">New Group</Label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input 
                                    value={group}
                                    onChange={(e) => setGroup(e.target.value)}
                                    placeholder="Leave blank to keep existing"
                                    className="pl-9 h-11"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs text-slate-500 uppercase font-bold tracking-tight">New Industry</Label>
                            <div className="relative">
                                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input 
                                    value={industry}
                                    onChange={(e) => setIndustry(e.target.value)}
                                    placeholder="Leave blank to keep existing"
                                    className="pl-9 h-11"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 flex gap-3 text-amber-800 text-sm">
                        <Info className="h-5 w-5 shrink-0 mt-0.5" />
                        <p>This action will overwrite the classification for all selected companies. This cannot be undone easily.</p>
                    </div>
                </div>

                <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 border-t gap-3 mt-4">
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-8 h-11"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Apply Bulk Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Info({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
        </svg>
    );
}
