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
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateJobRequisitionFormProps {
    onCancel: () => void;
    onSuccess: (updatedJR: any) => void;
    initialData?: any; // [NEW] For Edit Mode
}

interface ComboboxProps {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
    allowCustom?: boolean;
}

function CreatableCombobox({ value, onChange, options, placeholder, allowCustom = true }: ComboboxProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
                    {value || placeholder || "Select..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command filter={(value, search) => {
                    if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                    return 0;
                }}>
                    <CommandInput placeholder="Search or type..." onValueChange={setQuery} />
                    <CommandList>
                        <CommandEmpty>
                            {allowCustom && query.length > 0 ? (
                                <div
                                    className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-sm"
                                    onClick={() => {
                                        onChange(query);
                                        setOpen(false);
                                    }}
                                >
                                    <Plus className="h-4 w-4" /> Create &quot;{query}&quot;
                                </div>
                            ) : "No results found."}
                        </CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option}
                                    value={option}
                                    onSelect={(currentValue) => {
                                        onChange(currentValue === value ? "" : currentValue);
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

export function CreateJobRequisitionForm({ onCancel, onSuccess, initialData }: CreateJobRequisitionFormProps) {
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

    const [currentUserName, setCurrentUserName] = useState<string>("");

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
                    positions: pos,
                    divisions: bus,
                    subDivisions: subs,
                    originalJrs: jrs
                });

                setCurrentUserName(name);
                if (!isEdit) {
                    setFormData(prev => ({ ...prev, create_by: name }));
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (isEdit) {
                const { updateJobRequisition } = await import("@/app/actions/requisitions");
                const result = await updateJobRequisition(initialData.id, formData);
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

                {/* Create By - REMOVED from UI but kept in state for action */}
                {/* <div className="space-y-2">
                    <Label htmlFor="create_by">Create By <span className="text-red-500">*</span></Label>
                    <Select onValueChange={(v) => handleChange("create_by", v)} defaultValue={formData.create_by}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Creator" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="HR Manager">HR Manager</SelectItem>
                        </SelectContent>
                    </Select>
                </div> */}

                {/* Feedback File (PDF Link) */}
                <div className="space-y-2">
                    <Label htmlFor="feedback_file">Feedback File (PDF/Link)</Label>
                    <Input
                        placeholder="Paste PDF link here..."
                        value={formData.feedback_file}
                        onChange={(e) => handleChange("feedback_file", e.target.value)}
                    />
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
                    <span className="text-sm font-black text-indigo-600">{currentUserName || "Loading..."}</span>
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
