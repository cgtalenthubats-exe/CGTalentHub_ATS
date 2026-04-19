"use client";

import React from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StatusSelect } from "@/components/ui/status-select";
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
    onStatusChange: (newStatus: string) => Promise<boolean>;
    viewMode: 'csv' | 'resume';
}

export const LogTableRow = React.memo(({ 
    log, 
    isSelected, 
    onSelectChange, 
    onStatusChange,
    viewMode 
}: LogTableRowProps) => {
    
    const handleStatusChange = async (val: string) => {
        const success = await onStatusChange(val);
        if (success) {
            toast.success("Status updated");
        } else {
            toast.error("Failed to update status");
        }
    };

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
                    value={log.candidate_status || ""}
                    onChange={handleStatusChange}
                    className="w-[180px] h-8 text-xs bg-white border-slate-200"
                    placeholder="Select Status"
                />
            </TableCell>
            <TableCell className="text-xs text-slate-500 italic truncate max-w-[200px]">{log.note}</TableCell>
        </TableRow>
    );
});

LogTableRow.displayName = "LogTableRow";
