"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function JobStatusDetailDialog({ log, status, date }: { log: any, status: string, date: string }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs text-muted-foreground hover:text-primary px-2">
                    <Eye className="h-3 w-3" /> View
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Status Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Current Status:</span>
                        <Badge>{status}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Date:</span>
                        <span>{date}</span>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                        <h4 className="text-sm font-semibold">Notes / Feedback</h4>
                        <div className="p-3 bg-muted/30 rounded-md text-sm whitespace-pre-wrap min-h-[100px] border">
                            {log?.note || log?.status_note || "No additional notes recorded."}
                        </div>
                    </div>

                    <div className="text-xs text-muted-foreground pt-2">
                        Log ID: {log?.log_id} | Modified By: {log?.changed_by || "System"}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
