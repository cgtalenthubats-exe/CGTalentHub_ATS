"use client";

import React, { useState, useEffect } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Loader2, Briefcase, Building2, CheckCircle2 } from "lucide-react";
import { getJRSelectionData, createJobRequisition } from "@/app/actions/requisitions";
import { bulkAddCandidatesToJR, bulkAddByFilterToJR } from "@/app/actions/jr-candidates";
import { JobRequisition } from "@/types/requisition";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
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
    candidateSources?: string[]; // New prop for mapping internal/external
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
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedJrId, setSelectedJrId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // New JR Form State
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
            const data = await getJRSelectionData();
            setJrs(data.jrs);
            setFormOptions(data.options);
        } catch (error) {
            console.error("Failed to load initial data", error);
        } finally {
            setLoading(false);
        }
    }

    const [jrFilters, setJrFilters] = useState({
        position: "All",
        bu: "All",
        dept: "All",
        status: "All"
    });

    const uniqueOptions = React.useMemo(() => {
        // Interrelated filters: options for each field should be based on other selected filters
        const getFiltered = (excludeKey: string) => {
            return jrs.filter(jr => {
                const matchPos = excludeKey === 'position' || jrFilters.position === "All" || jr.title === jrFilters.position;
                const matchBu = excludeKey === 'bu' || jrFilters.bu === "All" || jr.division === jrFilters.bu;
                const matchDept = excludeKey === 'dept' || jrFilters.dept === "All" || jr.department === jrFilters.dept;
                const matchStatus = excludeKey === 'status' || jrFilters.status === "All" || jr.status === jrFilters.status;
                return matchPos && matchBu && matchDept && matchStatus;
            });
        };

        const positions = Array.from(new Set(getFiltered('position').map(j => j.title).filter(v => v && v.trim() !== ""))).sort();
        const bus = Array.from(new Set(getFiltered('bu').map(j => j.division).filter(v => v && v.trim() !== ""))).sort();
        const depts = Array.from(new Set(getFiltered('dept').map(j => j.department).filter(v => v && v.trim() !== ""))).sort();
        const statuses = Array.from(new Set(getFiltered('status').map(j => j.status).filter(v => v && v.trim() !== ""))).sort();

        return { positions, bus, depts, statuses };
    }, [jrs, jrFilters]);

    const filteredJrs = React.useMemo(() => {
        return jrs.filter(jr => {
            const search = searchQuery.toLowerCase();
            const matchSearch = jr.title.toLowerCase().includes(search) ||
                jr.id.toLowerCase().includes(search);

            const matchPos = jrFilters.position === "All" || jr.title === jrFilters.position;
            const matchBu = jrFilters.bu === "All" || jr.division === jrFilters.bu;
            const matchDept = jrFilters.dept === "All" || jr.department === jrFilters.dept;
            const matchStatus = jrFilters.status === "All" || jr.status === jrFilters.status;

            return matchSearch && matchPos && matchBu && matchDept && matchStatus;
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
                        source: candidateSources?.[idx] || 'internal_db' // Default to internal if not provided
                    }))
                ) as BulkAddResponse;
            }

            if (res.success) {
                // Formatting detailed message
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
            // 1. Create JR
            const createdJr = await createJobRequisition(newJr);
            if (!createdJr) throw new Error("Failed to create JR");

            // 2. Add Candidate
            const res = await bulkAddCandidatesToJR(
                createdJr.id,
                candidateIds.map((id, idx) => ({ 
                    id, 
                    name: candidateNames?.[idx] || id,
                    source: candidateSources?.[idx] || 'internal_db'
                }))
            );

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
                        <Plus className="w-5 h-5 text-indigo-400" />
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
                        <TabsContent value="existing" className="mt-0 h-full outline-none">
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
                                <div className="grid grid-cols-2 gap-2">
                                    <Select value={jrFilters.position} onValueChange={(v) => setJrFilters({ ...jrFilters, position: v })}>
                                        <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                                            <SelectValue placeholder="Position" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="All">All Positions</SelectItem>
                                            {uniqueOptions.positions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                    </Select>

                                    <Select value={jrFilters.bu} onValueChange={(v) => setJrFilters({ ...jrFilters, bu: v })}>
                                        <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                                            <SelectValue placeholder="Business Unit" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="All">All BUs</SelectItem>
                                            {uniqueOptions.bus.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                    </Select>

                                    <Select value={jrFilters.dept} onValueChange={(v) => setJrFilters({ ...jrFilters, dept: v })}>
                                        <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                                            <SelectValue placeholder="Department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="All">All Depts</SelectItem>
                                            {uniqueOptions.depts.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                    </Select>

                                    <Select value={jrFilters.status} onValueChange={(v) => setJrFilters({ ...jrFilters, status: v })}>
                                        <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="All">All Statuses</SelectItem>
                                            {uniqueOptions.statuses.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2">
                                {loading ? (
                                    <div className="flex items-center justify-center h-full gap-2 text-slate-400">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Loading requisitions...</span>
                                    </div>
                                ) : filteredJrs.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        No active requisitions found.
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

                        <TabsContent value="new" className="mt-0 h-full outline-none">
                            <div className="flex flex-col h-full space-y-4">
                            <div className="flex-1 overflow-y-auto pr-2 p-1">
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Position Title */}
                                        <div className="space-y-2">
                                            <Label htmlFor="position_jr" className="text-xs font-black uppercase tracking-wider text-slate-500">Position Title <span className="text-red-500">*</span></Label>
                                            <CreatableCombobox
                                                value={newJr.position_jr}
                                                onChange={(v) => setNewJr({ ...newJr, position_jr: v })}
                                                options={formOptions.positions}
                                                placeholder="Select or Type Position"
                                            />
                                        </div>

                                        {/* Create By */}
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

                                        {/* BU */}
                                        <div className="space-y-2">
                                            <Label htmlFor="bu" className="text-xs font-black uppercase tracking-wider text-slate-500">Business Unit</Label>
                                            <CreatableCombobox
                                                value={newJr.bu}
                                                onChange={(v) => setNewJr({ ...newJr, bu: v })}
                                                options={formOptions.divisions}
                                                placeholder="Select or Type BU"
                                            />
                                        </div>

                                        {/* Sub BU */}
                                        <div className="space-y-2">
                                            <Label htmlFor="sub_bu" className="text-xs font-black uppercase tracking-wider text-slate-500">Department (Sub BU)</Label>
                                            <CreatableCombobox
                                                value={newJr.sub_bu}
                                                onChange={(v) => setNewJr({ ...newJr, sub_bu: v })}
                                                options={formOptions.subDivisions}
                                                placeholder="Select or Type Sub BU"
                                            />
                                        </div>

                                        {/* JR Type */}
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

                                        {/* Request Date */}
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

                                    {/* Original JR (If Replacement) */}
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

                                    {/* Feedback File */}
                                    <div className="space-y-2">
                                        <Label htmlFor="feedback_file" className="text-xs font-black uppercase tracking-wider text-slate-500">Feedback File (PDF/Link)</Label>
                                        <Input
                                            id="feedback_file"
                                            placeholder="Paste PDF link here..."
                                            className="h-10 rounded-lg"
                                            value={newJr.feedback_file}
                                            onChange={(e) => setNewJr({ ...newJr, feedback_file: e.target.value })}
                                        />
                                    </div>

                                    {/* Job Description */}
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
    allowCustom?: boolean;
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
