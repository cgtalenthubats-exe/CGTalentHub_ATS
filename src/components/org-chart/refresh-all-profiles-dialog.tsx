'use client'

import React, { useState } from 'react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2, User } from 'lucide-react'
import { toast } from '@/lib/notifications'
import { triggerCandidateRefresh } from '@/app/actions/n8n-actions'

export type RefreshableCandidate = { id: string; name: string; linkedin: string | null }

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    candidates: RefreshableCandidate[]
}

export function RefreshAllProfilesDialog({ open, onOpenChange, candidates }: Props) {
    const [isSending, setIsSending] = useState(false)

    const handleConfirm = async () => {
        setIsSending(true)
        try {
            const result = await triggerCandidateRefresh(
                candidates.map((c) => ({ id: c.id, name: c.name, linkedin: c.linkedin || '' })),
                'Org Chart (Manual Trigger)'
            )
            if (!result.success) throw new Error(result.error)
            toast.success(`Sent ${candidates.length} candidates to n8n for refresh!`)
            onOpenChange(false)
        } catch (err: any) {
            toast.error('Failed to refresh: ' + err.message)
        } finally {
            setIsSending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[440px] grid-cols-1">
                <DialogHeader className="min-w-0">
                    <DialogTitle className="flex items-center gap-2">
                        <RefreshCw size={16} className="text-indigo-500" />
                        Refresh All Profiles
                    </DialogTitle>
                    <DialogDescription>
                        This sends every matched candidate on this org chart to n8n for a profile
                        refresh — same workflow as the Refresh Profile button on a single candidate.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-w-0 space-y-2 py-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} will be sent
                    </p>
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                        {candidates.length === 0 && (
                            <p className="p-4 text-xs text-slate-400 text-center">No matched candidates on this chart.</p>
                        )}
                        {candidates.map((c) => (
                            <div key={c.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                                <User size={12} className="text-slate-300 shrink-0" />
                                <span className="font-medium text-slate-700 truncate">{c.name || c.id}</span>
                                {!c.linkedin && (
                                    <span className="ml-auto text-[10px] text-amber-500 shrink-0">no LinkedIn</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter className="pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>Cancel</Button>
                    <Button
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                        disabled={isSending || candidates.length === 0}
                        onClick={handleConfirm}
                    >
                        {isSending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Send {candidates.length} to n8n
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
