"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { addExperience, deleteExperience, searchCompanies, getCompanyDetails, getFieldSuggestions } from "@/app/actions/candidate";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// --- Reusable Combobox Component ---
interface ComboboxProps {
    value: string;
    onChange: (val: string) => void;
    onSelect?: (item: any) => void;
    fetchSuggestions: (query: string) => Promise<any[]>;
    defaultOptions?: any[]; // New prop
    placeholder?: string;
    emptyText?: string;
    className?: string;
    itemKey?: string;
}

function CreatableCombobox({
    value,
    onChange,
    onSelect,
    fetchSuggestions,
    defaultOptions = [],
    placeholder = "Select or type...",
    emptyText = "Type to create new...",
    className,
    itemKey = "name"
}: ComboboxProps) {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<any[]>([]);

    // Initialize/Reset options when open changes or defaultOptions change
    useEffect(() => {
        if (open && options.length === 0 && defaultOptions.length > 0) {
            setOptions(defaultOptions);
        }
    }, [open, defaultOptions]);

    const handleSearch = useCallback(async (val: string) => {
        onChange(val);
        if (val.length > 0) {
            const results = await fetchSuggestions(val);
            setOptions(results);
        } else {
            // If cleared, show defaults if available
            setOptions(defaultOptions.length > 0 ? defaultOptions : []);
        }
    }, [fetchSuggestions, onChange, defaultOptions]);

    const handleSelect = (currentValue: any) => {
        const txt = typeof currentValue === 'string' ? currentValue : currentValue[itemKey];
        onChange(txt);
        if (onSelect) onSelect(currentValue);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("justify-between w-full font-normal text-left", !value && "text-muted-foreground", className)}
                >
                    {value || placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={placeholder}
                        onValueChange={handleSearch}
                        value={value}
                    />
                    <CommandList>
                        <CommandEmpty>
                            <div className="p-2 text-xs text-muted-foreground">{emptyText}</div>
                        </CommandEmpty>
                        <CommandGroup heading={defaultOptions.length > 0 && options === defaultOptions ? "Suggestions from Company" : undefined}>
                            {options.map((opt, i) => {
                                const txt = typeof opt === 'string' ? opt : opt[itemKey];
                                const key = typeof opt === 'string' ? opt : (opt.id || i);
                                return (
                                    <CommandItem
                                        key={key}
                                        value={txt}
                                        onSelect={() => handleSelect(opt)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === txt ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {txt}
                                        {typeof opt !== 'string' && opt.industry && <span className="ml-2 text-[10px] text-muted-foreground">({opt.industry})</span>}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// -----------------------------------

export function AddExperienceDialog({ candidateId }: { candidateId: string }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [position, setPosition] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [companyId, setCompanyId] = useState("");
    const [industry, setIndustry] = useState("");
    const [group, setGroup] = useState("");
    const [country, setCountry] = useState("");
    const [isCurrent, setIsCurrent] = useState(false);

    // Search State
    const [knownCountries, setKnownCountries] = useState<string[]>([]);

    const fetchPositions = async (q: string) => getFieldSuggestions('position', q);
    const fetchIndustries = async (q: string) => getFieldSuggestions('industry', q);
    const fetchGroups = async (q: string) => getFieldSuggestions('group', q);
    const fetchCountries = async (q: string) => getFieldSuggestions('country', q);
    const fetchCompanies = async (q: string) => searchCompanies(q);

    const handleSelectCompany = async (comp: any) => {
        setCompanyId(comp.id);
        // Fetch details
        const details = await getCompanyDetails(comp.id);
        if (details.industry) setIndustry(details.industry);
        if (details.group) setGroup(details.group);
        setKnownCountries(details.countries || []);
    };

    const onCompanyChange = (val: string) => {
        setCompanyName(val);
        setCompanyId(""); // Reset ID if typing
        // Should we clear known countries? Maybe not immediately to prevent flicker, but logical yes.
        // setKnownCountries([]); // Optional
    };

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        // Append controlled state
        formData.set("position", position);
        formData.set("company", companyName);
        if (companyId) formData.set("company_id", companyId);
        if (isCurrent) formData.set("is_current", "on");
        formData.set("country", country);
        formData.set("industry", industry);
        formData.set("group", group);

        const res = await addExperience(candidateId, formData);
        setLoading(false);
        if (res.error) {
            alert(res.error);
        } else {
            setOpen(false);
            // Reset form
            setPosition("");
            setCompanyName("");
            setCompanyId("");
            setIndustry("");
            setGroup("");
            setCountry("");
            setIsCurrent(false);
            setKnownCountries([]);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Add Experience
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Experience</DialogTitle>
                </DialogHeader>
                <form action={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-1 gap-2">
                        <Label htmlFor="position">Position</Label>
                        <CreatableCombobox
                            value={position}
                            onChange={setPosition}
                            fetchSuggestions={fetchPositions}
                            placeholder="e.g. Senior Developer"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        <Label>Company</Label>
                        <CreatableCombobox
                            value={companyName}
                            onChange={onCompanyChange}
                            onSelect={handleSelectCompany}
                            fetchSuggestions={fetchCompanies}
                            placeholder="e.g. Acme Corp"
                            emptyText="New company will be created..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="industry">Industry</Label>
                            <CreatableCombobox
                                value={industry}
                                onChange={setIndustry}
                                fetchSuggestions={fetchIndustries}
                                placeholder="Technology"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="group">Group</Label>
                            <CreatableCombobox
                                value={group}
                                onChange={setGroup}
                                fetchSuggestions={fetchGroups}
                                placeholder="Public Limited"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="country">Country</Label>
                            <CreatableCombobox
                                value={country}
                                onChange={setCountry}
                                fetchSuggestions={fetchCountries}
                                defaultOptions={knownCountries}
                                placeholder="Thailand"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="start_date">Start Date</Label>
                            <Input id="start_date" name="start_date" type="date" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="end_date">End Date</Label>
                            <Input
                                id="end_date"
                                name="end_date"
                                type={isCurrent ? "text" : "date"}
                                value={isCurrent ? "Present" : undefined}
                                disabled={isCurrent}
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox
                            id="is_current"
                            checked={isCurrent}
                            onCheckedChange={(c) => setIsCurrent(c as boolean)}
                        />
                        <label
                            htmlFor="is_current"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Current Job
                        </label>
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Experience"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function DeleteExperienceButton({ id, candidateId }: { id: string, candidateId: string }) {
    const [loading, setLoading] = useState(false);
    async function handleDelete(e: React.MouseEvent) {
        e.preventDefault();
        if (!confirm("Are you sure?")) return;
        setLoading(true);
        await deleteExperience(id, candidateId);
        setLoading(false);
    }

    return (
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={handleDelete} disabled={loading}>
            <Trash2 className="h-3 w-3" />
        </Button>
    )
}
