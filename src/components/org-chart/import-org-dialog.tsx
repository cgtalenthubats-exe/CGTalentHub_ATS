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
import { UploadCloud, FileText, Loader2, Plus, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react'
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
    const [isSuccess, setIsSuccess] = useState(false)
    const [formKey, setFormKey] = useState(0)
    const [companyName, setCompanyName] = useState('')
    const [notes, setNotes] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    // Reset state when dialog closes
    React.useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setIsSuccess(false)
                setCompanyName('')
                setNotes('')
                setSelectedFile(null)
                setIsDragging(false)
            }, 300)
        }
    }, [isOpen])

    const processSelectedFile = async (file: File) => {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            setSelectedFile(file)
            const baseName = file.name.replace(/\.pdf$/i, '')
            setNotes(baseName)
            const prefix = baseName.substring(0, 6)
            setCompanyName(prefix)
            
            try {
                const response = await searchCompanies(prefix, 1)
                if (response.results && response.results.length > 0) {
                    const matchedName = response.results[0]
                    setCompanyName(matchedName)
                    toast.success(`Smart Match: Found company "${matchedName}"`)
                }
            } catch (err) {
                console.error('Error auto-filling company:', err)
            }
        } else {
            toast.error("Please drop or select a PDF file")
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!companyName.trim()) { toast.error("Please enter a company name"); return; }
        if (!selectedFile) { toast.error("Please select a PDF file"); return; }

        setIsUploading(true)
        try {
            const uploadId = 'db' + Math.random().toString(16).slice(2, 8)
            const sanitizedBase = selectedFile.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, '_')
            const fileName = `${uploadId}_${sanitizedBase}`

            const { error: uploadError } = await supabase.storage
                .from('org_charts')
                .upload(fileName, selectedFile)

            if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

            const { data: urlData } = supabase.storage.from('org_charts').getPublicUrl(fileName)
            const publicUrl = urlData.publicUrl

            const result = await importOrgChart(uploadId, companyName, fileName, publicUrl, notes)

            if (result.success) {
                setIsSuccess(true)
                // Clear state
                setCompanyName('')
                setNotes('')
                setSelectedFile(null)
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

    const resetForNewImport = () => {
        setIsSuccess(false)
        setCompanyName('')
        setNotes('')
        setSelectedFile(null)
        setFormKey(prev => prev + 1)
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
                {isSuccess ? (
                    <div className="py-8 flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={48} className="stroke-[2.5]" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Upload เสร็จเรียบร้อยแล้ว!</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto">
                                ไฟล์ของคุณถูกส่งเข้าสู่ระบบแล้ว กำลังประมวลผลอยู่เบื้องหลัง คุณสามารถปิดหน้านี้ได้เลย หรืออัปโหลดไฟล์ถัดไป
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 w-full pt-4">
                            <Button 
                                onClick={resetForNewImport}
                                variant="outline"
                                className="w-full h-11 border-indigo-200 text-indigo-600 hover:bg-indigo-50 gap-2 font-bold"
                            >
                                <RefreshCw size={16} />
                                IMPORT ANOTHER ORGCHART
                            </Button>
                            <Button 
                                onClick={() => setIsOpen(false)}
                                variant="ghost"
                                className="w-full text-slate-500 hover:bg-slate-100 h-10"
                            >
                                CLOSE
                            </Button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>Import New OrgChart</DialogTitle>
                            <DialogDescription>
                                Upload a PDF file of the organization structure to generate a new interactive chart.
                            </DialogDescription>
                        </DialogHeader>
                        
                        <div key={formKey} className="grid gap-4 py-4">
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
                                    onDragOver={(e) => {e.preventDefault(); if (!isUploading) setIsDragging(true)}}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={(e) => {
                                        e.preventDefault(); 
                                        setIsDragging(false);
                                        if (!isUploading && e.dataTransfer.files[0]) processSelectedFile(e.dataTransfer.files[0])
                                    }}
                                >
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept=".pdf"
                                        ref={fileInputRef}
                                        onChange={(e) => e.target.files?.[0] && processSelectedFile(e.target.files[0])}
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
                                            <span className="text-sm text-slate-600 font-medium">Click or Drag to upload PDF</span>
                                            <span className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Only PDF allowed</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="submit"
                                className={cn(
                                    "w-full h-11 transition-all duration-300 bg-indigo-600 hover:bg-indigo-700 text-white font-bold",
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
                )}
            </DialogContent>
        </Dialog>
    )
}
