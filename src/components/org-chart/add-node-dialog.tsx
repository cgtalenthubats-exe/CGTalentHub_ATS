'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, User, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/notifications'
import { createOrgNode, getOrgChartNodesBrief } from '@/app/actions/org-chart-actions'

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    uploadId: string
}

type NodeBrief = { node_id: string; name: string; title: string | null }

export function AddNodeDialog({ open, onOpenChange, uploadId }: Props) {
    const [nodeType, setNodeType] = useState<'person' | 'group'>('person')
    const [name, setName] = useState('')
    const [title, setTitle] = useState('')
    const [parentNodeId, setParentNodeId] = useState<string>('__root__')
    const [existingNodes, setExistingNodes] = useState<NodeBrief[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    useEffect(() => {
        if (open && uploadId) {
            getOrgChartNodesBrief(uploadId).then(setExistingNodes)
        }
    }, [open, uploadId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) { toast.error('Name is required'); return }

        // Resolve parent name from node_id
        const parentName = parentNodeId === '__root__'
            ? null
            : existingNodes.find(n => n.node_id === parentNodeId)?.name ?? null

        setIsLoading(true)
        try {
            await createOrgNode(uploadId, {
                name: name.trim(),
                title: title.trim() || null,
                parent_name: parentName,
                matched_candidate_id: null,
                linkedin: null,
                is_verified: 'FALSE',
                is_group_node: nodeType === 'group'
            })
            toast.success(`Node "${name}" added`)
            setName('')
            setTitle('')
            setParentNodeId('__root__')
            onOpenChange(false)
            router.refresh()
        } catch (err: any) {
            toast.error('Failed to add node: ' + err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Add Node</DialogTitle>
                    <DialogDescription>Add a new node to this org chart manually.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        {/* Node type toggle */}
                        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setNodeType('person')}
                                className={cn("flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors",
                                    nodeType === 'person' ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50")}
                            >
                                <User size={13} /> Person
                            </button>
                            <button
                                type="button"
                                onClick={() => setNodeType('group')}
                                className={cn("flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors",
                                    nodeType === 'group' ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50")}
                            >
                                <Building2 size={13} /> Group / Branch
                            </button>
                        </div>

                        <div className="grid gap-2">
                            <Label>Name</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={nodeType === 'group' ? 'e.g. SALA Bangkok Branch' : 'e.g. John Smith'}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>{nodeType === 'group' ? 'Sub-label (Optional)' : 'Title / Position'}</Label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={nodeType === 'group' ? 'e.g. Bangkok HQ' : 'e.g. General Manager'}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Reports To</Label>
                            <Select value={parentNodeId} onValueChange={setParentNodeId} disabled={isLoading}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select parent node" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__root__">— No parent (Root node) —</SelectItem>
                                    {existingNodes.map((n) => (
                                        <SelectItem key={n.node_id} value={n.node_id}>
                                            {n.name}{n.title ? ` · ${n.title}` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isLoading}>
                            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</> : 'Add Node'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
