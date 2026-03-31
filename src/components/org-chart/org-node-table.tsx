'use client'

import React, { useState, useEffect } from 'react'
import { RawOrgNode, updateOrgNode, createOrgNode, searchCandidates, createSingleOrgProfile, verifyOrgChart, verifyOrgNode, unlinkOrgNode } from '@/app/actions/org-chart-actions'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Check, Unlink, Trash2, ArrowRight } from 'lucide-react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Edit2, Plus, UserCheck, AlertCircle, Search, X, Loader2, UserPlus, Info } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { cn } from "@/lib/utils"
import { NodeFormDialog } from './node-form-dialog'
import { VerificationDialog } from './verification-dialog'

export function OrgNodeTable({ nodes, uploadId, chartCompanyName = 'Unknown', modifyDate: initialModifyDate }: { nodes: RawOrgNode[], uploadId: string | null, chartCompanyName?: string, modifyDate?: string | null }) {
    const [editingNode, setEditingNode] = useState<RawOrgNode | null>(null)
    const [isAddMode, setIsAddMode] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)
    const [modifyDate, setModifyDate] = useState<string | null>(initialModifyDate || null)
    const [creatingIds, setCreatingIds] = useState<Set<string>>(new Set())
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

    // Verification Dialog States
    const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false)
    const [nodeToVerify, setNodeToVerify] = useState<any | null>(null)
    const [isVerifyingNode, setIsVerifyingNode] = useState(false)

    const handleEdit = (node: RawOrgNode) => {
        setIsAddMode(false)
        setEditingNode(node)
        setIsOpen(true)
    }

    const handleAdd = () => {
        if (!uploadId) {
            toast.error("Please select or upload an organization first")
            return
        }
        setIsAddMode(true)
        setEditingNode(null)
        setIsOpen(true)
    }

    const handleSingleCreate = async (nodeId: string) => {
        try {
            setCreatingIds(prev => new Set(prev).add(nodeId))
            const res = await createSingleOrgProfile(nodeId)
            if (res.mode === 'n8n') {
                toast.success("Profile created! Webhook sent to n8n for experience retrieval.")
            } else {
                toast.success("Profile and Current Job experience created successfully.")
            }
        } catch (error) {
            console.error(error)
            toast.error("Profile creation failed.")
        } finally {
            setCreatingIds(prev => {
                const next = new Set(prev)
                next.delete(nodeId)
                return next
            })
        }
    }

    const handleVerifyChart = async () => {
        if (!uploadId) return
        try {
            setIsVerifying(true)
            const res = await verifyOrgChart(uploadId as string)
            if (res.success) {
                const now = new Date().toISOString()
                setModifyDate(now)
                toast.success("Org Chart verified and timestamp updated 🛡️")
            } else {
                toast.error("Failed to verify chart")
            }
        } catch (err) {
            toast.error("An error occurred during verification")
        } finally {
            setIsVerifying(false)
        }
    }

    const handleVerifyNode = (node: any) => {
        setNodeToVerify(node);
        setIsVerifyDialogOpen(true);
    }

    const handleConfirmVerification = async (nodeId: string, status: 'TRUE' | 'NOT_MATCH') => {
        if (!uploadId) return
        try {
            setIsVerifyingNode(true)
            const res = await verifyOrgNode(nodeId, status)
            if (res.success) {
                toast.success(status === 'TRUE' ? 'Verified as Correct Match' : 'Flagged as Error')
                setIsVerifyDialogOpen(false)
            } else {
                toast.error("Failed to verify node")
            }
        } catch (err) {
            toast.error("An error occurred")
        } finally {
            setIsVerifyingNode(false)
        }
    }

    const handleUnlinkNode = async (nodeId: string) => {
        if (!uploadId) return
        if (!confirm("Are you sure you want to unlink this candidate?")) return
        try {
            setProcessingIds(prev => new Set(prev).add(nodeId))
            const res = await unlinkOrgNode(nodeId, uploadId)
            if (res.success) {
                toast.success("Candidate unlinked")
            } else {
                toast.error("Failed to unlink")
            }
        } catch (err) {
            toast.error("An error occurred")
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev)
                next.delete(nodeId)
                return next
            })
        }
    }


    return (
        <TooltipProvider>
            <div className='flex flex-col h-full space-y-4 p-4'>
                {/* ... (Header Area) */}
                <div className='flex justify-between items-center pr-2 shrink-0'>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                            Last Verified
                        </span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 pl-1">
                            {modifyDate ? new Date(modifyDate).toLocaleString('th-TH', { 
                                day: '2-digit', month: '2-digit', year: 'numeric', 
                                hour: '2-digit', minute: '2-digit' 
                            }) : 'Never'}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            className="gap-2 bg-indigo-600 border-none text-white hover:bg-indigo-700 shadow-sm text-xs font-bold"
                            onClick={handleVerifyChart}
                            disabled={isVerifying}
                        >
                            {isVerifying ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <UserCheck size={16} />
                            )}
                            Verify Chart
                        </Button>
                        <Button onClick={handleAdd} className="gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border-none shadow-sm text-xs font-bold">
                            <Plus size={16} />
                            Add Employee
                        </Button>
                    </div>
                </div>

                <div className='rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-auto flex-1 min-h-0 relative'>
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                            <TableRow>
                                <TableHead className="font-semibold">Employee Name</TableHead>
                                <TableHead className="font-semibold">Title</TableHead>
                                <TableHead className="font-semibold">Parent (Manager)</TableHead>
                                <TableHead className="font-semibold">Status/Match</TableHead>
                                <TableHead className='text-right font-semibold'>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {nodes.map((node) => {
                                const isVerified = node.is_verified === 'TRUE';
                                const isNotMatch = node.is_verified === 'NOT_MATCH';
                                const status = node.match_status || 'unmapped';
                                const isProcessing = processingIds.has((node as any).id?.toString() || node.node_id);

                                return (
                                    <TableRow key={node.node_id} className={cn(
                                        "hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors",
                                        isVerified && "bg-emerald-50/30",
                                        isNotMatch && "bg-rose-50/30"
                                    )}>
                                        <TableCell className='font-medium'>
                                            <div className='flex items-center gap-3'>
                                                <Avatar className="h-9 w-9 border shadow-sm">
                                                    <AvatarImage src={node.candidate?.photo || undefined} />
                                                    <AvatarFallback className="bg-slate-100 text-slate-600">
                                                        {node.name.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="text-sm">{node.name}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                            {node.title || <span className="opacity-30 italic">Not set</span>}
                                        </TableCell>
                                        <TableCell className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {node.parent_name || <span className='text-slate-400 italic font-normal'>None (Root)</span>}
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge node={node} />
                                        </TableCell>
                                        <TableCell className='text-right'>
                                            <div className="flex justify-end items-center gap-2">
                                                {status === 'unmapped' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 text-[10px] gap-1 text-emerald-600 hover:bg-emerald-50"
                                                        onClick={() => handleSingleCreate(node.node_id)}
                                                        disabled={creatingIds.has(node.node_id)}
                                                    >
                                                        {creatingIds.has(node.node_id) ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                                                        Create Profile
                                                    </Button>
                                                )}
                                                
                                                {(status === 'mismatch_company' || status === 'mismatch_position' || isNotMatch) && !isVerified && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 text-[10px] gap-1 text-amber-600 hover:bg-amber-50"
                                                        onClick={() => handleVerifyNode(node)}
                                                        disabled={isProcessing}
                                                    >
                                                        <Check size={12} />
                                                        Verify
                                                    </Button>
                                                )}

                                                {node.matched_candidate_id && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 text-[10px] gap-1 text-rose-600 hover:bg-rose-50"
                                                        onClick={() => handleUnlinkNode(node.node_id)}
                                                        disabled={isProcessing}
                                                    >
                                                        <Unlink size={12} />
                                                        Unlink
                                                    </Button>
                                                )}

                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(node)} className="h-8 w-8">
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>

                <NodeFormDialog 
                    isOpen={isOpen}
                    onOpenChange={setIsOpen}
                    uploadId={uploadId}
                    nodes={nodes}
                    editingNode={editingNode}
                    isAddMode={isAddMode}
                />

                <VerificationDialog 
                    isOpen={isVerifyDialogOpen}
                    onClose={() => setIsVerifyDialogOpen(false)}
                    node={nodeToVerify}
                    chartCompanyName={chartCompanyName}
                    onConfirmMatch={(id) => handleConfirmVerification(id, 'TRUE')}
                    onFlagError={(id) => handleConfirmVerification(id, 'NOT_MATCH')}
                    isProcessing={isVerifyingNode}
                />
            </div>
        </TooltipProvider>
    )
}

function StatusBadge({ node }: { node: RawOrgNode }) {
    const isVerified = node.is_verified === 'TRUE'
    const isNotMatch = node.is_verified === 'NOT_MATCH'
    const status = node.match_status
    const current = node.current_experience

    if (isVerified || status === 'matched') {
        return (
            <div className='flex items-center gap-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full w-fit text-[11px] font-bold border border-emerald-100'>
                <UserCheck size={14} />
                <span>{isVerified ? 'VERIFIED' : 'MATCHED'}</span>
            </div>
        )
    }

    if (isNotMatch || status === 'mismatch_company') {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className='flex items-center gap-2 text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-3 py-1 rounded-full w-fit text-[11px] font-bold border border-rose-100 cursor-help'>
                        <AlertCircle size={14} />
                        <span>{isNotMatch ? 'MANUAL ERROR' : 'CO. MISMATCH'}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent className="p-3 max-w-[280px]">
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-rose-600">{isNotMatch ? 'Marked as Not a Match' : 'Company Mismatch Detected'}</p>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="text-slate-400">ATS Profile:</div>
                            <div className="font-bold text-rose-700">{current?.company || 'N/A'}</div>
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        )
    }

    if (status === 'mismatch_position') {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className='flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full w-fit text-[11px] font-bold border border-amber-100 cursor-help'>
                        <Info size={14} />
                        <span>POS. MISMATCH</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent className="p-3 max-w-[280px]">
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-amber-600">Position Mismatch (Verify Recommended)</p>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="text-slate-400">Expected:</div>
                            <div className="font-bold text-slate-700">{node.title || 'N/A'}</div>
                            <div className="text-slate-400">Actual (ATS):</div>
                            <div className="font-bold text-amber-700">{current?.position || 'N/A'}</div>
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        )
    }

    if (status === 'n8n_processing') {
        return (
            <div className='flex items-center gap-2 text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full w-fit text-[11px] font-medium border animate-pulse'>
                <Loader2 size={14} className="animate-spin" />
                <span>PENDING N8N</span>
            </div>
        )
    }

    return (
        <div className='flex items-center gap-2 text-slate-400 px-3 py-1 text-[11px] font-medium'>
            <AlertCircle size={14} />
            <span>UNMATCHED</span>
        </div>
    )
}

