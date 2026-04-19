"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
    ArrowLeft, Save, UserPlus, Briefcase, Mail, Phone, Globe, Check, 
    ChevronsUpDown, Camera, Loader2, Sparkles, Trash2, Plus, Info,
    UploadCloud, CheckCircle, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { getUserProfiles, type UserProfile } from "@/app/actions/user-actions";
import { getN8nConfigs } from "@/app/actions/admin-actions";
import { toast } from "@/lib/notifications";
import { getEffectiveAge, extractYear, calculateBachelorYearFromAge } from "@/lib/date-utils";
import { checkCandidateDuplicate } from "@/app/actions/candidate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ExternalLink } from "lucide-react";
import { getCheckedStatus } from "@/lib/candidate-utils";

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

export default function NewCandidatePage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-slate-400" /></div>}>
            <CandidateForm />
        </Suspense>
    );
}

function CandidateForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [aiRawText, setAiRawText] = useState("");
    const [duplicateCandidate, setDuplicateCandidate] = useState<any>(null);
    const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
    const [manualSyncUrl, setManualSyncUrl] = useState<string | null>(null);

    // Master Data
    const [nationalities, setNationalities] = useState<string[]>([]);
    const [openNat, setOpenNat] = useState(false);
    const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [positions, setPositions] = useState<string[]>([]);
    const [countries, setCountries] = useState<string[]>([]);
    const [industryGroups, setIndustryGroups] = useState<any[]>([]);

    // Form State (Profile)
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string>("");
    const [formData, setFormData] = useState({
        name: "",
        email: "",
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
        others_benefit: "",
        createdBy: ""
    });

    // Form State (Experiences)
    const [experiences, setExperiences] = useState<ExperienceData[]>([]);

    const uniqueIndustries = Array.from(new Set(industryGroups.map(i => i.industry)));
    const uniqueGroups = Array.from(new Set(industryGroups.map(i => i.group)));

    useEffect(() => {
        const fetchMasterData = async () => {
            // 1. Nationalities
            const { data: nats } = await supabase.from('nationality').select('nationality').order('nationality');
            if (nats) setNationalities((nats as any).map((n: any) => n.nationality));

            // 2. User Profiles
            const res = await getUserProfiles();
            if (res.success && res.data) {
                setUserProfiles(res.data);
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const profile = res.data.find(u => u.email.toLowerCase() === user.email?.toLowerCase());
                    if (profile) setFormData(prev => ({ ...prev, createdBy: profile.real_name }));
                }
            }

            // 3. Companies
            const { data: compData } = await supabase.from('company_master').select('company_master, industry, group').order('company_master');
            if (compData) {
                const uniqueMap = new Map();
                (compData as any).forEach((c: any) => {
                    const name = c.company_master;
                    if (name && !uniqueMap.has(name)) {
                        uniqueMap.set(name, { company_name: name, industry: c.industry, group: c.group });
                    }
                });
                setCompanies(Array.from(uniqueMap.values()));
            }

            // 4. Positions (from existing experiences)
            const { data: posData } = await supabase.from('candidate_experiences').select('position').not('position', 'is', null).limit(1000);
            if (posData) {
                const unique = Array.from(new Set((posData as any).map((p: any) => p.position).filter(Boolean)));
                setPositions(unique.sort() as string[]);
            }

            // 5. Countries
            const { data: cData } = await supabase.from('country').select('country').order('country');
            if (cData) setCountries((cData as any).map((c: any) => c.country).filter(Boolean));

            // 6. Industry Groups
            const { data: indData } = await supabase.from('industry_group').select('industry, group').order('industry');
            if (indData) setIndustryGroups(indData as any);

            // 7. n8n Configs (Manual Sync)
            const n8nConfigs = await getN8nConfigs();
            const syncConfig = n8nConfigs.find(c => c.name === 'Manual Sync');
            if (syncConfig?.url && syncConfig.url !== 'N/A') {
                setManualSyncUrl(syncConfig.url);
            }
        };
        fetchMasterData();
    }, []);

    // Immediate Duplicate Check Logic
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (formData.name.length > 2 || formData.linkedin.length > 5) {
                const existing = await checkCandidateDuplicate(formData.name, formData.email, formData.linkedin);
                setDuplicateCandidate(existing);
            } else {
                setDuplicateCandidate(null);
            }
        }, 1000); // 1s debounce

        return () => clearTimeout(timer);
    }, [formData.name, formData.email, formData.linkedin]);

    // Age / Date Calculation Effects
    useEffect(() => {
        if (formData.age_input_type === 'manual') return;
        const calculatedAge = getEffectiveAge(
            formData.age_input_type === 'dob' ? formData.date_of_birth : null,
            formData.age_input_type === 'bachelor' ? formData.year_of_bachelor_education : null
        );
        setFormData(prev => ({ ...prev, age: calculatedAge }));
    }, [formData.date_of_birth, formData.year_of_bachelor_education, formData.age_input_type]);

    useEffect(() => {
        if (formData.age_input_type === 'manual' && formData.age) {
            const bachYear = calculateBachelorYearFromAge(formData.age);
            if (bachYear) setFormData(prev => ({ ...prev, year_of_bachelor_education: bachYear.toString() }));
        }
    }, [formData.age, formData.age_input_type]);

    // AI Parsing Logic
    const handleAiParse = async () => {
        if (!aiRawText.trim()) return;
        setIsParsing(true);
        try {
            const res = await fetch("/api/ai/parse-candidate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: aiRawText })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "AI Parsing failed");
            }

            // Helper to format date strings to MM/YYYY and handle year-only
            const formatToMMYYYY = (dateStr: string | null) => {
                if (!dateStr) return "";
                const clean = dateStr.trim();
                // If it's just a 4-digit year (e.g. "2002")
                if (/^\d{4}$/.test(clean)) return `01/${clean}`;
                // If it's YYYY-MM (from standard range or some AI outputs)
                if (/^\d{4}-\d{2}$/.test(clean)) {
                    const [y, m] = clean.split("-");
                    return `${m}/${y}`;
                }
                // If it's MM-YYYY or other, try to normalize
                return clean;
            };

            // Populate Profile
            if (data.profile) {
                setFormData(prev => ({
                    ...prev,
                    name: data.profile.name || prev.name,
                    gender: data.profile.gender || prev.gender,
                    email: data.profile.email || prev.email,
                    phone: data.profile.mobile_phone || prev.phone,
                    nationality: data.profile.nationality || prev.nationality,
                    linkedin: data.profile.linkedin || prev.linkedin,
                    date_of_birth: data.profile.date_of_birth || prev.date_of_birth,
                    year_of_bachelor_education: data.profile.year_of_bachelor_education?.toString() || prev.year_of_bachelor_education,
                    // Benefits
                    gross_salary_base_b_mth: formatNumberWithCommas(data.profile.compensation?.gross_salary_base_b_mth) || prev.gross_salary_base_b_mth,
                    car_allowance_b_mth: formatNumberWithCommas(data.profile.compensation?.car_allowance_b_mth) || prev.car_allowance_b_mth,
                    gasoline_b_mth: formatNumberWithCommas(data.profile.compensation?.gasoline_b_mth) || prev.gasoline_b_mth,
                    phone_b_mth: formatNumberWithCommas(data.profile.compensation?.phone_b_mth) || prev.phone_b_mth,
                    other_income: data.profile.compensation?.other_income || prev.other_income,
                    bonus_mth: data.profile.compensation?.bonus_mth || prev.bonus_mth,
                    provident_fund_pct: data.profile.compensation?.provident_fund_pct || prev.provident_fund_pct,
                }));
            }

            // Populate Enhance
            if (data.enhance) {
                setFormData(prev => ({
                    ...prev,
                    skills: data.enhance.skills_list || prev.skills,
                    education: data.enhance.education_summary || prev.education,
                    languages: data.enhance.languages || prev.languages,
                }));
            }

            // Populate Experiences
            if (data.experiences && Array.isArray(data.experiences)) {
                const parsedExps: ExperienceData[] = data.experiences.map((exp: any, idx: number) => ({
                    tempId: Date.now() + idx,
                    position: exp.position || "",
                    company: exp.company || "",
                    company_industry: exp.company_industry || "",
                    company_group: exp.company_group || "",
                    work_location: exp.work_location || "",
                    start_date: formatToMMYYYY(exp.start_date),
                    end_date: exp.end_date === "Present" ? "" : formatToMMYYYY(exp.end_date),
                    is_current: exp.is_current || false
                }));
                // Sort: is_current first, then desc start_date
                parsedExps.sort((a, b) => {
                    if (a.is_current && !b.is_current) return -1;
                    if (!a.is_current && b.is_current) return 1;
                    // For string comparison of MM/YYYY, need to convert to YYYYMM
                    const scoreA = a.start_date.split("/").reverse().join("");
                    const scoreB = b.start_date.split("/").reverse().join("");
                    return scoreB.localeCompare(scoreA);
                });
                setExperiences(parsedExps);
            }

            toast.success("AI extraction completed! Please review the data.");
            setAiRawText(""); // Clear text after successful parse
            
            // Immediate duplicate check after parse
            const existing = await checkCandidateDuplicate(
                data.profile?.name || formData.name, 
                data.profile?.email || formData.email, 
                data.profile?.linkedin || formData.linkedin
            );
            setDuplicateCandidate(existing);

        } catch (error: any) {
            console.error("AI Parse Error:", error);
            toast.error("Failed to parse text. Please check the AI configuration or your connection.");
        } finally {
            setIsParsing(false);
        }
    };

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handlePhotoDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingPhoto(true);
    };

    const handlePhotoDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingPhoto(false);
    };

    const handlePhotoDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingPhoto(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                setPhotoFile(file);
                setPhotoPreview(URL.createObjectURL(file));
                toast.success("Photo added!");
            } else {
                toast.error("Please upload an image file");
            }
        }
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        const salaryFields = ["gross_salary_base_b_mth", "car_allowance_b_mth", "gasoline_b_mth", "phone_b_mth"];
        if (salaryFields.includes(id)) {
            setFormData(prev => ({ ...prev, [id]: formatNumberWithCommas(parseNumberFromCommas(value)) }));
            return;
        }
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const addExperience = () => {
        setExperiences(prev => [
            ...prev,
            { tempId: Date.now(), position: "", company: "", company_industry: "", company_group: "", work_location: "", start_date: "", end_date: "", is_current: false }
        ]);
    };

    const deleteExperience = (tempId: number) => {
        setExperiences(prev => prev.filter(e => e.tempId !== tempId));
    };

    const updateExperience = (tempId: number, field: keyof ExperienceData, value: any) => {
        setExperiences(prev => prev.map(e => e.tempId === tempId ? { ...e, [field]: value } : e));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const submissionData = {
                ...formData,
                gross_salary_base_b_mth: parseNumberFromCommas(formData.gross_salary_base_b_mth) || null,
                car_allowance_b_mth: parseNumberFromCommas(formData.car_allowance_b_mth) || null,
                gasoline_b_mth: parseNumberFromCommas(formData.gasoline_b_mth) || null,
                phone_b_mth: parseNumberFromCommas(formData.phone_b_mth) || null,
                experiences: experiences.filter(exp => exp.company && exp.position)
            };

            const res = await fetch('/api/candidates/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionData)
            });

            const data = await res.json();
            if (res.status === 409) {
                toast.error(`Duplicate Found: This candidate already exists as ${data.duplicate?.candidate_id}`);
                setLoading(false);
                return;
            }
            if (!res.ok) throw new Error(data.error || 'Failed to create candidate');

            const newId = data.candidate_id;

            
            // Photo upload logic (omitted for brevity but same as before)
            if (photoFile && newId) {
                const fileExt = photoFile.name.split('.').pop();
                const fileName = `${newId}-${Date.now()}.${fileExt}`;
                await supabase.storage.from('avatars').upload(fileName, photoFile);
                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
                await (supabase.from('Candidate Profile') as any).update({ photo: publicUrl }).eq('candidate_id', newId);
            }

            // Trigger Manual Sync n8n Workflow (Fire and forget)
            if (manualSyncUrl) {
                console.log("Triggering n8n Manual Sync:", manualSyncUrl);
                fetch(manualSyncUrl, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ }) // Empty payload as requested
                }).catch(err => console.error("n8n Sync Error:", err));
            }

            toast.success("Candidate profile created successfully");
            router.push(`/candidates/${newId}`);
        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
            <div className="flex items-center justify-between">
                <Button variant="ghost" className="gap-2 text-muted-foreground" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" /> Back to List
                </Button>
                <div className="text-right">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">New Candidate</h1>
                    <p className="text-sm text-muted-foreground">Unified creation with AI assistance</p>
                </div>
            </div>

            {/* AI Assistant Card */}
            <Card className="border-indigo-100 bg-indigo-50/10 shadow-sm">
                <CardHeader className="pb-3 border-b border-indigo-100 bg-indigo-50/30">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-600 rounded-md text-white">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <CardTitle className="text-lg font-bold text-indigo-900">AI Input Assistant</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                            Paste LinkedIn Profile or Resume Content
                            <Info className="w-3.5 h-3.5 text-slate-400" />
                        </Label>
                        <Textarea 
                            placeholder="Paste text here... (e.g. John Doe, Senior Manager at Google, graduated from Harvard 2015...)"
                            className="min-h-[140px] bg-white border-indigo-100 focus:ring-indigo-500 text-sm leading-relaxed"
                            value={aiRawText}
                            onChange={(e) => setAiRawText(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-3 bg-white/50 p-3 rounded-lg border border-dashed border-indigo-200">
                        <div className="space-y-1.5">
                            <p className="text-xs text-slate-500">
                                AI will extract names, contacts, salary, and sorted work experiences. 
                                <span className="font-bold text-indigo-600 ml-1">No data will be saved until you click "Create Candidate Profile" at the bottom.</span>
                            </p>
                            <div className="flex flex-col gap-1">
                                <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                                    ⚠️ การกด Parse ซ้ำจะเขียนทับข้อมูลฟิลด์ที่เคยกรอกไว้ และ "ล้างรายการประวัติเดิม" ทั้งหมด
                                </p>
                                <p className="text-[10px] text-indigo-500 flex items-center gap-1">
                                    💡 หากระบุแค่ปีที่ทำงาน (เช่น 2002) ระบบจะลงวันเริ่มต้นเป็น 01/2002 ให้โดยอัตโนมัติ
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button 
                                type="button"
                                onClick={handleAiParse} 
                                disabled={!aiRawText.trim() || isParsing}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px] shadow-sm shadow-indigo-200"
                            >
                                {isParsing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Run AI Parsing
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Profile Information */}
                <Card className="border-slate-200 shadow-lg ring-1 ring-slate-100">
                    <CardHeader className="bg-slate-50 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-slate-200 rounded-lg text-slate-600 border border-slate-300 shadow-sm">
                                <UserPlus className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">Candidate Details</CardTitle>
                                <CardDescription>Basic information and contact details</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-8 pt-8">
                        {/* Review & Edit Section */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <UserPlus className="w-5 h-5 text-slate-400" />
                                <h2 className="text-xl font-bold text-slate-800">Review & Edit Candidate Details</h2>
                            </div>

                            {duplicateCandidate && (
                                <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-900 animate-in fade-in slide-in-from-top-2">
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                    <AlertTitle className="text-amber-800 font-bold">⚠️ Duplicate Candidate Found!</AlertTitle>
                                    <AlertDescription className="text-amber-700 flex items-center justify-between">
                                        <span>
                                            A candidate with this name or LinkedIn already exists in the system as 
                                            <strong> {duplicateCandidate.candidate_id}</strong>.
                                        </span>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="ml-4 h-7 text-[10px] bg-white border-amber-300 hover:bg-amber-100 text-amber-800"
                                            onClick={() => window.open(`/candidates/${duplicateCandidate.candidate_id}`, '_blank')}
                                        >
                                            <ExternalLink className="w-3 h-3 mr-1" /> View Existing
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                            {/* Left Column: Photo Drop Zone */}
                            <div className="space-y-6">
                                <div 
                                    className={cn(
                                        "flex flex-col items-center p-6 border-2 rounded-2xl transition-all duration-300 cursor-pointer group relative overflow-hidden",
                                        isDraggingPhoto 
                                            ? "border-indigo-500 bg-indigo-50/50 scale-[1.02] shadow-indigo-100 shadow-xl" 
                                            : "border-dashed border-slate-200 bg-slate-50/50 shadow-sm hover:border-slate-300 hover:bg-slate-100/50"
                                    )}
                                    onDragOver={handlePhotoDragOver}
                                    onDragLeave={handlePhotoDragLeave}
                                    onDrop={handlePhotoDrop}
                                    onClick={() => document.getElementById('photo-upload')?.click()}
                                >
                                    {isDraggingPhoto && (
                                        <div className="absolute inset-0 bg-indigo-600/10 flex items-center justify-center animate-pulse z-10">
                                            <UploadCloud className="w-12 h-12 text-indigo-600 animate-bounce" />
                                        </div>
                                    )}
                                    <div className="relative mb-6">
                                        <Avatar className={cn(
                                            "h-32 w-32 border-4 border-white shadow-xl ring-1 ring-slate-200 transition-all duration-300",
                                            isDraggingPhoto ? "scale-110 rotate-3" : "group-hover:scale-105"
                                        )}>
                                            <AvatarImage src={photoPreview} className="object-cover" />
                                            <AvatarFallback className="text-4xl font-black bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
                                                {formData.name ? formData.name.substring(0, 2).toUpperCase() : <UserPlus className="w-10 h-10 opacity-30" />}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-1 -right-1 p-2.5 bg-indigo-600 text-white rounded-full shadow-lg ring-4 ring-white group-hover:bg-indigo-700 transition-colors">
                                            <Camera className="w-4 h-4" />
                                        </div>
                                        <Input 
                                            id="photo-upload" 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={handlePhotoSelect} 
                                        />
                                    </div>
                                    <div className="text-center space-y-1.5">
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">
                                            {isDraggingPhoto ? "Release to Upload" : "Click or Drag Photo"}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium">JPEG, PNG, WEBP (Max 5MB)</p>
                                    </div>
                                </div>

                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/60 shadow-inner space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Profile Owner</Label>
                                        <select
                                            className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                                            value={formData.createdBy}
                                            onChange={(e) => setFormData(prev => ({ ...prev, createdBy: e.target.value }))}
                                        >
                                            <option value="">Select Auditor...</option>
                                            {userProfiles.map((u, idx) => (
                                                <option key={idx} value={u.real_name}>{u.real_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Nationality</Label>
                                        <select 
                                            id="nationality"
                                            className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                                            value={formData.nationality}
                                            onChange={(e) => setFormData(prev => ({ ...prev, nationality: e.target.value }))}
                                        >
                                            <option value="">Select Nationality...</option>
                                            {nationalities.map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Form Fields */}
                            <div className="md:col-span-2 space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="font-bold text-slate-700">Full Name <span className="text-red-500">*</span></Label>
                                    <Input id="name" placeholder="Candidate Full Name" required value={formData.name} onChange={handleFormChange} className="h-11 text-lg border-slate-300 focus:ring-indigo-500 rounded-xl shadow-sm" />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="gender" className="font-bold text-slate-700">Gender</Label>
                                        <select 
                                            id="gender" 
                                            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-medium transition-all focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500" 
                                            value={formData.gender} 
                                            onChange={(e) => setFormData({...formData, gender: e.target.value})}
                                        >
                                            <option value="">Select...</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="age" className="font-bold text-slate-700">Age</Label>
                                        <Input id="age" value={formData.age} readOnly className="h-11 bg-slate-50 border-slate-200 font-mono font-black text-indigo-600 rounded-xl" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                                     <div className="space-y-2">
                                        <Label htmlFor="email" className="font-bold text-slate-700 flex items-center gap-2">
                                            <Mail className="w-3.5 h-3.5 text-slate-400" /> Email
                                        </Label>
                                        <Input id="email" type="email" placeholder="email@example.com" value={formData.email} onChange={handleFormChange} className="h-11 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone" className="font-bold text-slate-700 flex items-center gap-2">
                                            <Phone className="w-3.5 h-3.5 text-slate-400" /> Mobile Phone
                                        </Label>
                                        <Input id="phone" placeholder="+66..." value={formData.phone} onChange={handleFormChange} className="h-11 rounded-xl" />
                                    </div>
                                </div>

                                <div className="space-y-2 pt-4 border-t border-slate-100">
                                     <div className="flex items-center justify-between">
                                         <Label htmlFor="linkedin" className="font-bold flex items-center gap-2 text-indigo-700">
                                            <Globe className="w-4 h-4" /> LinkedIn URL
                                         </Label>
                                         <div className={cn(
                                             "text-[10px] font-black uppercase tracking-tighter px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm",
                                             formData.linkedin ? (formData.linkedin.toLowerCase().includes('linkedin') ? "bg-green-50 text-green-700 border border-green-200" : "bg-blue-50 text-blue-700 border border-blue-200") : "bg-slate-50 text-slate-500 border border-slate-200"
                                         )}>
                                             {formData.linkedin ? (
                                                 formData.linkedin.toLowerCase().includes('linkedin') ? <CheckCircle className="w-2.5 h-2.5" /> : <Info className="w-2.5 h-2.5" />
                                             ) : <XCircle className="w-2.5 h-2.5" />}
                                             {getCheckedStatus(formData.linkedin)}
                                         </div>
                                     </div>
                                     <Input id="linkedin" placeholder="https://linkedin.com/in/..." value={formData.linkedin} onChange={handleFormChange} className="h-11 border-indigo-200 focus:ring-indigo-500 rounded-xl" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                                     <div className="space-y-2">
                                        <Label htmlFor="skills" className="font-bold text-slate-700">Skills</Label>
                                        <Textarea id="skills" value={formData.skills} onChange={handleFormChange} rows={3} className="bg-slate-50/50 rounded-xl focus:bg-white transition-all" placeholder="Key skills e.g. React, Node.js..." />
                                     </div>
                                     <div className="space-y-2">
                                        <Label htmlFor="education" className="font-bold text-slate-700">Education</Label>
                                        <Textarea id="education" value={formData.education} onChange={handleFormChange} rows={3} className="bg-slate-50/50 rounded-xl focus:bg-white transition-all" placeholder="Education background..." />
                                     </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Work Experiences Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-slate-800 rounded-md text-white">
                                <Briefcase className="w-4 h-4" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Work Experiences</h2>
                        </div>
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={addExperience}
                            className="text-xs h-8 border-dashed hover:bg-slate-50"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add Job
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {experiences.length === 0 ? (
                            <div className="py-12 border-2 border-dashed rounded-xl bg-slate-50/50 flex flex-col items-center justify-center text-slate-400 gap-2">
                                <Briefcase className="w-8 h-8 opacity-20" />
                                <p className="text-sm">No experiences added. Use AI parsing or add manually.</p>
                                <Button type="button" variant="link" size="sm" onClick={addExperience}>+ Add First Job</Button>
                            </div>
                        ) : (
                            experiences.map((exp, index) => (
                                <Card key={exp.tempId} className="border-slate-200 relative overflow-visible shadow-sm hover:border-slate-300 transition-colors">
                                    <div className="absolute top-2 right-2">
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-slate-300 hover:text-red-500 transition-colors"
                                            onClick={() => deleteExperience(exp.tempId)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div className="absolute top-4 -left-3">
                                        <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold shadow-md">
                                            {index + 1}
                                        </div>
                                    </div>
                                    <CardContent className="p-5 pt-8 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold uppercase text-slate-400">Position</Label>
                                                <Input 
                                                    value={exp.position} 
                                                    onChange={(e) => updateExperience(exp.tempId, 'position', e.target.value)}
                                                    placeholder="Role Title"
                                                    className="h-9 font-semibold"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold uppercase text-slate-400">Company</Label>
                                                <Input 
                                                    value={exp.company} 
                                                    onChange={(e) => updateExperience(exp.tempId, 'company', e.target.value)}
                                                    placeholder="Enterprise Name"
                                                    className="h-9 font-semibold"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                             <div className="space-y-1.5">
                                                <Label className="text-xs font-bold uppercase text-slate-400">Work Location</Label>
                                                <Input 
                                                    value={exp.work_location} 
                                                    onChange={(e) => updateExperience(exp.tempId, 'work_location', e.target.value)}
                                                    className="h-8 bg-slate-50/50"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold uppercase text-slate-400">Start Date</Label>
                                                <Input 
                                                    placeholder="MM/YYYY"
                                                    value={exp.start_date} 
                                                    onChange={(e) => {
                                                        let val = e.target.value.replace(/\D/g, "");
                                                        if (val.length > 6) val = val.slice(0, 6);
                                                        if (val.length > 2) {
                                                            val = val.slice(0, 2) + "/" + val.slice(2);
                                                        }
                                                        updateExperience(exp.tempId, 'start_date', val);
                                                    }}
                                                    className="h-8 bg-slate-50/50 font-mono text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold uppercase text-slate-400">End Date</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        placeholder="MM/YYYY"
                                                        value={exp.end_date} 
                                                        disabled={exp.is_current}
                                                        onChange={(e) => {
                                                            let val = e.target.value.replace(/\D/g, "");
                                                            if (val.length > 6) val = val.slice(0, 6);
                                                            if (val.length > 2) {
                                                                val = val.slice(0, 2) + "/" + val.slice(2);
                                                            }
                                                            updateExperience(exp.tempId, 'end_date', val);
                                                        }}
                                                        className="h-8 flex-1 bg-slate-50/50 font-mono text-xs"
                                                    />
                                                    <div className="flex items-center gap-1.5 ml-2">
                                                        <Checkbox 
                                                            id={`current-${exp.tempId}`} 
                                                            checked={exp.is_current}
                                                            onCheckedChange={(val) => updateExperience(exp.tempId, 'is_current', !!val)}
                                                        />
                                                        <Label htmlFor={`current-${exp.tempId}`} className="text-[10px] whitespace-nowrap cursor-pointer">Current</Label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>

                {/* Final Actions */}
                <div className="flex items-center justify-between pt-10 border-t">
                    <p className="text-xs text-slate-400">
                        * Required fields must be filled before saving.
                    </p>
                    <div className="flex items-center gap-3">
                        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
                        <Button 
                            type="submit" 
                            disabled={loading || !formData.name}
                            className="bg-slate-900 text-white hover:bg-black min-w-[200px] h-11 text-base font-bold shadow-xl shadow-slate-200"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating Profile...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Create Candidate Profile
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
