'use client'

import React, { useState, useEffect } from 'react'
import { RawOrgNode, updateOrgNode, createOrgNode, searchCandidates, moveOrgNode } from '@/app/actions/org-chart-actions'
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
import { Search, X, Loader2, UserCheck } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/lib/notifications'
import { useRouter } from 'next/navigation'

interface NodeFormDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    uploadId: string | null
    nodes: any[] // For parent selection
    editingNode?: RawOrgNode | null
    defaultParentName?: string
    isAddMode?: boolean
    isMoveMode?: boolean
    hasChildren?: boolean
    onSuccess?: () => void
}

export function NodeFormDialog({
    isOpen,
    onOpenChange,
    uploadId,
    nodes,
    editingNode,
    defaultParentName,
    isAddMode = false,
    isMoveMode = false,
    hasChildren = false,
    onSuccess
}: NodeFormDialogProps) {
    const router = useRouter()
    const [isSaving, setIsSaving] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<{ id: string, name: string, photo: string | null }[]>([])
    const [isSearching, setIsSearching] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        title: '',
        parent_name: '',
        matched_candidate_id: '',
        matched_candidate_name: '',
        linkedin: ''
    })

    // Sync form data when props change
    useEffect(() => {
        if (isOpen) {
            if (isAddMode) {
                setFormData({
                    name: '',
                    title: '',
                    parent_name: defaultParentName || '',
                    matched_candidate_id: '',
                    matched_candidate_name: '',
                    linkedin: ''
                })
            } else if (editingNode) {
                setFormData({
                    name: editingNode.name,
                    title: editingNode.title || '',
                    parent_name: editingNode.parent_name || '',
                    matched_candidate_id: editingNode.matched_candidate_id || '',
                    matched_candidate_name: editingNode.candidate ? (editingNode.candidate.name || '') : '',
                    linkedin: editingNode.linkedin || ''
                })
            }
            setSearchQuery('')
            setSearchResults([])
        }
    }, [isOpen, isAddMode, editingNode, defaultParentName])

    // Candidate Search logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setIsSearching(true)
                try {
                    const results = await searchCandidates(searchQuery)
                    setSearchResults(results)
                } catch (err) {
                    console.error("Search failed:", err)
                } finally {
                    setIsSearching(false)
                }
            } else {
                setSearchResults([])
            }
        }, 500)

        return () => clearTimeout(delayDebounceFn)
    }, [searchQuery])

    const handleSave = async () => {
        if (!uploadId) return
        
        // Validation
        if (!isMoveMode && !formData.name) {
            toast.error("Name is required")
            return
        }

        setIsSaving(true)
        
        let loadingMsg = "Updating node..."
        if (isAddMode) loadingMsg = "Adding employee..."
        if (isMoveMode) loadingMsg = "Moving node..."
        
        const actionToast = toast.loading(loadingMsg)

        try {
            if (isMoveMode && editingNode) {
                // Move logic
                const res = await moveOrgNode(editingNode.node_id, formData.parent_name, hasChildren)
                if (res.success) {
                    toast.success("Node moved successfully", { id: actionToast })
                }
            } else {
                // Create or Replace/Edit logic
                const payload = {
                    name: formData.name,
                    title: formData.title,
                    parent_name: formData.parent_name,
                    matched_candidate_id: formData.matched_candidate_id || null,
                    linkedin: formData.linkedin || null,
                    is_verified: editingNode?.is_verified || false
                }

                if (isAddMode) {
                    await createOrgNode(uploadId, payload)
                    toast.success("Employee added successfully", { id: actionToast })
                } else if (editingNode) {
                    await updateOrgNode(editingNode.node_id, payload)
                    toast.success("Changes saved successfully", { id: actionToast })
                }
            }
            
            onOpenChange(false)
            if (onSuccess) onSuccess()
            router.refresh()
        } catch (error) {
            console.error(error)
            let errorMsg = isAddMode ? "Failed to add employee" : "Failed to update node"
            if (isMoveMode) errorMsg = "Failed to move node"
            toast.error(errorMsg, { id: actionToast })
        } finally {
            setIsSaving(false)
        }
    }

    const selectCandidate = (candidate: { id: string, name: string }) => {
        setFormData({
            ...formData,
            matched_candidate_id: candidate.id,
            matched_candidate_name: candidate.name
        })
        setSearchQuery('')
        setSearchResults([])
    }

    const clearCandidate = () => {
        setFormData({
            ...formData,
            matched_candidate_id: '',
            matched_candidate_name: ''
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        {isAddMode ? 'Add New Employee' : (isMoveMode ? 'Move Node' : 'Replace / Edit Node')}
                    </DialogTitle>
                    <DialogDescription>
                        {isAddMode 
                            ? 'Enter details for the new person in the chart.' 
                            : (isMoveMode 
                                ? `Choose a new manager for ${formData.name}.`
                                : 'Update info or replace the person in this position.')
                        }
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    {!isMoveMode && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="node-name">Full Name</Label>
                                <Input
                                    id="node-name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Full Name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="node-title">Job Title</Label>
                                <Input
                                    id="node-title"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="CEO / Manager"
                                />
                            </div>
                        </>
                    )}
                    
                    <div className="space-y-2">
                        <Label htmlFor="node-parent">Reporting To (Manager Name)</Label>
                        <Select 
                            value={formData.parent_name || 'none'} 
                            onValueChange={(val) => setFormData({ ...formData, parent_name: val === 'none' ? '' : val })}
                        >
                            <SelectTrigger id="node-parent" className="w-full bg-white dark:bg-slate-950">
                                <SelectValue placeholder="Select a manager" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[250px]">
                                <SelectItem value="none" className="italic text-slate-500">None (Root Level)</SelectItem>
                                {nodes
                                    .filter(n => !(editingNode && (n.node_id === editingNode.node_id || n.name === editingNode.name))) // Prevent selecting self or same name
                                    .map(node => (
                                        <SelectItem key={node.node_id || node.name} value={node.name}>
                                            {node.name} {node.title ? `— ${node.title}` : ''}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {!isMoveMode && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="node-linkedin-dialog" className="flex items-center gap-2">
                                    <Search size={14} /> Profile LinkedIn (Independent)
                                </Label>
                                <Input
                                    id="node-linkedin-dialog"
                                    value={formData.linkedin}
                                    onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                                    placeholder="https://www.linkedin.com/in/..."
                                />
                                <p className="text-[10px] text-slate-500 italic">
                                    Fill this if there is no matched candidate profile, but you still want to show a LinkedIn icon.
                                </p>
                            </div>

                            <div className="space-y-2 border-t pt-4">
                                <Label className="flex items-center gap-2 text-indigo-600 font-semibold mb-2">
                                    <UserCheck size={16} /> Candidate Profile Matching
                                </Label>

                                {formData.matched_candidate_id ? (
                                    <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 dark:bg-slate-800 border-indigo-200">
                                        <div className="flex items-center gap-2">
                                            <UserCheck className="text-green-500" size={18} />
                                            <span className="font-medium">{formData.matched_candidate_name}</span>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={clearCandidate} className="h-8 px-2 text-slate-500 hover:text-red-500">
                                            <X size={16} />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2 relative">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search candidate by name..."
                                                className="pl-9"
                                            />
                                            {isSearching && (
                                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                                            )}
                                        </div>

                                        {searchResults.length > 0 && (
                                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border rounded-lg shadow-xl max-h-[200px] overflow-auto">
                                                {searchResults.map(c => (
                                                    <div
                                                        key={c.id}
                                                        onClick={() => selectCandidate(c)}
                                                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-3 border-b last:border-0"
                                                    >
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={c.photo || undefined} />
                                                            <AvatarFallback>{c.name.substring(0, 2)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium">{c.name}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="button" onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700">
                        {isSaving && <Loader2 size={16} className="mr-2 animate-spin" />}
                        {isAddMode ? 'Create Node' : (isMoveMode ? 'Move Node' : 'Save Changes')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
