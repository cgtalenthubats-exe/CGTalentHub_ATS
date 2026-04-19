"use client";

import React, { useState, useRef } from "react";
import { Download, UploadCloud, MoreVertical, FileText, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/lib/notifications";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface ResumeManagerProps {
    candidateId: string;
    resumeUrl?: string | null;
    onUpdate?: () => void; // Callback to refresh parent data
}

export function ResumeManager({ candidateId, resumeUrl, onUpdate }: ResumeManagerProps) {
    const router = useRouter();
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            await uploadResume(file);
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const uploadResume = async (file: File) => {
        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${candidateId}-${Date.now()}-resume.${fileExt}`; // Unique name to avoid cache issues

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage.from('resumes').upload(fileName, file);
            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data } = supabase.storage.from('resumes').getPublicUrl(fileName);
            const publicUrl = data.publicUrl;

            // 3. Update Candidate Profile
            const res = await fetch(`/api/candidates/${candidateId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume_url: publicUrl })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to update profile");
            }

            toast.success("Resume uploaded successfully");
            router.refresh();
            if (onUpdate) onUpdate();

        } catch (error: any) {
            console.error(error);
            toast.error("Upload failed: " + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const removeResume = async () => {
        if (!confirm("Are you sure you want to remove this resume?")) return;

        setIsUploading(true);
        try {
            // 1. Update Profile to remove URL
            const res = await fetch(`/api/candidates/${candidateId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume_url: null }) // Send null to clear
            });

            if (!res.ok) throw new Error("Failed to remove resume");

            toast.success("Resume removed");
            router.refresh();
            if (onUpdate) onUpdate();

        } catch (error: any) {
            toast.error("Failed to remove: " + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const triggerUpload = () => {
        fileInputRef.current?.click();
    };

    if (isUploading) {
        return (
            <Button variant="outline" disabled className="gap-2 border-border shadow-sm min-w-[120px]">
                <Loader2 className="h-4 w-4 animate-spin" /> Processing...
            </Button>
        );
    }

    // Case 1: No Resume -> Upload Button
    if (!resumeUrl) {
        return (
            <>
                <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                />
                <Button
                    variant="outline"
                    className="gap-2 border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 shadow-sm"
                    onClick={triggerUpload}
                >
                    <UploadCloud className="h-4 w-4" /> Upload Resume
                </Button>
            </>
        );
    }

    // Case 2: Has Resume -> Download + Actions
    return (
        <div className="flex items-center gap-1">
            <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
            />

            {/* Main Button: Download */}
            <Button
                variant="outline"
                className="gap-2 border-border shadow-sm rounded-r-none border-r-0 hover:bg-slate-50"
                onClick={() => window.open(resumeUrl, '_blank')}
            >
                <FileText className="h-4 w-4 text-rose-500" /> Resume
            </Button>

            {/* Dropdown: Actions (Update/Remove) */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-l-none border-l-0 px-2 shadow-sm hover:bg-slate-50">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={triggerUpload}>
                        <RefreshCw className="mr-2 h-4 w-4 text-indigo-500" /> Update / Replace
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={removeResume} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                        <Trash2 className="mr-2 h-4 w-4" /> Remove
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
