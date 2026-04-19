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
    AlertCircle,
    Calendar as CalendarIcon,
    Filter as FilterIcon,
    X as XIcon,
    ChevronDown,
    Check
} from "lucide-react";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { format, startOfDay, endOfDay } from "date-fns";
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
import { toast } from "@/lib/notifications";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import { Label } from "@/components/ui/label";

interface UploadLog {
    id: number | string; // UUID for resume, Int for CSV
    batch_id?: string; // CSV only
    batch_name?: string; // CSV only
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
    const [allMetadata, setAllMetadata] = useState<any[]>([]);
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]);
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
    const [statusFilters, setStatusFilters] = useState<string[]>([]);
    const [userFilters, setUserFilters] = useState<string[]>([]);
    const [batchFilters, setBatchFilters] = useState<string[]>([]);
    const [dateFilter, setDateFilter] = useState<string>("all");

    // Discovery State

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
                    if (currentUser && currentUser.real_name) {
                        setSelectedCreatedBy(currentUser.real_name);
                    } else {
                        setSelectedCreatedBy(email); // Fallback to email
                    }
                } else {
                    setSelectedCreatedBy(email); // Fallback to email
                }
            }).catch(() => {
                setSelectedCreatedBy(email);
            });
        });
    }, []);

    useEffect(() => {
        getStatuses().then(data => setStatusOptions(data));
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [viewMode, currentPage, statusFilters, userFilters, batchFilters, dateFilter]);

    // Fetch discovery metadata only when viewMode changes
    useEffect(() => {
        fetchDiscoveryData();
    }, [viewMode]);

    // Reset to page 1 when filters change
    useEffect(() => {
        if (currentPage !== 1) {
            setCurrentPage(1);
        } else {
            // If already on page 1, we still need to fetch logs if filters changed
            // but the main effect above handles it via dependencies.
        }
    }, [statusFilters, userFilters, batchFilters, dateFilter, searchTerm]);

    const fetchDiscoveryData = async () => {
        try {
            const supabase = createClient();
            const tableName = viewMode === 'csv' ? 'csv_upload_logs' : 'resume_uploads';
            
            const query = supabase
                .from(tableName as any)
                .select(viewMode === 'csv' ? 'status, uploader_email, batch_id, batch_name, created_at' : 'status, uploader_email, created_at')
                .order('created_at', { ascending: false })
                .limit(10000);
            
            const { data, error } = await query;

            if (error) throw error;
            setAllMetadata(data || []);
            
            if (data) {
                const dates = data.map((d: any) => {
                    const dt = new Date(d.created_at);
                    return format(dt, 'yyyy-MM-dd');
                });
                setAvailableDates(Array.from(new Set(dates)).sort().reverse());
            }
        } catch (e) {
            console.error("Discovery error:", e);
        }
    };

    // Memoized Faceted Options
    const availableStatuses = React.useMemo(() => {
        let filtered = allMetadata;
        if (userFilters.length > 0) filtered = filtered.filter(d => userFilters.includes(d.uploader_email));
        if (batchFilters.length > 0) filtered = filtered.filter(d => batchFilters.includes(d.batch_id));
        if (dateFilter !== 'all') filtered = filtered.filter(d => format(new Date(d.created_at), 'yyyy-MM-dd') === dateFilter);
        return Array.from(new Set(filtered.map(d => d.status))).filter(Boolean).sort();
    }, [allMetadata, userFilters, batchFilters, dateFilter]);

    const availableUsers = React.useMemo(() => {
        let filtered = allMetadata;
        if (statusFilters.length > 0) filtered = filtered.filter(d => statusFilters.includes(d.status));
        if (batchFilters.length > 0) filtered = filtered.filter(d => batchFilters.includes(d.batch_id));
        if (dateFilter !== 'all') filtered = filtered.filter(d => format(new Date(d.created_at), 'yyyy-MM-dd') === dateFilter);
        return Array.from(new Set(filtered.map(d => d.uploader_email))).filter(Boolean).sort();
    }, [allMetadata, statusFilters, batchFilters, dateFilter]);

    const availableBatches = React.useMemo(() => {
        let filtered = allMetadata;
        if (statusFilters.length > 0) filtered = filtered.filter(d => statusFilters.includes(d.status));
        if (userFilters.length > 0) filtered = filtered.filter(d => userFilters.includes(d.uploader_email));
        if (dateFilter !== 'all') filtered = filtered.filter(d => format(new Date(d.created_at), 'yyyy-MM-dd') === dateFilter);
        
        const batchMap = new Map<string, string>();
        filtered.forEach(d => {
            if (d.batch_id) {
                batchMap.set(d.batch_id, d.batch_name || d.batch_id);
            }
        });
        
        return Array.from(batchMap.values()).filter(Boolean).sort();
    }, [allMetadata, statusFilters, userFilters, dateFilter]);

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
        setBatchFilters([]); // Reset batch filter when switching tabs
    }, [viewMode]);

    const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
            const supabase = createClient();
            
            const isAnyFilterActive = statusFilters.length > 0 || 
                                     userFilters.length > 0 || 
                                     batchFilters.length > 0 || 
                                     dateFilter !== 'all' || 
                                     searchTerm !== '';

            const from = isAnyFilterActive ? 0 : (currentPage - 1) * pageSize;
            const to = isAnyFilterActive ? 5000 : from + pageSize - 1;

            let query = supabase
                .from(viewMode === 'csv' ? 'csv_upload_logs' : 'resume_uploads')
                .select('*', { count: 'exact' });

            // Search
            if (searchTerm) {
                const search = `%${searchTerm}%`;
                if (viewMode === 'csv') {
                    query = query.or(`name.ilike.${search},note.ilike.${search},candidate_id.ilike.${search}`);
                } else {
                    query = query.or(`file_name.ilike.${search},note.ilike.${search},candidate_id.ilike.${search}`);
                }
            }

            // Status Multi-In
            if (statusFilters.length > 0) {
                query = query.in('status', statusFilters);
            }

            // User Multi-In
            if (userFilters.length > 0) {
                query = query.in('uploader_email', userFilters);
            }

            // Batch Multi-In
            if (batchFilters.length > 0 && viewMode === 'csv') {
                // Since filters show batch_name but query uses batch_id, we need to map names back to IDs from allMetadata
                const matchingBatchIds = allMetadata
                    .filter(m => batchFilters.includes(m.batch_name || m.batch_id))
                    .map(m => m.batch_id);
                
                if (matchingBatchIds.length > 0) {
                    query = query.in('batch_id', matchingBatchIds);
                }
            }

            // Date Range
            if (dateFilter !== 'all') {
                const dayStart = startOfDay(new Date(dateFilter)).toISOString();
                const dayEnd = endOfDay(new Date(dateFilter)).toISOString();
                query = query.gte('created_at', dayStart).lte('created_at', dayEnd);
            }

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .order('id', { ascending: false })
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

                    const res = await processCsvUpload(rows, selectedCreatedBy, files.name);

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
    const handleReset = () => {
        setSearchTerm("");
        setStatusFilters([]);
        setUserFilters([]);
        setBatchFilters([]);
        setDateFilter("all");
        setCurrentPage(1);
    };

    const toggleFilter = (current: string[], value: string, setter: (v: string[]) => void) => {
        if (current.includes(value)) {
            setter(current.filter(v => v !== value));
        } else {
            setter([...current, value]);
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            // Select all currently visible logs (this handles the "Matched" set correctly when filtered)
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

    const validSelectedCount = React.useMemo(() => {
        return logs.filter(l => selectedIds.includes(l.id) && l.candidate_id?.startsWith('C')).length;
    }, [logs, selectedIds]);


    const isAnyFilterActive = React.useMemo(() => {
        return statusFilters.length > 0 || 
               userFilters.length > 0 || 
               batchFilters.length > 0 || 
               dateFilter !== 'all' || 
               searchTerm !== '';
    }, [statusFilters, userFilters, batchFilters, dateFilter, searchTerm]);

    const filteredLogs = logs;

    const filteredSummary = React.useMemo(() => {
        if (!isAnyFilterActive) return null;
        
        const total = logs.length;
        const ready = logs.filter(l => l.candidate_id?.startsWith('C')).length;
        const missing = total - ready;
        
        return { total, ready, missing };
    }, [logs, statusFilters, userFilters, batchFilters, dateFilter, searchTerm]);


    const handleAddFilteredToJob = () => {
        if (!filteredSummary || filteredSummary.ready === 0) return;
        
        const validIds = logs
            .filter(l => l.candidate_id?.startsWith('C'))
            .map(l => l.id);
            
        setSelectedIds(validIds);
        setOpenJrDialog(true);
    };

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

            if (statusFilters.length > 0) {
                query = query.in('status', statusFilters);
            }
            if (userFilters.length > 0) {
                query = query.in('uploader_email', userFilters);
            }
            if (batchFilters.length > 0) {
                query = query.in('batch_id', batchFilters);
            }
            if (dateFilter !== 'all') {
                const dayStart = startOfDay(new Date(dateFilter)).toISOString();
                const dayEnd = endOfDay(new Date(dateFilter)).toISOString();
                query = query.gte('created_at', dayStart).lte('created_at', dayEnd);
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
                        {/* Add to JR Button - Only show if NO filter is active, or if user explicitly selected items */}
                        {!isAnyFilterActive && selectedIds.length > 0 && (
                            <Button
                                className="bg-amber-500 hover:bg-amber-600 text-white animate-in zoom-in fade-in slide-in-from-right-4"
                                onClick={() => setOpenJrDialog(true)}
                            >
                                <PlusCircle className="w-4 h-4 mr-2" /> Add {validSelectedCount} to Job
                            </Button>
                        )}
                        
                        {/* Hidden standard Add button when filters are active to prioritize the new Matches system */}
                        {isAnyFilterActive && selectedIds.length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-xl animate-in fade-in zoom-in">
                                <span className="text-xs font-bold text-indigo-600 uppercase tracking-tighter">
                                    {selectedIds.length} Selected
                                </span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs text-indigo-600 hover:bg-indigo-100"
                                    onClick={() => setOpenJrDialog(true)}
                                >
                                    Assign to Job
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => setSelectedIds([])}
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
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
                            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-[300px]">
                                <TabsList className="rounded-xl p-1 bg-slate-200/50">
                                    <TabsTrigger value="resume" className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"><FileText className="w-4 h-4" /> Resumes</TabsTrigger>
                                    <TabsTrigger value="csv" className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"><FileSpreadsheet className="w-4 h-4" /> CSV</TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
                                {totalLogs} {totalLogs === 1 ? 'Record' : 'Records'} Found
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={downloadCsv} disabled={totalLogs === 0 || isDownloading} className="h-9 gap-2 text-slate-600 rounded-xl border-slate-200 bg-white hover:bg-slate-50">
                                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-indigo-500" />} Export CSV
                            </Button>
                            <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loadingLogs} className="h-9 w-9 rounded-xl hover:bg-slate-100">
                                <RefreshCw className={cn("w-4 h-4 text-slate-500", loadingLogs && "animate-spin")} />
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        <div className="md:col-span-4 relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Search candidates, ID, notes..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                className="pl-10 h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-indigo-500 shadow-sm" 
                            />
                        </div>
                        
                        <div className="md:col-span-8 flex flex-wrap items-center gap-2 justify-end">
                            {/* Date Filter */}
                            <Select value={dateFilter} onValueChange={setDateFilter}>
                                <SelectTrigger className="w-[160px] h-9 bg-white border-slate-200 rounded-xl text-xs gap-2">
                                    <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                                    <SelectValue placeholder="All Dates" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all">All Dates</SelectItem>
                                    {availableDates.map(date => (
                                        <SelectItem key={date} value={date}>{date}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Status Multi-Select */}
                            <FilterMultiSelect
                                label="Status"
                                icon={FilterIcon}
                                options={availableStatuses}
                                selected={statusFilters}
                                onChange={(val) => toggleFilter(statusFilters, val, setStatusFilters)}
                            />

                            {/* User Multi-Select */}
                            <FilterMultiSelect
                                label="User"
                                icon={FilterIcon}
                                options={availableUsers}
                                selected={userFilters}
                                onChange={(val) => toggleFilter(userFilters, val, setUserFilters)}
                            />

                            {/* Batch Multi-Select (CSV only) */}
                            {viewMode === 'csv' && (
                                <FilterMultiSelect
                                    label="Batch ID"
                                    icon={Layers}
                                    options={availableBatches}
                                    selected={batchFilters}
                                    onChange={(val) => toggleFilter(batchFilters, val, setBatchFilters)}
                                />
                            )}

                            {/* Reset Button */}
                            {isAnyFilterActive && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={handleReset} 
                                    className="h-9 px-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl"
                                >
                                    <XIcon className="h-4 w-4 mr-1" /> Reset
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Filtered Statistics Summary */}
                    {filteredSummary && (
                        <div className="mt-1 flex items-center justify-between bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-10">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-1.5">Matched Records</span>
                                    <span className="text-2xl font-black text-indigo-900 leading-none">{filteredSummary.total}</span>
                                </div>
                                <div className="h-10 w-px bg-indigo-100" />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Ready to Job (C-ID)</span>
                                    </div>
                                    <span className="text-2xl font-black text-emerald-700 leading-none">{filteredSummary.ready}</span>
                                </div>
                                <div className="h-10 w-px bg-indigo-100" />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                        <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Processing</span>
                                    </div>
                                    <span className="text-2xl font-black text-amber-700 leading-none">{filteredSummary.missing}</span>
                                </div>
                            </div>
                            
                            {filteredSummary.ready > 0 && (
                                <Button 
                                    onClick={handleAddFilteredToJob}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100/50 rounded-2xl font-bold px-8 h-12 text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <PlusCircle className="mr-2 h-5 w-5" /> Add {filteredSummary.ready} Matches to Job
                                </Button>
                            )}
                        </div>
                    )}
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
                {!isAnyFilterActive && totalLogs > pageSize && (
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
