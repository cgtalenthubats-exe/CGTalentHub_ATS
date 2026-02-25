"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, User, Briefcase, Mail, Phone, Globe, Check, ChevronsUpDown, Camera, Loader2, FileText, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusSelect } from "@/components/ui/status-select";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
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
import { getStatuses } from "@/app/actions/candidate-filters";

export default function EditCandidatePage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    // Unwrap params
    const resolvedParams = use(params);
    const candidateId = resolvedParams.id;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    // Master Data
    const [nationalities, setNationalities] = useState<string[]>([]);
    const [openNat, setOpenNat] = useState(false);

    // Form State
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string>("");

    // Resume State
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [currentResumeUrl, setCurrentResumeUrl] = useState<string>("");
    const [isUploadingResume, setIsUploadingResume] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        candidate_status: "",
        email: "",
        phone: "", // mobile_phone in DB
        nationality: "",
        gender: "",
        linkedin: "",
        // Age Logic
        age_input_type: "dob",
        date_of_birth: "",
        year_of_bachelor_education: "",
        age: "",
        // Enhance Fields
        skills: "",
        education: "",
        languages: "",
        blacklist_note: ""
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Fetch Nationalities
                const { data: natData } = await supabase.from('nationality').select('nationality').order('nationality');
                if (natData) setNationalities((natData as any).map((n: any) => n.nationality));

                // 2. Fetch Statuses - Handled by StatusSelect now

                // 3. Fetch Candidate
                const res = await fetch(`/api/candidates/${candidateId}`);
                if (!res.ok) throw new Error("Failed to fetch candidate");
                const { data } = await res.json();

                // Map Data to Form
                setFormData({
                    name: data.name || "",
                    candidate_status: data.candidate_status || "New",
                    email: data.email || "",
                    phone: data.mobile_phone || "",
                    nationality: data.nationality || "",
                    gender: data.gender || "",
                    linkedin: data.linkedin || "",
                    age_input_type: "dob", // Default
                    date_of_birth: data.date_of_birth || "",
                    year_of_bachelor_education: data.year_of_bachelor_education || "",
                    age: data.age || "",
                    skills: data.other_skill || data.enhancement?.skills || "", // Try both
                    education: data.enhancement?.education_summary || "",
                    languages: data.language_skill || data.enhancement?.languages || "",
                    blacklist_note: data.blacklist_note || ""
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

    // Age Calculation Effect (Same as New Page)
    useEffect(() => {
        const currentYear = new Date().getFullYear();
        let calculatedAge = formData.age; // Keep existing if no change

        if (formData.age_input_type === 'dob' && formData.date_of_birth) {
            const birthYear = new Date(formData.date_of_birth).getFullYear();
            if (!isNaN(birthYear)) {
                calculatedAge = (currentYear - birthYear).toString();
            }
        } else if (formData.age_input_type === 'bachelor' && formData.year_of_bachelor_education) {
            const gradYear = parseInt(formData.year_of_bachelor_education);
            if (!isNaN(gradYear)) {
                calculatedAge = (currentYear - gradYear + 22).toString();
            }
        }

        if (calculatedAge !== formData.age) {
            setFormData(prev => ({ ...prev, age: calculatedAge }));
        }
    }, [formData.date_of_birth, formData.year_of_bachelor_education, formData.age_input_type]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

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

            // 1. Upload Photo if changed
            if (photoFile) {
                const fileExt = photoFile.name.split('.').pop();
                const fileName = `${candidateId}-${Date.now()}-photo.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, photoFile);
                if (uploadError) throw uploadError;
                const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
                photoUrl = data.publicUrl;
            }

            // 2. Upload Resume if changed
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

            // 3. Update Profile
            const updatePayload = {
                name: formData.name,
                candidate_status: formData.candidate_status,
                email: formData.email,
                mobile_phone: formData.phone,
                nationality: formData.nationality,
                gender: formData.gender,
                linkedin: formData.linkedin,
                date_of_birth: formData.date_of_birth,
                year_of_bachelor_education: formData.year_of_bachelor_education,
                age: formData.age,
                photo: photoUrl,
                resume_url: resumeUrl,
                blacklist_note: formData.blacklist_note
            };

            const res = await fetch(`/api/candidates/${candidateId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update candidate');

            toast.success("Candidate saved successfully");
            router.push(`/candidates/${candidateId}`);
            router.refresh();

        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setLoading(false);
            setIsUploadingResume(false);
        }
    };

    if (fetching) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <Button variant="ghost" className="gap-2 mb-6 text-muted-foreground" onClick={() => router.push(`/candidates/${candidateId}`)}>
                <ArrowLeft className="h-4 w-4" /> Cancel & Back
            </Button>

            <form onSubmit={handleSubmit}>
                <Card className="border-none shadow-xl ring-1 ring-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b pb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-100 rounded-lg text-indigo-600">
                                    <User className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle>Edit Candidate Profile</CardTitle>
                                    <CardDescription>Update status, resume, and personal details.</CardDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Label className="text-xs font-semibold uppercase text-slate-500 mr-2">Current Status</Label>
                                <StatusSelect
                                    value={formData.candidate_status}
                                    onChange={(v) => setFormData(prev => ({ ...prev, candidate_status: v }))}
                                    className="w-[200px] border-slate-200"
                                />
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-8 pt-8">

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Left Column: Photo & Resume */}
                            <div className="space-y-6">
                                {/* Photo */}
                                <div className="flex flex-col items-center p-4 border rounded-xl bg-slate-50/50">
                                    <div className="relative group mb-4">
                                        <Avatar className="h-32 w-32 border-4 border-white shadow-md">
                                            <AvatarImage src={photoPreview} className="object-cover" />
                                            <AvatarFallback className="text-3xl font-bold bg-indigo-100 text-indigo-600">
                                                {formData.name ? formData.name.substring(0, 2).toUpperCase() : "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <Label htmlFor="photo-upload" className="absolute bottom-0 right-0 p-2.5 bg-indigo-600 text-white rounded-full cursor-pointer hover:bg-indigo-700 transition-all shadow-lg ring-2 ring-white">
                                            <Camera className="h-4 w-4" />
                                            <Input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                                        </Label>
                                    </div>
                                    <p className="text-xs text-center text-slate-500">Allowed *.jpeg, *.jpg, *.png, *.webp</p>
                                </div>

                                {/* Resume */}
                                <div className="space-y-3 p-4 border rounded-xl bg-slate-50/50">
                                    <Label className="text-sm font-semibold flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-slate-500" /> Resume / CV
                                    </Label>

                                    {currentResumeUrl && !resumeFile && (
                                        <div className="flex items-center justify-between p-3 bg-white border rounded-md text-sm">
                                            <a href={currentResumeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[150px]">
                                                View Current
                                            </a>
                                            <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentResumeUrl("")} className="h-auto p-1 text-red-500">
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    )}

                                    {(!currentResumeUrl || resumeFile) && (
                                        <div className="relative">
                                            <Input type="file" accept=".pdf" onChange={handleResumeSelect} className="cursor-pointer file:text-indigo-600 file:font-semibold" />
                                            {resumeFile && (
                                                <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Selected: {resumeFile.name}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column: Form Fields */}
                            <div className="md:col-span-2 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                                        <Input id="name" placeholder="Full Name" required value={formData.name} onChange={handleChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="gender">Gender</Label>
                                        <select
                                            id="gender"
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2 flex flex-col">
                                        <Label>Nationality</Label>
                                        <Popover open={openNat} onOpenChange={setOpenNat}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" className="justify-between pl-3 font-normal w-full text-left">
                                                    {formData.nationality || "Select nationality..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="p-0 w-[300px]" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search..." />
                                                    <CommandList>
                                                        <CommandEmpty>No nationality found.</CommandEmpty>
                                                        <CommandGroup className="max-h-[300px] overflow-y-auto">
                                                            {nationalities.map((nat) => (
                                                                <CommandItem key={nat} value={nat} onSelect={(v) => { setFormData(prev => ({ ...prev, nationality: nat })); setOpenNat(false); }}>
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
                                    <div className="space-y-2">
                                        <Label htmlFor="linkedin">LinkedIn URL</Label>
                                        <Input id="linkedin" value={formData.linkedin} onChange={handleChange} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" type="email" value={formData.email} onChange={handleChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Mobile Phone</Label>
                                        <Input id="phone" value={formData.phone} onChange={handleChange} />
                                    </div>
                                </div>

                                {/* Age Section */}
                                <div className="p-4 bg-slate-50 rounded-xl border space-y-4">
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="age_type" className="accent-indigo-600"
                                                checked={formData.age_input_type === 'dob'}
                                                onChange={() => setFormData(prev => ({ ...prev, age_input_type: 'dob' }))}
                                            />
                                            <span className="text-sm font-medium">Use DOB</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="age_type" className="accent-indigo-600"
                                                checked={formData.age_input_type === 'bachelor'}
                                                onChange={() => setFormData(prev => ({ ...prev, age_input_type: 'bachelor' }))}
                                            />
                                            <span className="text-sm font-medium">Use Bachelor Year</span>
                                        </label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        {formData.age_input_type === 'dob' ? (
                                            <div className="space-y-1">
                                                <Label className="text-xs">Date of Birth</Label>
                                                <Input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} className="bg-white" />
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <Label className="text-xs">Grad Year</Label>
                                                <Input type="number" placeholder="YYYY" value={formData.year_of_bachelor_education} onChange={(e) => setFormData({ ...formData, year_of_bachelor_education: e.target.value })} className="bg-white" />
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <Label className="text-xs">Age</Label>
                                            <Input value={formData.age} readOnly className="bg-slate-100 font-bold text-slate-700" />
                                        </div>
                                    </div>
                                </div>

                                {/* Blacklist Reason */}
                                {formData.candidate_status === "Blacklist" && (
                                    <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 space-y-2 animate-in slide-in-from-top-2">
                                        <Label htmlFor="blacklist_note" className="text-rose-700 font-bold flex items-center gap-2">
                                            <X className="h-4 w-4" /> Blacklist Reason (Required)
                                        </Label>
                                        <textarea
                                            id="blacklist_note"
                                            placeholder="Please describe why this candidate is blacklisted..."
                                            className="min-h-[100px] w-full rounded-md border border-rose-200 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={formData.blacklist_note}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                    </CardContent>

                    <CardFooter className="flex justify-between items-center bg-slate-50/50 py-4 rounded-b-xl border-t">
                        <p className="text-xs text-muted-foreground"></p>
                        <Button type="submit" disabled={loading} className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200">
                            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Changes</>}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
