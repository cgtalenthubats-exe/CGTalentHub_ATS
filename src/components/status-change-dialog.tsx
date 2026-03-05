"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface StatusChangeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    targetStatus: string;
    onConfirm: (note: string) => Promise<void>;
}

export function StatusChangeDialog({ open, onOpenChange, targetStatus, onConfirm }: StatusChangeDialogProps) {
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        setLoading(true);
        await onConfirm(note);
        setLoading(false);
        setNote(""); // Reset for next time
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Update Status to "{targetStatus}"</DialogTitle>
                    <DialogDescription>
                        Would you like to add a note to the activity log for this change? This is optional.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Textarea
                        placeholder="Add your note here..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="resize-none h-24"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={loading}>
                        {loading ? "Updating..." : "Update Status"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
