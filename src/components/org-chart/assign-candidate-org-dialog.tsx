'use client'

import React, { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select"
import { 
    fetchOrgChartUploads, 
    getCandidateExperiences, 
    getOrgChartNodesBrief,
    assignCandidateToOrgChart,
    verifyOrgChart
} from '@/app/actions/org-chart-actions'
import { toast } from '@/lib/notifications'
import { Loader2, Network } from 'lucide-react'

type AssignCandidateOrgDialogProps = {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    candidateId: string
    candidateName: string
    linkedin: string | null
}

export function AssignCandidateOrgDialog({
    isOpen,
    onOpenChange,
    candidateId,
    candidateName,
    linkedin
}: AssignCandidateOrgDialogProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    
    const [uploads, setUploads] = useState<any[]>([])
    const [experiences, setExperiences] = useState<any[]>([])
    const [chartNodes, setChartNodes] = useState<any[]>([])
    
    const [selectedUploadId, setSelectedUploadId] = useState<string>('')
    const [selectedPosition, setSelectedPosition] = useState<string>('')
    const [selectedParentName, setSelectedParentName] = useState<string>('NONE') // NONE = Root
    
    // 1. Initial Data Fetch
    useEffect(() => {
        if (isOpen) {
            loadInitialData()
        }
    }, [isOpen, candidateId])
    
    // 2. Fetch nodes when chart changes
    useEffect(() => {
        if (selectedUploadId) {
            loadChartNodes(selectedUploadId)
        }
    }, [selectedUploadId])

    async function loadInitialData() {
        setIsLoading(true)
        try {
            const [u, e] = await Promise.all([
                fetchOrgChartUploads(),
                getCandidateExperiences(candidateId)
            ])
            setUploads(u)
            setExperiences(e)
            
            // Auto-select latest chart if any
            if (u.length > 0) setSelectedUploadId(u[0].upload_id)
            
            // Auto-select current position if any
            const current = e.find((exp: any) => exp.is_current_job === 'Current')
            if (current) setSelectedPosition(current.position)
            else if (e.length > 0) setSelectedPosition(e[0].position)
            
        } catch (err) {
            toast.error("Failed to load assignment data")
        } finally {
            setIsLoading(false)
        }
    }

    async function loadChartNodes(uploadId: string) {
        try {
            const nodes = await getOrgChartNodesBrief(uploadId)
            setChartNodes(nodes)
            setSelectedParentName('NONE')
        } catch (err) {
            toast.error("Failed to load chart nodes")
        }
    }

    async function handleAssign() {
        if (!selectedUploadId || !selectedPosition) {
            toast.error("Please select a chart and position")
            return
        }

        setIsSubmitting(true)
        try {
            const res = await assignCandidateToOrgChart({
                candidateId,
                uploadId: selectedUploadId,
                parentName: selectedParentName === 'NONE' ? null : selectedParentName,
                position: selectedPosition,
                name: candidateName,
                linkedin: linkedin
            })

            if (res.success) {
                // Auto-verify as requested: "ถ้าเพิ่มคนมาจากหน้า candidate profile อันนั้นถือว่าเป็นการ verify ไปในตัว"
                await verifyOrgChart(selectedUploadId)
                
                toast.success(`Successfully assigned ${candidateName} to Org Chart and verified 🛡️`)
                onOpenChange(false)
            } else {
                toast.error(res.error || "Assignment failed")
            }
        } catch (err) {
            toast.error("An error occurred during assignment")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <div className="bg-indigo-50 dark:bg-indigo-950/30 w-10 h-10 rounded-full flex items-center justify-center mb-2">
                        <Network className="text-indigo-600 h-5 w-5" />
                    </div>
                    <DialogTitle>Assign to Org Chart</DialogTitle>
                    <DialogDescription>
                        Place <strong>{candidateName}</strong> into an existing organization structure.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="py-10 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="animate-spin text-slate-300" />
                        <span className="text-xs text-slate-400 font-medium tracking-wider uppercase">Loading Charts & History...</span>
                    </div>
                ) : (
                    <div className="grid gap-6 py-4">
                        {/* Selected Org Chart */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase">1. Select Target Org Chart</Label>
                            <Select value={selectedUploadId} onValueChange={setSelectedUploadId}>
                                <SelectTrigger className="h-11 bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Choose a company chart..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {uploads.map((u) => (
                                        <SelectItem key={u.upload_id} value={u.upload_id}>
                                            {u.company_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Reported Position */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase">2. Position to Display</Label>
                            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                                <SelectTrigger className="h-11 bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Select from experience history..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {experiences.map((exp: any, idx: number) => (
                                        <SelectItem key={idx} value={exp.position}>
                                            {exp.position} {exp.company ? `@ ${exp.company}` : ''} {exp.is_current_job === 'Current' ? '(Current)' : ''}
                                        </SelectItem>
                                    ))}
                                    {/* Allow custom if none? For now just history */}
                                    {experiences.length === 0 && (
                                        <SelectItem value="Untitled Position">Untitled Position</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Reporting To */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase">3. Report Under (Manager)</Label>
                            <Select value={selectedParentName} onValueChange={setSelectedParentName}>
                                <SelectTrigger className="h-11 bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Who is their manager?" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NONE">-- Top Level (Root Node) --</SelectItem>
                                    {chartNodes.map((node: any, idx: number) => (
                                        <SelectItem key={idx} value={node.name}>
                                            {node.name} {node.title ? `(${node.title})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
                    <Button 
                        onClick={handleAssign} 
                        className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]"
                        disabled={isSubmitting || isLoading || !selectedUploadId}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ASSIGNING...
                            </>
                        ) : (
                            'Confirm Assignment'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
