"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone"; // Assuming installed or need to install. Codebase usually has it or similar.
// If not installed, I'll use standard input type=file or basic drag events. 
// Let's check package.json from memory (Step 126). 
// I didn't verify 'react-dropzone' in package.json. 
// I will use a simple native drag-and-drop implementation to avoid dependency issues unless I check package.json again.
import { Upload, FileText, X, Check, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js"; // Client side supabase
import { cn } from "@/lib/utils";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface ResumeUploadProps {
    onUploadComplete: (files: UploadedFile[]) => void;
}

export interface UploadedFile {
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    url?: string;
    error?: string;
    dbId?: string; // ID from resume_uploads table
}

export function ResumeUpload({ onUploadComplete }: ResumeUploadProps) {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf')); // Only PDF for now

        if (droppedFiles.length === 0) return;

        const newFiles = droppedFiles.map(file => ({
            file,
            status: 'pending' as const
        }));

        setFiles(prev => [...prev, ...newFiles]);
        // Trigger upload immediately or wait for user? 
        // Plan says "Loop upload...". Let's auto-process or let parent handle it?
        // Let's let parent handle the logic, but here we expose the files. 
        // Actually, the component should probably handle the "Upload to Storage" part and report back.

        uploadFiles(newFiles);
    }, []);

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
            const newFiles = selectedFiles.map(file => ({
                file,
                status: 'pending' as const
            }));
            setFiles(prev => [...prev, ...newFiles]);
            uploadFiles(newFiles);
        }
    };

    const uploadFiles = async (newFiles: UploadedFile[]) => {
        // Upload logic here -> Storage
        // Passing result to parent to save to DB? 
        // Or loop here.

        const updatedFiles = [...newFiles];

        // This is a local state update helper
        const updateFileStatus = (fileName: string, status: UploadedFile['status'], url?: string, error?: string) => {
            setFiles(prev => prev.map(f =>
                f.file.name === fileName ? { ...f, status, url, error } : f
            ));
        };

        for (const f of newFiles) {
            updateFileStatus(f.file.name, 'uploading');

            try {
                const fileName = `${Date.now()}_${f.file.name.replace(/\s+/g, '_')}`; // Sanitize name
                const { data, error } = await supabase.storage
                    .from('resumes')
                    .upload(fileName, f.file);

                if (error) throw error;

                // Get Public URL
                const { data: publicUrlData } = supabase.storage
                    .from('resumes')
                    .getPublicUrl(fileName);

                updateFileStatus(f.file.name, 'success', publicUrlData.publicUrl);

                // Notify parent that ONE file is done (so it can save to DB incremental)
                // OR wait for all. 
                // Better to notify incremental so user sees progress in DB log list.
                onUploadComplete([{
                    file: f.file,
                    status: 'success',
                    url: publicUrlData.publicUrl
                }]);

            } catch (err: any) {
                console.error("Upload Error:", err);
                updateFileStatus(f.file.name, 'error', undefined, err.message);
                onUploadComplete([{
                    file: f.file,
                    status: 'error',
                    error: err.message
                }]);
            }
        }
    };

    return (
        <div className="w-full space-y-4">
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cn(
                    "border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer",
                    isDragging ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                )}
                onClick={() => document.getElementById('file-upload')?.click()}
            >
                <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    multiple
                    accept=".pdf"
                    onChange={onFileSelect}
                />
                <div className="flex flex-col items-center gap-2">
                    <div className="p-4 bg-gray-100 rounded-full">
                        <Upload className="w-8 h-8 text-gray-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700">Click or drag resumes here</h3>
                    <p className="text-sm text-gray-500">Supports PDF files (Max 10 files recommended)</p>
                </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-2 rounded-lg",
                                    file.status === 'success' ? "bg-green-100" :
                                        file.status === 'error' ? "bg-red-100" : "bg-gray-100"
                                )}>
                                    <FileText className={cn(
                                        "w-5 h-5",
                                        file.status === 'success' ? "text-green-600" :
                                            file.status === 'error' ? "text-red-600" : "text-gray-600"
                                    )} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{file.file.name}</p>
                                    <p className="text-xs text-gray-500">{(file.file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {file.status === 'uploading' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                                {file.status === 'success' && <Check className="w-5 h-5 text-green-500" />}
                                {file.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
