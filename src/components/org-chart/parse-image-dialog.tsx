'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel
} from '@/components/ui/select'
import {
    Loader2, Sparkles, CheckCircle2,
    AlertTriangle, UploadCloud, RefreshCw, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/notifications'
import { bulkAddParsedNodes } from '@/app/actions/org-chart-actions'

type ParsedNode = {
    _id: string
    name: string
    title: string
    parent_name: string
}

type ExistingNode = { name: string; parent_name: string | null }

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    uploadId: string
    existingNodes: ExistingNode[]
}

type Step = 'upload' | 'parsing' | 'preview' | 'importing' | 'done'

const PARSE_MESSAGES = [
    'Analyzing image structure...',
    'Identifying nodes and positions...',
    'Extracting hierarchy...',
    'Building node list...',
]

export function ParseImageDialog({ open, onOpenChange, uploadId, existingNodes }: Props) {
    const [step, setStep] = useState<Step>('upload')
    const [isDragging, setIsDragging] = useState(false)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
    const [imageBase64, setImageBase64] = useState<string | null>(null)
    const [parsedNodes, setParsedNodes] = useState<ParsedNode[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [parseMsg, setParseMsg] = useState(PARSE_MESSAGES[0])
    const [parseError, setParseError] = useState<string | null>(null)
    const [importCount, setImportCount] = useState(0)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const router = useRouter()

    const existingNamesSet = useMemo(() => new Set(existingNodes.map(n => n.name)), [existingNodes])

    useEffect(() => {
        if (!open) {
            setTimeout(() => {
                setStep('upload')
                setImageFile(null)
                setImagePreviewUrl(null)
                setImageBase64(null)
                setParsedNodes([])
                setSelectedIds(new Set())
                setParseError(null)
                setImportCount(0)
            }, 300)
        }
    }, [open])

    const isPdf = (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

    const readFileAsBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve((reader.result as string).split(',')[1])
            reader.onerror = reject
            reader.readAsDataURL(file)
        })

    const selectFile = useCallback(async (file: File) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
        if (!allowed.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
            toast.error('Please use a JPG, PNG, WEBP, GIF, or PDF file')
            return
        }
        const maxSize = isPdf(file) ? 10 * 1024 * 1024 : 4 * 1024 * 1024
        if (file.size > maxSize) {
            toast.error(`File must be under ${isPdf(file) ? '10' : '4'} MB`)
            return
        }
        setImageFile(file)
        setImagePreviewUrl(isPdf(file) ? null : URL.createObjectURL(file))
        setImageBase64(await readFileAsBase64(file))
    }, [])

    useEffect(() => {
        if (!open) return
        const handler = (e: ClipboardEvent) => {
            const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
            if (item) { const f = item.getAsFile(); if (f) selectFile(f) }
        }
        window.addEventListener('paste', handler)
        return () => window.removeEventListener('paste', handler)
    }, [open, selectFile])

    const startParse = async () => {
        if (!imageBase64 || !imageFile) return
        setStep('parsing')
        setParseError(null)
        let msgIdx = 0
        msgIntervalRef.current = setInterval(() => {
            msgIdx = (msgIdx + 1) % PARSE_MESSAGES.length
            setParseMsg(PARSE_MESSAGES[msgIdx])
        }, 1800)
        try {
            const res = await fetch('/api/ai/parse-org-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64, mimeType: imageFile.type })
            })
            const data = await res.json()
            if (!res.ok || data.error) throw new Error(data.error || 'Parse failed')
            const nodes: ParsedNode[] = (data.nodes as any[]).map((n, i) => ({
                _id: `node-${i}`,
                name: n.name || '',
                title: n.title || '',
                parent_name: n.parent_name || ''
            }))
            setParsedNodes(nodes)
            setSelectedIds(new Set(nodes.filter(n => !existingNamesSet.has(n.name.trim())).map(n => n._id)))
            setStep('preview')
        } catch (err: any) {
            setParseError(err.message)
        } finally {
            if (msgIntervalRef.current) clearInterval(msgIntervalRef.current)
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
    }
    const allSelected = parsedNodes.length > 0 && selectedIds.size === parsedNodes.length
    const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(parsedNodes.map(n => n._id)))

    const updateNode = (id: string, field: keyof ParsedNode, value: string) => {
        setParsedNodes(prev => prev.map(n => n._id === id ? { ...n, [field]: value } : n))
    }

    const removeNode = (id: string) => {
        setParsedNodes(p => p.filter(x => x._id !== id))
        setSelectedIds(p => { const s = new Set(p); s.delete(id); return s })
    }

    const selectedNodes = parsedNodes.filter(n => selectedIds.has(n._id))
    const duplicateCount = selectedNodes.filter(n => existingNamesSet.has(n.name.trim())).length

    const handleImport = async () => {
        if (!selectedNodes.length) return
        setStep('importing')
        try {
            const result = await bulkAddParsedNodes(uploadId, selectedNodes.map(n => ({
                name: n.name.trim(),
                title: n.title.trim() || null,
                parent_name: n.parent_name.trim() || null,
            })))
            if (!result.success) throw new Error(result.error)
            setImportCount(result.count ?? selectedNodes.length)
            setStep('done')
            router.refresh()
        } catch (err: any) {
            toast.error('Import failed: ' + err.message)
            setStep('preview')
        }
    }

    // Deduplicated existing names for dropdowns
    const uniqueExistingNames = useMemo(() => [...new Set(existingNodes.map(n => n.name))], [existingNodes])

    // BFS: descendants of selfName within the parsed batch (circular ref prevention)
    const getBatchDescendants = (nodeName: string): Set<string> => {
        const result = new Set<string>()
        const queue = [nodeName]
        while (queue.length > 0) {
            const current = queue.shift()!
            parsedNodes.forEach(n => {
                if (n.parent_name.trim() === current && !result.has(n.name.trim())) {
                    result.add(n.name.trim())
                    queue.push(n.name.trim())
                }
            })
        }
        return result
    }

    // Walk up existing org to get all ancestors of a name (so they can be excluded)
    const getExistingAncestors = (nodeName: string): Set<string> => {
        const nodeMap = new Map(existingNodes.map(n => [n.name, n]))
        const ancestors = new Set<string>()
        let current = nodeMap.get(nodeName)
        while (current?.parent_name) {
            ancestors.add(current.parent_name)
            current = nodeMap.get(current.parent_name)
        }
        return ancestors
    }

    // Parent options per row: exclude self + batch-descendants + self's existing ancestors
    const getParentOptions = (selfId: string, selfName: string) => {
        const batchDescendants = getBatchDescendants(selfName)
        const existingAncestors = getExistingAncestors(selfName)

        const fromBatch = [...new Set(
            parsedNodes
                .filter(n => n._id !== selfId && n.name.trim() && !batchDescendants.has(n.name.trim()))
                .map(n => n.name.trim())
        )]
        const fromExisting = uniqueExistingNames.filter(name =>
            !fromBatch.includes(name) &&
            name !== selfName &&
            !existingAncestors.has(name)
        )
        return { fromBatch, fromExisting }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[660px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles size={16} className="text-indigo-500" />
                        Parse Org Chart Image
                    </DialogTitle>
                    <DialogDescription>
                        Upload or paste a screenshot — AI will extract the structure. Tick only the nodes you want to import.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto">

                    {/* UPLOAD */}
                    {step === 'upload' && (
                        <div className="py-4">
                            <div
                                className={cn(
                                    "border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer",
                                    isDragging ? "border-indigo-500 bg-indigo-50 scale-[1.01]" :
                                    imageFile ? "border-indigo-400 bg-indigo-50/40" :
                                    "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                )}
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) selectFile(f) }}
                            >
                                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) selectFile(f) }} />
                                {imageFile ? (
                                    <div className="p-3 flex items-center gap-4">
                                        {imagePreviewUrl
                                            ? <img src={imagePreviewUrl} alt="preview" className="h-28 w-auto rounded-lg object-contain border border-slate-200 shadow-sm" />
                                            : <div className="h-28 w-20 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-400 text-xs font-bold">PDF</div>
                                        }
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{imageFile.name}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{(imageFile.size / 1024).toFixed(0)} KB</p>
                                            <p className="text-xs text-indigo-500 mt-2 font-medium">Click to change file</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-10 flex flex-col items-center gap-2">
                                        <UploadCloud className="h-10 w-10 text-slate-300" />
                                        <span className="text-sm font-medium text-slate-600">Click or drag to upload</span>
                                        <span className="text-xs text-slate-400">Or press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">Ctrl+V</kbd> to paste image</span>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-1">JPG · PNG · WEBP · PDF · max 10MB</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* PARSING */}
                    {step === 'parsing' && !parseError && (
                        <div className="py-12 flex flex-col items-center gap-5">
                            <div className="relative">
                                <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <Sparkles size={28} className="text-indigo-600" />
                                </div>
                                <Loader2 size={64} className="absolute inset-0 text-indigo-400 animate-spin opacity-40" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-slate-800">{parseMsg}</p>
                                <p className="text-xs text-slate-500 mt-1">Retries up to 3× if needed</p>
                            </div>
                        </div>
                    )}
                    {step === 'parsing' && parseError && (
                        <div className="m-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
                            <AlertTriangle size={16} className="text-rose-500 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-rose-700">Parse Failed</p>
                                <p className="text-xs text-rose-600 mt-0.5">{parseError}</p>
                            </div>
                        </div>
                    )}

                    {/* PREVIEW */}
                    {step === 'preview' && (
                        <div className="py-4 space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-800">{parsedNodes.length} nodes found</span>
                                    <span className="text-xs text-slate-400">·</span>
                                    <span className="text-sm font-semibold text-indigo-600">{selectedIds.size} selected</span>
                                    {duplicateCount > 0 && (
                                        <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 font-bold rounded-full flex items-center gap-1">
                                            <AlertTriangle size={9} /> {duplicateCount} duplicate
                                        </span>
                                    )}
                                </div>
                                <button onClick={toggleAll} className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold">
                                    {allSelected ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="grid grid-cols-[28px_1fr_1fr_160px_28px] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="mt-0.5" />
                                    <span>Name</span><span>Title</span><span>Reports To</span><span></span>
                                </div>
                                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                                    {parsedNodes.map(n => {
                                        const isDupe = existingNamesSet.has(n.name.trim())
                                        const isSelected = selectedIds.has(n._id)
                                        const { fromBatch, fromExisting } = getParentOptions(n._id, n.name.trim())
                                        return (
                                            <div key={n._id} className={cn(
                                                "grid grid-cols-[28px_1fr_1fr_160px_28px] gap-2 px-3 py-1.5 items-center transition-colors",
                                                isSelected ? (isDupe ? "bg-amber-50/60" : "bg-white") : "bg-slate-50/70 opacity-50"
                                            )}>
                                                <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(n._id)} />
                                                <Input
                                                    value={n.name}
                                                    onChange={e => updateNode(n._id, 'name', e.target.value)}
                                                    className={cn("h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:border-b focus-visible:border-indigo-400", isDupe && isSelected && "text-amber-700 font-semibold")}
                                                />
                                                <Input
                                                    value={n.title}
                                                    onChange={e => updateNode(n._id, 'title', e.target.value)}
                                                    className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 text-slate-500"
                                                    placeholder="—"
                                                />
                                                {/* Reports To dropdown */}
                                                <Select
                                                    value={n.parent_name || '__root__'}
                                                    onValueChange={v => updateNode(n._id, 'parent_name', v === '__root__' ? '' : v)}
                                                >
                                                    <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-0 focus:ring-0 shadow-none text-slate-500 truncate [&>svg]:hidden">
                                                        <SelectValue placeholder="root" />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-60">
                                                        <SelectItem value="__root__" className="text-xs text-slate-400 italic">— root (no parent) —</SelectItem>
                                                        {fromBatch.length > 0 && (
                                                            <SelectGroup>
                                                                <SelectLabel className="text-[10px] text-slate-400 uppercase tracking-wider px-2 py-1">This import</SelectLabel>
                                                                {fromBatch.map(name => (
                                                                    <SelectItem key={`batch-${name}`} value={name} className="text-xs">{name}</SelectItem>
                                                                ))}
                                                            </SelectGroup>
                                                        )}
                                                        {fromExisting.length > 0 && (
                                                            <SelectGroup>
                                                                <SelectLabel className="text-[10px] text-slate-400 uppercase tracking-wider px-2 py-1">Existing in org</SelectLabel>
                                                                {fromExisting.map(name => (
                                                                    <SelectItem key={`existing-${name}`} value={name} className="text-xs">{name}</SelectItem>
                                                                ))}
                                                            </SelectGroup>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <button onClick={() => removeNode(n._id)} className="h-6 w-6 flex items-center justify-center rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {duplicateCount > 0 && (
                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                    <strong>Warning:</strong> {duplicateCount} selected node{duplicateCount > 1 ? 's' : ''} share a name with existing nodes.
                                </p>
                            )}
                        </div>
                    )}

                    {/* IMPORTING */}
                    {step === 'importing' && (
                        <div className="py-12 flex flex-col items-center gap-4">
                            <Loader2 size={40} className="text-indigo-500 animate-spin" />
                            <p className="text-sm font-semibold text-slate-700">Saving {selectedNodes.length} nodes...</p>
                        </div>
                    )}

                    {/* DONE */}
                    {step === 'done' && (
                        <div className="py-10 flex flex-col items-center gap-5">
                            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
                                <CheckCircle2 size={36} className="text-emerald-600 stroke-[2.5]" />
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-bold text-slate-900">Import Complete!</p>
                                <p className="text-sm text-slate-500 mt-1">{importCount} nodes added to the org chart.</p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="pt-2 border-t border-slate-100 mt-2">
                    {step === 'upload' && (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2" disabled={!imageBase64} onClick={startParse}>
                                <Sparkles size={14} /> Parse with Gemini
                            </Button>
                        </>
                    )}
                    {step === 'parsing' && !parseError && (
                        <Button variant="outline" disabled><Loader2 size={14} className="mr-2 animate-spin" />Parsing...</Button>
                    )}
                    {step === 'parsing' && parseError && (
                        <>
                            <Button variant="outline" onClick={() => { setStep('upload'); setParseError(null) }}>
                                <RefreshCw size={14} className="mr-2" /> Try Again
                            </Button>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                        </>
                    )}
                    {step === 'preview' && (
                        <>
                            <Button variant="outline" onClick={() => setStep('upload')} className="gap-1.5">
                                <RefreshCw size={13} /> Re-upload
                            </Button>
                            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={selectedIds.size === 0} onClick={handleImport}>
                                Import {selectedIds.size} Node{selectedIds.size !== 1 ? 's' : ''}
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
