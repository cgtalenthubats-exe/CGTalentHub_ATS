'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Search, Globe, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
    const [searchTerm, setSearchTerm] = useState('')
    const [isExpanded, setIsExpanded] = useState(!currentId) // Auto-collapse if already viewing an org

    // Group and stabilize uploads (Pre-sorted)
    const grouped = useMemo(() => {
        const sortedUploads = [...uploads].sort((a, b) => {
            const nameA = a.company_name.toLowerCase();
            const nameB = b.company_name.toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        })

        const groups: Record<string, Upload[]> = {}
        sortedUploads.forEach(u => {
            const firstChar = u.company_name.charAt(0).toUpperCase()
            const key = /^[A-Z]$/.test(firstChar) ? firstChar : '#'
            if (!groups[key]) groups[key] = []
            groups[key].push(u)
        })
        return groups
    }, [uploads])

    const filteredGrouped = useMemo(() => {
        if (!searchTerm.trim()) return grouped

        const filtered: Record<string, Upload[]> = {}
        Object.entries(grouped).forEach(([letter, items]) => {
            const matched = items.filter(u =>
                u.company_name.toLowerCase().includes(searchTerm.toLowerCase())
            )
            if (matched.length > 0) filtered[letter] = matched
        })
        return filtered
    }, [grouped, searchTerm])

    // Layout configuration (4 rows vertical)
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('')
    const columns = []
    for (let i = 0; i < alphabet.length; i += 4) {
        columns.push(alphabet.slice(i, i + 4))
    }

    const handleCompanyClick = (uploadId: string) => {
        router.push(`/org-chart?id=${uploadId}`)
    }

    if (uploads.length === 0) return null

    return (
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col shrink-0">
            {/* Header / Search */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-900/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 p-0"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </Button>
                    <div className="bg-indigo-600 p-1.5 rounded-lg text-white cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                        <Globe size={16} />
                    </div>
                    <div className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 italic">Organization Directory</h2>
                        <p className="text-[10px] text-slate-500 font-medium">Browse and search structural data</p>
                    </div>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search company..."
                        className="h-9 pl-9 text-xs bg-white dark:bg-slate-950 shadow-sm border-slate-200 dark:border-slate-800 focus:ring-indigo-500 rounded-lg"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Vertical Flow Directory Grid */}
            {isExpanded && (
                <ScrollArea className="h-48 transition-all duration-300">
                    <div className="p-4 grid grid-rows-4 grid-flow-col gap-x-8 gap-y-4 auto-cols-max overflow-x-auto">
                        {alphabet.map(letter => {
                            const items = filteredGrouped[letter]
                            const hasItems = items && items.length > 0

                            // If searching, hide letters that don't match
                            if (searchTerm && !hasItems) return null

                            return (
                                <div key={letter} className="flex flex-col gap-1.5 min-w-[120px]">
                                    <div className={cn(
                                        "text-xs font-black px-2 py-0.5 rounded border-l-4 w-fit mb-1",
                                        hasItems
                                            ? "text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-600"
                                            : "text-slate-300 dark:text-slate-700 bg-slate-50/30 dark:bg-slate-900/10 border-slate-200 dark:border-slate-800"
                                    )}>
                                        {letter === '#' ? 'Others' : letter}
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        {items?.map(u => (
                                            <button
                                                key={u.upload_id}
                                                onClick={() => handleCompanyClick(u.upload_id)}
                                                className={cn(
                                                    "text-[11px] px-2 py-1 rounded-md text-left transition-all truncate hover:bg-white dark:hover:bg-slate-900 hover:shadow-sm border border-transparent",
                                                    u.upload_id === currentId
                                                        ? "text-indigo-600 font-bold bg-indigo-50/30 dark:bg-indigo-900/20 border-indigo-200 shadow-sm"
                                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100"
                                                )}
                                            >
                                                {u.company_name}
                                            </button>
                                        ))}
                                        {!hasItems && !searchTerm && (
                                            <div className="text-[11px] px-2 text-slate-300 dark:text-slate-800 italic">
                                                -
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </ScrollArea>
            )}
        </div>
    )
}
