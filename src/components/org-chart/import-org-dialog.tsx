'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { UploadCloud, FileText, Loader2, Plus, CheckCircle2 } from 'lucide-react'
import { toast } from '@/lib/notifications'
import { importOrgChart } from '@/app/actions/org-chart-actions'
import { searchCompanies } from '@/app/actions/candidate-filters'
import { CompanySuggestionInput } from './company-suggestion-input'
import { Textarea } from '@/components/ui/textarea'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export function ImportOrgDialog() {
    const [isOpen, setIsOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [formKey, setFormKey] = useState(0)
    const [companyName, setCompanyName] = useState('')
    const [notes, setNotes] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [lastUploadSuccess, setLastUploadSuccess] = useState<{name: string, time: string} | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    // Reset state when dialog closes
    React.useEffect(() => {
        if (!isOpen) {
            setCompanyName('')
            setNotes('')
            setSelectedFile(null)
            setIsDragging(false)
            setLastUploadSuccess(null)
        }
    }, [isOpen])

    const processSelectedFile = async (file: File) => {
        setLastUploadSuccess(null) // Clear success message when new file added
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            setSelectedFile(file)
            
            // Auto-fill Notes and Company
            const baseName = file.name.replace(/\.pdf$/i, '')
            setNotes(baseName)
            
            // Smart Auto-fill: Search for the first 6 characters and pick the first match
            const prefix = baseName.substring(0, 6)
            setCompanyName(prefix) // Default to prefix first
            
            try {
                const response = await searchCompanies(prefix, 1)
                if (response.results && response.results.length > 0) {
                    const matchedName = response.results[0]
                    setCompanyName(matchedName)
                    toast.success(`Smart Match: Found company "${matchedName}"`)
                } else {
                    toast.info(`Smart Match: No company found for "${prefix}". Please verify manually.`)
                }
            } catch (err) {
                console.error('Error auto-filling company:', err)
            }
        } else {
            toast.error("Please drop or select a PDF file")
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processSelectedFile(e.target.files[0])
        }
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        if (!isUploading) setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        if (isUploading) return
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processSelectedFile(e.dataTransfer.files[0])
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!companyName.trim()) {
            toast.error("Please enter a company name")
            return
        }
        if (!selectedFile) {
            toast.error("Please select a PDF file")
            return
        }

        setIsUploading(true)
        try {
            // 1. Generate Upload ID & File Name on Client
            const uploadId = 'db' + Math.random().toString(16).slice(2, 8)
            const sanitizedBase = selectedFile.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, '_')
            const fileName = `${uploadId}_${sanitizedBase}`

            // 2. Client-side upload straight to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('org_charts')
                .upload(fileName, selectedFile)

            if (uploadError) {
                throw new Error(`Upload failed: ${uploadError.message}`)
            }

            // 3. Get Public URL
            const { data: urlData } = supabase.storage
                .from('org_charts')
                .getPublicUrl(fileName)

            const publicUrl = urlData.publicUrl

            // 4. Trigger Server Action for DB Logging and Webhook
            const result = await importOrgChart(uploadId, companyName, fileName, publicUrl, notes)

            if (result.success) {
                toast.success("OrgChart import initiated!")
                
                // Show success badge BEFORE resetting form fields
                setLastUploadSuccess({
                    name: companyName,
                    time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                })
                
                // RESET EVERYTHING TO IMAGE 1 STATE
                setCompanyName('')
                setNotes('')
                setSelectedFile(null)
                
                // HARD RESET: Force re-mount of child components (Clears internal states)
                setFormKey(prev => prev + 1)
                
                router.refresh()
            } else {
                toast.error(result.error || "Failed to trigger import")
            }
        } catch (err: any) {
            toast.error("An error occurred: " + err.message)
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="default" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm h-8 px-3 rounded-lg text-xs font-bold transition-all">
                    <Plus size={14} className="stroke-[3]" />
                    IMPORT ORGCHART
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Import New OrgChart</DialogTitle>
                        <DialogDescription>
                            Upload a PDF file of the organization structure to generate a new interactive chart.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        {/* 1. SUCCESS BADGE (Outside keyed div so it stays) */}
                        {lastUploadSuccess && (
                            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <CheckCircle2 size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Uploaded Successfully!</p>
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
                                        "{lastUploadSuccess.name}" was sent for processing at {lastUploadSuccess.time}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 2. INTERACTIVE FORM (Inside keyed div for HARD RESET to Image 1) */}
                        <div key={formKey} className="space-y-4 animate-in fade-in duration-500">
                            <div className="grid gap-2">
                                <Label htmlFor="company">Company Name (Master)</Label>
                                <CompanySuggestionInput
                                    value={companyName}
                                    onChange={setCompanyName}
                                    disabled={isUploading}
                                    placeholder="e.g. Asset World Corp"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="notes">Notes (Optional)</Label>
                                <Textarea 
                                    id="notes" 
                                    placeholder="Any context or details about this chart..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    disabled={isUploading}
                                    className="resize-none h-20"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="file">OrgChart PDF</Label>
                                <div
                                    className={cn(
                                        "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200",
                                        isDragging ? "border-primary bg-primary/5 scale-[1.02] ring-2 ring-primary/20" : 
                                        selectedFile ? "border-indigo-400 bg-indigo-50/50" : 
                                        "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                    )}
                                    onClick={() => !isUploading && fileInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDragEnter={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <input
                                        type="file"
                                        id="file"
                                        className="hidden"
                                        accept=".pdf"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        disabled={isUploading}
                                    />
                                    {selectedFile ? (
                                        <div className="flex flex-col items-center">
                                            <FileText className="h-10 w-10 text-rose-500 mb-2" />
                                            <span className="text-xs font-medium text-slate-900 truncate max-w-[200px]">
                                                {selectedFile.name}
                                            </span>
                                            <span className="text-[10px] text-slate-500 mt-1">
                                                {(selectedFile.size / 1024).toFixed(1)} KB
                                            </span>
                                        </div>
                                    ) : (
                                        <>
                                            <UploadCloud className="h-10 w-10 text-slate-300 mb-2" />
                                            <span className="text-sm text-slate-600">Click to upload PDF</span>
                                            <span className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Only PDF allowed</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="submit"
                            className={cn(
                                "w-full h-11 transition-all duration-300 bg-indigo-600 hover:bg-indigo-700 text-white",
                                isUploading && "bg-slate-400 pointer-events-none opacity-80"
                            )}
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    UPLOADING & TRIGGERING...
                                </>
                            ) : (
                                'UPLOAD & START IMPORT'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
