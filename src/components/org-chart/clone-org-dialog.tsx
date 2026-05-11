'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, GitFork } from 'lucide-react'
import { toast } from '@/lib/notifications'
import { cloneOrgAsSubtree, getOrgChartNodesBrief } from '@/app/actions/org-chart-actions'

type NodeBrief = { node_id: string; name: string; title: string | null }

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    targetUploadId: string
    allUploads: { upload_id: string; company_name: string; branch_name?: string | null }[]
}

export function CloneOrgDialog({ open, onOpenChange, targetUploadId, allUploads }: Props) {
    const [sourceUploadId, setSourceUploadId] = useState('')
    const [parentNodeId, setParentNodeId] = useState('__root__')
    const [existingNodes, setExistingNodes] = useState<NodeBrief[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const otherUploads = allUploads.filter((u) => u.upload_id !== targetUploadId)

    useEffect(() => {
        if (open && targetUploadId) {
            getOrgChartNodesBrief(targetUploadId).then(setExistingNodes)
        }
    }, [open, targetUploadId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!sourceUploadId) { toast.error('Please select a source org chart'); return }

        // Resolve parent node name from node_id
        const parentNodeName = parentNodeId === '__root__'
            ? null
            : existingNodes.find(n => n.node_id === parentNodeId)?.name ?? null

        setIsLoading(true)
        try {
            const result = await cloneOrgAsSubtree(targetUploadId, sourceUploadId, parentNodeName)
            if (result.success) {
                toast.success(`Cloned ${result.count} nodes successfully`)
                setSourceUploadId('')
                setParentNodeId('__root__')
                onOpenChange(false)
                router.refresh()
            } else {
                toast.error(result.error || 'Clone failed')
            }
        } catch (err: any) {
            toast.error('Failed to clone: ' + err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <GitFork size={16} className="text-indigo-600" />
                        Clone Org as Subtree
                    </DialogTitle>
                    <DialogDescription>
                        Copy an existing org chart and attach it as a branch inside this org.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Source Org Chart</Label>
                            <Select value={sourceUploadId} onValueChange={setSourceUploadId} disabled={isLoading}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select org to clone from..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {otherUploads.map((u) => (
                                        <SelectItem key={u.upload_id} value={u.upload_id}>
                                            {u.branch_name ? `${u.company_name} — ${u.branch_name}` : u.company_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Attach Under</Label>
                            <Select value={parentNodeId} onValueChange={setParentNodeId} disabled={isLoading}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select parent node..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__root__">— No parent (Root level) —</SelectItem>
                                    {existingNodes.map((n) => (
                                        <SelectItem key={n.node_id} value={n.node_id}>
                                            {n.name}{n.title ? ` · ${n.title}` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg p-3">
                            All nodes from the selected org will be copied into this org. The original org will not be modified.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isLoading}>
                            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cloning...</> : 'Clone & Attach'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
