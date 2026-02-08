"use client";

import React, { useEffect, useState } from "react";
import {
    Briefcase,
    Search,
    Plus,
    Filter,
    MoreHorizontal,
    Copy,
    ArrowUpDown
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { JobRequisition } from "@/types/job";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function JobsPage() {
    const [jobs, setJobs] = useState<JobRequisition[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        async function fetchJobs() {
            try {
                // Based on check-db.js, table name is `job_requisitions` (snake_case)
                const { data, error } = await supabase
                    .from('job_requisitions')
                    .select('*')
                    .order('jr_number', { ascending: false }); // Show newest first?

                if (error) throw error;
                setJobs(data || []);
            } catch (err: any) {
                console.error("Error fetching jobs:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchJobs();
    }, []);

    // Filter Logic
    const filteredJobs = jobs.filter(job =>
        job.position_jr?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.jr_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.bu?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-6 h-full">
            {/* Header */}
            <div className="flex items-end justify-between shrink-0">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Job Requisitions</h1>
                    <p className="text-muted-foreground mt-1">Manage active positions and hiring pipelines.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" /> Filters
                    </Button>
                    <Button className="gap-2 bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                        <Plus className="h-4 w-4" /> Create Requisition
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex gap-4 items-center bg-card p-4 rounded-2xl ring-1 ring-border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by Position, JR ID, or BU..."
                        className="pl-10 bg-secondary/50 border-transparent focus:bg-background transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Main Content: Table */}
            <div className="flex-1 overflow-hidden ring-1 ring-border rounded-xl bg-card shadow-sm flex flex-col">
                {/* Table Header: Stronger Contrast */}
                <div className="grid grid-cols-12 gap-4 p-4 border-b bg-slate-100 dark:bg-slate-900/50 text-xs font-bold uppercase text-slate-700 dark:text-slate-300 tracking-wider sticky top-0 backdrop-blur-md z-10 shadow-sm">
                    <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-primary transition-colors">JR ID <ArrowUpDown className="h-3 w-3" /></div>
                    <div className="col-span-4">Position</div>
                    <div className="col-span-2">BU / Dept</div>
                    <div className="col-span-2">Created</div>
                    <div className="col-span-1">Status</div>
                    <div className="col-span-1 text-right">Actions</div>
                </div>

                {/* Scrollable Rows */}
                <div className="overflow-y-auto flex-1 p-2 space-y-1 bg-slate-50/50 dark:bg-transparent">
                    {loading ? (
                        <div className="p-10 text-center text-muted-foreground animate-pulse">Loading Requisitions...</div>
                    ) : filteredJobs.length === 0 ? (
                        <div className="p-10 text-center text-muted-foreground">No jobs found matching &quot;{searchTerm}&quot;</div>
                    ) : (
                        filteredJobs.map((job) => (
                            <div key={job.jr_id} className="grid grid-cols-12 gap-4 p-3 items-center bg-card hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-all group text-sm border border-transparent hover:border-border hover:shadow-sm">
                                <div className="col-span-2 font-mono text-xs text-primary font-bold tracking-tight">{job.jr_id}</div>
                                <div className="col-span-4 font-bold text-foreground truncate text-base" title={job.position_jr}>{job.position_jr || "Untitled"}</div>
                                <div className="col-span-2 text-muted-foreground text-xs font-medium">{job.bu}</div>
                                <div className="col-span-2 text-muted-foreground text-xs">{job.request_date}</div>
                                <div className="col-span-1">
                                    <Badge variant={job.is_active?.toLowerCase() === 'active' ? "default" : "secondary"}
                                        className={
                                            job.is_active?.toLowerCase() === 'active'
                                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none px-2"
                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-none px-2"
                                        }>
                                        {job.is_active || 'Unknown'}
                                    </Badge>
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem>View Pipeline</DropdownMenuItem>
                                            <DropdownMenuItem>Edit Details</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="gap-2">
                                                <Copy className="h-3 w-3" /> Duplicate
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Stats */}
                <div className="p-3 border-t bg-slate-50 dark:bg-slate-900/30 text-xs text-muted-foreground flex justify-between font-medium">
                    <span>Showing {filteredJobs.length} of {jobs.length} requisitions</span>
                    <span>Table: public.job_requisitions</span>
                </div>
            </div>
        </div>
    );
}
