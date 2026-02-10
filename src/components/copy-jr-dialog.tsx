"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JobRequisition } from "@/types/requisition";
import { copyJobRequisition } from "@/app/actions/requisitions";
import { toast } from "sonner";
import { Loader2, Copy } from "lucide-react";

interface CopyJRDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sourceJR: JobRequisition | null;
    onSuccess: (newId: string) => void;
}

export function CopyJRDialog({ open, onOpenChange, sourceJR, onSuccess }: CopyJRDialogProps) {
    const [loading, setLoading] = useState(false);

    // Form State (Default to source values)
    const [position, setPosition] = useState(sourceJR?.job_title || "");
    const [bu, setBu] = useState(sourceJR?.division || "");
    const [subBu, setSubBu] = useState(sourceJR?.department || "");

    // Update state when sourceJR changes (if dialog re-opens)
    // Note: Better to use a key or effect, but this simple init works if component unmounts
    // Since we conditionally render this dialog usually, initial state is fine.

    const handleCopy = async () => {
        if (!sourceJR) return;

        setLoading(true);
        try {
            const res = await copyJobRequisition(sourceJR.id, {
                job_title: position,
                division: bu,
                department: subBu
            });

            if (res.success && res.newJrId) {
                toast.success(`JR Copied Successfully! New ID: ${res.newJrId}`);
                onSuccess(res.newJrId);
                onOpenChange(false);
            } else {
                toast.error(`Copy Failed: ${res.error}`);
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        }
        setLoading(false);
    };

    if (!sourceJR) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Copy Job Requisition</DialogTitle>
                    <DialogDescription>
                        Duplicate <strong>{sourceJR.id}</strong> ({sourceJR.job_title}).
                        All candidates will be copied and reset to <strong>Pool Candidate</strong> status.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="position" className="text-right">
                            Position
                        </Label>
                        <Input
                            id="position"
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="bu" className="text-right">
                            BU
                        </Label>
                        <Select value={bu} onValueChange={setBu}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select BU" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CHR">CHR</SelectItem>
                                <SelectItem value="CRC">CRC</SelectItem>
                                <SelectItem value="CMG">CMG</SelectItem>
                                <SelectItem value="Cpn">CPN</SelectItem>
                                <SelectItem value="Go Wholesale">Go Wholesale</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="subBu" className="text-right">
                            Sub BU
                        </Label>
                        <Input
                            id="subBu"
                            value={subBu}
                            onChange={(e) => setSubBu(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleCopy} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Copying...
                            </>
                        ) : (
                            <>
                                <Copy className="mr-2 h-4 w-4" /> Copy & Reset Candidates
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
