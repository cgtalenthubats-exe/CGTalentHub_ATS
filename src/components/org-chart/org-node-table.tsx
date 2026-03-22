'use client'

import React, { useState, useEffect } from 'react'
import { RawOrgNode, updateOrgNode, createOrgNode, searchCandidates, createSingleOrgProfile } from '@/app/actions/org-chart-actions'
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

export function OrgNodeTable({ nodes, uploadId }: { nodes: RawOrgNode[], uploadId: string | null }) {
    const [editingNode, setEditingNode] = useState<RawOrgNode | null>(null)
    const [isAddMode, setIsAddMode] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [creatingIds, setCreatingIds] = useState<Set<string>>(new Set())

    // Search State
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<{ id: string, name: string, photo: string | null }[]>([])
    const [isSearching, setIsSearching] = useState(false)

    // Edit/Add Form State
    const [formData, setFormData] = useState({
        name: '',
        title: '',
        parent_name: '',
        matched_candidate_id: '',
        matched_candidate_name: '', // For display
        linkedin: ''
    })

    const handleEdit = (node: RawOrgNode) => {
        setIsAddMode(false)
        setEditingNode(node)
        setFormData({
            name: node.name,
            title: node.title || '',
            parent_name: node.parent_name || '',
            matched_candidate_id: node.matched_candidate_id || '',
            matched_candidate_name: node.candidate ? (node.candidate.name || '') : '',
            linkedin: node.linkedin || ''
        })
        setSearchQuery('')
        setSearchResults([])
        setIsOpen(true)
    }

    const handleAdd = () => {
        if (!uploadId) {
            toast.error("Please select or upload an organization first")
            return
        }
        setIsAddMode(true)
        setEditingNode(null)
        setFormData({
            name: '',
            title: '',
            parent_name: '',
            matched_candidate_id: '',
            matched_candidate_name: '',
            linkedin: ''
        })
        setSearchQuery('')
        setSearchResults([])
        setIsOpen(true)
    }

    const handleSave = async () => {
        if (!uploadId) return

        try {
            const payload = {
                name: formData.name,
                title: formData.title,
                parent_name: formData.parent_name,
                matched_candidate_id: formData.matched_candidate_id || null,
                linkedin: formData.linkedin || null
            }

            if (isAddMode) {
                await createOrgNode(uploadId, payload)
                toast.success("Employee added successfully")
            } else if (editingNode) {
                await updateOrgNode(editingNode.node_id, payload)
                toast.success("Node updated successfully")
            }
            setIsOpen(false)
        } catch (error) {
            console.error(error)
            toast.error(isAddMode ? "Failed to add employee" : "Failed to update node")
        }
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

    // Effect for searching candidates
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
        <div className='flex flex-col h-full space-y-4 p-4'>
            <div className='flex justify-end pr-2 shrink-0'>
                <Button onClick={handleAdd} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                    <Plus size={16} />
                    Add Employee
                </Button>
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

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{isAddMode ? 'Add New Employee' : 'Edit Node Details'}</DialogTitle>
                        <DialogDescription>
                            {isAddMode ? 'Enter details for the new person in the chart.' : 'Update the organization node information.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Jakkrit Keeratichokchaikun"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="title">Job Title</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="CEO / Manager"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="parent">Reporting To (Manager Name)</Label>
                            <Select 
                                value={formData.parent_name || 'none'} 
                                onValueChange={(val) => setFormData({ ...formData, parent_name: val === 'none' ? '' : val })}
                            >
                                <SelectTrigger id="parent" className="w-full bg-white dark:bg-slate-950">
                                    <SelectValue placeholder="Select a manager" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[250px]">
                                    <SelectItem value="none" className="italic text-slate-500">None (Root Level)</SelectItem>
                                    {nodes
                                        .filter(n => !(editingNode && n.node_id === editingNode.node_id)) // Prevent selecting self
                                        .map(node => (
                                            <SelectItem key={node.node_id} value={node.name}>
                                                {node.name} {node.title ? `— ${node.title}` : ''}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="node-linkedin" className="flex items-center gap-2">
                                <Search size={14} /> Profile LinkedIn (Independent)
                            </Label>
                            <Input
                                id="node-linkedin"
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
                                    <p className="text-[11px] text-slate-500 italic pl-1">
                                        Search for an existing candidate in the system to link them to this chart node.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                        <Button type="submit" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
                            {isAddMode ? 'Create Node' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
