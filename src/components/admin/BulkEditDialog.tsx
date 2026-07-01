"use client";

import React, { useState, useMemo } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Loader2, Layers, Briefcase, AlertTriangle } from "lucide-react";
import { bulkUpdateCompanies } from "@/app/actions/company-mgmt";
import { toast } from "@/lib/notifications";
import { cn } from "@/lib/utils";

interface BulkEditDialogProps {
    ids: number[];
    onClose: () => void;
    onSuccess: () => void;
    groups?: string[];
    industriesByGroup?: Record<string, Record<string, number>>;
}

export default function BulkEditDialog({
    ids,
    onClose,
    onSuccess,
    groups = [],
    industriesByGroup = {},
}: BulkEditDialogProps) {
    const [group, setGroup] = useState("");
    const [industry, setIndustry] = useState("");
    const [industryOpen, setIndustryOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const industryOptions = useMemo(() => {
        if (!group || !industriesByGroup[group]) return [];
        return Object.keys(industriesByGroup[group]).sort();
    }, [group, industriesByGroup]);

    const filteredIndustries = useMemo(() => {
        const q = industry.trim().toLowerCase();
        if (!q) return industryOptions;
        return industryOptions.filter(opt => opt.toLowerCase().includes(q));
    }, [industry, industryOptions]);

    const handleSave = async () => {
        if (!group && !industry) {
            toast.error("Please provide at least one field to update");
            return;
        }

        setIsSaving(true);
        const updates: { group?: string; industry?: string } = {};
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
                        {/* Group */}
                        <div className="space-y-2">
                            <Label className="text-xs text-slate-500 uppercase font-bold tracking-tight flex items-center gap-1.5">
                                <Briefcase className="h-3 w-3" /> New Group
                            </Label>
                            {groups.length > 0 ? (
                                <Select value={group} onValueChange={v => { setGroup(v); setIndustry(""); }}>
                                    <SelectTrigger className="h-10 text-sm border-slate-200 focus:ring-indigo-500">
                                        <SelectValue placeholder="Keep existing group..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groups.map(g => (
                                            <SelectItem key={g} value={g}>{g}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    value={group}
                                    onChange={(e) => setGroup(e.target.value)}
                                    placeholder="Leave blank to keep existing"
                                    className="h-10"
                                />
                            )}
                        </div>

                        {/* Industry */}
                        <div className="space-y-2">
                            <Label className="text-xs text-slate-500 uppercase font-bold tracking-tight flex items-center gap-1.5">
                                <Layers className="h-3 w-3" /> New Industry
                            </Label>
                            <div className="relative">
                                <Input
                                    value={industry}
                                    onChange={(e) => { setIndustry(e.target.value); setIndustryOpen(true); }}
                                    onFocus={() => setIndustryOpen(true)}
                                    onBlur={() => setTimeout(() => setIndustryOpen(false), 150)}
                                    placeholder="Leave blank to keep existing"
                                    className="h-10 text-sm border-slate-200 focus-visible:ring-indigo-500"
                                />

                                {industryOpen && filteredIndustries.length > 0 && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                        {filteredIndustries.map(opt => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => { setIndustry(opt); setIndustryOpen(false); }}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 text-sm transition-colors",
                                                    opt === industry
                                                        ? "bg-indigo-50 text-indigo-700 font-medium"
                                                        : "hover:bg-slate-50 text-slate-700"
                                                )}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {!group && (
                                    <p className="text-[11px] text-slate-400 mt-1">Select a group first to see industry suggestions</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 flex gap-3 text-amber-800 text-sm">
                        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />
                        <p>This will overwrite the classification for all selected companies.</p>
                    </div>
                </div>

                <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 border-t gap-3 mt-4">
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-8 h-11"
                    >
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Apply Bulk Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
