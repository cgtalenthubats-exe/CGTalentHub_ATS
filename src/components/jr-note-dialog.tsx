"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { updateJRNote } from "@/app/actions/requisitions";
import { toast } from "@/lib/notifications";

interface JRNoteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jrId: string;
    note: string | null | undefined;
    onSaved?: (note: string) => void;
}

export function JRNoteDialog({ open, onOpenChange, jrId, note, onSaved }: JRNoteDialogProps) {
    const [draft, setDraft] = useState(note || "");
    const [saving, setSaving] = useState(false);

    // Re-sync draft whenever the dialog is (re)opened for a (possibly different) JR
    useEffect(() => {
        if (open) setDraft(note || "");
    }, [open, note]);

    const handleSave = async () => {
        setSaving(true);
        const result = await updateJRNote(jrId, draft);
        setSaving(false);
        if (result.success) {
            toast.success("Note saved");
            onSaved?.(draft);
            onOpenChange(false);
        } else {
            toast.error(result.error || "Failed to save note");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Note — {jrId}</DialogTitle>
                    <DialogDescription>Free-form note for this requisition.</DialogDescription>
                </DialogHeader>
                <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={8}
                    placeholder="Add a note about this requisition..."
                    className="resize-y"
                    autoFocus
                />
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Note
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
