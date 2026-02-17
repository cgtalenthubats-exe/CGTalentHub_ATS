'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

type Upload = {
    upload_id: string
    company_name: string
    created_at: string
}

type OrgDirectoryProps = {
    uploads: Upload[]
    currentId: string | null
}

export function OrgDirectory({ uploads, currentId }: OrgDirectoryProps) {
    const router = useRouter()

    // Group and stabilize uploads (Pre-sorted)
    const { grouped, initialLetter } = useMemo(() => {
        const sortedUploads = [...uploads].sort((a, b) =>
            a.company_name < b.company_name ? -1 : a.company_name > b.company_name ? 1 : 0
        )

        const groups: Record<string, Upload[]> = {}
        sortedUploads.forEach(u => {
            const firstLetter = u.company_name.charAt(0).toUpperCase()
            if (!groups[firstLetter]) groups[firstLetter] = []
            groups[firstLetter].push(u)
        })

        const available = Object.keys(groups).sort()
        const selectedCompany = uploads.find(u => u.upload_id === currentId)
        const letter = selectedCompany
            ? selectedCompany.company_name.charAt(0).toUpperCase()
            : available[0] || 'A'

        return { grouped: groups, initialLetter: letter }
    }, [uploads, currentId])

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const [selectedLetter, setSelectedLetter] = useState(initialLetter)

    // Sync selectedLetter if initialLetter changes (e.g. navigation)
    useEffect(() => {
        setSelectedLetter(initialLetter)
    }, [initialLetter])

    const handleCompanyClick = (uploadId: string) => {
        router.push(`/org-chart?id=${uploadId}`)
    }

    if (uploads.length === 0) return null

    return (
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden flex flex-col shrink-0">
            {/* Alphabet Row (Top) */}
            <div className="flex flex-wrap gap-0.5 p-1.5 border-b border-slate-100 dark:border-slate-900 justify-center bg-slate-50/30 dark:bg-slate-900/10">
                {alphabet.map(letter => {
                    const hasCompanies = !!grouped[letter]
                    const isSelected = selectedLetter === letter

                    return (
                        <button
                            key={letter}
                            onClick={() => hasCompanies && setSelectedLetter(letter)}
                            disabled={!hasCompanies}
                            className={cn(
                                "w-6 h-6 flex items-center justify-center rounded text-[9px] font-bold transition-all",
                                isSelected
                                    ? "bg-indigo-600 text-white shadow-sm"
                                    : hasCompanies
                                        ? "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                                        : "text-slate-200 dark:text-slate-800 cursor-not-allowed"
                            )}
                        >
                            {letter}
                        </button>
                    )
                })}
            </div>

            {/* Companies Row (Bottom) */}
            <div className="bg-slate-50/50 dark:bg-slate-900/50">
                <ScrollArea className="w-full">
                    <div className="flex p-1.5 gap-1.5 items-center min-h-[38px]">
                        <div className="shrink-0 px-2 border-r border-slate-200 dark:border-slate-800 mr-1">
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                {selectedLetter}
                            </span>
                        </div>
                        {grouped[selectedLetter]?.map((upload) => {
                            const isActive = upload.upload_id === currentId
                            return (
                                <button
                                    key={upload.upload_id}
                                    onClick={() => handleCompanyClick(upload.upload_id)}
                                    className={cn(
                                        "px-3 py-1 rounded text-[11px] transition-all whitespace-nowrap border shrink-0",
                                        isActive
                                            ? "bg-indigo-600 text-white border-indigo-600 font-medium shadow-sm"
                                            : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                                    )}
                                >
                                    {upload.company_name}
                                </button>
                            )
                        })}
                        {(!grouped[selectedLetter] || grouped[selectedLetter].length === 0) && (
                            <div className="px-3 text-slate-400 text-[10px] italic">
                                No companies for "{selectedLetter}"
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    )
}
