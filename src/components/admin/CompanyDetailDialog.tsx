"use client";

import React, { useState, useEffect } from "react";
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
import { Loader2, Building2, Layers, Briefcase, Trash2, Plus, Info } from "lucide-react";
import { updateCompanyMaster, getCompanyVariations, CompanyVariation } from "@/app/actions/company-mgmt";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface CompanyDetailDialogProps {
    company: {
        company_id: number;
        company_master: string;
        industry: string;
        group: string;
    };
    onClose: () => void;
    onSuccess: () => void;
}

export default function CompanyDetailDialog({
    company,
    onClose,
    onSuccess
}: CompanyDetailDialogProps) {
    const [name, setName] = useState(company.company_master);
    const [group, setGroup] = useState(company.group);
    const [industry, setIndustry] = useState(company.industry);
    const [variations, setVariations] = useState<CompanyVariation[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

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
            group: group,
            industry: industry
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
                    <div className="space-y-4">
                        <Label className="text-sm font-bold text-slate-700 uppercase tracking-widest">Core Identification</Label>
                        <div className="space-y-2">
                            <Label htmlFor="master_name" className="text-xs text-slate-500">Master Company Name</Label>
                            <Input 
                                id="master_name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="h-11 font-semibold text-slate-900 border-slate-200 focus-visible:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-slate-500 flex items-center gap-1.5 focus-visible:ring-indigo-500">
                                <Briefcase className="h-3 w-3" /> Group
                            </Label>
                            <Input 
                                value={group || ""}
                                onChange={(e) => setGroup(e.target.value)}
                                className="h-10 text-sm"
                                placeholder="Group Name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-slate-500 flex items-center gap-1.5">
                                <Layers className="h-3 w-3" /> Industry
                            </Label>
                            <Input 
                                value={industry || ""}
                                onChange={(e) => setIndustry(e.target.value)}
                                className="h-10 text-sm"
                                placeholder="Industry Name"
                            />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                Variations / Aliases
                                <Badge variant="secondary" className="font-bold">{variations.length}</Badge>
                            </Label>
                        </div>
                        
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 min-h-[100px]">
                            {isLoading ? (
                                <div className="flex justify-center items-center h-[60px]">
                                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                                </div>
                            ) : variations.length === 0 ? (
                                <div className="text-center py-4">
                                    <p className="text-xs text-slate-400 italic">No variants found for this company.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    {variations.map(v => (
                                        <div key={v.variation_id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm group">
                                            <span className="text-sm font-medium text-slate-700">{v.variation_name}</span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
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
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
