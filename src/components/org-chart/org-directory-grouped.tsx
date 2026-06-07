'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Search, Globe } from 'lucide-react'
import type { DirectoryUpload, AgingBucket } from '@/app/actions/org-chart-actions'

type Props = {
    uploads: DirectoryUpload[]
}

const AGING_META: Record<AgingBucket, { label: string; dot: string; text: string }> = {
    fresh: { label: 'Updated < 3 months', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
    aging: { label: 'Updated 3-9 months', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
    stale: { label: 'Updated > 9 months', dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
    unknown: { label: 'No update date', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
}

const AGING_ORDER: AgingBucket[] = ['fresh', 'aging', 'stale', 'unknown']

// Plain codepoint comparison — avoids localeCompare, whose collation differs
// between Node (SSR) and the browser (CSR) and causes hydration mismatches.
function compareNames(a: string, b: string) {
    const la = a.toLowerCase()
    const lb = b.toLowerCase()
    if (la < lb) return -1
    if (la > lb) return 1
    return 0
}

export function OrgDirectoryGrouped({ uploads }: Props) {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState('')

    const agingCounts = useMemo(() => {
        const counts: Record<AgingBucket, number> = { fresh: 0, aging: 0, stale: 0, unknown: 0 }
        uploads.forEach(u => { counts[u.aging_bucket]++ })
        return counts
    }, [uploads])

    // Group -> Industry -> Companies (alphabetical)
    const groups = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        const filtered = term
            ? uploads.filter(u =>
                u.company_name.toLowerCase().includes(term) ||
                (u.notes && u.notes.toLowerCase().includes(term)) ||
                (u.resolved_industry && u.resolved_industry.toLowerCase().includes(term)) ||
                u.resolved_group.toLowerCase().includes(term)
            )
            : uploads

        const byGroup = new Map<string, DirectoryUpload[]>()
        filtered.forEach(u => {
            if (!byGroup.has(u.resolved_group)) byGroup.set(u.resolved_group, [])
            byGroup.get(u.resolved_group)!.push(u)
        })

        const groupNames = [...byGroup.keys()].sort((a, b) => {
            if (a === 'Uncategorized') return 1
            if (b === 'Uncategorized') return -1
            return compareNames(a, b)
        })

        return groupNames.map(groupName => {
            const items = byGroup.get(groupName)!
            const byIndustry = new Map<string, DirectoryUpload[]>()
            items.forEach(u => {
                const key = u.resolved_industry || 'Uncategorized'
                if (!byIndustry.has(key)) byIndustry.set(key, [])
                byIndustry.get(key)!.push(u)
            })

            const industryNames = [...byIndustry.keys()].sort((a, b) => {
                if (a === 'Uncategorized') return 1
                if (b === 'Uncategorized') return -1
                return compareNames(a, b)
            })

            return {
                groupName,
                count: items.length,
                industries: industryNames.map(industryName => ({
                    industryName,
                    companies: [...byIndustry.get(industryName)!].sort((a, b) =>
                        compareNames(a.company_name, b.company_name)
                    ),
                }))
            }
        })
    }, [uploads, searchTerm])

    if (uploads.length === 0) return null

    return (
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col shrink-0">
            {/* Header / Search / Legend */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-900/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 shrink-0">
                    <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                        <Globe size={16} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 italic">Organization Directory</h2>
                        <p className="text-[10px] text-slate-500 font-medium">Grouped by industry · Total {uploads.length} org charts</p>
                    </div>
                </div>

                {/* Aging Legend */}
                <div className="hidden lg:flex items-center gap-3 text-[10px] font-bold shrink-0">
                    {AGING_ORDER.filter(b => b !== 'unknown' || agingCounts.unknown > 0).map(bucket => (
                        <div key={bucket} className="flex items-center gap-1.5">
                            <span className={cn('h-2 w-2 rounded-full', AGING_META[bucket].dot)} />
                            <span className={AGING_META[bucket].text}>
                                {AGING_META[bucket].label} ({agingCounts[bucket]})
                            </span>
                        </div>
                    ))}
                </div>

                <div className="relative w-64 shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search company, industry..."
                        className="h-9 pl-9 text-xs bg-white dark:bg-slate-950 shadow-sm border-slate-200 dark:border-slate-800 focus:ring-indigo-500 rounded-lg"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                    {groups.map(group => (
                        <div
                            key={group.groupName}
                            className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950"
                        >
                            <div className="px-3 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                    {group.groupName}
                                </h3>
                                <span className="text-sm font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-full px-2.5 py-0.5">
                                    {group.count} {group.count === 1 ? 'company' : 'companies'}
                                </span>
                            </div>
                            <div className="p-3 flex flex-col gap-3">
                                {group.industries.map(industry => (
                                    <div key={industry.industryName} className="flex flex-col gap-1">
                                        {group.industries.length > 1 && (
                                            <div className="flex items-center justify-between px-1">
                                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                                                    {industry.industryName}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {industry.companies.length} {industry.companies.length === 1 ? 'company' : 'companies'}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex flex-col gap-0.5">
                                            {industry.companies.map(u => {
                                                const aging = AGING_META[u.aging_bucket]
                                                const hasBranch = !!(u.branch_name && u.branch_name !== u.company_name)
                                                return (
                                                    <button
                                                        key={u.upload_id}
                                                        onClick={() => router.push(`/org-chart/${u.upload_id}`)}
                                                        title={`${u.company_name}${u.branch_name ? ` — ${u.branch_name}` : ''}${u.notes ? `\n${u.notes}` : ''}\n${aging.label}`}
                                                        className="text-[11px] px-2 py-1 rounded-md text-left transition-all hover:bg-slate-50 dark:hover:bg-slate-900 hover:shadow-sm border border-transparent flex items-center gap-2"
                                                    >
                                                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', aging.dot)} />
                                                        <span className="flex flex-col flex-1 min-w-0">
                                                            <span className={cn('truncate font-medium', aging.text)}>{u.company_name}</span>
                                                            {hasBranch && (
                                                                <span className="truncate text-[10px] font-bold text-indigo-400">
                                                                    {u.branch_name}
                                                                </span>
                                                            )}
                                                        </span>
                                                        {u.status === 'Processing' && (
                                                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-bold rounded animate-pulse shrink-0">
                                                                Processing...
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {groups.length === 0 && (
                        <div className="col-span-full text-center text-xs text-slate-400 py-10 italic">
                            No organizations match your search.
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
