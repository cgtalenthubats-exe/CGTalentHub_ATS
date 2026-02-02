"use client";

import React, { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Briefcase, Trash2, Save, Plus, ChevronsUpDown, Check } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

interface ExperienceData {
    tempId: number;
    position: string;
    company: string;
    company_industry: string;
    company_group: string;
    work_location: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
}

export default function NewExperiencePage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);

    const [loading, setLoading] = useState(false);
    const [candidateName, setCandidateName] = useState("");

    // Master Data
    const [companies, setCompanies] = useState<any[]>([]);
    const [positions, setPositions] = useState<string[]>([]);
    const [countries, setCountries] = useState<string[]>([]);
    const [industryGroups, setIndustryGroups] = useState<any[]>([]);

    // Form State (Array of Experiences)
    const [experiences, setExperiences] = useState<ExperienceData[]>([
        { tempId: Date.now(), position: "", company: "", company_industry: "", company_group: "", work_location: "", start_date: "", end_date: "", is_current: false }
    ]);

    // Helpers
    const uniqueIndustries = Array.from(new Set(industryGroups.map(i => i.industry)));
    const uniqueGroups = Array.from(new Set(industryGroups.map(i => i.group)));

    useEffect(() => {
        const fetchData = async () => {
            // 1. Candidate Name
            const { data: profile } = await supabase.from('Candidate Profile').select('name').eq('candidate_id', id).single();
            if (profile) setCandidateName(profile.name);

            // 2. Companies (company_master)
            const { data: compData } = await supabase.from('company_master').select('company_master, industry, group').order('company_master');
            if (compData) {
                // De-duplicate by company_name (company_master)
                const uniqueMap = new Map();
                compData.forEach(c => {
                    const name = c.company_master;
                    if (name && !uniqueMap.has(name)) {
                        uniqueMap.set(name, {
                            company_name: name,
                            industry: c.industry,
                            group: c.group
                        });
                    }
                });
                setCompanies(Array.from(uniqueMap.values()));
            }

            // 3. Positions
            const { data: posData } = await supabase.from('candidate_experiences').select('position').not('position', 'is', null).limit(2000);
            if (posData) {
                const unique = Array.from(new Set(posData.map(p => p.position).filter(Boolean)));
                setPositions(unique.sort());
            }

            // 4. Countries
            const { data: cData } = await supabase.from('country').select('country').order('country');
            if (cData) setCountries(cData.map(c => c.country).filter(Boolean));

            // 5. Industry Groups
            const { data: indData } = await supabase.from('industry_group').select('industry, group').order('industry');
            if (indData) setIndustryGroups(indData);
        };
        fetchData();
    }, [id]);

    // --- Row Management ---
    const addRow = () => {
        setExperiences(prev => [
            ...prev,
            { tempId: Date.now(), position: "", company: "", company_industry: "", company_group: "", work_location: "", start_date: "", end_date: "", is_current: false }
        ]);
    };

    const removeRow = (index: number) => {
        if (experiences.length > 1) {
            setExperiences(prev => prev.filter((_, i) => i !== index));
        }
    };

    const updateRow = (index: number, field: keyof ExperienceData, value: any) => {
        setExperiences(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleCompanyChange = (index: number, companyName: string) => {
        const selected = companies.find(c => c.company_name?.toLowerCase() === companyName?.toLowerCase());
        setExperiences(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                company: selected ? selected.company_name : companyName,
                company_industry: selected?.industry || updated[index].company_industry,
                company_group: selected?.group || updated[index].company_group
            };
            return updated;
        });
    };

    const handleSaveAll = async () => {
        setLoading(true);
        try {
            const validRows = experiences.filter(exp => exp.company && exp.position); // Basic validation
            if (validRows.length === 0) {
                alert("Please fill in at least one experience with Company and Position.");
                setLoading(false);
                return;
            }

            // 1. Process Companies (Auto-create if new)
            // Use a Set to avoid trying to create same new company twice from multiple rows
            const uniqueCompanies = Array.from(new Set(validRows.map(r => r.company)));

            for (const compName of uniqueCompanies) {
                const exists = companies.some(c => c.company_name?.toLowerCase() === compName.toLowerCase());
                if (!exists) {
                    // Try to find the row that has metadata for this company to save it
                    const sourceRow = validRows.find(r => r.company === compName);

                    const { error: createErr } = await supabase.from('company_master').insert([{
                        company_master: compName,
                        industry: sourceRow?.company_industry || null,
                        group: sourceRow?.company_group || null
                    }]);
                    if (createErr) console.error(`Failed to create company ${compName}:`, createErr.message);
                }
            }

            // 2. Prepare Experience Payloads
            const formatMonth = (m: string) => m ? `${m}-01` : null;
            const payloads = validRows.map(row => ({
                candidate_id: id,
                name: candidateName,
                position: row.position,
                company: row.company,
                company_industry: row.company_industry || null,
                company_group: row.company_group || null,
                work_location: row.work_location || null,
                start_date: formatMonth(row.start_date),
                end_date: row.is_current ? 'Present' : formatMonth(row.end_date),
            }));

            // 3. Bulk Insert
            const { error: insertErr } = await supabase.from('candidate_experiences').insert(payloads);
            if (insertErr) throw insertErr;

            alert("All experiences saved successfully!");
            router.push(`/candidates/${id}`); // Or wherever the list is

        } catch (error: any) {
            alert("Error saving: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <div className="flex justify-between items-center mb-6">
                <Button variant="ghost" className="gap-2 text-muted-foreground" onClick={() => router.push(`/candidates/${id}`)}>
                    <ArrowLeft className="h-4 w-4" /> Go to Profile
                </Button>
                <div className="text-right">
                    <h1 className="text-2xl font-bold">Work Experience</h1>
                    <p className="text-sm text-muted-foreground">Adding history for <span className="font-mono text-primary">{id}</span></p>
                </div>
            </div>

            <div className="space-y-6">
                {experiences.map((exp, index) => (
                    <ExperienceRow
                        key={exp.tempId}
                        index={index}
                        data={exp}
                        isOnly={experiences.length === 1}
                        positions={positions}
                        companies={companies}
                        countries={countries}
                        uniqueIndustries={uniqueIndustries}
                        uniqueGroups={uniqueGroups}
                        onUpdate={updateRow}
                        onCompanyChange={handleCompanyChange}
                        onRemove={() => removeRow(index)}
                    />
                ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-6 border-t">
                <Button variant="outline" onClick={addRow} className="gap-2 flex-1 sm:flex-none border-dashed">
                    <Plus className="h-4 w-4" /> Add Another Experience
                </Button>
                <Button onClick={handleSaveAll} disabled={loading} className="gap-2 flex-1 sm:flex-none sm:ml-auto shadow-lg shadow-primary/20">
                    <Save className="h-4 w-4" /> Save All Experiences
                </Button>
            </div>
        </div>
    );
}

// --- Sub-Component for Cleanliness ---
function ExperienceRow({
    index, data, isOnly, positions, companies, countries, uniqueIndustries, uniqueGroups,
    onUpdate, onCompanyChange, onRemove
}: any) {
    const [openPos, setOpenPos] = useState(false);
    const [openComp, setOpenComp] = useState(false);
    const [openInd, setOpenInd] = useState(false);
    const [openGrp, setOpenGrp] = useState(false);
    const [openLoc, setOpenLoc] = useState(false);

    return (
        <Card className="relative group border-l-4 border-l-primary/50 shadow-sm overflow-visible">
            {!isOnly && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={onRemove}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            )}

            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground/80">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-primary">
                        {index + 1}
                    </div>
                    Experience
                </CardTitle>
            </CardHeader>

            <CardContent className="grid gap-4 pt-2">
                {/* Row 1: Job & Company */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 flex flex-col">
                        <Label>Job Title <span className="text-red-500">*</span></Label>
                        <Popover open={openPos} onOpenChange={setOpenPos}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="justify-between bg-background pl-3 font-normal">
                                    {data.position || "Select or type..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[350px]" align="start">
                                <Command>
                                    <CommandInput placeholder="Search positions..." onValueChange={(v) => onUpdate(index, "position", v)} />
                                    <CommandList>
                                        <CommandGroup>
                                            {positions.map((pos: string) => (
                                                <CommandItem key={pos} value={pos} onSelect={(v) => { onUpdate(index, "position", v); setOpenPos(false); }}>
                                                    <Check className={cn("mr-2 h-4 w-4", data.position === pos ? "opacity-100" : "opacity-0")} />
                                                    {pos}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2 flex flex-col">
                        <Label>Company <span className="text-red-500">*</span></Label>
                        <Popover open={openComp} onOpenChange={setOpenComp}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="justify-between bg-background pl-3 font-normal">
                                    <div className="truncate">{data.company || "Select or type..."}</div>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[350px]" align="start">
                                <Command>
                                    <CommandInput placeholder="Search company..." onValueChange={(v) => onCompanyChange(index, v)} />
                                    <CommandList>
                                        <CommandEmpty className="py-2 px-4 text-xs">
                                            {data.company ? "Press Enter to use this new company." : "Type to search..."}
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {companies.map((c: any) => (
                                                <CommandItem
                                                    key={c.company_name}
                                                    value={c.company_name}
                                                    onSelect={(currentValue) => {
                                                        // currentValue from cmdk might be lowercased; prefer using the explicit name from our data
                                                        onCompanyChange(index, c.company_name);
                                                        setOpenComp(false);
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", data.company === c.company_name ? "opacity-100" : "opacity-0")} />
                                                    {c.company_name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* Row 2: Industry & Group (Auto/Manual) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-secondary/5 p-3 rounded-md border border-dashed">
                    <div className="space-y-2 flex flex-col">
                        <Label>Industry</Label>
                        <Popover open={openInd} onOpenChange={setOpenInd}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="justify-between bg-background pl-3 font-normal h-9 bg-secondary/20">
                                    <div className="truncate">{data.company_industry || "Auto-match or select..."}</div>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[300px]" align="start">
                                <Command>
                                    <CommandInput placeholder="Search..." />
                                    <CommandList>
                                        <CommandGroup className="max-h-[300px] overflow-y-auto">
                                            {uniqueIndustries.map((ind: any) => (
                                                <CommandItem key={ind} value={ind} onSelect={(v) => { onUpdate(index, "company_industry", ind); setOpenInd(false); }}>
                                                    <Check className={cn("mr-2 h-4 w-4", data.company_industry === ind ? "opacity-100" : "opacity-0")} />
                                                    {ind}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="space-y-2 flex flex-col">
                        <Label>Company Group</Label>
                        <Popover open={openGrp} onOpenChange={setOpenGrp}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="justify-between bg-background pl-3 font-normal h-9 bg-secondary/20">
                                    <div className="truncate">{data.company_group || "Auto-match or select..."}</div>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[300px]" align="start">
                                <Command>
                                    <CommandInput placeholder="Search..." />
                                    <CommandList>
                                        <CommandGroup className="max-h-[300px] overflow-y-auto">
                                            {uniqueGroups.map((grp: any) => (
                                                <CommandItem key={grp} value={grp} onSelect={(v) => { onUpdate(index, "company_group", grp); setOpenGrp(false); }}>
                                                    <Check className={cn("mr-2 h-4 w-4", data.company_group === grp ? "opacity-100" : "opacity-0")} />
                                                    {grp}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* Row 3: Location & Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2 flex flex-col">
                        <Label>Location</Label>
                        <Popover open={openLoc} onOpenChange={setOpenLoc}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="justify-between bg-background pl-3 font-normal">
                                    <div className="truncate">{data.work_location || "Select country..."}</div>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[300px]" align="start">
                                <Command>
                                    <CommandInput placeholder="Search..." />
                                    <CommandList>
                                        <CommandGroup className="max-h-[300px] overflow-y-auto">
                                            {countries.map((c: any) => (
                                                <CommandItem key={c} value={c} onSelect={(v) => { onUpdate(index, "work_location", c); setOpenLoc(false); }}>
                                                    <Check className={cn("mr-2 h-4 w-4", data.work_location === c ? "opacity-100" : "opacity-0")} />
                                                    {c}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input type="month" value={data.start_date} onChange={(e) => onUpdate(index, "start_date", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input type="month" value={data.end_date} disabled={data.is_current} onChange={(e) => onUpdate(index, "end_date", e.target.value)} />
                        <div className="flex items-center space-x-2 pt-1">
                            <Checkbox
                                id={`curr-${index}`}
                                checked={data.is_current}
                                onCheckedChange={(c) => onUpdate(index, "is_current", !!c)}
                            />
                            <label htmlFor={`curr-${index}`} className="text-xs cursor-pointer select-none">Current Job</label>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
