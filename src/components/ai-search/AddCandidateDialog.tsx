"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Loader2, Briefcase, ChevronRight, CheckCircle2, Building2, Upload, FileText, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { createJobRequisition } from "@/app/actions/requisitions";
import { bulkAddCandidatesToJR, bulkAddByFilterToJR } from "@/app/actions/jr-candidates";
import { JobRequisition } from "@/types/requisition";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/notifications";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";

interface BulkAddResponse {
    success: boolean;
    added?: number;
    duplicates?: string[];
    blacklisted?: string[];
    error?: string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    candidateIds: string[];
    candidateNames?: string[];
    candidateSources?: string[];
    onSuccess?: () => void;
    isSelectAll?: boolean;
    filters?: any;
    search?: string;
    totalCount?: number;
}

export function AddCandidateDialog({
    open,
    onOpenChange,
    candidateIds,
    candidateNames,
    candidateSources,
    onSuccess,
    isSelectAll,
    filters,
    search,
    totalCount
}: Props) {
    const [activeTab, setActiveTab] = useState("existing");
    const [jrs, setJrs] = useState<JobRequisition[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedJrId, setSelectedJrId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [jrFilters, setJrFilters] = useState({
        position: "All",
        bu: "All",
        dept: "All"
    });

    const [newJr, setNewJr] = useState({
        position_jr: "",
        bu: "",
        sub_bu: "",
        jr_type: "New",
        request_date: new Date().toISOString().split('T')[0],
        original_jr_id: "",
        job_description: "",
        feedback_file: "",
        create_by: "Admin"
    });

    const [formOptions, setFormOptions] = useState<{
        positions: string[];
        divisions: string[];
        subDivisions: string[];
        originalJrs: string[];
    }>({
        positions: [],
        divisions: [],
        subDivisions: [],
        originalJrs: []
    });

    useEffect(() => {
        if (open) {
            loadInitialData();
        }
    }, [open]);

    async function loadInitialData() {
        setLoading(true);
        try {
            // DIRECT CLIENT FETCH (FAST) - Removed status and is_active
            const { data, error } = await supabase
                .from('job_requisitions')
                .select('jr_id, position_jr, bu, sub_bu, request_date')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const mappedJrs = data.map((row: any) => ({
                    id: row.jr_id,
                    title: row.position_jr || "Untitled Position",
                    job_title: row.position_jr || "Untitled Position",
                    department: row.sub_bu || "General",
                    division: row.bu || "Corporate",
                    opened_date: row.request_date,
                    created_by: row.create_by || "System",
                    hiring_manager_id: "",
                    headcount_total: 1,
                    headcount_hired: 0,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    jr_type: row.jr_type || "New"
                }));

                const positions = [...new Set(mappedJrs.map(j => j.title).filter(Boolean))].sort() as string[];
                const divisions = [...new Set(mappedJrs.map(j => j.division).filter(Boolean))].sort() as string[];
                const subDivisions = [...new Set(mappedJrs.map(j => j.department).filter(Boolean))].sort() as string[];
                const originalJrs = [...new Set(mappedJrs.map(j => j.id).filter(Boolean))].sort() as string[];

                setJrs(mappedJrs);
                setFormOptions({
                    positions,
                    divisions,
                    subDivisions,
                    originalJrs
                });
            }
        } catch (error) {
            console.error("Failed to load initial data", error);
            toast.error("Failed to load job requisitions");
        } finally {
            setLoading(false);
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "application/pdf") {
            toast.error("Please upload only PDF files");
            return;
        }

        setUploadingFile(true);
        try {
            // Sanitize filename
            const sanitizedBase = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileName = `jr_feedback/${Date.now()}_${sanitizedBase}`;
            
            const { data, error } = await supabase.storage
                .from('resumes')
                .upload(fileName, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('resumes')
                .getPublicUrl(fileName);

            setNewJr(prev => ({ ...prev, feedback_file: publicUrl }));
            setUploadedFileName(file.name);
            toast.success("File uploaded successfully");
        } catch (err: any) {
            console.error("Upload Error:", err);
            toast.error("Failed to upload file: " + err.message);
        } finally {
            setUploadingFile(false);
        }
    };

    const uniqueOptions = useMemo(() => {
        const getFiltered = (excludeKey: string) => {
            return jrs.filter(jr => {
                const matchPos = excludeKey === 'position' || jrFilters.position === "All" || jr.title === jrFilters.position;
                const matchBu = excludeKey === 'bu' || jrFilters.bu === "All" || jr.division === jrFilters.bu;
                const matchDept = excludeKey === 'dept' || jrFilters.dept === "All" || jr.department === jrFilters.dept;
                return matchPos && matchBu && matchDept;
            });
        };

        const positions = Array.from(new Set(getFiltered('position').map(j => j.title).filter(v => v && v.trim() !== ""))).sort();
        const bus = Array.from(new Set(getFiltered('bu').map(j => j.division).filter(v => v && v.trim() !== ""))).sort();
        const depts = Array.from(new Set(getFiltered('dept').map(j => j.department).filter(v => v && v.trim() !== ""))).sort();

        return { positions, bus, depts };
    }, [jrs, jrFilters]);

    const filteredJrs = useMemo(() => {
        return jrs.filter(jr => {
            const searchStr = searchQuery.toLowerCase();
            const matchSearch = jr.title.toLowerCase().includes(searchStr) ||
                jr.id.toLowerCase().includes(searchStr);

            const matchPos = jrFilters.position === "All" || jr.title === jrFilters.position;
            const matchBu = jrFilters.bu === "All" || jr.division === jrFilters.bu;
            const matchDept = jrFilters.dept === "All" || jr.department === jrFilters.dept;

            return matchSearch && matchPos && matchBu && matchDept;
        });
    }, [jrs, searchQuery, jrFilters]);

    async function handleAddExisting() {
        if (!selectedJrId) return;
        setSubmitting(true);
        try {
            let res: BulkAddResponse;
            if (isSelectAll) {
                res = await bulkAddByFilterToJR(selectedJrId, filters, search || "") as BulkAddResponse;
            } else {
                res = await bulkAddCandidatesToJR(
                    selectedJrId,
                    candidateIds.map((id, idx) => ({ 
                        id, 
                        name: candidateNames?.[idx] || id,
                        source: candidateSources?.[idx] || 'internal_db'
                    }))
                ) as BulkAddResponse;
            }

            if (res.success) {
                const parts = [];
                if ((res.added ?? 0) > 0) parts.push(`✅ Added ${res.added} candidate(s).`);
                if ((res.duplicates?.length ?? 0) > 0) parts.push(`⚠️ Skipped ${res.duplicates?.length} duplicate(s).`);
                if ((res.blacklisted?.length ?? 0) > 0) {
                    const blNames = res.blacklisted?.join(', ');
                    parts.push(`🚫 Skipped blacklisted: ${blNames}`);
                }

                toast.success(`Operation Complete`, {
                    description: parts.join(" "),
                    duration: 6000
                });
                onOpenChange(false);
                onSuccess?.();
            } else {
                toast.error(res.error || "Failed to add candidates");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCreateAndAdd() {
        if (!newJr.position_jr) return;
        setSubmitting(true);
        try {
            const createdJr = await createJobRequisition(newJr);
            if (!createdJr) throw new Error("Failed to create JR");

            const res = await bulkAddCandidatesToJR(
                createdJr.id,
                candidateIds.map((id, idx) => ({ 
                    id, 
                    name: candidateNames?.[idx] || id,
                    source: candidateSources?.[idx] || 'internal_db'
                }))
            ) as BulkAddResponse;

            if (res.success) {
                const parts = [];
                if ((res.added ?? 0) > 0) parts.push(`✅ Added ${res.added} candidate(s).`);
                if ((res.duplicates?.length ?? 0) > 0) parts.push(`⚠️ Skipped ${res.duplicates?.length} duplicate(s).`);
                if ((res.blacklisted?.length ?? 0) > 0) {
                    const blNames = res.blacklisted?.join(', ');
                    parts.push(`🚫 Skipped blacklisted: ${blNames}`);
                }

                toast.success(`JR Created and candidates added!`, {
                    description: parts.join(" "),
                    duration: 6000
                });
                onOpenChange(false);
                onSuccess?.();
            } else {
                toast.error(res.error || "Failed to add candidates to new JR");
            }
        } catch (error) {
            toast.error("An error occurred while creating JR");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[500px] w-full flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                <SheetHeader className="p-6 shrink-0 bg-slate-900 text-left">
                    <SheetTitle className="text-xl font-bold flex items-center gap-2 text-white">
                        <Plus className="w-4 h-4 text-indigo-400" />
                        Add to Job Requisition
                    </SheetTitle>
                    <SheetDescription className="text-slate-400">
                        {isSelectAll
                            ? `Adding all ${totalCount} matching candidates`
                            : `${candidateIds.length} candidate${candidateIds.length > 1 ? 's' : ''} selected`
                        }
                    </SheetDescription>
                </SheetHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0">
                    <div className="px-6 border-b bg-slate-50 shrink-0">
                        <TabsList className="grid w-full grid-cols-2 mt-4 mb-2 bg-slate-200/50">
                            <TabsTrigger value="existing">Selection Existing JR</TabsTrigger>
                            <TabsTrigger value="new">Create New JR</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="p-6 flex-1 min-h-0 overflow-hidden flex flex-col">
                        <TabsContent value="existing" className="mt-0 h-full outline-none flex flex-col">
                            <div className="flex flex-col h-full space-y-4">
                                <div className="space-y-3 shrink-0">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            placeholder="Search by Title or ID..."
                                            className="pl-9 h-10 bg-white border-slate-200 rounded-lg text-sm"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Select value={jrFilters.position} onValueChange={(v) => setJrFilters({ ...jrFilters, position: v })}>
                                            <SelectTrigger className="h-8 text-[10px] bg-slate-50 border-slate-200">
                                                <SelectValue placeholder="Position" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="All">All Positions</SelectItem>
                                                {uniqueOptions.positions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                            </SelectContent>
                                        </Select>

                                        <Select value={jrFilters.bu} onValueChange={(v) => setJrFilters({ ...jrFilters, bu: v })}>
                                            <SelectTrigger className="h-8 text-[10px] bg-slate-50 border-slate-200">
                                                <SelectValue placeholder="BU" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="All">All BUs</SelectItem>
                                                {uniqueOptions.bus.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                            </SelectContent>
                                        </Select>

                                        <Select value={jrFilters.dept} onValueChange={(v) => setJrFilters({ ...jrFilters, dept: v })}>
                                            <SelectTrigger className="h-8 text-[10px] bg-slate-50 border-slate-200">
                                                <SelectValue placeholder="Dept" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="All">All Depts</SelectItem>
                                                {uniqueOptions.depts.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-2">
                                    {loading ? (
                                        <div className="flex items-center justify-center h-full gap-2 text-slate-400">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Loading...</span>
                                        </div>
                                    ) : filteredJrs.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400">
                                            No requisitions found.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {filteredJrs.map(jr => (
                                                <div
                                                    key={jr.id}
                                                    onClick={() => setSelectedJrId(jr.id)}
                                                    className={cn(
                                                        "p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group",
                                                        selectedJrId === jr.id
                                                            ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600/10"
                                                            : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                                            selectedJrId === jr.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                                                        )}>
                                                            <Briefcase className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-900">{jr.title}</div>
                                                            <div className="text-[10px] font-medium text-slate-500 flex items-center gap-2">
                                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded uppercase font-bold text-[9px]">{jr.id}</span>
                                                                <span>•</span>
                                                                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {jr.department}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {selectedJrId === jr.id && (
                                                        <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="new" className="mt-0 h-full outline-none flex flex-col">
                            <div className="flex flex-col h-full space-y-4">
                                <div className="flex-1 overflow-y-auto pr-2 p-1">
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="position_jr" className="text-xs font-black uppercase tracking-wider text-slate-500">Position Title <span className="text-red-500">*</span></Label>
                                                <CreatableCombobox
                                                    value={newJr.position_jr}
                                                    onChange={(v) => setNewJr({ ...newJr, position_jr: v })}
                                                    options={formOptions.positions}
                                                    placeholder="Select or Type Position"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="create_by" className="text-xs font-black uppercase tracking-wider text-slate-500">Create By <span className="text-red-500">*</span></Label>
                                                <Select value={newJr.create_by} onValueChange={(v) => setNewJr({ ...newJr, create_by: v })}>
                                                    <SelectTrigger className="h-10 rounded-lg">
                                                        <SelectValue placeholder="Select Creator" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Admin">Admin</SelectItem>
                                                        <SelectItem value="HR Manager">HR Manager</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="bu" className="text-xs font-black uppercase tracking-wider text-slate-500">Business Unit</Label>
                                                <CreatableCombobox
                                                    value={newJr.bu}
                                                    onChange={(v) => setNewJr({ ...newJr, bu: v })}
                                                    options={formOptions.divisions}
                                                    placeholder="Select or Type BU"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="sub_bu" className="text-xs font-black uppercase tracking-wider text-slate-500">Department (Sub BU)</Label>
                                                <CreatableCombobox
                                                    value={newJr.sub_bu}
                                                    onChange={(v) => setNewJr({ ...newJr, sub_bu: v })}
                                                    options={formOptions.subDivisions}
                                                    placeholder="Select or Type Sub BU"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs font-black uppercase tracking-wider text-slate-500">JR Type</Label>
                                                <Select
                                                    value={newJr.jr_type}
                                                    onValueChange={(v) => setNewJr({ ...newJr, jr_type: v })}
                                                >
                                                    <SelectTrigger className="h-10 rounded-lg">
                                                        <SelectValue placeholder="Type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="New">New Headcount</SelectItem>
                                                        <SelectItem value="Replacement">Replacement</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="request_date" className="text-xs font-black uppercase tracking-wider text-slate-500">Request Date <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="request_date"
                                                    type="date"
                                                    className="h-10 rounded-lg"
                                                    value={newJr.request_date}
                                                    onChange={(e) => setNewJr({ ...newJr, request_date: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        {newJr.jr_type === 'Replacement' && (
                                            <div className="space-y-2">
                                                <Label htmlFor="original_jr_id" className="text-xs font-black uppercase tracking-wider text-slate-500">Original JR ID</Label>
                                                <Select value={newJr.original_jr_id} onValueChange={(v) => setNewJr({ ...newJr, original_jr_id: v })}>
                                                    <SelectTrigger className="h-10 rounded-lg">
                                                        <SelectValue placeholder="Select Original JR" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {formOptions.originalJrs.map((jr) => (
                                                            <SelectItem key={jr} value={jr}>{jr}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label htmlFor="feedback_file" className="text-xs font-black uppercase tracking-wider text-slate-500">Job Description File (Upload PDF)</Label>
                                            <div className="flex flex-col gap-2">
                                                {newJr.feedback_file ? (
                                                    <div className="flex items-center justify-between p-3 border rounded-xl bg-green-50 border-green-200">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                            <span className="text-xs text-green-700 truncate font-semibold">
                                                                {uploadedFileName || "File uploaded"}
                                                            </span>
                                                        </div>
                                                        <Button 
                                                            type="button" 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-full"
                                                            onClick={() => {
                                                                setNewJr(prev => ({ ...prev, feedback_file: "" }));
                                                                setUploadedFileName(null);
                                                            }}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <Input
                                                            type="file"
                                                            accept=".pdf"
                                                            className="hidden"
                                                            id="jr-file-upload-dialog"
                                                            onChange={handleFileUpload}
                                                            disabled={uploadingFile}
                                                        />
                                                        <Label
                                                            htmlFor="jr-file-upload-dialog"
                                                            className={cn(
                                                                "flex items-center justify-center gap-2 w-full h-12 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                                                                uploadingFile 
                                                                    ? "opacity-50 cursor-not-allowed bg-slate-50" 
                                                                    : "hover:bg-slate-50 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/10"
                                                            )}
                                                        >
                                                            {uploadingFile ? (
                                                                <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                                                            ) : (
                                                                <>
                                                                    <Upload className="w-5 h-5 text-slate-400" />
                                                                    <span className="text-sm text-slate-500 font-medium">Upload PDF for n8n processing</span>
                                                                </>
                                                            )}
                                                        </Label>
                                                    </div>
                                                )}
                                                <p className="text-[10px] text-slate-400 font-medium italic pl-1">Supporting only PDF format for automated processing.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="job_description" className="text-xs font-black uppercase tracking-wider text-slate-500">Job Description</Label>
                                            <Textarea
                                                id="job_description"
                                                placeholder="Enter full job description here..."
                                                className="min-h-[100px] rounded-lg"
                                                value={newJr.job_description}
                                                onChange={(e) => setNewJr({ ...newJr, job_description: e.target.value })}
                                            />
                                        </div>

                                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                                            <Plus className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                            <div className="text-xs text-amber-900 leading-relaxed font-medium">
                                                This will create a new Job Requisition and automatically add
                                                <b>{isSelectAll ? ` all ${totalCount} matching candidates` : ` ${candidateIds.length} candidate${candidateIds.length > 1 ? 's' : ''}`}</b> to it.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>

                <SheetFooter className="p-6 shrink-0 bg-slate-50 border-t flex items-center justify-end sm:justify-end gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl font-bold text-slate-500"
                    >
                        Cancel
                    </Button>
                    {activeTab === 'existing' ? (
                        <Button
                            disabled={!selectedJrId || submitting}
                            onClick={handleAddExisting}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-8 font-bold shadow-lg shadow-indigo-500/20"
                        >
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm & Add
                        </Button>
                    ) : (
                        <Button
                            disabled={!newJr.position_jr || submitting}
                            onClick={handleCreateAndAdd}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-8 font-bold shadow-lg shadow-indigo-500/20"
                        >
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create & Add
                        </Button>
                    )}
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

// --- Helper Components ---

interface ComboboxProps {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
}

function CreatableCombobox({ value, onChange, options, placeholder }: ComboboxProps) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative w-full">
                    <Input
                        value={value}
                        onChange={(e) => {
                            onChange(e.target.value);
                            if (!open) setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        placeholder={placeholder || "Select or Type..."}
                        className="w-full pr-10 h-10 rounded-lg border-slate-200"
                    />
                    <ChevronsUpDown className="absolute right-3 top-3 h-4 w-4 shrink-0 opacity-50" />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                <Command>
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup>
                            {options.filter(opt => opt.toLowerCase().includes(value.toLowerCase())).map((option) => (
                                <CommandItem
                                    key={option}
                                    value={option}
                                    onSelect={(currentValue) => {
                                        onChange(currentValue);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", value === option ? "opacity-100" : "opacity-0")} />
                                    {option}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
