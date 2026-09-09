'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/notifications'
import { replaceOrgChartPdf } from '@/app/actions/org-chart-actions'
import {
    UploadCloud, FileText, Loader2, CheckCircle2, AlertTriangle, FileCheck2, Sparkles
} from 'lucide-react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    uploadId: string
}

type Step = 'upload' | 'choose' | 'confirm-reextract' | 'saving' | 'done'
type Mode = 'pdf_only' | 'reextract'

export function UploadNewPdfDialog({ open, onOpenChange, uploadId }: Props) {
    const [step, setStep] = useState<Step>('upload')
    const [isDragging, setIsDragging] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [mode, setMode] = useState<Mode | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    const reset = () => {
        setStep('upload')
        setFile(null)
        setMode(null)
        setIsDragging(false)
    }

    React.useEffect(() => {
        if (!open) setTimeout(reset, 300)
    }, [open])

    const selectFile = (f: File) => {
        if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
            toast.error('Please select a PDF file')
            return
        }
        if (f.size > 10 * 1024 * 1024) {
            toast.error('File must be under 10 MB')
            return
        }
        setFile(f)
        setStep('choose')
    }

    const runReplace = async (chosenMode: Mode) => {
        if (!file) return
        setMode(chosenMode)
        setStep('saving')
        try {
            const sanitizedBase = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
            const fileName = `${uploadId}_${Date.now()}_${sanitizedBase}`

            const { error: uploadError } = await supabase.storage.from('org_charts').upload(fileName, file)
            if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

            const { data: urlData } = supabase.storage.from('org_charts').getPublicUrl(fileName)
            const result = await replaceOrgChartPdf(uploadId, urlData.publicUrl, chosenMode)
            if (!result.success) throw new Error(result.error)

            setStep('done')
            router.refresh()
        } catch (err: any) {
            toast.error('Failed: ' + err.message)
            setStep('choose')
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UploadCloud size={16} className="text-indigo-500" />
                        Upload New PDF
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'upload' && 'Replace the source PDF for this org chart.'}
                        {step === 'choose' && 'Choose how to apply the new file.'}
                        {step === 'confirm-reextract' && 'This will reset every node in this chart.'}
                        {step === 'saving' && 'Applying your changes...'}
                        {step === 'done' && 'All set.'}
                    </DialogDescription>
                </DialogHeader>

                {step === 'upload' && (
                    <div className="py-2">
                        <div
                            className={cn(
                                "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200",
                                isDragging ? "border-indigo-500 bg-indigo-50 scale-[1.01]" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                            )}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) selectFile(f) }}
                        >
                            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) selectFile(f) }} />
                            <UploadCloud className="h-10 w-10 text-slate-300 mb-2" />
                            <span className="text-sm text-slate-600 font-medium">Click or drag to upload PDF</span>
                            <span className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Only PDF · max 10MB</span>
                        </div>
                    </div>
                )}

                {step === 'choose' && file && (
                    <div className="py-2 space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                            <FileText className="h-8 w-8 text-rose-500 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                                <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => runReplace('pdf_only')}
                            className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors flex gap-3 items-start"
                        >
                            <FileCheck2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-slate-800">Update PDF only</p>
                                <p className="text-xs text-slate-500 mt-0.5">Just swaps the file. Verified nodes and matches stay exactly as they are — nothing gets re-extracted.</p>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => setStep('confirm-reextract')}
                            className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 transition-colors flex gap-3 items-start"
                        >
                            <Sparkles size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-slate-800">Update PDF + re-extract</p>
                                <p className="text-xs text-slate-500 mt-0.5">Sends the new PDF to AI extraction. All current nodes are cleared, including verified ones — everyone goes through Verify Chart again.</p>
                            </div>
                        </button>
                    </div>
                )}

                {step === 'confirm-reextract' && (
                    <div className="py-2 space-y-4">
                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3 items-start">
                            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-amber-800">This can't be undone</p>
                                <p className="text-xs text-amber-700 leading-relaxed">
                                    Every node on this chart — including ones already verified and matched — will be deleted and rebuilt from the new PDF. You'll need to run Verify Chart on this org again from scratch. The chart's URL and ID stay the same.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'saving' && (
                    <div className="py-10 flex flex-col items-center gap-4">
                        <Loader2 size={40} className="text-indigo-500 animate-spin" />
                        <p className="text-sm font-semibold text-slate-700">
                            {mode === 'reextract' ? 'Clearing old nodes and re-extracting...' : 'Updating PDF...'}
                        </p>
                    </div>
                )}

                {step === 'done' && (
                    <div className="py-10 flex flex-col items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 size={36} className="text-emerald-600 stroke-[2.5]" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-slate-900">Done!</p>
                            <p className="text-sm text-slate-500 mt-1">
                                {mode === 'reextract'
                                    ? 'The new PDF is being processed. Nodes will appear shortly — run Verify Chart when ready.'
                                    : 'The PDF has been updated.'}
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter className="pt-2">
                    {step === 'choose' && (
                        <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
                    )}
                    {step === 'confirm-reextract' && (
                        <>
                            <Button variant="outline" onClick={() => setStep('choose')}>Back</Button>
                            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => runReplace('reextract')}>
                                Yes, wipe &amp; re-extract
                            </Button>
                        </>
                    )}
                    {step === 'done' && (
                        <Button onClick={() => onOpenChange(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full">Close</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
