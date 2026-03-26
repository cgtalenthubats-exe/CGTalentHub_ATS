"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus, Loader2, Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client for client-side storage upload
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface CreateJobRequisitionFormProps {
    onCancel: () => void;
    onSuccess: (updatedJR: any) => void;
    initialData?: any;
    selectedCreatedBy?: string;
    profiles?: { email: string; real_name: string }[];
}

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
                        className="w-full pr-10 h-10 bg-white border-slate-200 focus:ring-primary/20"
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

export function CreateJobRequisitionForm({ onCancel, onSuccess, initialData, selectedCreatedBy, profiles }: CreateJobRequisitionFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const isEdit = !!initialData;

    // Dynamic Options State
    const [options, setOptions] = useState<{
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

    const [formData, setFormData] = useState({
        position_jr: initialData?.job_title || "",
        bu: initialData?.division || "",
        sub_bu: initialData?.department || "",
        request_date: initialData?.opened_date || new Date().toISOString().split('T')[0],
        jr_type: initialData?.jr_type || "New",
        original_jr_id: initialData?.original_jr_id || "",
        job_description: initialData?.job_description || "",
        feedback_file: initialData?.feedback_file || "",
        create_by: initialData?.created_by || ""
    });
    
    // Combined Profiles Logic
    const [fetchedProfiles, setFetchedProfiles] = useState<{ email: string; real_name: string }[]>([]);
    const allProfiles = (profiles && profiles.length > 0) ? profiles : fetchedProfiles;

    const [currentUserName, setCurrentUserName] = useState<string>("");
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [isFileUpdated, setIsFileUpdated] = useState(false);

    // Load Distinct Values on Mount
    useEffect(() => {
        async function loadOptions() {
            try {
                const [{ getDistinctFieldValues }, { getCurrentUserRealName }] = await Promise.all([
                    import("@/app/actions/requisitions"),
                    import("@/app/actions/user-actions")
                ]);

                const [pos, bus, subs, jrs, name] = await Promise.all([
                    getDistinctFieldValues('position_jr'),
                    getDistinctFieldValues('bu'),
                    getDistinctFieldValues('sub_bu'),
                    getDistinctFieldValues('jr_id'),
                    getCurrentUserRealName()
                ]);

                setOptions({
                    positions: pos.filter((v: string) => v && v.trim() !== ""),
                    divisions: bus.filter((v: string) => v && v.trim() !== ""),
                    subDivisions: subs.filter((v: string) => v && v.trim() !== ""),
                    originalJrs: jrs.filter((v: string) => v && v.trim() !== "")
                });

                setCurrentUserName(name);
                if (!isEdit) {
                    setFormData(prev => ({ ...prev, create_by: selectedCreatedBy || name }));
                }

                if (!profiles || profiles.length === 0) {
                    const { getUserProfiles } = await import("@/app/actions/requisitions");
                    const pList = await getUserProfiles();
                    setFetchedProfiles(pList);
                }
            } catch (e) {
                console.error("Failed to load options", e);
            }
        }
        loadOptions();
    }, []);

    const handleChange = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

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
                .from('resumes') // Reusing resumes bucket as it's common for recruiter docs
                .upload(fileName, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('resumes')
                .getPublicUrl(fileName);

            handleChange("feedback_file", publicUrl);
            setUploadedFileName(file.name);
            setIsFileUpdated(true);
            toast.success("File uploaded successfully");
        } catch (err: any) {
            console.error("Upload Error:", err);
            toast.error("Failed to upload file: " + err.message);
        } finally {
            setUploadingFile(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (isEdit) {
                const { updateJobRequisition } = await import("@/app/actions/requisitions");
                const result = await updateJobRequisition(initialData.id, formData, isFileUpdated);
                if (result.success && result.data) {
                    toast.success("Job Requisition updated successfully");
                    onSuccess(result.data);
                } else {
                    toast.error(result.error || "Failed to update Job Requisition. Check if required fields like Original JR ID are correct.");
                }
            } else {
                const { createJobRequisition } = await import("@/app/actions/requisitions");
                const newJR = await createJobRequisition(formData);
                if (newJR) {
                    toast.success("Job Requisition created successfully");
                    onSuccess(newJR);
                } else {
                    toast.error("Failed to create Job Requisition");
                }
            }
        } catch (error: any) {
            console.error("Failed to save JR", error);
            toast.error(error.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Position (JR) */}
                <div className="space-y-2">
                    <Label htmlFor="position_jr">Position (JR) <span className="text-red-500">*</span></Label>
                    {isEdit ? (
                        <Input
                            id="position_jr"
                            value={formData.position_jr}
                            onChange={(e) => handleChange("position_jr", e.target.value)}
                            placeholder="Enter position title"
                            className="h-10 px-3 bg-white border-slate-200 focus:ring-primary/20"
                        />
                    ) : (
                        <CreatableCombobox
                            value={formData.position_jr}
                            onChange={(v) => handleChange("position_jr", v)}
                            options={options.positions}
                            placeholder="Select or Type Position"
                        />
                    )}
                </div>

                {/* BU: Combobox */}
                <div className="space-y-2">
                    <Label htmlFor="bu">BU</Label>
                    <CreatableCombobox
                        value={formData.bu}
                        onChange={(v) => handleChange("bu", v)}
                        options={options.divisions}
                        placeholder="Select or Type BU"
                    />
                </div>

                {/* Sub BU: Combobox */}
                <div className="space-y-2">
                    <Label htmlFor="sub_bu">Sub BU</Label>
                    <CreatableCombobox
                        value={formData.sub_bu}
                        onChange={(v) => handleChange("sub_bu", v)}
                        options={options.subDivisions}
                        placeholder="Select or Type Sub BU"
                    />
                </div>

                {/* Request Date - REMOVED from UI but kept in state for action */}
                {/* <div className="space-y-2">
                    <Label htmlFor="request_date">Request Date <span className="text-red-500">*</span></Label>
                    <Input
                        type="date"
                        value={formData.request_date}
                        onChange={(e) => handleChange("request_date", e.target.value)}
                    />
                </div> */}

                {/* JR Type: New / Replacement */}
                <div className="space-y-2">
                    <Label>JR Type</Label>
                    <div className="flex gap-4 mt-2">
                        <Button
                            type="button"
                            variant={formData.jr_type === 'New' ? 'default' : 'outline'}
                            onClick={() => handleChange('jr_type', 'New')}
                            className="flex-1"
                        >
                            New
                        </Button>
                        <Button
                            type="button"
                            variant={formData.jr_type === 'Replacement' ? 'default' : 'outline'}
                            onClick={() => handleChange('jr_type', 'Replacement')}
                            className="flex-1"
                        >
                            Replacement
                        </Button>
                    </div>
                </div>

                {/* Original JR (Only if Replacement) */}
                {formData.jr_type === 'Replacement' && (
                    <div className="space-y-2">
                        <Label htmlFor="original_jr_id">Original JR ID</Label>
                        <Select onValueChange={(v) => handleChange("original_jr_id", v)} value={formData.original_jr_id}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Original JR" />
                            </SelectTrigger>
                            <SelectContent>
                                {options.originalJrs.map((jr) => (
                                    <SelectItem key={jr} value={jr}>{jr}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Create By */}
                <div className="space-y-2">
                    <Label htmlFor="create_by">Create By <span className="text-red-500">*</span></Label>
                    <Select onValueChange={(v) => handleChange("create_by", v)} value={formData.create_by}>
                        <SelectTrigger className="bg-white border-slate-200">
                            <SelectValue placeholder="Select Creator" />
                        </SelectTrigger>
                        <SelectContent>
                            {allProfiles.filter(p => !!p.real_name && p.real_name.trim() !== "").map((p, idx) => (
                                <SelectItem key={`${p.email}-${idx}`} value={p.real_name}>{p.real_name}</SelectItem>
                            ))}
                            {/* Fallback if profiles not loaded or the current name isn't in profiles */}
                            {(allProfiles.length === 0 || !allProfiles.some(p => p.real_name === formData.create_by)) && formData.create_by && (
                                <SelectItem value={formData.create_by}>{formData.create_by}</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* Job Description File (PDF Upload) */}
                <div className="space-y-2">
                    <Label htmlFor="feedback_file">Job Description File (Upload PDF)</Label>
                    <div className="flex flex-col gap-2">
                        {formData.feedback_file ? (
                            <div className="flex items-center justify-between p-2 border rounded-md bg-green-50 border-green-200">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                                    <span className="text-xs text-green-700 truncate" title={formData.feedback_file}>
                                        {uploadedFileName || "File uploaded"}
                                    </span>
                                </div>
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                                    onClick={() => {
                                        handleChange("feedback_file", "");
                                        setUploadedFileName(null);
                                    }}
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Input
                                    type="file"
                                    accept=".pdf"
                                    className="hidden"
                                    id="jr-file-upload"
                                    onChange={handleFileUpload}
                                    disabled={uploadingFile}
                                />
                                <Label
                                    htmlFor="jr-file-upload"
                                    className={cn(
                                        "flex items-center justify-center gap-2 w-full h-10 px-3 border-2 border-dashed rounded-md cursor-pointer transition-colors",
                                        uploadingFile ? "opacity-50 cursor-not-allowed bg-slate-50" : "hover:bg-slate-50 border-slate-200 hover:border-slate-300"
                                    )}
                                >
                                    {uploadingFile ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-500">Upload PDF</span>
                                        </>
                                    )}
                                </Label>
                            </div>
                        )}
                        <p className="text-[10px] text-slate-400">Supporting only PDF format for n8n processing.</p>
                    </div>
                </div>
            </div>

            {/* Job Description */}
            <div className="space-y-2">
                <Label htmlFor="job_description">Job Description</Label>
                <Textarea
                    id="job_description"
                    placeholder="Enter full job description here..."
                    className="min-h-[150px]"
                    value={formData.job_description}
                    onChange={(e) => handleChange("job_description", e.target.value)}
                />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Created By</span>
                    <span className="text-sm font-black text-indigo-600">{formData.create_by || "System"}</span>
                </div>
                <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading} className="bg-primary text-primary-foreground">
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isEdit ? "Saving..." : "Creating..."}
                            </>
                        ) : (
                            isEdit ? "Update Requisition" : "Create Requisition"
                        )}
                    </Button>
                </div>
            </div>
        </form>
    );
}
