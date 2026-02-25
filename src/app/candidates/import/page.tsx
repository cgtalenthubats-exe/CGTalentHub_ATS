"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";
import { processCsvUpload } from "@/app/actions/csv-actions";
import { createUploadRecord } from "@/app/actions/resume-actions";
import { getJobRequisitions } from "@/app/actions/requisitions";
import { bulkAddCandidatesToJR } from "@/app/actions/jr-candidates";
import { getStatuses } from "@/app/actions/candidate-filters";
import { createClient } from "@/utils/supabase/client";
import { updateUploadCandidateStatus } from "@/app/actions/resume-actions"; // Import update action
// Ensure ResumeUpload is exported correctly in src/components/ResumeUpload.tsx
import { ResumeUpload, UploadedFile } from "@/components/ResumeUpload";
import {
    ArrowLeft,
    UploadCloud,
    FileSpreadsheet,
    Loader2,
    Info,
    RefreshCw,
    Download,
    X,
    File as FileIcon,
    Search,
    ArrowUpDown,
    Filter,
    PlusCircle,
    CheckSquare,
    Square,
    FileText,
    Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { StatusSelect } from "@/components/ui/status-select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";

interface UploadLog {
    id: number | string; // UUID for resume, Int for CSV
    batch_id?: string; // CSV only
    candidate_id?: string;
    name?: string; // CSV
    file_name?: string; // Resume
    linkedin?: string;
    status: string;
    note?: string;
    uploader_email: string;
    created_at: string;
    resume_url?: string;
    candidate_status?: string; // Added field
}

interface JobRequisition {
    id: string;
    title: string;
    department: string;
    division: string;
    status: string;
}

export default function CandidateImportPage() {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<'csv' | 'resume'>('resume');
    const [uploading, setUploading] = useState(false);
    const [logs, setLogs] = useState<UploadLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [openDialog, setOpenDialog] = useState(false); // CSV Dialog
    const [openResumeDialog, setOpenResumeDialog] = useState(false); // Resume Dialog
    const [files, setFiles] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);

    // Selection & JR Logic
    const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]); // Log IDs
    const [openJRDialog, setOpenJRDialog] = useState(false);
    const [jrs, setJrs] = useState<JobRequisition[]>([]);
    const [loadingJrs, setLoadingJrs] = useState(false);
    const [jrSearch, setJrSearch] = useState("");
    const [selectedJrId, setSelectedJrId] = useState<string | null>(null);
    const [addingToJr, setAddingToJr] = useState(false);

    // Filter & Sort State
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [userFilter, setUserFilter] = useState<string>("all");
    const [sortConfig, setSortConfig] = useState<{ key: keyof UploadLog; direction: 'asc' | 'desc' } | null>(null);

    // Status Master Data
    const [statusOptions, setStatusOptions] = useState<{ status: string, color: string }[]>([]);

    // Current user email for upload tracking
    const [userEmail, setUserEmail] = useState<string>('');

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUserEmail(user?.email || '');
        });
    }, []);

    useEffect(() => {
        getStatuses().then(data => setStatusOptions(data));
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [viewMode]);

    const fetchLogs = async () => {
        setLoadingLogs(true);
        const supabase = createClient();
        let data: any[] | null = null;
        let error: any = null;

        if (viewMode === 'csv') {
            const result = await supabase
                .from('csv_upload_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);
            data = result.data;
            error = result.error;
        } else {
            const result = await supabase
                .from('resume_uploads')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);
            data = result.data;
            error = result.error;
        }

        if (error) {
            console.error(error);
            toast.error("Failed to load history");
        } else {
            setLogs(data || []);
        }
        setLoadingLogs(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFiles(e.target.files[0]);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.type === "text/csv" || droppedFile.name.endsWith('.csv')) {
                setFiles(droppedFile);
            } else {
                toast.error("Please upload a valid CSV file");
            }
        }
    };

    const downloadTemplate = () => {
        const csvContent = "data:text/csv;charset=utf-8,Name,LinkedIn\nJohn Doe,https://www.linkedin.com/in/johndoe\nJane Smith,https://www.linkedin.com/in/janesmith";
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "candidate_import_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleCsvUpload = async () => {
        if (!files) return;

        setUploading(true);
        try {
            Papa.parse(files, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const rows = results.data as any[];
                    if (rows.length > 0) {
                        const headers = Object.keys(rows[0]).map(h => h.trim().toLowerCase());
                        const hasName = headers.includes('name');
                        const hasLinkedin = headers.some(h => h.includes('linkedin'));

                        if (!hasName || !hasLinkedin) {
                            toast.error("Invalid CSV Headers. Missing 'Name' or 'LinkedIn'.");
                            setUploading(false);
                            return;
                        }
                    }

                    // Use real logged-in user email
                    const uploaderEmail = userEmail || 'unknown';

                    const res = await processCsvUpload(rows, uploaderEmail);

                    if (res.success) {
                        toast.success(`Processed ${res.totalProcessed} records. ${res.newCandidates} new, ${res.duplicates} duplicates.`);
                        setOpenDialog(false);
                        setFiles(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        fetchLogs();
                    } else {
                        toast.error("Upload failed: " + res.error);
                    }
                    setUploading(false);
                },
                error: (err) => {
                    toast.error("CSV Parse Error: " + err.message);
                    setUploading(false);
                }
            });
        } catch (error) {
            console.error(error);
            toast.error("Something went wrong");
            setUploading(false);
        }
    };

    const handleResumeUploadComplete = async (files: UploadedFile[]) => {
        // Filter only success files
        const successFiles = files.filter(f => f.status === 'success' && f.url);

        for (const f of successFiles) {
            // Save to DB
            const res = await createUploadRecord({
                file_name: f.file.name,
                resume_url: f.url!,
                uploader_email: userEmail || 'unknown'
            });

            if (!res.success) {
                toast.error(`Failed to save record for ${f.file.name}`);
            }
        }

        // Refresh logs to see new pending items
        fetchLogs();
    };

    // --- JR Selection Logic ---
    const handleOpenJRDialog = async () => {
        if (selectedIds.length === 0) return;
        setOpenJRDialog(true);
        setLoadingJrs(true);
        const data = await getJobRequisitions();
        setJrs(data.filter(j => j.is_active));
        setLoadingJrs(false);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredLogs.map(l => l.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: number | string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(x => x !== id));
        }
    };

    const handleAddToJR = async () => {
        if (!selectedJrId) {
            toast.error("Please select a Job Requisition");
            return;
        }

        setAddingToJr(true);
        try {
            // Get candidate info from selected logs
            const selectedCandidates = logs
                .filter(l => selectedIds.includes(l.id) && l.candidate_id?.startsWith('C'))
                .map(l => ({ id: l.candidate_id!, name: l.name || l.file_name || "Unknown" })) as { id: string, name: string }[];

            if (selectedCandidates.length === 0) {
                toast.error("No valid candidates selected (Must have Candidate ID)");
                setAddingToJr(false);
                return;
            }

            // Remove duplicates within selection
            const uniqueCandidates = Array.from(new Map(selectedCandidates.map(item => [item.id, item])).values());

            const res = await bulkAddCandidatesToJR(selectedJrId, uniqueCandidates);

            if (res.success) {
                setOpenJRDialog(false);
                setSelectedIds([]);
                setSelectedJrId(null);

                // Show Summary
                if (res.duplicates && res.duplicates.length > 0) {
                    toast.message("Added with Duplicates skipped", {
                        description: (
                            <div className="max-h-32 overflow-y-auto mt-2 text-xs">
                                <p className="font-bold text-emerald-600 mb-1">Success: {res.added}</p>
                                <p className="font-bold text-amber-600 mb-1">Skipped (Already in JR): {res.duplicates.length}</p>
                                <ul className="list-disc pl-4 text-slate-500">
                                    {res.duplicates.slice(0, 5).map((n, i) => <li key={i}>{n}</li>)}
                                    {res.duplicates.length > 5 && <li>...and {res.duplicates.length - 5} more</li>}
                                </ul>
                            </div>
                        ),
                        duration: 5000
                    });
                } else {
                    toast.success(`Successfully added ${res.added} candidates to JR`);
                }

            } else {
                toast.error("Failed to add to JR: " + res.error);
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setAddingToJr(false);
        }
    };

    // Filter Logic
    const filteredJrs = jrs.filter(jr =>
        jr.title.toLowerCase().includes(jrSearch.toLowerCase()) ||
        jr.department.toLowerCase().includes(jrSearch.toLowerCase()) ||
        jr.division.toLowerCase().includes(jrSearch.toLowerCase()) ||
        jr.id.toLowerCase().includes(jrSearch.toLowerCase())
    );

    const uniqueUsers = Array.from(new Set(logs.map(l => l.uploader_email).filter(Boolean)));
    const uniqueStatuses = Array.from(new Set(logs.map(l => l.status).filter(Boolean)));

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            (log.name && log.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (log.file_name && log.file_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (log.candidate_id && log.candidate_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (log.note && log.note.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesStatus = statusFilter === "all" || log.status === statusFilter;
        const matchesUser = userFilter === "all" || log.uploader_email === userFilter;

        return matchesSearch && matchesStatus && matchesUser;
    });

    const sortedLogs = [...filteredLogs].sort((a, b) => {
        if (!sortConfig) return 0;

        // Handle potentially missing keys safely
        const valA = (a as any)[sortConfig.key] || "";
        const valB = (b as any)[sortConfig.key] || "";

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const requestSort = (key: keyof UploadLog) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ column }: { column: keyof UploadLog }) => {
        if (sortConfig?.key !== column) return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-300" />;
        return sortConfig.direction === 'asc' ?
            <ArrowUpDown className="ml-1 h-3 w-3 text-indigo-600 rotate-180" /> :
            <ArrowUpDown className="ml-1 h-3 w-3 text-indigo-600" />;
    };

    return (
        <div className="container mx-auto p-6 space-y-6 max-w-7xl h-full flex flex-col">
            <div className="flex flex-col gap-2">
                <AtsBreadcrumb
                    items={[
                        { label: 'Candidates', href: '/candidates' },
                        { label: 'Import' }
                    ]}
                />
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">Candidate Import</h1>
                        <p className="text-muted-foreground mt-1">Bulk upload candidates via CSV or AI Resume Parsing.</p>
                    </div>

                    <div className="flex gap-2">
                        {/* Add to JR Button */}
                        {selectedIds.length > 0 && (
                            <Button
                                className="bg-amber-500 hover:bg-amber-600 text-white animate-in zoom-in fade-in slide-in-from-right-4"
                                onClick={handleOpenJRDialog}
                            >
                                <PlusCircle className="w-4 h-4 mr-2" /> Add {selectedIds.length} to Job
                            </Button>
                        )}

                        {/* Resume Dialog */}
                        <Dialog open={openResumeDialog} onOpenChange={setOpenResumeDialog}>
                            <DialogTrigger asChild>
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200">
                                    <FileText className="mr-2 h-4 w-4" /> Import Resumes (PDF)
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-xl">
                                <DialogHeader>
                                    <DialogTitle>Bulk Resume Upload</DialogTitle>
                                    <DialogDescription>
                                        Upload multiple PDF resumes. The AI will process them in the background.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4 space-y-4">
                                    <ResumeUpload onUploadComplete={handleResumeUploadComplete} />
                                </div>
                            </DialogContent>
                        </Dialog>

                        {/* CSV Dialog */}
                        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                            <DialogTrigger asChild>
                                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200">
                                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Import CSV
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Upload Candidate CSV</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div
                                        className={cn(
                                            "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer",
                                            dragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
                                        )}
                                        onDragEnter={handleDrag}
                                        onDragLeave={handleDrag}
                                        onDragOver={handleDrag}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {files ? (
                                            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                                                <FileIcon className="w-10 h-10 text-emerald-500 mb-2" />
                                                <span className="text-sm font-medium text-slate-700">{files.name}</span>
                                                <span className="text-xs text-slate-400 mt-1">{(files.size / 1024).toFixed(1)} KB</span>
                                                <Button
                                                    variant="ghost" size="sm" className="mt-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={(e) => { e.stopPropagation(); setFiles(null); }}
                                                >
                                                    <X className="w-3 h-3 mr-1" /> Remove
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <FileSpreadsheet className="w-10 h-10 text-slate-300 mb-2" />
                                                <p className="text-sm text-slate-500 mb-1">
                                                    <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
                                                </p>
                                                <p className="text-xs text-slate-400">CSV file with &apos;Name&apos; and &apos;LinkedIn&apos; headers</p>
                                            </>
                                        )}
                                        <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                                    </div>

                                    <div className="flex justify-between items-center px-1">
                                        <Button variant="link" size="sm" className="h-auto p-0 text-slate-500 text-xs" onClick={downloadTemplate}>
                                            <Download className="w-3 h-3 mr-1" /> Download Template
                                        </Button>
                                    </div>

                                    <Button onClick={handleCsvUpload} disabled={!files || uploading} className="w-full bg-indigo-600 hover:bg-indigo-700">
                                        {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Start Import"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>

            <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm flex-1 flex flex-col overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100/50 flex flex-col gap-4 pb-4">
                    <div className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-[400px]">
                                <TabsList>
                                    <TabsTrigger value="resume" className="gap-2"><FileText className="w-4 h-4" /> Resume Uploads</TabsTrigger>
                                    <TabsTrigger value="csv" className="gap-2"><FileSpreadsheet className="w-4 h-4" /> CSV Uploads</TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                {filteredLogs.length} records
                            </span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loadingLogs}>
                            <RefreshCw className={cn("w-4 h-4", loadingLogs && "animate-spin")} />
                        </Button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input placeholder="Search by name, ID or note..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-white border-slate-200" />
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[160px] bg-white border-slate-200">
                                    <SelectValue placeholder="Filter Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    {uniqueStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            <Select value={userFilter} onValueChange={setUserFilter}>
                                <SelectTrigger className="w-[200px] bg-white border-slate-200">
                                    <SelectValue placeholder="Filter User" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Users</SelectItem>
                                    {uniqueUsers.map(user => <SelectItem key={user} value={user}>{user}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            {(statusFilter !== "all" || userFilter !== "all" || searchQuery) && (
                                <Button variant="ghost" size="icon" onClick={() => { setStatusFilter("all"); setUserFilter("all"); setSearchQuery(""); }} className="text-slate-400 hover:text-red-500">
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto">
                    {loadingLogs ? (
                        <div className="h-[400px] flex flex-col items-center justify-center gap-4 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <span className="text-xs font-bold uppercase tracking-widest">Loading Logs...</span>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-slate-400">
                            <Search className="w-8 h-8 opacity-20" />
                            <span className="text-xs">No matching records</span>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <Checkbox
                                            checked={filteredLogs.length > 0 && selectedIds.length === filteredLogs.length}
                                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                        />
                                    </TableHead>
                                    <TableHead className="w-[150px] cursor-pointer" onClick={() => requestSort('created_at')}>
                                        <div className="flex items-center">Timestamp <SortIcon column="created_at" /></div>
                                    </TableHead>
                                    <TableHead className="w-[100px] cursor-pointer" onClick={() => requestSort('candidate_id')}>
                                        <div className="flex items-center">ID <SortIcon column="candidate_id" /></div>
                                    </TableHead>
                                    <TableHead className="w-[200px] cursor-pointer" onClick={() => requestSort('name')}>
                                        <div className="flex items-center">{viewMode === 'resume' ? 'File / Name' : 'Name'} <SortIcon column="name" /></div>
                                    </TableHead>
                                    {viewMode === 'resume' && (
                                        <TableHead className="w-[80px]">Link</TableHead>
                                    )}
                                    <TableHead className="w-[150px] cursor-pointer" onClick={() => requestSort('uploader_email')}>
                                        <div className="flex items-center">User <SortIcon column="uploader_email" /></div>
                                    </TableHead>
                                    <TableHead className="w-[120px] cursor-pointer" onClick={() => requestSort('status')}>
                                        <div className="flex items-center">Process Status <SortIcon column="status" /></div>
                                    </TableHead>
                                    <TableHead className="w-[200px]">Candidate Status</TableHead>
                                    <TableHead>Note</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedLogs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.includes(log.id)}
                                                onCheckedChange={(checked) => handleSelectOne(log.id, !!checked)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-500 font-mono">
                                            {new Date(log.created_at).toLocaleString('th-TH')}
                                        </TableCell>
                                        <TableCell>
                                            {/* Feature 1: Clickable ID if status is 'Complete' or ID exists */}
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
                                        <TableCell className="text-xs text-slate-500 truncate max-w-[150px]">{log.uploader_email}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={cn("text-[10px] uppercase font-bold tracking-wider",
                                                log.status === 'Completed' || log.status === 'Complete' || log.status === 'Scraping' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                                    log.status.includes('Duplicate') ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                        log.status === 'pending' || log.status === 'Processing' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                                            "bg-red-50 text-red-600 border-red-100")}>
                                                {log.status}
                                            </Badge>
                                        </TableCell>

                                        {/* Candidate Status Dropdown */}
                                        <TableCell>
                                            <StatusSelect
                                                value={log.candidate_status || ""}
                                                onChange={async (val) => {
                                                    // Optimistic Update
                                                    setLogs(prev => prev.map(l => l.id === log.id ? { ...l, candidate_status: val } : l));

                                                    // API Call
                                                    const res = await updateUploadCandidateStatus(String(log.id), val, viewMode);
                                                    if (res.success) {
                                                        toast.success("Status updated");
                                                    } else {
                                                        toast.error("Failed to update status");
                                                        // Revert if needed
                                                    }
                                                }}
                                                className="w-[180px] h-8 text-xs bg-white border-slate-200"
                                                placeholder="Select Status"
                                            />
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-500 italic truncate max-w-[200px]">{log.note}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* JR Selection Dialog */}
            <Dialog open={openJRDialog} onOpenChange={setOpenJRDialog}>
                {/* ... (Existing JR Dialog Content) ... */}
                <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Add {selectedIds.length} Candidate(s) to Requisition</DialogTitle>
                        <DialogDescription>Select a target Job Requisition to add these candidates.</DialogDescription>
                    </DialogHeader>

                    <div className="relative mt-2">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by Title, ID, BU or Department..."
                            className="pl-9"
                            value={jrSearch}
                            onChange={(e) => setJrSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto border rounded-md mt-2 p-1">
                        {loadingJrs ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
                        ) : filteredJrs.length === 0 ? (
                            <div className="text-center p-8 text-slate-400 text-sm">No Active Job Requisitions found matching your search.</div>
                        ) : (
                            <div className="space-y-1">
                                {filteredJrs.map(jr => (
                                    <div
                                        key={jr.id}
                                        className={cn(
                                            "flex items-center justify-between p-3 rounded-lg cursor-pointer border transition-all",
                                            selectedJrId === jr.id ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500" : "hover:bg-slate-50 border-transparent hover:border-slate-200"
                                        )}
                                        onClick={() => setSelectedJrId(jr.id)}
                                    >
                                        <div>
                                            <div className="font-semibold text-sm text-slate-800">{jr.title} <span className="text-xs text-slate-400 font-normal ml-1">({jr.id})</span></div>
                                            <div className="text-xs text-slate-500 flex gap-2 mt-1">
                                                <Badge variant="secondary" className="text-[10px] px-1 h-5">{jr.department}</Badge>
                                                <Badge variant="outline" className="text-[10px] px-1 h-5 text-slate-500">{jr.division}</Badge>
                                            </div>
                                        </div>
                                        {selectedJrId === jr.id && <CheckSquare className="w-5 h-5 text-indigo-600" />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="mt-4">
                        <div className="mr-auto text-xs text-slate-500 self-center">
                            Note: Duplicates in target JR will be skipped automatically.
                        </div>
                        <Button variant="outline" onClick={() => setOpenJRDialog(false)}>Cancel</Button>
                        <Button onClick={handleAddToJR} disabled={!selectedJrId || addingToJr} className="bg-indigo-600 hover:bg-indigo-700">
                            {addingToJr && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm & Add
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
