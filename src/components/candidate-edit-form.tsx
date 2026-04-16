"use client";

import React, { useState, useEffect, useRef } from "react";
import { Save, User, Check, ChevronsUpDown, Camera, Loader2, FileText, X, UploadCloud, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusSelect } from "@/components/ui/status-select";
import { supabase } from "@/lib/supabase/client";
import { cn, formatNumberWithCommas, parseNumberFromCommas } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { toast } from "sonner";
import { getEffectiveAge, formatDateForInput, extractYear, calculateBachelorYearFromAge } from "@/lib/date-utils";

interface CandidateEditFormProps {
    candidateId: string;
    onSuccess?: (data?: any) => void;
    onCancel?: () => void;
    showCancel?: boolean;
    hideFooter?: boolean;
}

export function CandidateEditForm({ candidateId, onSuccess, onCancel, showCancel = true, hideFooter = false }: CandidateEditFormProps) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    // Master Data
    const [nationalities, setNationalities] = useState<string[]>([]);
    const [openNat, setOpenNat] = useState(false);

    // Form State (Files)
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string>("");
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);

    // Resume State
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [currentResumeUrl, setCurrentResumeUrl] = useState<string>("");
    const [isUploadingResume, setIsUploadingResume] = useState(false);

    // Form State (Data)
    const [formData, setFormData] = useState({
        name: "",
        candidate_status: "",
        email: "",
        alt_email: "",
        phone: "",
        nationality: "",
        gender: "",
        linkedin: "",
        age_input_type: "dob",
        date_of_birth: "",
        year_of_bachelor_education: "",
        age: "",
        skills: "",
        education: "",
        languages: "",
        about: "",
        country: "",
        full_address: "",
        blacklist_note: "",
        // Compensation & Benefits
        gross_salary_base_b_mth: "",
        other_income: "",
        bonus_mth: "",
        car_allowance_b_mth: "",
        gasoline_b_mth: "",
        phone_b_mth: "",
        provident_fund_pct: "",
        medical_b_annual: "",
        medical_b_mth: "",
        insurance: "",
        housing_for_expat_b_mth: "",
        others_benefit: ""
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Fetch Nationalities
                const { data: natData } = await supabase.from('nationality').select('nationality').order('nationality');
                if (natData) setNationalities(["N/A", ...(natData as any).map((n: any) => n.nationality)]);

                // 2. Fetch Candidate
                const res = await fetch(`/api/candidates/${candidateId}`);
                if (!res.ok) throw new Error("Failed to fetch candidate");
                const { data } = await res.json();

                // Map Data to Form
                setFormData({
                    name: data.name || "",
                    candidate_status: data.candidate_status || "",
                    email: data.email || "",
                    alt_email: data.enhancement?.alt_email || "",
                    phone: data.mobile_phone || "",
                    nationality: data.nationality || "",
                    gender: data.gender || "",
                    linkedin: data.linkedin || "",
                    age_input_type: data.date_of_birth ? "dob" : (data.year_of_bachelor_education ? "bachelor" : "dob"),
                    date_of_birth: formatDateForInput(data.date_of_birth),
                    year_of_bachelor_education: extractYear(data.year_of_bachelor_education)?.toString() || "",
                    age: data.age?.toString() || "",
                    skills: data.enhancement?.skills || data.other_skill || "",
                    education: data.enhancement?.education_summary || "",
                    languages: data.enhancement?.languages || data.language_skill || "",
                    about: data.enhancement?.about || "",
                    country: data.enhancement?.country || "",
                    full_address: data.enhancement?.full_address || "",
                    blacklist_note: data.blacklist_note || "",
                    // Compensation & Benefits
                    gross_salary_base_b_mth: formatNumberWithCommas(data.gross_salary_base_b_mth) || "",
                    car_allowance_b_mth: formatNumberWithCommas(data.car_allowance_b_mth) || "",
                    gasoline_b_mth: formatNumberWithCommas(data.gasoline_b_mth) || "",
                    phone_b_mth: formatNumberWithCommas(data.phone_b_mth) || "",
                    other_income: data.other_income || "",
                    bonus_mth: data.bonus_mth || "",
                    provident_fund_pct: data.provident_fund_pct || "",
                    medical_b_annual: formatNumberWithCommas(data.medical_b_annual) || "",
                    medical_b_mth: formatNumberWithCommas(data.medical_b_mth) || "",
                    insurance: data.insurance || "",
                    housing_for_expat_b_mth: data.housing_for_expat_b_mth || "",
                    others_benefit: data.others_benefit || ""
                });

                if (data.photo) setPhotoPreview(data.photo);
                if (data.resume_url) setCurrentResumeUrl(data.resume_url);

            } catch (error) {
                console.error(error);
                toast.error("Failed to load candidate data");
            } finally {
                setFetching(false);
            }
        };
        loadData();
    }, [candidateId]);

    // Age Calculation Effect
    useEffect(() => {
        if (formData.age_input_type === 'manual') return;

        const calculatedAge = getEffectiveAge(
            formData.age_input_type === 'dob' ? formData.date_of_birth : null,
            formData.age_input_type === 'bachelor' ? formData.year_of_bachelor_education : null
        );

        if (calculatedAge !== formData.age) {
            setFormData(prev => ({ ...prev, age: calculatedAge }));
        }
    }, [formData.date_of_birth, formData.year_of_bachelor_education, formData.age_input_type]);

    // Manual Age -> Bachelor Year Sync
    useEffect(() => {
        if (formData.age_input_type === 'manual' && formData.age) {
            const bachYear = calculateBachelorYearFromAge(formData.age);
            if (bachYear) {
                setFormData(prev => ({ ...prev, year_of_bachelor_education: bachYear.toString() }));
            }
        }
    }, [formData.age, formData.age_input_type]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        const salaryFields = ["gross_salary_base_b_mth", "car_allowance_b_mth", "gasoline_b_mth", "phone_b_mth", "medical_b_annual", "medical_b_mth"];
        
        if (salaryFields.includes(id)) {
            const cleanValue = parseNumberFromCommas(value);
            const formattedValue = formatNumberWithCommas(cleanValue);
            setFormData(prev => ({ ...prev, [id]: formattedValue }));
            return;
        }
        
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            processPhotoFile(file);
        }
    };

    const processPhotoFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error("Please select an image file");
            return;
        }
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processPhotoFile(e.dataTransfer.files[0]);
        }
    };

    // Paste from clipboard support
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf("image") !== -1) {
                        const file = items[i].getAsFile();
                        if (file) processPhotoFile(file);
                        break;
                    }
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, []);

    const handleResumeSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setResumeFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let photoUrl = photoPreview;
            let resumeUrl = currentResumeUrl;

            // 1. Photo Upload
            if (photoFile) {
                const fileExt = photoFile.name.split('.').pop();
                const fileName = `${candidateId}-${Date.now()}-photo.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, photoFile);
                if (uploadError) throw uploadError;
                const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
                photoUrl = data.publicUrl;
            }

            // 2. Resume Upload
            if (resumeFile) {
                setIsUploadingResume(true);
                const fileExt = resumeFile.name.split('.').pop();
                const fileName = `${candidateId}-${Date.now()}-resume.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('resumes').upload(fileName, resumeFile);
                if (uploadError) throw uploadError;
                const { data } = supabase.storage.from('resumes').getPublicUrl(fileName);
                resumeUrl = data.publicUrl;
                setIsUploadingResume(false);
            }

            // 3. API Update
            const updatePayload = {
                name: formData.name,
                candidate_status: formData.candidate_status,
                email: formData.email,
                alt_email: formData.alt_email,
                mobile_phone: formData.phone,
                nationality: formData.nationality,
                gender: formData.gender,
                linkedin: formData.linkedin,
                date_of_birth: formData.date_of_birth,
                year_of_bachelor_education: formData.year_of_bachelor_education,
                age: formData.age,
                photo: photoUrl,
                resume_url: resumeUrl,
                // Enhancement data
                country: formData.country,
                full_address: formData.full_address,
                about: formData.about,
                education: formData.education,
                skills: formData.skills,
                languages: formData.languages,
                // Compensation & Benefits fields
                gross_salary_base_b_mth: parseNumberFromCommas(formData.gross_salary_base_b_mth) || null,
                car_allowance_b_mth: parseNumberFromCommas(formData.car_allowance_b_mth) || null,
                gasoline_b_mth: parseNumberFromCommas(formData.gasoline_b_mth) || null,
                phone_b_mth: parseNumberFromCommas(formData.phone_b_mth) || null,
                other_income: formData.other_income || null,
                bonus_mth: formData.bonus_mth || null,
                provident_fund_pct: formData.provident_fund_pct || null,
                medical_b_annual: parseNumberFromCommas(formData.medical_b_annual) || null,
                medical_b_mth: parseNumberFromCommas(formData.medical_b_mth) || null,
                insurance: formData.insurance || null,
                housing_for_expat_b_mth: formData.housing_for_expat_b_mth || null,
                others_benefit: formData.others_benefit || null,
            };

            const res = await fetch(`/api/candidates/${candidateId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
            });

            const responseText = await res.text();
            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch (e) {
                console.error("Failed to parse response:", responseText);
                throw new Error("Invalid server response");
            }

            if (!res.ok) throw new Error(responseData.error || 'Failed to update candidate');

            toast.success("Candidate saved successfully");
            if (onSuccess) onSuccess(responseData.data);

        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setLoading(false);
            setIsUploadingResume(false);
        }
    };

    if (fetching) {
        return <div className="flex h-32 items-center justify-center"><Loader2 className="animate-spin text-primary w-6 h-6" /></div>;
    }

    return (
        <form id="candidate-edit-form" onSubmit={handleSubmit} className="space-y-6">
            <Card className="border-none shadow-none ring-0">
                <CardHeader className="px-0 pt-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-100 rounded-lg text-indigo-600">
                                <User className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Candidate Profile</CardTitle>
                                <CardDescription className="text-xs">Update personal details and status.</CardDescription>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-8 px-0">
                    <div className="flex items-center gap-4 p-4 border rounded-xl bg-slate-50/50">
                        <StatusSelect
                            value={formData.candidate_status}
                            onChange={(v) => setFormData(prev => ({ ...prev, candidate_status: v }))}
                            className="bg-white border-slate-200"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-6">
                            <div 
                                className={cn(
                                    "flex flex-col items-center p-6 border-2 border-dashed rounded-2xl transition-all duration-300 relative overflow-hidden",
                                    isDragging ? "bg-indigo-50 border-indigo-500 scale-[1.02] shadow-inner" : "bg-slate-50/50 border-slate-200"
                                )}
                                onDragOver={handleDragOver}
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                {isDragging && (
                                    <div className="absolute inset-0 z-10 bg-indigo-600/10 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-200">
                                        <div className="bg-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2">
                                            <UploadCloud className="w-4 h-4 text-indigo-600 animate-bounce" />
                                            <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Drop to Upload</span>
                                        </div>
                                    </div>
                                )}

                                <div className="relative group mb-4">
                                    <Avatar className={cn(
                                        "h-28 w-28 border-4 border-white shadow-xl ring-2 ring-slate-100 transition-transform duration-300 transform-gpu",
                                        isDragging ? "scale-90 opacity-50" : "group-hover:scale-105"
                                    )}>
                                        <AvatarImage src={photoPreview} className="object-cover" />
                                        <AvatarFallback className="text-3xl font-black bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600">
                                            {formData.name ? formData.name.substring(0, 2).toUpperCase() : "?"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <Label htmlFor="photo-upload" className="absolute bottom-0 right-0 p-2.5 bg-indigo-600 text-white rounded-full cursor-pointer hover:bg-indigo-700 hover:scale-110 transition-all shadow-lg active:scale-95 ring-4 ring-white">
                                        <Camera className="h-4 w-4" />
                                        <Input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                                    </Label>
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-tight">Drag & Drop Photo</p>
                                    <p className="text-[9px] text-slate-400 font-medium">Or paste from clipboard</p>
                                    <div className="pt-2 flex items-center justify-center gap-1.5 opacity-40">
                                        {['jpg', 'png', 'webp'].map(fmt => (
                                            <span key={fmt} className="px-1.5 py-0.5 rounded border border-slate-300 text-[8px] font-black uppercase">{fmt}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 p-4 border rounded-xl bg-slate-50/50">
                                <Label className="text-xs font-semibold flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-slate-500" /> Resume / CV
                                </Label>

                                {currentResumeUrl && !resumeFile && (
                                    <div className="flex items-center justify-between p-2 bg-white border rounded-md text-xs">
                                        <a href={currentResumeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[100px]">
                                            View Current
                                        </a>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentResumeUrl("")} className="h-auto p-1 text-red-500">
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                )}

                                {(!currentResumeUrl || resumeFile) && (
                                    <div className="relative">
                                        <Input type="file" accept=".pdf" onChange={handleResumeSelect} className="h-8 text-xs cursor-pointer file:text-indigo-600 file:font-semibold" />
                                        {resumeFile && (
                                            <p className="text-[10px] text-emerald-600 mt-1 font-medium flex items-center gap-1">
                                                <Check className="w-2.5 h-2.5" /> {resumeFile.name}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="name" className="text-xs">Full Name <span className="text-red-500">*</span></Label>
                                    <Input id="name" placeholder="Full Name" required value={formData.name} onChange={handleChange} className="h-9 text-sm" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="gender" className="text-xs">Gender</Label>
                                    <select
                                        id="gender"
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={formData.gender}
                                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                    >
                                        <option value="">Select Gender...</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 flex flex-col">
                                    <Label className="text-xs">Nationality</Label>
                                    <Popover open={openNat} onOpenChange={setOpenNat}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" className="h-9 justify-between pl-3 font-normal w-full text-left text-sm">
                                                {formData.nationality || "Select nationality..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0 w-[240px]" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search..." />
                                                <CommandList>
                                                    <CommandEmpty>No nationality found.</CommandEmpty>
                                                    <CommandGroup className="max-h-[200px] overflow-y-auto">
                                                        {nationalities.map((nat) => (
                                                            <CommandItem key={nat} value={nat} onSelect={() => { setFormData(prev => ({ ...prev, nationality: nat })); setOpenNat(false); }}>
                                                                <Check className={cn("mr-2 h-4 w-4", formData.nationality === nat ? "opacity-100" : "opacity-0")} />
                                                                {nat}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="linkedin" className="text-xs">LinkedIn URL</Label>
                                    <Input id="linkedin" value={formData.linkedin} onChange={handleChange} className="h-9 text-sm" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="country" className="text-xs">Country (from LI)</Label>
                                    <Input id="country" placeholder="e.g. Thailand" value={formData.country} onChange={handleChange} className="h-9 text-sm" />
                                </div>
                            </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="email" className="text-xs">Primary Email</Label>
                                    <Input id="email" type="text" value={formData.email} onChange={handleChange} className="h-9 text-sm" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="alt_email" className="text-xs">Alt. Email (from LI)</Label>
                                    <Input id="alt_email" type="text" value={formData.alt_email} onChange={handleChange} className="h-9 text-sm" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="phone" className="text-xs">Mobile Phone</Label>
                                    <Input id="phone" value={formData.phone} onChange={handleChange} className="h-9 text-sm" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="full_address" className="text-xs">Full Address (from LI)</Label>
                                    <Input id="full_address" value={formData.full_address} onChange={handleChange} className="h-9 text-sm" />
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-xl border space-y-3">
                                <div className="flex flex-wrap gap-3">
                                    {['dob', 'bachelor', 'manual'].map(type => (
                                        <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="radio" name="age_type" className="accent-indigo-600 w-3 h-3"
                                                checked={formData.age_input_type === type}
                                                onChange={() => setFormData(prev => ({ ...prev, age_input_type: type as any }))}
                                            />
                                            <span className="text-[11px] font-medium uppercase text-slate-500">{type === 'dob' ? 'DOB' : type === 'bachelor' ? 'BACH' : 'MANUAL'}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {formData.age_input_type === 'dob' && (
                                        <Input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} className="h-8 text-xs bg-white" />
                                    )}
                                    {formData.age_input_type === 'bachelor' && (
                                        <Input type="number" placeholder="YYYY" value={formData.year_of_bachelor_education} onChange={(e) => setFormData({ ...formData, year_of_bachelor_education: e.target.value })} className="h-8 text-xs bg-white" />
                                    )}
                                    {formData.age_input_type === 'manual' && (
                                        <Input type="number" placeholder="Age" id="age" value={formData.age} onChange={handleChange} className="h-8 text-xs bg-white font-bold text-indigo-600" />
                                    )}
                                    <div className="flex items-center bg-white border rounded-md px-2 h-8 text-[11px] font-bold text-slate-600">
                                        {formData.age_input_type === 'manual' ? `Grad: ${formData.year_of_bachelor_education}` : `Age: ${formData.age}`}
                                    </div>
                                </div>
                            </div>

                            {formData.candidate_status === "Blacklist" && (
                                <div className="p-3 bg-rose-50 rounded-lg border border-rose-100 space-y-1.5">
                                    <Label htmlFor="blacklist_note" className="text-[11px] text-rose-700 font-bold">Blacklist Reason *</Label>
                                    <textarea
                                        id="blacklist_note"
                                        placeholder="Reason..."
                                        className="min-h-[60px] w-full rounded-md border border-rose-200 bg-white px-2 py-1.5 text-xs focus:ring-1 focus:ring-rose-500 outline-none"
                                        value={formData.blacklist_note}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-6 border-t space-y-4 text-sm">
                        <h4 className="font-bold text-slate-700 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Compensation & Benefits
                        </h4>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Salary (฿/M)</Label>
                                <Input id="gross_salary_base_b_mth" placeholder="0" value={formData.gross_salary_base_b_mth} onChange={handleChange} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Bonus (Months)</Label>
                                <Input id="bonus_mth" placeholder="0" value={formData.bonus_mth} onChange={handleChange} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Other Income</Label>
                                <Input id="other_income" placeholder="Allowances..." value={formData.other_income} onChange={handleChange} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Car (฿/M)</Label>
                                <Input id="car_allowance_b_mth" placeholder="0" value={formData.car_allowance_b_mth} onChange={handleChange} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Gas (฿/M)</Label>
                                <Input id="gasoline_b_mth" placeholder="0" value={formData.gasoline_b_mth} onChange={handleChange} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Phone (฿/M)</Label>
                                <Input id="phone_b_mth" placeholder="0" value={formData.phone_b_mth} onChange={handleChange} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">PFund (%)</Label>
                                <Input id="provident_fund_pct" placeholder="0" value={formData.provident_fund_pct} onChange={handleChange} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5" /> {/* Empty for grid alignment */}

                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Medical (฿/Yr)</Label>
                                <Input id="medical_b_annual" placeholder="0" value={formData.medical_b_annual} onChange={handleChange} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Medical (฿/M)</Label>
                                <Input id="medical_b_mth" placeholder="0" value={formData.medical_b_mth} onChange={handleChange} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5">Insurance</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-9 text-sm justify-start font-normal px-3 py-1 bg-white border-slate-200 truncate">
                                            {formData.insurance || "Select options..."}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-3" align="start">
                                        <div className="space-y-3">
                                            {["Self", "Immediate family", "Can Subscribe"].map((opt) => {
                                                const currentOptions = formData.insurance ? formData.insurance.split(',').map(s => s.trim()) : [];
                                                const isChecked = currentOptions.includes(opt);
                                                return (
                                                    <div key={opt} className="flex items-center space-x-2">
                                                        <Checkbox 
                                                            id={`ins-${opt}`} 
                                                            checked={isChecked}
                                                            onCheckedChange={(checked) => {
                                                                let newOptions;
                                                                if (checked) {
                                                                    newOptions = [...new Set([...currentOptions, opt])];
                                                                } else {
                                                                    newOptions = currentOptions.filter(o => o !== opt);
                                                                }
                                                                setFormData(prev => ({ ...prev, insurance: newOptions.join(', ') }));
                                                            }}
                                                        />
                                                        <label htmlFor={`ins-${opt}`} className="text-xs font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                                            {opt}
                                                        </label>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Housing / Expat</Label>
                                <Input id="housing_for_expat_b_mth" placeholder="Notes..." value={formData.housing_for_expat_b_mth} onChange={handleChange} className="h-9 text-sm" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Additional Benefits Pool (Other Benefits)</Label>
                            <textarea
                                id="others_benefit"
                                placeholder="Describe other benefits..."
                                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.others_benefit}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* Enhanced Profile Data (LinkedIn) */}
                    <div className="pt-6 border-t font-semibold px-0 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-purple-100 rounded-lg text-purple-600">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-slate-700">LinkedIn Enhanced Information</h4>
                                <p className="text-xs text-muted-foreground font-medium">Fields usually captured from LinkedIn scraping.</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-5">
                             <div className="space-y-1.5">
                                <Label htmlFor="about" className="text-xs font-bold text-slate-500">About Summary</Label>
                                <textarea
                                    id="about"
                                    placeholder="LinkedIn About Section..."
                                    className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={formData.about}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="education" className="text-xs font-bold text-slate-500">Education Summary</Label>
                                <textarea
                                    id="education"
                                    placeholder="Education details..."
                                    className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={formData.education}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="skills" className="text-xs font-bold text-slate-500">Skills</Label>
                                    <textarea
                                        id="skills"
                                        placeholder="List of skills..."
                                        className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        value={formData.skills}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="languages" className="text-xs font-bold text-slate-500">Languages</Label>
                                    <textarea
                                        id="languages"
                                        placeholder="Languages..."
                                        className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        value={formData.languages}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>

                {!hideFooter && (
                    <CardFooter className="flex justify-end gap-3 px-0 pb-0 border-t pt-6 mt-4">
                        {showCancel && (
                            <Button type="button" variant="ghost" onClick={onCancel} disabled={loading} className="font-bold text-slate-500">
                                Cancel
                            </Button>
                        )}
                        <Button type="submit" disabled={loading} className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 min-w-[140px]">
                            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Changes</>}
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </form>
    );
}
