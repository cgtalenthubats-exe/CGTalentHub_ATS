"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    onSuccess: (newJR: any) => void;
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

export function CreateJobRequisitionForm({ onCancel, onSuccess }: CreateJobRequisitionFormProps) {
    const [isLoading, setIsLoading] = useState(false);

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
        position_jr: "",
        bu: "",
        sub_bu: "",
        request_date: new Date().toISOString().split('T')[0], // Default to today YYYY-MM-DD
        jr_type: "New",
        original_jr_id: "",
        job_description: "",
        feedback_file: "",
        create_by: "Admin" // Simple default as per current context
    });

    // Load Distinct Values on Mount
    useState(() => {
        async function loadOptions() {
            try {
                const { getDistinctFieldValues } = await import("@/app/actions/requisitions");
                const [pos, bus, subs, jrs] = await Promise.all([
                    getDistinctFieldValues('position_jr'),
                    getDistinctFieldValues('bu'),
                    getDistinctFieldValues('sub_bu'),
                    getDistinctFieldValues('jr_id')
                ]);
                setOptions({
                    positions: pos,
                    divisions: bus,
                    subDivisions: subs,
                    originalJrs: jrs
                });
            } catch (e) {
                console.error("Failed to load options", e);
            }
        }
        loadOptions();
    });

    const handleChange = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { createJobRequisition } = await import("@/app/actions/requisitions");
            const newJR = await createJobRequisition(formData);
            if (newJR) {
                onSuccess(newJR);
            }
        } catch (error) {
            console.error("Failed to create JR", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Position Title: Combobox (Customizable) */}
                <div className="space-y-2">
                    <Label htmlFor="position_jr">Position (JR) <span className="text-red-500">*</span></Label>
                    <CreatableCombobox
                        value={formData.position_jr}
                        onChange={(v) => handleChange("position_jr", v)}
                        options={options.positions}
                        placeholder="Select or Type Position"
                    />
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

                {/* Request Date */}
                <div className="space-y-2">
                    <Label htmlFor="request_date">Request Date <span className="text-red-500">*</span></Label>
                    <Input
                        type="date"
                        value={formData.request_date}
                        onChange={(e) => handleChange("request_date", e.target.value)}
                    />
                </div>

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
                    <Select onValueChange={(v) => handleChange("create_by", v)} defaultValue={formData.create_by}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Creator" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="HR Manager">HR Manager</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

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

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="bg-primary text-primary-foreground">
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                        </>
                    ) : (
                        "Create Requisition"
                    )}
                </Button>
            </div>
        </form>
    );
}
