"use client";

import React from "react";
import { ExternalExperience } from "./types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Props {
    experiences: ExternalExperience[];
}

export function ExternalExperienceTable({ experiences }: Props) {
    if (!experiences || experiences.length === 0) {
        return <div className="text-sm text-slate-500 italic p-4 text-center">No experience records found.</div>;
    }

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Unknown';
        // Check for specific "Present" keyword (case-insensitive)
        if (dateStr.toLowerCase() === 'present') {
            return <Badge variant="secondary" className="ml-1 text-[10px] bg-emerald-100 text-emerald-700">Present</Badge>;
        }
        // Fallback: Return raw string
        return dateStr;
    };

    return (
        <div className="border rounded-md overflow-hidden bg-white shadow-sm">
            <Table>
                <TableHeader className="bg-slate-50">
                    <TableRow>
                        <TableHead className="w-[40%]">Company</TableHead>
                        <TableHead className="w-[40%]">Position</TableHead>
                        <TableHead className="w-[20%] text-right">Duration</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {experiences.map((exp, index) => (
                        <TableRow key={exp.experience_id || `exp-${index}`} className="hover:bg-slate-50/50">
                            <TableCell className="font-bold text-slate-800 align-top">
                                {exp.company_name_text || "Unknown Company"}
                            </TableCell>
                            <TableCell className="text-slate-600 align-top font-medium">{exp.position}</TableCell>
                            <TableCell className="text-right align-top">
                                <div className="flex flex-col items-end gap-1">
                                    <div className="text-xs font-bold text-slate-700 whitespace-nowrap bg-slate-100 px-2 py-1 rounded flex items-center gap-1">
                                        <span>{formatDate(exp.start_date)}</span>
                                        <span>-</span>
                                        <span>
                                            {exp.end_date ? formatDate(exp.end_date) :
                                                (exp.is_current ?
                                                    <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700">Present</Badge>
                                                    : 'Unknown')
                                            }
                                        </span>
                                    </div>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
