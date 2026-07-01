"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
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
import { Loader2, Building2, Layers, Briefcase, Trash2 } from "lucide-react";
import { updateCompanyMaster, getCompanyVariations, CompanyVariation } from "@/app/actions/company-mgmt";
import { toast } from "@/lib/notifications";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CompanyDetailDialogProps {
    company: {
        company_id: number;
        company_master: string;
        industry: string;
        group: string;
    };
    onClose: () => void;
    onSuccess: () => void;
    groups?: string[];
    industriesByGroup?: Record<string, Record<string, number>>;
}

export default function CompanyDetailDialog({
    company,
    onClose,
    onSuccess,
    groups = [],
    industriesByGroup = {},
}: CompanyDetailDialogProps) {
    const [name, setName] = useState(company.company_master);
    const [group, setGroup] = useState(company.group || "");
    const [industry, setIndustry] = useState(company.industry || "");
    const [variations, setVariations] = useState<CompanyVariation[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Industry combobox state
    const [industryOpen, setIndustryOpen] = useState(false);
    const industryRef = useRef<HTMLDivElement>(null);

    const industryOptions = useMemo(() => {
        if (!group || !industriesByGroup[group]) return [];
        return Object.keys(industriesByGroup[group]).sort();
    }, [group, industriesByGroup]);

    const filteredIndustries = useMemo(() => {
        const q = industry.trim().toLowerCase();
        if (!q) return industryOptions;
        return industryOptions.filter(opt => opt.toLowerCase().includes(q));
    }, [industry, industryOptions]);

    // Reset industry when group changes (only if current value isn't in new group's list)
    const prevGroupRef = useRef(group);
    useEffect(() => {
        if (prevGroupRef.current !== group) {
            prevGroupRef.current = group;
            if (industry && !industryOptions.includes(industry)) {
                setIndustry("");
            }
        }
    }, [group, industryOptions, industry]);

    useEffect(() => {
        const fetchVars = async () => {
            setIsLoading(true);
            const data = await getCompanyVariations(company.company_id);
            setVariations(data);
            setIsLoading(false);
        };
        fetchVars();
    }, [company.company_id]);

    const handleSave = async () => {
        setIsSaving(true);
        const result = await updateCompanyMaster(company.company_id, {
            company_master: name,
            group,
            industry,
        });
        if (result.success) {
            toast.success("Company updated successfully");
            onSuccess();
            onClose();
        } else {
            toast.error(result.error || "Failed to update company");
        }
        setIsSaving(false);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-[600px] p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 bg-slate-900 text-white">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-500/20 p-2 rounded-lg">
                            <Building2 className="h-6 w-6 text-indigo-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold tracking-tight">Edit Company Details</DialogTitle>
                            <DialogDescription className="text-slate-400">ID: {company.company_id}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-6 bg-white overflow-y-auto max-h-[70vh]">
                    {/* Master name */}
                    <div className="space-y-2">
                        <Label className="text-xs text-slate-500 uppercase tracking-widest font-bold">Master Company Name</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="h-11 font-semibold text-slate-900 border-slate-200 focus-visible:ring-indigo-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Group — controlled Select */}
                        <div className="space-y-2">
                            <Label className="text-xs text-slate-500 flex items-center gap-1.5">
                                <Briefcase className="h-3 w-3" /> Group
                            </Label>
                            {groups.length > 0 ? (
                                <Select value={group} onValueChange={setGroup}>
                                    <SelectTrigger className="h-10 text-sm border-slate-200 focus:ring-indigo-500">
                                        <SelectValue placeholder="Select group..." />
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
                                    className="h-10 text-sm"
                                    placeholder="Group Name"
                                />
                            )}
                        </div>

                        {/* Industry — combobox: type to filter, free-text allowed */}
                        <div className="space-y-2" ref={industryRef}>
                            <Label className="text-xs text-slate-500 flex items-center gap-1.5">
                                <Layers className="h-3 w-3" /> Industry
                            </Label>
                            <div className="relative">
                                <Input
                                    value={industry}
                                    onChange={(e) => {
                                        setIndustry(e.target.value);
                                        setIndustryOpen(true);
                                    }}
                                    onFocus={() => setIndustryOpen(true)}
                                    onBlur={() => setTimeout(() => setIndustryOpen(false), 150)}
                                    className="h-10 text-sm border-slate-200 focus-visible:ring-indigo-500"
                                    placeholder="Type or select industry..."
                                />

                                {industryOpen && filteredIndustries.length > 0 && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                                        {filteredIndustries.map(opt => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                    setIndustry(opt);
                                                    setIndustryOpen(false);
                                                }}
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

                                {/* Hint when no group selected */}
                                {!group && industryOptions.length === 0 && (
                                    <p className="text-[11px] text-slate-400 mt-1">Select a group first to see suggestions</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Variations */}
                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                Variations / Aliases
                                <Badge variant="secondary" className="font-bold">{variations.length}</Badge>
                            </Label>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 min-h-[80px]">
                            {isLoading ? (
                                <div className="flex justify-center items-center h-[60px]">
                                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                                </div>
                            ) : variations.length === 0 ? (
                                <p className="text-center text-xs text-slate-400 italic py-4">No variants found for this company.</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    {variations.map(v => (
                                        <div key={v.variation_id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm group">
                                            <span className="text-sm font-medium text-slate-700">{v.variation_name}</span>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-slate-50 border-t gap-3">
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8"
                    >
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
