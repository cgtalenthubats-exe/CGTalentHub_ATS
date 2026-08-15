"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { updateHeadRecruitNote } from "@/app/actions/status-updates";
import { toast } from "@/lib/notifications";

interface HeadRecruitNoteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jrCandidateId: string;
    candidateName: string;
    note: string | null | undefined;
    onSaved?: (note: string) => void;
}

export function HeadRecruitNoteDialog({ open, onOpenChange, jrCandidateId, candidateName, note, onSaved }: HeadRecruitNoteDialogProps) {
    const [draft, setDraft] = useState(note || "");
    const [saving, setSaving] = useState(false);

    // Re-sync draft whenever the dialog is (re)opened for a (possibly different) candidate
    useEffect(() => {
        if (open) setDraft(note || "");
    }, [open, note]);

    const handleSave = async () => {
        setSaving(true);
        const result = await updateHeadRecruitNote(jrCandidateId, draft);
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
                    <DialogTitle>Head Recruit Note — {candidateName}</DialogTitle>
                    <DialogDescription>Shared note for this candidate in this JR — visible and editable by any recruiter.</DialogDescription>
                </DialogHeader>
                <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={6}
                    placeholder="Add context for this candidate..."
                    className="resize-y"
                    autoFocus
                />
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Skip</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Note
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
