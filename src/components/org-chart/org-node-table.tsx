'use client'

import React, { useState, useEffect } from 'react'
import { RawOrgNode, updateOrgNode, createOrgNode, searchCandidates, createSingleOrgProfile, verifyOrgChart } from '@/app/actions/org-chart-actions'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Edit2, Plus, UserCheck, AlertCircle, Search, X, Loader2, UserPlus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { NodeFormDialog } from './node-form-dialog'

export function OrgNodeTable({ nodes, uploadId, modifyDate: initialModifyDate }: { nodes: RawOrgNode[], uploadId: string | null, modifyDate?: string | null }) {
    const [editingNode, setEditingNode] = useState<RawOrgNode | null>(null)
    const [isAddMode, setIsAddMode] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)
    const [modifyDate, setModifyDate] = useState<string | null>(initialModifyDate || null)
    const [creatingIds, setCreatingIds] = useState<Set<string>>(new Set())

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

    return (
        <div className='flex flex-col h-full space-y-4 p-4'>
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
                            <TableHead className="font-semibold">Matched Profile</TableHead>
                            <TableHead className='text-right font-semibold'>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {nodes.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className='h-32 text-center text-slate-400'>
                                    <div className="flex flex-col items-center gap-2">
                                        <AlertCircle size={32} className="opacity-20" />
                                        <p>No nodes found for this organization.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {nodes.map((node) => (
                            <TableRow key={node.node_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
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
                                    {node.matched_candidate_id ? (
                                        <div className='flex items-center gap-2 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-full w-fit text-[11px] font-bold border border-indigo-100 dark:border-indigo-800/30'>
                                            <UserCheck size={14} />
                                            <span>MATCHED</span>
                                        </div>
                                    ) : (
                                        <div className='flex items-center gap-2 text-slate-400 px-3 py-1 text-[11px] font-medium'>
                                            <AlertCircle size={14} />
                                            <span>UNMATCHED</span>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className='text-right'>
                                    <div className="flex justify-end items-center gap-2">
                                        {!node.matched_candidate_id && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 text-[10px] gap-1 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                                onClick={() => handleSingleCreate(node.node_id)}
                                                disabled={creatingIds.has(node.node_id)}
                                            >
                                                {creatingIds.has(node.node_id) ? (
                                                    <Loader2 size={12} className="animate-spin" />
                                                ) : (
                                                    <UserPlus size={12} />
                                                )}
                                                Create Profile
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(node)} className="h-8 w-8 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/10">
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
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

        </div>
    )
}
