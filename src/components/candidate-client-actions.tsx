"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus, Download, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function BackButton() {
    return (
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground pl-0 gap-1 group" onClick={() => window.history.back()}>
            <div className="rounded-full bg-background/50 p-1 group-hover:bg-background transition-colors">
                <ChevronLeft className="h-4 w-4" />
            </div>
            Back to List
        </Button>
    );
}

export function EditButton({ id }: { id: string }) {
    const router = useRouter();
    return (
        <Button onClick={() => router.push(`/candidates/${id}/edit`)}>Edit Profile</Button>
    );
}

export function AddPrescreenDialog({ candidateId }: { candidateId: string }) {
    const [open, setOpen] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Placeholder for API call
        alert("Add Log function will be implemented with Server Actions.");
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2 h-8">
                    <Plus className="h-3 w-3" /> Add Log
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Pre-Screen Log</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="screener">Screener Name</Label>
                            <Input id="screener" placeholder="e.g. John Doe" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="date">Date</Label>
                            <Input id="date" type="date" required />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="feedback">Feedback</Label>
                        <Textarea
                            id="feedback"
                            className="min-h-[150px]"
                            placeholder="Type your feedback here... (Supports basic text)"
                            required
                        />
                        <p className="text-xs text-muted-foreground">Detailed feedback about the screening session.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="file">Attachment (PDF)</Label>
                        <div className="flex items-center gap-2">
                            <Input id="file" type="file" accept=".pdf" className="cursor-pointer" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit">Save Log</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
