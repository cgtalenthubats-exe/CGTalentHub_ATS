"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateEmploymentRecord, getResignationReasons, addResignationReason } from "@/app/actions/employment";
import { toast } from "sonner";
import { Save, Loader2, Calendar, FileText, Check, ChevronsUpDown, Plus, User, Building, Briefcase, GraduationCap } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EditResignationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData: any;
    onSuccess: () => void;
}

export function EditResignationDialog({
    open,
    onOpenChange,
    initialData,
    onSuccess
}: EditResignationDialogProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        resign_date: "",
        resignation_reason: "",
        resign_note: "",
        position: "",
        bu: "",
        latest_hiring_manager: "",
        company_destination: "",
        new_position: "",
        resign_job_grade: "",
        resign_bu: "",
        tracking_status: "pending"
    });

    const [reasons, setReasons] = useState<string[]>([]);
    const [reasonSearch, setReasonSearch] = useState("");
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    useEffect(() => {
        if (open && initialData) {
            setFormData({
                resign_date: initialData.resign_date || "",
                resignation_reason: initialData.resignation_reason || "",
                resign_note: initialData.resign_note || "",
                position: initialData.position || "",
                bu: initialData.bu || "",
                latest_hiring_manager: initialData.latest_hiring_manager || "",
                company_destination: initialData.company_destination || "",
                new_position: initialData.new_position || "",
                resign_job_grade: initialData.resign_job_grade || "",
                resign_bu: initialData.resign_bu || "",
                tracking_status: initialData.tracking_status || "pending"
            });
            fetchReasons();
        }
    }, [open, initialData]);

    const fetchReasons = async () => {
        const fetchedReasons = await getResignationReasons();
        setReasons(fetchedReasons);
    };

    const handleSubmit = async () => {
        setLoading(true);
        if (!initialData?.employment_record_id) {
            toast.error("Error: Missing Record ID");
            setLoading(false);
            return;
        }

        const res = await updateEmploymentRecord(initialData.employment_record_id, {
            resign_date: formData.resign_date || null,
            resignation_reason: formData.resignation_reason || null,
            resign_note: formData.resign_note || null,
            position: formData.position || null,
            bu: formData.bu || null,
            latest_hiring_manager: formData.latest_hiring_manager || null,
            company_destination: formData.company_destination || null,
            new_position: formData.new_position || null,
            resign_job_grade: formData.resign_job_grade || null,
            resign_bu: formData.resign_bu || null,
            tracking_status: formData.tracking_status
        });

        if (res.success) {
            toast.success("Resignation details updated successfully!");
            onSuccess();
            onOpenChange(false);
        } else {
            toast.error("Failed to update: " + res.error);
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] rounded-[2rem] border-none shadow-2xl overflow-hidden p-0">
                <div className="bg-red-50 p-6 text-red-900 text-center border-b border-red-100">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Save className="w-8 h-8 text-red-500" />
                    </div>
                    <DialogTitle className="text-2xl font-black mb-1">Edit Resignation</DialogTitle>
                    <DialogDescription className="text-red-700/80 font-medium">
                        Update resignation details for <b>{initialData?.candidate_name}</b>.
                    </DialogDescription>
                    {formData.tracking_status && (
                        <div className="mt-2">
                            <Badge className={cn(
                                "text-[10px] uppercase font-black tracking-tighter",
                                formData.tracking_status === 'manual' ? "bg-emerald-500 text-white" :
                                    formData.tracking_status === 'auto' ? "bg-amber-500 text-white animate-pulse" :
                                        formData.tracking_status === 'ref_set' ? "bg-blue-500 text-white" :
                                            "bg-slate-400 text-white"
                            )}>
                                Status: {formData.tracking_status}
                            </Badge>
                        </div>
                    )}
                </div>

                <ScrollArea className="max-h-[60vh]">
                    <div className="p-6 grid gap-6">
                        {/* Basic Info Read-only/Edit */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Position</Label>
                                <Input
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                    className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Business Unit</Label>
                                <Input
                                    value={formData.bu}
                                    onChange={(e) => setFormData({ ...formData, bu: e.target.value })}
                                    className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <Calendar className="w-3 h-3 text-red-500" /> Resignation Date
                                </Label>
                                <Input
                                    type="date"
                                    value={formData.resign_date}
                                    onChange={(e) => setFormData({ ...formData, resign_date: e.target.value })}
                                    className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <User className="w-3 h-3 text-red-500" /> Latest Hiring Manager
                                </Label>
                                <Input
                                    placeholder="Name..."
                                    value={formData.latest_hiring_manager}
                                    onChange={(e) => setFormData({ ...formData, latest_hiring_manager: e.target.value })}
                                    className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <FileText className="w-3 h-3 text-red-500" /> Resignation Reason
                            </Label>

                            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isPopoverOpen}
                                        className="w-full justify-between h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium"
                                    >
                                        {formData.resignation_reason || "Select a reason..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[450px] p-0 rounded-2xl border-none shadow-2xl overflow-hidden">
                                    <Command>
                                        <CommandInput
                                            placeholder="Search or type a new reason..."
                                            value={reasonSearch}
                                            onValueChange={setReasonSearch}
                                            className="h-12"
                                        />
                                        <CommandEmpty className="p-4 text-center">
                                            <div className="space-y-3">
                                                <p className="text-xs text-slate-500">No matching reason found.</p>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="w-full rounded-xl h-10 text-[10px] uppercase font-black tracking-widest bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100"
                                                    onClick={async () => {
                                                        if (reasonSearch.trim()) {
                                                            await addResignationReason(reasonSearch.trim());
                                                            setFormData({ ...formData, resignation_reason: reasonSearch.trim() });
                                                            setIsPopoverOpen(false);
                                                            setReasonSearch("");
                                                            fetchReasons();
                                                        }
                                                    }}
                                                >
                                                    <Plus className="w-3 h-3 mr-2" /> Add "{reasonSearch}" as new reason
                                                </Button>
                                            </div>
                                        </CommandEmpty>
                                        <CommandGroup>
                                            <CommandList className="max-h-[200px]">
                                                {reasons.map((r) => (
                                                    <CommandItem
                                                        key={r}
                                                        value={r}
                                                        onSelect={(currentValue) => {
                                                            setFormData({ ...formData, resignation_reason: currentValue === formData.resignation_reason ? "" : currentValue });
                                                            setIsPopoverOpen(false);
                                                        }}
                                                        className="py-3 px-4 text-xs font-medium cursor-pointer hover:bg-slate-50"
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4 text-emerald-500",
                                                                formData.resignation_reason === r ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {r}
                                                    </CommandItem>
                                                ))}
                                            </CommandList>
                                        </CommandGroup>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <Building className="w-3 h-3 text-red-500" /> Company Destination
                                </Label>
                                <Input
                                    placeholder="New Company..."
                                    value={formData.company_destination}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        company_destination: e.target.value,
                                        tracking_status: 'manual'
                                    })}
                                    className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <Briefcase className="w-3 h-3 text-red-500" /> New Position
                                </Label>
                                <Input
                                    placeholder="Job Title..."
                                    value={formData.new_position}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        new_position: e.target.value,
                                        tracking_status: 'manual'
                                    })}
                                    className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <GraduationCap className="w-3 h-3 text-red-500" /> Resigned Job Grade
                                </Label>
                                <Input
                                    placeholder="Grade..."
                                    value={formData.resign_job_grade}
                                    onChange={(e) => setFormData({ ...formData, resign_job_grade: e.target.value })}
                                    className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <Building className="w-3 h-3 text-red-500" /> Resigned BU
                                </Label>
                                <Input
                                    placeholder="Final BU..."
                                    value={formData.resign_bu}
                                    onChange={(e) => setFormData({ ...formData, resign_bu: e.target.value })}
                                    className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Resignation Note</Label>
                            <Textarea
                                placeholder="Additional details about resignation..."
                                value={formData.resign_note}
                                onChange={(e) => setFormData({ ...formData, resign_note: e.target.value })}
                                className="min-h-[80px] rounded-xl bg-slate-50 border-slate-200 text-xs"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                className="flex-1 rounded-xl font-bold uppercase text-xs tracking-widest h-12"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="flex-[2] bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase text-xs tracking-widest h-12 shadow-lg shadow-red-500/20"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Update
                            </Button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
