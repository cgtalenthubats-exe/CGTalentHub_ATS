
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Copy, Loader2, AlertCircle } from "lucide-react";
import { JobRequisition } from "@/types/requisition";
import { copyJobRequisition, getDistinctFieldValues } from "@/app/actions/requisitions";
import { toast } from "@/lib/notifications";

interface CopyJRDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sourceJR: JobRequisition;
    onSuccess: (newJrId: string) => void;
    updatedBy?: string;
}

export function CopyJRDialog({ open, onOpenChange, sourceJR, onSuccess, updatedBy }: CopyJRDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        job_title: `${sourceJR.job_title} (Copy)`,
        division: sourceJR.division || "",
        department: sourceJR.department || ""
    });

    const [options, setOptions] = useState<{
        divisions: string[];
        subDivisions: string[];
    }>({
        divisions: [],
        subDivisions: []
    });

    useEffect(() => {
        if (open) {
            async function loadOptions() {
                try {
                    const [bus, subs] = await Promise.all([
                        getDistinctFieldValues('bu'),
                        getDistinctFieldValues('sub_bu')
                    ]);
                    setOptions({
                        divisions: bus,
                        subDivisions: subs
                    });
                } catch (e) {
                    console.error("Failed to load options", e);
                }
            }
            loadOptions();
        }
    }, [open]);

    const handleCopy = async () => {
        setIsLoading(true);
        try {
            const result = await copyJobRequisition(sourceJR.id, {
                job_title: formData.job_title,
                division: formData.division,
                department: formData.department,
                created_by: updatedBy
            });

            if (result.success && result.newJrId) {
                toast.success("Job Requisition copied successfully!");
                onSuccess(result.newJrId);
                onOpenChange(false);
            } else {
                toast.error(result.error || "Failed to copy requisition");
            }
        } catch (error) {
            console.error("Copy Error:", error);
            toast.error("An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Copy className="h-5 w-5 text-amber-500" />
                        Copy Job Requisition
                    </DialogTitle>
                    <DialogDescription>
                        This will create a new requisition based on **{sourceJR.id}**.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 p-3 rounded-lg flex gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800 dark:text-amber-200">
                            <p className="font-semibold mb-1">Candidate Auto-Clone</p>
                            <p>ผู้สมัครทุกคนจาก JR เดิมจะถูกก๊อปปี้ตามมาด้วย โดยจะตั้งสถานะเริ่มต้นเป็น <strong>Pool Candidate</strong> ทั้งหมดครับ</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="job_title">New Position Title</Label>
                        <Input
                            id="job_title"
                            value={formData.job_title}
                            onChange={(e) => handleChange("job_title", e.target.value)}
                            placeholder="Enter new job title"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="division">BU (Business Unit)</Label>
                            <div className="space-y-1">
                                <Input
                                    value={formData.division}
                                    onChange={(e) => handleChange("division", e.target.value)}
                                    placeholder="Type or select BU"
                                    className="h-9"
                                />
                                {options.divisions.length > 0 && (
                                    <Select
                                        onValueChange={(v) => handleChange("division", v)}
                                        value={formData.division}
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder="Existing BUs" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {options.divisions.map((bu) => (
                                                <SelectItem key={bu} value={bu}>{bu}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="department">Sub BU</Label>
                            <div className="space-y-1">
                                <Input
                                    value={formData.department}
                                    onChange={(e) => handleChange("department", e.target.value)}
                                    placeholder="Type or select Sub BU"
                                    className="h-9"
                                />
                                {options.subDivisions.length > 0 && (
                                    <Select
                                        onValueChange={(v) => handleChange("department", v)}
                                        value={formData.department}
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder="Existing Sub BUs" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {options.subDivisions.map((sub) => (
                                                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCopy}
                        disabled={isLoading}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Copying...
                            </>
                        ) : (
                            "Confirm Copy"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
