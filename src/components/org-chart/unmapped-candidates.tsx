'use client'

import React, { useState, useEffect } from 'react'
import { getUnmappedCompanyCandidates, addUnmappedCandidateToOrgChart } from '@/app/actions/org-chart-actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CandidateAvatar } from '@/components/candidate-avatar'
import { UserPlus, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type UnmappedCandidatesProps = {
    companyId: string | null
    uploadId: string | null
}

export function UnmappedCandidates({ companyId, uploadId }: UnmappedCandidatesProps) {
    const [candidates, setCandidates] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [addingId, setAddingId] = useState<string | null>(null)

    useEffect(() => {
        if (!companyId || !uploadId) return

        let isMounted = true
        setIsLoading(true)

        getUnmappedCompanyCandidates(companyId, uploadId)
            .then(data => {
                if (isMounted) setCandidates(data)
            })
            .catch(err => {
                console.error("Failed to fetch unmapped candidates", err)
            })
            .finally(() => {
                if (isMounted) setIsLoading(false)
            })

        return () => { isMounted = false }
    }, [companyId, uploadId])

    const handleAdd = async (candidate: any) => {
        if (!uploadId) return
        setAddingId(candidate.candidate_id)
        try {
            await addUnmappedCandidateToOrgChart(
                uploadId,
                candidate.candidate_id,
                candidate.name,
                candidate.current_position,
                candidate.linkedin
            )
            toast.success(`${candidate.name} added to OrgChart!`)
            // Remove from list
            setCandidates(prev => prev.filter(c => c.candidate_id !== candidate.candidate_id))
        } catch (error: any) {
            toast.error("Failed to add candidate: " + error.message)
        } finally {
            setAddingId(null)
        }
    }

    if (!companyId || (!isLoading && candidates.length === 0)) return null

    return (
        <Card className="border-indigo-100 dark:border-indigo-900/30 shadow-sm bg-indigo-50/30 dark:bg-indigo-950/20 w-full">
            <CardHeader className="pb-2 pt-4 px-4 bg-white/50 dark:bg-slate-900/50 rounded-t-xl border-b border-indigo-50 dark:border-indigo-900/10">
                <div className="flex items-center gap-2">
                    <Users size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <CardTitle className="text-sm font-bold text-indigo-900 dark:text-indigo-300">Unmapped Employees</CardTitle>
                </div>
                <CardDescription className="text-[11px] leading-tight mt-1">
                    Found {candidates.length} active employees from your ATS not yet on this chart.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pt-3 pb-3">
                {isLoading ? (
                    <div className="flex justify-center p-6">
                        <Loader2 className="animate-spin text-indigo-400" size={24} />
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1 pb-1">
                        {candidates.map(candidate => (
                            <div key={candidate.candidate_id} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group">
                                <div className="flex items-center gap-3">
                                    <CandidateAvatar src={candidate.photo} name={candidate.name} className="h-8 w-8 ring-1 ring-slate-100 dark:ring-slate-800" />
                                    <div className="flex flex-col">
                                        <Link href={`/candidates/${candidate.candidate_id}`} target="_blank" className="text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 truncate max-w-[140px] transition-colors">
                                            {candidate.name}
                                        </Link>
                                        <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                            {candidate.current_position || 'Position unknown'}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-indigo-600 bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-900/30 dark:group-hover:bg-indigo-600 rounded-full transition-colors shrink-0 object-right"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleAdd(candidate);
                                    }}
                                    disabled={addingId === candidate.candidate_id}
                                    title="Add to OrgChart"
                                >
                                    {addingId === candidate.candidate_id ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
