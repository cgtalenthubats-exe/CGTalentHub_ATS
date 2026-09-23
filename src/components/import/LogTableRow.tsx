"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FileText, UserPlus, Loader2 } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusSelect } from "@/components/ui/status-select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/notifications";

interface UploadLog {
    id: number | string;
    batch_id?: string;
    batch_name?: string;
    candidate_id?: string;
    name?: string;
    file_name?: string;
    linkedin?: string;
    status: string;
    note?: string;
    uploader_email: string;
    created_at: string;
    resume_url?: string;
    candidate_status?: string;
}

interface LogTableRowProps {
    log: UploadLog;
    isSelected: boolean;
    onSelectChange: (checked: boolean) => void;
    onStatusChange: (newStatus: string) => Promise<boolean | undefined>;
    viewMode: 'csv' | 'resume';
    onOverrideDuplicate?: (logId: number) => Promise<{ success: boolean; candidateId?: string; error?: string }>;
}

export const LogTableRow = React.memo(({
    log,
    isSelected,
    onSelectChange,
    onStatusChange,
    viewMode,
    onOverrideDuplicate,
}: LogTableRowProps) => {
    const [overrideOpen, setOverrideOpen] = useState(false);
    const [overriding, setOverriding] = useState(false);

    const handleStatusChange = async (vals: string[]) => {
        const val = vals[0] || "";
        const success = await onStatusChange(val);
        if (success) {
            toast.success("Status updated");
        } else {
            toast.error("Failed to update status");
        }
    };

    const handleOverrideConfirm = async () => {
        if (!onOverrideDuplicate || typeof log.id !== 'number') return;
        setOverriding(true);
        try {
            const res = await onOverrideDuplicate(log.id);
            if (res.success) {
                toast.success(`Created ${res.candidateId} and queued for scraping`);
                setOverrideOpen(false);
            } else {
                toast.error(res.error || "Failed to override");
            }
        } finally {
            setOverriding(false);
        }
    };

    const isDuplicateRow = viewMode === 'csv' && log.status === 'Duplicate found';

    return (
        <TableRow className="hover:bg-slate-50/50 transition-colors">
            <TableCell>
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => onSelectChange(!!checked)}
                />
            </TableCell>
            <TableCell className="text-xs text-slate-500 font-mono">
                {new Date(log.created_at).toLocaleString('th-TH')}
            </TableCell>
            <TableCell>
                {log.candidate_id && log.candidate_id.startsWith('C') ? (
                    <Link href={`/candidates/${log.candidate_id}`} className="hover:underline">
                        <Badge variant="outline" className="font-mono text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 cursor-pointer">
                            {log.candidate_id}
                        </Badge>
                    </Link>
                ) : (
                    <Badge variant="outline" className="font-mono text-xs bg-slate-50 text-slate-400 border-slate-200">
                        {log.candidate_id || '-'}
                    </Badge>
                )}
            </TableCell>
            <TableCell>
                <div className="flex flex-col">
                    <span className="font-medium text-slate-800 text-sm">
                        {log.name || log.file_name || "Unknown"}
                    </span>
                    {viewMode === 'resume' && log.candidate_id && log.name && log.file_name && (
                        <span className="text-[10px] text-slate-400">{log.file_name}</span>
                    )}
                </div>
            </TableCell>
            {viewMode === 'resume' && (
                <TableCell>
                    {log.resume_url && (
                        <a href={log.resume_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                            <FileText className="w-4 h-4" />
                        </a>
                    )}
                </TableCell>
            )}
            <TableCell className="text-xs text-slate-500">
                <div className="flex flex-col">
                    <span className="truncate max-w-[150px]">{log.uploader_email}</span>
                    {viewMode === 'csv' && log.batch_name && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                            {log.batch_name}
                        </span>
                    )}
                </div>
            </TableCell>
            <TableCell>
                <Badge variant="secondary" className={cn("text-[10px] uppercase font-bold tracking-wider",
                    log.status === 'Completed' || log.status === 'Complete' || log.status === 'Scraping' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        log.status.includes('Duplicate') ? "bg-amber-50 text-amber-600 border-amber-100" :
                            log.status === 'pending' || log.status === 'Processing' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                "bg-red-50 text-red-600 border-red-100")}>
                    {log.status}
                </Badge>
            </TableCell>

            <TableCell>
                <StatusSelect
                    value={log.candidate_status ? [log.candidate_status] : null}
                    onChange={handleStatusChange}
                    className="w-[180px] h-8 text-xs bg-white border-slate-200"
                    placeholder="Select Status"
                />
            </TableCell>
            <TableCell className="text-xs text-slate-500 italic max-w-[260px]">
                <div className="flex items-center gap-2">
                    <span className="truncate" title={log.note}>{log.note}</span>
                    {isDuplicateRow && onOverrideDuplicate && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 shrink-0 not-italic text-[10px] font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                onClick={() => setOverrideOpen(true)}
                            >
                                <UserPlus className="w-3 h-3 mr-1" /> Not a duplicate
                            </Button>
                            <AlertDialog open={overrideOpen} onOpenChange={(open) => !overriding && setOverrideOpen(open)}>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Create {log.name} as a new candidate?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This row was matched by name only against{" "}
                                            <span className="font-semibold text-slate-700">{log.candidate_id || "an existing candidate"}</span>.
                                            If the LinkedIn profile is actually different, confirming here reserves a new
                                            Candidate ID for &quot;{log.name}&quot; and queues it for scraping, same as a normal import.
                                            <span className="block mt-2 font-semibold text-destructive">This creates real data and cannot be undone.</span>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={overriding}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleOverrideConfirm}
                                            disabled={overriding}
                                            className="bg-indigo-600 hover:bg-indigo-700"
                                        >
                                            {overriding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create New Candidate"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
});

LogTableRow.displayName = "LogTableRow";
