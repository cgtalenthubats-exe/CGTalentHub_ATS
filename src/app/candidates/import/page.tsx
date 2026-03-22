"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";
import { processCsvUpload } from "@/app/actions/csv-actions";
import { createUploadRecord, handleDuplicateResume, logSkippedResume } from "@/app/actions/resume-actions";
import { bulkAddCandidatesToJR } from "@/app/actions/jr-candidates";
import { AddCandidateDialog } from "@/components/ai-search/AddCandidateDialog";
import { getStatuses } from "@/app/actions/candidate-filters";
import { getUserProfiles, UserProfile } from "@/app/actions/user-actions";
import { createClient } from "@/utils/supabase/client";
import { updateUploadCandidateStatus } from "@/app/actions/resume-actions"; // Import update action
// Ensure ResumeUpload is exported correctly in src/components/ResumeUpload.tsx
import { ResumeUpload, UploadedFile } from "@/components/ResumeUpload";
import { LogTableRow } from "@/components/import/LogTableRow";
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
    Layers,
    AlertCircle
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import { Label } from "@/components/ui/label";

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



export default function CandidateImportPage() {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<'csv' | 'resume'>('resume');
    const [uploading, setUploading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [logs, setLogs] = useState<UploadLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [openDialog, setOpenDialog] = useState(false); // CSV Dialog
    const [openResumeDialog, setOpenResumeDialog] = useState(false); // Resume Dialog
    const [files, setFiles] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);

    // Manual Add State
    const [openManualDialog, setOpenManualDialog] = useState(false);
    const [manualName, setManualName] = useState("");
    const [manualLinkedin, setManualLinkedin] = useState("");

    // Selection & JR Logic
    const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]); // Log IDs
    const [openJrDialog, setOpenJrDialog] = useState(false);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(25);
    const [totalLogs, setTotalLogs] = useState(0);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [openDuplicateDialog, setOpenDuplicateDialog] = useState(false);
    const [duplicateData, setDuplicateData] = useState<{
        existingRecord: any;
        newResumeUrl: string;
        fileName: string;
    } | null>(null);
    const [processingDuplicate, setProcessingDuplicate] = useState(false);

    // Filter & Sort State
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [userFilter, setUserFilter] = useState<string>("all");
    const [sortConfig, setSortConfig] = useState<{ key: keyof UploadLog; direction: 'asc' | 'desc' } | null>(null);

    // Created By Selection
    const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
    const [selectedCreatedBy, setSelectedCreatedBy] = useState<string>("Manual Input");

    // Status Master Data
    const [statusOptions, setStatusOptions] = useState<{ status: string, color: string }[]>([]);

    // Current user email for upload tracking
    const [userEmail, setUserEmail] = useState<string>('');

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            const email = user?.email || '';
            setUserEmail(email);
            
            // Fetch profiles and set default Created By
            getUserProfiles().then(res => {
                if (res.success && res.data) {
                    setUserProfiles(res.data);
                    const currentUser = res.data.find(p => p.email.toLowerCase() === email.toLowerCase());
                    if (currentUser) {
                        setSelectedCreatedBy(currentUser.real_name);
                    }
                }
            });
        });
    }, []);

    useEffect(() => {
        getStatuses().then(data => setStatusOptions(data));
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [viewMode, currentPage, statusFilter, userFilter]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (currentPage !== 1) {
                setCurrentPage(1);
            } else {
                fetchLogs();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [viewMode]);

    const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
            const supabase = createClient();
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            let query = supabase
                .from(viewMode === 'csv' ? 'csv_upload_logs' : 'resume_uploads')
                .select('*', { count: 'exact' });

            // Backend Search
            if (searchTerm) {
                const search = `%${searchTerm}%`;
                if (viewMode === 'csv') {
                    query = query.or(`name.ilike.${search},note.ilike.${search},candidate_id.ilike.${search}`);
                } else {
                    query = query.or(`file_name.ilike.${search},note.ilike.${search},candidate_id.ilike.${search}`);
                }
            }

            // Backend Filters
            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }
            if (userFilter !== 'all') {
                query = query.eq('uploader_email', userFilter);
            }

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            setLogs(data || []);
            setTotalLogs(count || 0);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load history");
        } finally {
            setLoadingLogs(false);
        }
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

                    const res = await processCsvUpload(rows, selectedCreatedBy);

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

    const handleManualSubmit = async () => {
        if (!manualName || !manualLinkedin) return;

        setUploading(true);
        try {
            const rows = [{
                Name: manualName,
                LinkedIn: manualLinkedin
            }];

            const res = await processCsvUpload(rows, selectedCreatedBy);

            if (res.success) {
                toast.success(`Candidate ${manualName} submitted for scraping.`);
                setOpenManualDialog(false);
                setManualName("");
                setManualLinkedin("");
                fetchLogs();
            } else {
                toast.error("Submission failed: " + res.error);
            }
        } catch (error) {
            console.error(error);
            toast.error("Something went wrong");
        } finally {
            setUploading(false);
        }
    };
    // Handle Duplicate Upload Dialog Queue
    const [duplicateQueue, setDuplicateQueue] = useState<any[]>([]);
    const [applyToAll, setApplyToAll] = useState(false);
    
    // Derived state for the current duplicate being processed
    const currentDuplicate = duplicateQueue.length > 0 ? duplicateQueue[0] : null;

    useEffect(() => {
        if (duplicateQueue.length > 0) {
            setOpenDuplicateDialog(true);
        } else {
            setOpenDuplicateDialog(false);
            setApplyToAll(false);
        }
    }, [duplicateQueue]);

    // -- File Drop Handlers --
    const handleResumeUploadComplete = async (files: UploadedFile[]) => {
        // Filter only success files
        const successFiles = files.filter(f => f.status === 'success' && f.url);

        for (const f of successFiles) {
            // Save to DB
            const res = await createUploadRecord({
                file_name: f.file.name,
                resume_url: f.url!,
                uploader_email: selectedCreatedBy
            });

            if (!res.success) {
                toast.error(`Failed to save record for ${f.file.name}`);
            }
        }

        fetchLogs();
    };

    const handleDuplicatesDetected = (duplicates: { file: File, existingRecord: any }[]) => {
        const queueItems = duplicates.map(d => ({
            file: d.file,
            existingRecord: d.existingRecord,
            fileName: d.file.name
        }));
        setDuplicateQueue(prev => [...prev, ...queueItems]);
    };

    const processSingleDuplicate = async (choice: 'update' | 'attach' | 'no-action', dup: any) => {
        if (choice === 'no-action') {
            return await logSkippedResume(dup.fileName, userEmail || 'unknown');
        } else {
            // Must upload to S3 first since it was paused
            const supabase = createClient();
            // Sanitize filename to prevent 'Invalid key' error from special characters (accents, etc)
            const sanitizedBase = dup.file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileNameToUpload = `${Date.now()}_${sanitizedBase}`;
            const { error: uploadErr } = await supabase.storage.from('resumes').upload(fileNameToUpload, dup.file);
            if (uploadErr) return { success: false, error: "Cloud storage upload failed: " + uploadErr.message };

            const { data } = supabase.storage.from('resumes').getPublicUrl(fileNameToUpload);
            
            return await handleDuplicateResume(
                choice,
                dup.existingRecord,
                data.publicUrl,
                userEmail || 'unknown'
            );
        }
    };

    const handleDuplicateChoice = async (choice: 'update' | 'attach' | 'no-action') => {
        if (!currentDuplicate) return;
        setProcessingDuplicate(true);
        
        try {
            if (applyToAll) {
                // Process entire queue
                let successCount = 0;
                for (const dup of duplicateQueue) {
                    const res = await processSingleDuplicate(choice, dup);
                    if (res.success) successCount++;
                }
                toast.success(`Action '${choice}' applied to ${successCount} duplicate files.`);
                setDuplicateQueue([]); // Clear queue
            } else {
                // Process just the current one
                const res = await processSingleDuplicate(choice, currentDuplicate);

                if (res.success) {
                    toast.success((res as any).message || "Action completed for " + currentDuplicate.fileName);
                } else {
                    toast.error(res.error || "Failed to process choice for " + currentDuplicate.fileName);
                }
                setDuplicateQueue(prev => prev.slice(1));
            }
        } catch (error) {
            console.error(error);
            toast.error("Something went wrong processing duplicates");
            setDuplicateQueue(prev => prev.slice(1));
        } finally {
            setProcessingDuplicate(false);
            fetchLogs();
        }
    };

    const handleDuplicateDialogChange = (open: boolean) => {
        if (!open) {
            // If user explicitly closes the dialog without action (clicks outside or X)
            // We assume they want to "Skip" the remaining duplicates to clear the UI queue
            if (duplicateQueue.length > 0) {
                toast.info(`Skipped remaining ${duplicateQueue.length} duplicate(s)`);
                setDuplicateQueue([]);
            }
        }
        setOpenDuplicateDialog(open);
    };

    // --- JR Selection Logic ---
    const handleOpenJrDialog = () => {
        if (selectedIds.length === 0) return;

        // Check if any valid candidates (with ID) are selected
        const validCount = logs.filter(l => selectedIds.includes(l.id) && l.candidate_id?.startsWith('C')).length;
        if (validCount === 0) {
            toast.error("No valid candidates selected (Must have Candidate ID)");
            return;
        }

        setOpenJrDialog(true);
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

    // Memoized selection data to prevent lag on complex pages
    const selectedCandidateData = React.useMemo(() => {
        return logs
            .filter(l => selectedIds.includes(l.id) && l.candidate_id?.startsWith('C'))
            .map(l => ({
                id: l.candidate_id!,
                name: l.name || l.file_name || "Unknown"
            }));
    }, [logs, selectedIds]);

    const uniqueUsers = React.useMemo(() => Array.from(new Set(logs.map(log => log.uploader_email).filter(Boolean))).sort(), [logs]);
    const uniqueStatuses = React.useMemo(() => Array.from(new Set(logs.map(log => log.status).filter(Boolean))).sort(), [logs]);

    const filteredLogs = logs;

    const sortedLogs = React.useMemo(() => {
        if (!sortConfig) return filteredLogs;
        return [...filteredLogs].sort((a, b) => {

        // Handle potentially missing keys safely
        const valA = (a as any)[sortConfig.key] || "";
        const valB = (b as any)[sortConfig.key] || "";

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredLogs, sortConfig]);

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

    const downloadCsv = async () => {
        setIsDownloading(true);
        try {
            const supabase = createClient();
            let query = supabase
                .from(viewMode === 'csv' ? 'csv_upload_logs' : 'resume_uploads')
                .select('*');

            // Apply current filters to get ALL matching records, not just the current page
            if (searchTerm) {
                const search = `%${searchTerm}%`;
                if (viewMode === 'csv') {
                    query = query.or(`name.ilike.${search},note.ilike.${search},candidate_id.ilike.${search}`);
                } else {
                    query = query.or(`file_name.ilike.${search},note.ilike.${search},candidate_id.ilike.${search}`);
                }
            }

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }
            if (userFilter !== 'all') {
                query = query.eq('uploader_email', userFilter);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            
            if (error) throw error;
            
            const logsToDownload = data || [];
            
            if (logsToDownload.length === 0) {
                toast.error("No records found to download");
                return;
            }

            const headers = [
                'Candidate ID', 'Name', 'File Name', 'LinkedIn',
                'Status', 'Candidate Status', 'Note',
                'Uploader Email', 'Batch ID', 'Created At', 'Resume URL'
            ];
            
            const rows = logsToDownload.map(log => [
                log.candidate_id || '',
                log.name || '',
                log.file_name || '',
                log.linkedin || '',
                log.status || '',
                log.candidate_status || '',
                (log.note || '').replace(/,/g, ';').replace(/\n/g, ' '),
                log.uploader_email || '',
                log.batch_id || '',
                log.created_at || '',
                log.resume_url || ''
            ]);
            
            const csvContent = [headers, ...rows]
                .map(row => row.map(cell => `"${cell}"`).join(','))
                .join('\n');
                
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `upload-log-${viewMode}-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error generating CSV:", error);
            toast.error("Failed to generate CSV");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6 max-w-7xl">
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

                    <div className="flex items-center gap-3 bg-white/50 p-2 rounded-lg border border-slate-100 shadow-sm">
                        <Label htmlFor="global-created-by" className="text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                            Created By:
                        </Label>
                        <Select value={selectedCreatedBy} onValueChange={setSelectedCreatedBy}>
                            <SelectTrigger id="global-created-by" className="w-[220px] bg-white border-slate-200 h-9 text-sm font-medium">
                                <SelectValue placeholder="Selecting creator..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Manual Input">Manual Input</SelectItem>
                                {userProfiles.filter(p => !!p.real_name && p.real_name.trim() !== "").map((profile) => (
                                    <SelectItem key={profile.email} value={profile.real_name}>
                                        {profile.real_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex gap-2">
                        {/* Add to JR Button */}
                        {selectedIds.length > 0 && (
                            <Button
                                className="bg-amber-500 hover:bg-amber-600 text-white animate-in zoom-in fade-in slide-in-from-right-4"
                                onClick={handleOpenJrDialog}
                            >
                                <PlusCircle className="w-4 h-4 mr-2" /> Add {selectedIds.length} to Job
                            </Button>
                        )}

                        {/* Resume Sheet */}
                        <Sheet open={openResumeDialog} onOpenChange={setOpenResumeDialog}>
                            <SheetTrigger asChild>
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200">
                                    <FileText className="mr-2 h-4 w-4" /> Import Resumes (PDF)
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="sm:max-w-xl w-full flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                                <SheetHeader className="p-6 shrink-0 bg-slate-900 text-left">
                                    <SheetTitle className="text-xl font-bold flex items-center gap-2 text-white">
                                        <FileText className="w-5 h-5 text-blue-400" />
                                        Bulk Resume Upload
                                    </SheetTitle>
                                    <SheetDescription className="text-slate-400">
                                        Upload multiple PDF resumes. The AI will process them in the background.
                                    </SheetDescription>
                                </SheetHeader>
                                <div className="p-6 flex-1 min-h-0 overflow-y-auto space-y-4 bg-slate-50/50">
                                    <ResumeUpload onUploadComplete={handleResumeUploadComplete} onDuplicatesDetected={handleDuplicatesDetected} />
                                </div>
                                <div className="p-6 shrink-0 bg-slate-50 border-t flex items-center justify-end">
                                    <Button variant="outline" onClick={() => setOpenResumeDialog(false)} className="rounded-xl font-bold text-slate-500 hover:bg-slate-200">
                                        Close Window
                                    </Button>
                                </div>
                            </SheetContent>
                        </Sheet>

                        {/* Manual Add Dialog */}
                        <Dialog open={openManualDialog} onOpenChange={setOpenManualDialog}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                                    <PlusCircle className="mr-2 h-4 w-4" /> Manual Add
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Manual Candidate Addition</DialogTitle>
                                    <DialogDescription>
                                        Enter name and LinkedIn URL to trigger AI scraping.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="manual-name">Full Name</Label>
                                        <Input
                                            id="manual-name"
                                            placeholder="Enter name"
                                            value={manualName}
                                            onChange={(e) => setManualName(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="manual-linkedin">LinkedIn URL</Label>
                                        <Input
                                            id="manual-linkedin"
                                            placeholder="https://www.linkedin.com/in/..."
                                            value={manualLinkedin}
                                            onChange={(e) => setManualLinkedin(e.target.value)}
                                        />
                                    </div>
                                    <Button
                                        onClick={handleManualSubmit}
                                        disabled={!manualName || !manualLinkedin || uploading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                                    >
                                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                        Submit for Scraping
                                    </Button>
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

            <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm">
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
                                {totalLogs} records
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={downloadCsv} disabled={totalLogs === 0 || isDownloading} className="gap-2 text-slate-600">
                                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download CSV
                            </Button>
                            <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loadingLogs}>
                                <RefreshCw className={cn("w-4 h-4", loadingLogs && "animate-spin")} />
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input placeholder="Search by name, ID or note..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-white border-slate-200" />
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[160px] bg-white border-slate-200">
                                    <SelectValue placeholder="Filter Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    {uniqueStatuses.map((status: string, idx: number) => <SelectItem key={`${status}-${idx}`} value={status}>{status}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            <Select value={userFilter} onValueChange={setUserFilter}>
                                <SelectTrigger className="w-[200px] bg-white border-slate-200">
                                    <SelectValue placeholder="Filter User" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Users</SelectItem>
                                    {uniqueUsers.map((user: string, idx: number) => <SelectItem key={`${user}-${idx}`} value={user}>{user}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            {(statusFilter !== "all" || userFilter !== "all" || searchTerm) && (
                                <Button variant="ghost" size="icon" onClick={() => { setStatusFilter("all"); setUserFilter("all"); setSearchTerm(""); }} className="text-slate-400 hover:text-red-500">
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
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
                                {filteredLogs.map((log) => (
                                    <LogTableRow
                                        key={log.id}
                                        log={log}
                                        viewMode={viewMode}
                                        isSelected={selectedIds.includes(log.id)}
                                        onSelectChange={(checked) => {
                                            setSelectedIds(prev => 
                                                checked 
                                                    ? [...prev, log.id] 
                                                    : prev.filter(id => id !== log.id)
                                            );
                                        }}
                                        onStatusChange={async (newStatus) => {
                                            // Optimistic Update
                                            setLogs(prev => prev.map(l => l.id === log.id ? { ...l, candidate_status: newStatus } : l));
                                            const res = await updateUploadCandidateStatus(String(log.id), newStatus, viewMode);
                                            return res.success;
                                        }}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
                {totalLogs > pageSize && (
                    <div className="px-6 py-4 border-t flex items-center justify-between">
                        <div className="text-xs text-slate-500">
                            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalLogs)} of {totalLogs} entries
                        </div>
                        <PaginationControls
                            currentPage={currentPage}
                            totalCount={totalLogs}
                            pageSize={pageSize}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}
            </Card>

            {/* JR Selection Dialog */}
            <AddCandidateDialog
                open={openJrDialog}
                onOpenChange={setOpenJrDialog}
                candidateIds={selectedCandidateData.map(c => c.id)}
                candidateNames={selectedCandidateData.map(c => c.name)}
                onSuccess={() => {
                    setSelectedIds([]);
                    setOpenJrDialog(false);
                }}
            />

            {/* Duplicate Handling Dialog */}
            <Dialog open={openDuplicateDialog} onOpenChange={handleDuplicateDialogChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertCircle className="w-5 h-5" />
                            Duplicate Resume Detected
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 mt-2">
                            File <span className="font-semibold text-slate-900">{currentDuplicate?.fileName || 'Unknown file'}</span> has already been uploaded.
                            <br />What would you like to do?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-3 py-4">
                        <Button
                            variant="outline"
                            className="justify-start h-auto py-3 px-4 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                            onClick={() => handleDuplicateChoice('update')}
                            disabled={processingDuplicate}
                        >
                            <div className="flex flex-col items-start text-left">
                                <span className="font-semibold text-indigo-700 flex items-center gap-2">
                                    <RefreshCw className={cn("w-4 h-4", processingDuplicate && "animate-spin")} />
                                    Update Information
                                </span>
                                <span className="text-xs text-slate-500 mt-1">Re-trigger AI to parse and overwrite existing data.</span>
                            </div>
                        </Button>

                        <Button
                            variant="outline"
                            className="justify-start h-auto py-3 px-4 border-slate-200 hover:bg-slate-50 transition-colors"
                            onClick={() => handleDuplicateChoice('attach')}
                            disabled={processingDuplicate}
                        >
                            <div className="flex flex-col items-start text-left">
                                <span className="font-semibold text-slate-700 flex items-center gap-2">
                                    <PlusCircle className="w-4 h-4" />
                                    Attach Resume Only
                                </span>
                                <span className="text-xs text-slate-500 mt-1">Keep existing data but update the resume file link.</span>
                            </div>
                        </Button>

                        <Button
                            variant="ghost"
                            className="justify-center mt-2 text-slate-600 hover:bg-slate-100"
                            onClick={() => handleDuplicateChoice('no-action')}
                            disabled={processingDuplicate}
                        >
                            No Action (Skip)
                        </Button>
                        
                        {duplicateQueue.length > 1 && (
                            <div className="mt-4 flex items-center justify-center gap-2 pt-4 border-t border-slate-100">
                                <Checkbox 
                                    id="apply-to-all" 
                                    checked={applyToAll} 
                                    onCheckedChange={(c) => setApplyToAll(!!c)} 
                                />
                                <Label htmlFor="apply-to-all" className="text-sm cursor-pointer font-medium text-slate-600">
                                    Apply this choice to the remaining <span className="font-bold text-amber-600">{duplicateQueue.length - 1}</span> duplicate(s)
                                </Label>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function PaginationControls({ currentPage, totalCount, pageSize, onPageChange }: any) {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Sliding Window Logic
    let startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }

    return (
        <div className="flex items-center gap-1">
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
            >
                Previous
            </Button>

            {startPage > 1 && (
                <>
                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-xs" onClick={() => onPageChange(1)}>1</Button>
                    {startPage > 2 && <span className="text-muted-foreground px-1 text-xs">...</span>}
                </>
            )}

            {pages.map(p => (
                <Button
                    key={p}
                    variant={currentPage === p ? "default" : "ghost"}
                    size="sm"
                    className="w-8 h-8 p-0 text-xs"
                    onClick={() => onPageChange(p)}
                >
                    {p}
                </Button>
            ))}

            {endPage < totalPages && (
                <>
                    {endPage < totalPages - 1 && <span className="text-muted-foreground px-1 text-xs">...</span>}
                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-xs" onClick={() => onPageChange(totalPages)}>{totalPages}</Button>
                </>
            )}

            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
            >
                Next
            </Button>
        </div>
    )
}
