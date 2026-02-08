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

    return (
        <div className="border rounded-md overflow-hidden">
            <Table>
                <TableHeader className="bg-slate-50">
                    <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Duration</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {experiences.map((exp) => (
                        <TableRow key={exp.experience_id}>
                            <TableCell className="font-medium text-slate-800">
                                {exp.company_name_text}
                            </TableCell>
                            <TableCell>{exp.position}</TableCell>
                            <TableCell className="text-xs text-slate-500">
                                <div className="flex flex-col">
                                    <span>
                                        {exp.start_date ? new Date(exp.start_date).getFullYear() : 'Unknown'} -
                                        {exp.is_current ? <Badge variant="secondary" className="ml-1 text-[10px] bg-emerald-100 text-emerald-700">Present</Badge> :
                                            exp.end_date ? new Date(exp.end_date).getFullYear() : 'Unknown'}
                                    </span>
                                    {exp.description && (
                                        <span className="mt-1 text-[10px] text-slate-400 truncate max-w-[200px]" title={exp.description}>
                                            {exp.description}
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
