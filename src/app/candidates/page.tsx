"use client";

import React, { useEffect, useState } from "react";
import {
    Users,
    Search,
    Plus,
    Upload,
    FileText,
    TableProperties,
    Database as DatabaseIcon,
    PenTool,
    UploadCloud,
    CheckCircle,
    AlertCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";

// MenuItem Component
function MenuCard({
    title,
    icon: Icon,
    color,
    onClick,
    description
}: {
    title: string;
    icon: any;
    color: string;
    onClick?: () => void;
    description?: string;
}) {
    return (
        <Card
            onClick={onClick}
            className="group relative cursor-pointer hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 border-none ring-1 ring-border bg-gradient-to-br from-card to-card/50"
        >
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <div className={`p-4 rounded-2xl ${color} bg-opacity-10 group-hover:scale-110 transition-transform duration-300 ring-1 ring-black/5`}>
                    <Icon className={`h-8 w-8 ${color.replace('bg-', 'text-')}`} />
                </div>
                <div className="space-y-1">
                    <h3 className="font-bold text-base">{title}</h3>
                    {description && <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>}
                </div>
                <div className="absolute inset-0 rounded-xl ring-2 ring-primary/0 group-hover:ring-primary/10 transition-all pointer-events-none" />
            </CardContent>
        </Card>
    );
}

export default function CandidatesMenuPage() {
    const [candidateCount, setCandidateCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [errorDetails, setErrorDetails] = useState<string | null>(null);

    // Manual Form State
    const [isOpenManual, setIsOpenManual] = useState(false);
    const [isOpenResume, setIsOpenResume] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        name: "",
        position: "",
        email: "",
        phone: "",
        notes: ""
    });

    async function checkConnection() {
        try {
            // Use "Candidate Profile" as verified by debug script
            let { count, error } = await supabase
                .from('Candidate Profile')
                .select('*', { count: 'exact', head: true });

            if (error) {
                console.warn("Table access error:", error);
                setErrorDetails(error.message);
            } else {
                setCandidateCount(count || 0);
                setErrorDetails(null);
            }
        } catch (err: any) {
            setErrorDetails(err.message);
        } finally {
            setLoading(false);
        }
    }

    // Fetch Logic
    useEffect(() => {
        checkConnection();
    }, []);

    const handleManualSubmit = async () => {
        setSaving(true);
        try {
            const { error } = await supabase.from('Candidate Profile').insert([
                {
                    "Name": formData.name, // Assuming columns might also be Title Case based on table naming style
                    "Email": formData.email,
                    "Mobile_phone": formData.phone,
                    // Add other fields as per schema if they exist, or map loosely for now
                    // If strictly mapped, check schema. For now, try common variations or minimal insert
                }
            ]);

            if (error) {
                // Fallback: Try lowercase keys if Title Case keys fail. 
                // We really should know the column names. 
                // Based on "Candidate Profile", let's assume "Name", "Email" (as seen in screenshot `uploaded_media_1769814534416.png`)
                // Screenshot shows: CandidateID, Name, Age, Gender, Nationality... 
                // So "Name" is correct.
                throw error;
            }

            setIsOpenManual(false);
            setFormData({ name: "", position: "", email: "", phone: "", notes: "" });
            checkConnection(); // Refresh count
            alert("Candidate saved successfully!");
        } catch (err: any) {
            alert("Error saving: " + err.message);
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 max-w-6xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight">Candidate Central</h1>
                <p className="text-muted-foreground">Manage intake, screening, and database operations.</p>

                {/* Connection Status Alert */}
                <div className="flex items-center gap-3 mt-2 text-xs font-medium">
                    <span className="text-muted-foreground">Database Status:</span>
                    {loading ? (
                        <span className="text-yellow-500 animate-pulse">Checking...</span>
                    ) : errorDetails ? (
                        <span className="text-destructive font-bold flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" /> Offline ({errorDetails})
                        </span>
                    ) : (
                        <span className="text-emerald-500 font-bold flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" /> Connected ({candidateCount} Records)
                        </span>
                    )}
                </div>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">

                {/* 1. Search */}
                <MenuCard
                    title="Search by Keyword"
                    icon={Search}
                    color="bg-blue-500"
                    description="AI-powered resume search"
                />

                {/* 2. Upload Resume */}
                <Dialog open={isOpenResume} onOpenChange={setIsOpenResume}>
                    <DialogTrigger asChild>
                        <div className="contents">
                            <MenuCard
                                title="Upload Resume"
                                icon={UploadCloud}
                                color="bg-cyan-500"
                                description="Drag & drop to parse with n8n"
                            />
                        </div>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Upload Resume for Parsing</DialogTitle>
                            <DialogDescription>
                                Files will be sent to n8n for OCR and Auto-Extraction.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex items-center justify-center w-full mt-4">
                            <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-secondary/50 hover:bg-secondary/80 transition-colors border-muted-foreground/25">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadCloud className="w-10 h-10 mb-3 text-primary" />
                                    <p className="text-sm text-foreground font-semibold">Click to upload or drag and drop</p>
                                    <p className="text-xs text-muted-foreground mt-2">PDF, DOCX (MAX. 5MB)</p>
                                </div>
                                <input id="dropzone-file" type="file" className="hidden" />
                            </label>
                        </div>
                        <DialogFooter>
                            <Button type="submit" className="w-full">Start Processing</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* 3. Manual Input (Direct Link) */}
                <MenuCard
                    title="Manual Input"
                    icon={PenTool}
                    color="bg-orange-500"
                    description="Entry form for walk-ins"
                    onClick={() => window.location.href = '/candidates/new'}
                />

                {/* 4. Upload CSV */}
                <MenuCard
                    title="Upload CSV File"
                    icon={FileText}
                    color="bg-emerald-500"
                    description="Bulk import via Excel/CSV"
                />

                {/* 5. All List */}
                <MenuCard
                    title="All Candidate List"
                    icon={Users}
                    color="bg-indigo-500"
                    description="View full database"
                    onClick={() => window.location.href = '/candidates/list'}
                />

                {/* 6. Pre-Screen */}
                <MenuCard
                    title="Pre-Screen Table"
                    icon={TableProperties}
                    color="bg-purple-500"
                    description="Initial screening results"
                />

                {/* 7. Profile Table */}
                <MenuCard
                    title="Profile Table"
                    icon={DatabaseIcon}
                    color="bg-pink-500"
                    description="Deep profile data view"
                />

            </div>
        </div>
    );
}
