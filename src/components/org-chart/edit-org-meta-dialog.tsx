'use client'

import React, { useState } from 'react'
import { Pencil, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateOrgUploadMeta } from '@/app/actions/org-chart-actions'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/notifications'

type Props = {
    uploadId: string
    companyName: string
    notes?: string | null
    branchName?: string | null
}

export function EditOrgMetaDialog({ uploadId, companyName, notes, branchName }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [name, setName] = useState(companyName)
    const [note, setNote] = useState(notes ?? '')
    const [branch, setBranch] = useState(branchName ?? '')

    const handleOpen = () => {
        setName(companyName)
        setNote(notes ?? '')
        setBranch(branchName ?? '')
        setOpen(true)
    }

    const handleSave = async () => {
        if (!name.trim()) return
        setSaving(true)
        const result = await updateOrgUploadMeta(uploadId, {
            company_name: name.trim(),
            notes: note.trim() || undefined,
            branch_name: branch.trim() || undefined,
        })
        setSaving(false)
        if (result.success) {
            toast.success('Updated successfully')
            setOpen(false)
            router.refresh()
        } else {
            toast.error(result.error ?? 'Failed to update')
        }
    }

    return (
        <>
            <button
                onClick={handleOpen}
                className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 rounded"
                title="Edit org info"
            >
                <Pencil size={12} />
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-black">Edit Org Info</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600">Company Name</Label>
                            <Input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="h-9 text-sm"
                                placeholder="Company name"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600">Branch / Division</Label>
                            <Input
                                value={branch}
                                onChange={e => setBranch(e.target.value)}
                                className="h-9 text-sm"
                                placeholder="e.g. HQ, SALA Samui Choengmon Beach Resort"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600">Notes</Label>
                            <Input
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                className="h-9 text-sm"
                                placeholder="Internal notes..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
