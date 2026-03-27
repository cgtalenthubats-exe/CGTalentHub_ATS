"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { addExperience, deleteExperience, searchCompanies, getCompanyDetails, getFieldSuggestions, setCurrentExperience, updateExperience, getIndustryGroupMaster, getCountryMaster } from "@/app/actions/candidate";
import { formatMonthYear, parseMonthYearToInput } from "@/lib/date-utils";
import { useRouter } from "next/navigation";
import { Info, Plus, Trash2, Check, ChevronsUpDown, Star, Edit } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon } from "lucide-react";

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
    const [isSearching, setIsSearching] = useState(false);

    // Initialize/Reset options when open changes or defaultOptions change
    useEffect(() => {
        if (open && options.length === 0 && defaultOptions.length > 0) {
            setOptions(defaultOptions);
        }
    }, [open, defaultOptions]);

    const handleSearch = useCallback(async (val: string) => {
        onChange(val);
        if (val.length > 0) {
            setIsSearching(true);
            try {
                const results = await fetchSuggestions(val);
                setOptions(results);
            } finally {
                setIsSearching(false);
            }
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
                <div className="relative w-full">
                    <Input
                        value={value}
                        onChange={(e) => {
                            handleSearch(e.target.value);
                            if (!open) setOpen(true);
                        }}
                        onFocus={() => {
                            if (options.length === 0 && defaultOptions.length > 0) {
                                setOptions(defaultOptions);
                            }
                            setOpen(true);
                        }}
                        placeholder={placeholder}
                        className={cn("w-full pr-10 h-10 bg-white border-slate-200 focus:ring-primary/20", className)}
                    />
                    <ChevronsUpDown className="absolute right-3 top-3 h-4 w-4 shrink-0 opacity-50" />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                <Command shouldFilter={false}>
                    <CommandList>
                        {isSearching ? (
                            <div className="p-4 text-xs text-center text-muted-foreground flex items-center justify-center gap-2">
                                <div className="h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                กำลังค้นหา...
                            </div>
                        ) : (
                            <>
                                <CommandEmpty>
                                    <div className="p-2 text-xs text-muted-foreground">
                                        {options.length === 0 && value.length > 0 ? "ไม่พบข้อมูลเดิม สามารถพิมพ์เพื่อเพิ่มใหม่ได้" : emptyText}
                                    </div>
                                </CommandEmpty>
                                <CommandGroup heading={defaultOptions.length > 0 && options === defaultOptions ? "Suggestions" : undefined}>
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
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// --- Specialized Month/Year Picker ---
function MonthYearPicker({
    value,
    onChange,
    placeholder = "Select month/year",
    disabled = false
}: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

    const [selectedMonth, setSelectedMonth] = useState(value ? value.split('-')[0] : "");
    const [selectedYear, setSelectedYear] = useState(value ? value.split('-')[1] : "");

    useEffect(() => {
        if (value) {
            const [m, y] = value.split('-');
            setSelectedMonth(m);
            setSelectedYear(y);
        }
    }, [value]);

    const handleSelect = (m: string, y: string) => {
        if (m && y) {
            onChange(`${m}-${y}`);
            setOpen(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !value && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {value || placeholder}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
                <div className="flex gap-4 h-64">
                    <div className="flex flex-col gap-2">
                        <Label className="text-[10px] uppercase text-muted-foreground px-1">Month</Label>
                        <ScrollArea className="h-full w-24 rounded-md border p-1">
                            <div className="flex flex-col gap-1">
                                {months.map((m, i) => {
                                    const mVal = String(i + 1).padStart(2, '0');
                                    return (
                                        <Button
                                            key={mVal}
                                            variant={selectedMonth === mVal ? "default" : "ghost"}
                                            size="sm"
                                            className="justify-start text-xs h-8"
                                            onClick={() => {
                                                setSelectedMonth(mVal);
                                                if (selectedYear) handleSelect(mVal, selectedYear);
                                            }}
                                        >
                                            {m}
                                        </Button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-[10px] uppercase text-muted-foreground px-1">Year</Label>
                        <ScrollArea className="h-full w-24 rounded-md border p-1">
                            <div className="flex flex-col gap-1">
                                {years.map((y) => (
                                    <Button
                                        key={y}
                                        variant={selectedYear === String(y) ? "default" : "ghost"}
                                        size="sm"
                                        className="justify-start text-xs h-8"
                                        onClick={() => {
                                            setSelectedYear(String(y));
                                            if (selectedMonth) handleSelect(selectedMonth, String(y));
                                        }}
                                    >
                                        {y}
                                    </Button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

// -----------------------------------

export function AddExperienceDialog({ candidateId, onSuccess: onRefresh }: { candidateId: string, onSuccess?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 font-bold bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
                    <Plus className="h-4 w-4 stroke-[3]" /> Add Experience
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Experience</DialogTitle>
                    <DialogDescription>Add a new work experience entry to the candidate's profile.</DialogDescription>
                </DialogHeader>
                <ExperienceForm
                    candidateId={candidateId}
                    onSuccess={() => {
                        setOpen(false);
                        if (onRefresh) onRefresh();
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}

export function EditExperienceDialog({ experience, candidateId, onSuccess: onRefresh }: { experience: any; candidateId: string; onSuccess?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <Edit className="h-3 w-3" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Experience</DialogTitle>
                    <DialogDescription>Update the existing work experience details.</DialogDescription>
                </DialogHeader>
                <ExperienceForm
                    candidateId={candidateId}
                    experience={experience}
                    onSuccess={() => {
                        setOpen(false);
                        if (onRefresh) onRefresh();
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}

function ExperienceForm({
    candidateId,
    experience,
    onSuccess
}: {
    candidateId: string;
    experience?: any;
    onSuccess: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [isAutoFilling, setIsAutoFilling] = useState(false);
    const router = useRouter();

    // Form State
    const [position, setPosition] = useState(experience?.position || "");
    const [companyName, setCompanyName] = useState(experience?.company || "");
    const [companyId, setCompanyId] = useState(experience?.company_id || "");
    const [industry, setIndustry] = useState(experience?.company_industry || "");
    const [group, setGroup] = useState(experience?.company_group || "");
    const [country, setCountry] = useState(experience?.country || "");
    const [isCurrent, setIsCurrent] = useState(experience?.is_current_job === 'Current');
    const [startDate, setStartDate] = useState(formatMonthYear(experience?.start_date));
    const [endDate, setEndDate] = useState(formatMonthYear(experience?.end_date));

    // Search/Master State
    const [knownCountries, setKnownCountries] = useState<string[]>([]);
    const [masterIndustryGroups, setMasterIndustryGroups] = useState<{ industry: string, group: string }[]>([]);
    const [masterCountries, setMasterCountries] = useState<string[]>([]);

    useEffect(() => {
        async function load() {
            const [ig, c] = await Promise.all([getIndustryGroupMaster(), getCountryMaster()]);
            setMasterIndustryGroups(ig);
            setMasterCountries(c);
        }
        load();
    }, []);

    const fetchPositions = async (q: string) => getFieldSuggestions('position', q);

    const fetchIndustries = async (q: string) => {
        const unique = Array.from(new Set(masterIndustryGroups.map(i => i.industry)));
        return unique.filter(i => i.toLowerCase().includes(q.toLowerCase()));
    };

    const fetchGroups = async (q: string) => {
        // Filter by currently selected industry
        const filtered = masterIndustryGroups
            .filter(i => !industry || i.industry === industry)
            .map(i => i.group);
        const unique = Array.from(new Set(filtered));
        return unique.filter(g => g.toLowerCase().includes(q.toLowerCase()));
    };

    const fetchCountries = async (q: string) => {
        const baseList = knownCountries.length > 0 ? knownCountries : masterCountries;
        return baseList.filter(c => c.toLowerCase().includes(q.toLowerCase())).slice(0, 50);
    };

    const fetchCompanies = async (q: string) => searchCompanies(q);

    const handleSelectCompany = async (comp: any) => {
        setCompanyId(comp.id);
        setIsAutoFilling(true);
        const details = await getCompanyDetails(comp.id);
        if (details.industry) setIndustry(details.industry);
        if (details.group) setGroup(details.group);
        setKnownCountries(details.countries || []);
        setTimeout(() => setIsAutoFilling(false), 4000);
    };

    const onCompanyChange = (val: string) => {
        setCompanyName(val);
        setCompanyId("");
    };

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        formData.set("position", position);
        formData.set("company", companyName);
        if (companyId) formData.set("company_id", companyId);
        if (isCurrent) formData.set("is_current", "on");
        formData.set("country", country);
        formData.set("industry", industry);
        formData.set("group", group);
        formData.set("start_date", parseMonthYearToInput(startDate));
        formData.set("end_date", isCurrent ? "" : parseMonthYearToInput(endDate));

        const expId = experience?.id;
        const res = experience
            ? await updateExperience(expId, candidateId, formData)
            : await addExperience(candidateId, formData);

        if (res.error) {
            setLoading(false);
            alert(res.error);
        } else {
            // If callback provided, run it, otherwise do the default reload
            if (onSuccess) {
                onSuccess();
            } else {
                window.location.reload();
            }
        }
    }

    return (
        <form action={handleSubmit} className="space-y-4 py-4">
            {isAutoFilling && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-md text-[11px] flex items-center gap-2 animate-pulse mb-2">
                    <Info className="h-3 w-3" />
                    ระบบอัตโนมัติกำลังดึงข้อมูลบริษัทมาเติมให้ครับ...
                </div>
            )}
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
                        onChange={(val) => {
                            setIndustry(val);
                            setGroup(""); // Clear group when industry changes
                        }}
                        fetchSuggestions={fetchIndustries}
                        defaultOptions={Array.from(new Set(masterIndustryGroups.map(i => i.industry)))}
                        placeholder="Technology"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="group">Group</Label>
                    <CreatableCombobox
                        value={group}
                        onChange={setGroup}
                        fetchSuggestions={fetchGroups}
                        defaultOptions={Array.from(new Set(masterIndustryGroups.filter(i => !industry || i.industry === industry).map(i => i.group)))}
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
                        defaultOptions={knownCountries.length > 0 ? knownCountries : masterCountries.slice(0, 20)}
                        placeholder="Thailand"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <MonthYearPicker
                        value={startDate}
                        onChange={setStartDate}
                        placeholder="MM-YYYY"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="end_date">End Date</Label>
                    <MonthYearPicker
                        value={isCurrent ? "Present" : endDate}
                        onChange={setEndDate}
                        placeholder="MM-YYYY"
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
                <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full">
                    {loading ? "Saving..." : experience ? "Update Experience" : "Save Experience"}
                </Button>
            </DialogFooter>
        </form>
    );
}

export function DeleteExperienceButton({ id, candidateId, onSuccess }: { id: string, candidateId: string, onSuccess?: () => void }) {
    const [loading, setLoading] = useState(false);
    async function handleDelete(e: React.MouseEvent) {
        e.preventDefault();
        if (!confirm("Are you sure?")) return;
        setLoading(true);
        await deleteExperience(id, candidateId);
        setLoading(false);
        if (onSuccess) onSuccess();
        else window.location.reload();
    }

    return (
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={handleDelete} disabled={loading}>
            <Trash2 className="h-3 w-3" />
        </Button>
    )
}

export function SetCurrentExperienceButton({
    experienceId, candidateId, isCurrent, onSuccess
}: { experienceId: string; candidateId: string; isCurrent: boolean; onSuccess?: () => void }) {
    const [loading, setLoading] = useState(false);

    async function handleClick(e: React.MouseEvent) {
        e.preventDefault();
        setLoading(true);
        await setCurrentExperience(experienceId, candidateId);
        setLoading(false);
        if (onSuccess) onSuccess();
        else window.location.reload();
    }

    return (
        <button
            onClick={handleClick}
            disabled={loading}
            title={isCurrent ? "Unset as Current Job" : "Set as Current Job"}
            className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border",
                isCurrent
                    ? "bg-amber-50 border-amber-200 text-amber-600 shadow-sm shadow-amber-100/50"
                    : "bg-slate-50/50 border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-500 hover:bg-amber-50",
                loading && "opacity-50 cursor-not-allowed"
            )}
        >
            <Star className={cn("h-3 w-3 transition-transform", isCurrent ? "fill-amber-400 text-amber-500 scale-110" : "text-slate-300")} />
            {isCurrent ? "Current" : "Set Current"}
        </button>
    );
}
