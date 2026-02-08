"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateEmploymentRecord } from "@/app/actions/employment";
import { toast } from "sonner";
import { CheckCircle2, Calculator, Loader2, Save } from "lucide-react";

interface EditPlacementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData: any;
    onSuccess: () => void;
}

export function EditPlacementDialog({
    open,
    onOpenChange,
    initialData,
    onSuccess
}: EditPlacementDialogProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        hire_date: "",
        base_salary: "",
        hiring_manager: "",
        employee_id: "",
        job_grade: "",
        note: "",
        position: "",
        bu: "",
        sub_bu: ""
    });

    useEffect(() => {
        if (open && initialData) {
            setFormData({
                hire_date: initialData.hire_date || "",
                base_salary: initialData.base_salary ? initialData.base_salary.toString() : "",
                hiring_manager: initialData.hiring_manager || "",
                employee_id: initialData.employee_id || "",
                job_grade: initialData.job_grade ? initialData.job_grade.toString() : "",
                note: initialData.note || "",
                position: initialData.position || "",
                bu: initialData.bu || "",
                sub_bu: initialData.sub_bu || ""
            });
        }
    }, [open, initialData]);

    const baseSalary = parseFloat(formData.base_salary) || 0;
    const annualSalary = baseSalary * 12;
    const outsourceFee = annualSalary * 0.20;

    const handleSubmit = async () => {
        setLoading(true);
        if (!initialData?.employment_record_id) {
            toast.error("Error: Missing Record ID");
            setLoading(false);
            return;
        }

        const res = await updateEmploymentRecord(initialData.employment_record_id, {
            hire_date: formData.hire_date || null,
            base_salary: baseSalary || null,
            job_grade: formData.job_grade || null,
            employee_id: formData.employee_id || null,
            hiring_manager: formData.hiring_manager || null,
            note: formData.note || null,
            position: formData.position || null,
            bu: formData.bu || null,
            sub_bu: formData.sub_bu || null
        });

        if (res.success) {
            toast.success("Placement details updated successfully!");
            onSuccess();
            onOpenChange(false);
        } else {
            toast.error("Failed to update placement: " + res.error);
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] rounded-[2rem] border-none shadow-2xl overflow-hidden p-0">
                <div className="bg-slate-900 p-6 text-white text-center">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <Save className="w-8 h-8 text-white" />
                    </div>
                    <DialogTitle className="text-2xl font-black mb-1">Edit Placement Details</DialogTitle>
                    <DialogDescription className="text-slate-400 font-medium">
                        Update employment information for <b>{initialData?.candidate_name}</b>.
                    </DialogDescription>
                </div>

                <div className="p-6 grid gap-6">
                    {/* Position & BU Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Position</Label>
                            <Input
                                value={formData.position}
                                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Business Unit</Label>
                            <Input
                                value={formData.bu}
                                onChange={(e) => setFormData({ ...formData, bu: e.target.value })}
                                className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Sub BU / Dept</Label>
                            <Input
                                value={formData.sub_bu}
                                onChange={(e) => setFormData({ ...formData, sub_bu: e.target.value })}
                                className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Hire Date</Label>
                            <Input
                                type="date"
                                value={formData.hire_date}
                                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                                className="h-11 rounded-xl bg-slate-50 border-slate-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Base Salary (THB)</Label>
                            <Input
                                type="number"
                                placeholder="Optional"
                                value={formData.base_salary}
                                onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                                className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold text-slate-900"
                            />
                        </div>
                    </div>

                    {/* Calculations Preview */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex gap-6 items-center">
                        <div className="p-3 bg-white rounded-lg shadow-sm">
                            <Calculator className="w-6 h-6 text-indigo-500" />
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400">Annual Salary (x12)</p>
                                <p className="text-lg font-black text-slate-700">฿{annualSalary.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400">Outsource Fee (20%)</p>
                                <p className="text-lg font-black text-slate-700">฿{outsourceFee.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Job Grade</Label>
                            <Input
                                placeholder="e.g. 10"
                                type="number"
                                value={formData.job_grade}
                                onChange={(e) => setFormData({ ...formData, job_grade: e.target.value })}
                                className="h-11 rounded-xl bg-slate-50 border-slate-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Employee ID</Label>
                            <Input
                                placeholder="Optional"
                                value={formData.employee_id}
                                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                                className="h-11 rounded-xl bg-slate-50 border-slate-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Hiring Manager</Label>
                            <Input
                                placeholder="Optional"
                                value={formData.hiring_manager}
                                onChange={(e) => setFormData({ ...formData, hiring_manager: e.target.value })}
                                className="h-11 rounded-xl bg-slate-50 border-slate-200"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Note</Label>
                        <Textarea
                            placeholder="Additional details..."
                            value={formData.note}
                            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                            className="min-h-[80px] rounded-xl bg-slate-50 border-slate-200"
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
                            className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold uppercase text-xs tracking-widest h-12 shadow-lg shadow-slate-900/20"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Update Placement
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
