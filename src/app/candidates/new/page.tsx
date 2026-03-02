"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, UserPlus, Briefcase, Mail, Phone, Globe, Check, ChevronsUpDown, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner"; // Assuming sonner is available as used in Edit page

export default function NewCandidatePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Master Data
    const [nationalities, setNationalities] = useState<string[]>([]);
    const [openNat, setOpenNat] = useState(false);

    // Form State
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
        // Compensation & Benefits (optional)
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
        const fetchNat = async () => {
            const { data } = await supabase.from('nationality').select('nationality').order('nationality');
            if (data) setNationalities((data as any).map((n: any) => n.nationality));
        };
        fetchNat();
    }, []);

    // Age Calculation Effect
    useEffect(() => {
        const currentYear = new Date().getFullYear();
        let calculatedAge = "";

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

        setFormData(prev => ({ ...prev, age: calculatedAge }));
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Create Candidate via API
            const res = await fetch('/api/candidates/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create candidate');

            const newId = data.candidate_id;

            // 2. Upload Photo (if selected)
            if (photoFile && newId) {
                try {
                    const fileExt = photoFile.name.split('.').pop();
                    const fileName = `${newId}-${Date.now()}.${fileExt}`;
                    const filePath = `${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('avatars')
                        .upload(filePath, photoFile);

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('avatars')
                        .getPublicUrl(filePath);

                    // Update Profile with Photo URL
                    await (supabase
                        .from('Candidate Profile' as any) as any)
                        .update({ photo: publicUrl })
                        .eq('candidate_id', newId);

                } catch (uploadErr) {
                    console.error("Failed to upload photo:", uploadErr);
                    // Don't stop flow, just warn
                    // toast.warning("Candidate created but photo upload failed.");
                }
            }

            // 3. Redirect
            router.push(`/candidates/${newId}/experiences/new`);

        } catch (error: any) {
            alert("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-10 px-4">
            <Button variant="ghost" className="gap-2 mb-6 text-muted-foreground" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" /> Back to List
            </Button>

            <form onSubmit={handleSubmit}>
                <Card className="border-none shadow-lg ring-1 ring-border">
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent rounded-t-xl border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
                                <UserPlus className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle>New Candidate Profile</CardTitle>
                                <CardDescription>Step 1: Basic Information & Skills</CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-8 pt-6">

                        {/* Avatar Selection */}
                        <div className="flex justify-center mb-6">
                            <div className="relative group">
                                <Avatar className="h-28 w-28 border-4 border-background shadow-lg ring-2 ring-border/50">
                                    <AvatarImage src={photoPreview} className="object-cover" />
                                    <AvatarFallback className="text-2xl font-bold bg-secondary text-primary">
                                        {formData.name ? formData.name.substring(0, 2).toUpperCase() : <UserPlus className="h-8 w-8 opacity-50" />}
                                    </AvatarFallback>
                                </Avatar>
                                <Label htmlFor="photo-upload" className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-lg">
                                    <Camera className="h-4 w-4" />
                                    <Input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                                </Label>
                            </div>
                        </div>

                        {/* Section 1: Identity */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Metric Identity</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                                    <Input id="name" placeholder="Full Name" required value={formData.name} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="gender">Gender</Label>
                                    <select
                                        id="gender"
                                        className="flex h-10 w-full rounded-md border border-input bg-secondary/20 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                                            <Button variant="outline" role="combobox" className="justify-between bg-background pl-3 font-normal w-full text-left bg-secondary/20">
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
                                    <Input id="linkedin" placeholder="https://linkedin.com/in/..." value={formData.linkedin} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Contact & Age */}
                        <div className="space-y-4 pt-4 border-t border-border/50">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact & Age Calculation</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" placeholder="example@mail.com" value={formData.email} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Mobile Phone</Label>
                                    <Input id="phone" placeholder="+66..." value={formData.phone} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                            </div>

                            {/* Age Logic */}
                            <div className="p-4 bg-secondary/10 rounded-lg space-y-4 border border-border/50">
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="age_type"
                                            className="accent-primary"
                                            checked={formData.age_input_type === 'dob'}
                                            onChange={() => setFormData(prev => ({ ...prev, age_input_type: 'dob', year_of_bachelor_education: '', date_of_birth: '' }))}
                                        />
                                        <span className="text-sm font-medium">Use Date of Birth</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="age_type"
                                            className="accent-primary"
                                            checked={formData.age_input_type === 'bachelor'}
                                            onChange={() => setFormData(prev => ({ ...prev, age_input_type: 'bachelor', year_of_bachelor_education: '', date_of_birth: '' }))}
                                        />
                                        <span className="text-sm font-medium">Use Bachelor Grad Year</span>
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                    {formData.age_input_type === 'dob' ? (
                                        <div className="space-y-2">
                                            <Label>Date of Birth</Label>
                                            <Input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} className="bg-background" />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label>Year of Bachelor Graduation</Label>
                                            <Input type="number" placeholder="YYYY (e.g. 2020)" value={formData.year_of_bachelor_education} onChange={(e) => setFormData({ ...formData, year_of_bachelor_education: e.target.value })} className="bg-background" />
                                            <p className="text-[10px] text-muted-foreground">Formula: Current Year - Grad Year + 22</p>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>Calculated Age</Label>
                                        <Input value={formData.age} readOnly className="bg-secondary/50 font-mono text-primary font-bold" placeholder="Auto-calculated" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Enhanced Info (Optional) */}
                        <div className="space-y-4 pt-4 border-t border-border/50">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Enhanced Profile (Optional)</h3>

                            <div className="space-y-2">
                                <Label htmlFor="skills">Skills</Label>
                                <textarea id="skills" className="flex min-h-[80px] w-full rounded-md border border-input bg-secondary/20 px-3 py-2 text-sm" placeholder="Java, Python, Leadership..." value={formData.skills} onChange={handleChange} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="education">Education Summary</Label>
                                    <textarea id="education" className="flex min-h-[80px] w-full rounded-md border border-input bg-secondary/20 px-3 py-2 text-sm" placeholder="Degree, University..." value={formData.education} onChange={handleChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="languages">Languages</Label>
                                    <textarea id="languages" className="flex min-h-[80px] w-full rounded-md border border-input bg-secondary/20 px-3 py-2 text-sm" placeholder="Thai (Native), English (Fluent)..." value={formData.languages} onChange={handleChange} />
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Compensation & Benefits (Optional) */}
                        <div className="space-y-4 pt-4 border-t border-border/50">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Compensation &amp; Benefits</h3>
                                <span className="text-xs text-muted-foreground">(optional)</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="gross_salary_base_b_mth" className="text-xs font-semibold">Gross Salary (B/mth)</Label>
                                    <Input id="gross_salary_base_b_mth" placeholder="e.g. 250000" value={formData.gross_salary_base_b_mth} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="other_income" className="text-xs font-semibold">Other Income</Label>
                                    <Input id="other_income" placeholder="e.g. 10000" value={formData.other_income} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="bonus_mth" className="text-xs font-semibold">Bonus (months)</Label>
                                    <Input id="bonus_mth" placeholder="e.g. 3" value={formData.bonus_mth} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="car_allowance_b_mth" className="text-xs font-semibold">Car Allowance (B/mth)</Label>
                                    <Input id="car_allowance_b_mth" placeholder="e.g. 15000" value={formData.car_allowance_b_mth} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="gasoline_b_mth" className="text-xs font-semibold">Gasoline (B/mth)</Label>
                                    <Input id="gasoline_b_mth" placeholder="e.g. 5000" value={formData.gasoline_b_mth} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="phone_b_mth" className="text-xs font-semibold">Phone Allowance (B/mth)</Label>
                                    <Input id="phone_b_mth" placeholder="e.g. 1500" value={formData.phone_b_mth} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="provident_fund_pct" className="text-xs font-semibold">Provident Fund (%)</Label>
                                    <Input id="provident_fund_pct" placeholder="e.g. 5%" value={formData.provident_fund_pct} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="medical_b_annual" className="text-xs font-semibold">Medical (B/annual)</Label>
                                    <Input id="medical_b_annual" placeholder="e.g. 30000" value={formData.medical_b_annual} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="medical_b_mth" className="text-xs font-semibold">Medical (B/mth)</Label>
                                    <Input id="medical_b_mth" placeholder="e.g. 2500" value={formData.medical_b_mth} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="insurance" className="text-xs font-semibold">Insurance</Label>
                                    <Input id="insurance" placeholder="e.g. Immediate family" value={formData.insurance} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="housing_for_expat_b_mth" className="text-xs font-semibold">Housing Expat (B/mth)</Label>
                                    <Input id="housing_for_expat_b_mth" placeholder="e.g. 50000" value={formData.housing_for_expat_b_mth} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="others_benefit" className="text-xs font-semibold">Others</Label>
                                    <Input id="others_benefit" placeholder="e.g. Company car" value={formData.others_benefit} onChange={handleChange} className="bg-secondary/20" />
                                </div>
                            </div>
                        </div>

                    </CardContent>

                    <CardFooter className="flex justify-between items-center bg-secondary/10 py-4 rounded-b-xl border-t">
                        <p className="text-xs text-muted-foreground hidden sm:block">ID Generated Automatically</p>
                        <Button type="submit" disabled={loading} className="gap-2 shadow-lg shadow-primary/20">
                            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save & Continue</>}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
