'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { FilterMultiSelect } from '@/components/ui/filter-multi-select'
import { Search, Globe, Layers, Building2, CalendarClock } from 'lucide-react'
import type { DirectoryUpload, AgingBucket } from '@/app/actions/org-chart-actions'

type Props = {
    uploads: DirectoryUpload[]
}

const AGING_META: Record<AgingBucket, { label: string; short: string; dot: string; text: string; bg: string }> = {
    fresh: { label: 'Updated < 3 months', short: '< 3 months', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    aging: { label: 'Updated 3-9 months', short: '3-9 months', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    stale: { label: 'Updated > 9 months', short: '> 9 months', dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30' },
    unknown: { label: 'No update date', short: 'No date', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
}

const AGING_ORDER: AgingBucket[] = ['fresh', 'aging', 'stale', 'unknown']
const AGING_FILTER_OPTIONS = AGING_ORDER.filter(b => b !== 'unknown').map(b => AGING_META[b].short)

const GROUP_ORDER = [
    'Retail / FMCG / F&B',
    'Technology / Digital / Telecom',
    'Hospitality & Real Estate',
    'Financial Services / Banking / Insurance',
    'Consulting Firm / Consulting Services',
    'Others',
]

// Groups pinned first, in this exact order — remaining groups follow, sorted by company count desc
const PINNED_GROUPS = ['Retail / FMCG / F&B', 'Hospitality & Real Estate']

function groupRank(name: string) {
    if (name === 'Uncategorized') return GROUP_ORDER.length + 1
    const idx = GROUP_ORDER.indexOf(name)
    return idx === -1 ? GROUP_ORDER.length : idx
}

// Plain codepoint comparison — avoids localeCompare, whose collation differs
// between Node (SSR) and the browser (CSR) and causes hydration mismatches.
function compareNames(a: string, b: string) {
    const la = a.toLowerCase()
    const lb = b.toLowerCase()
    if (la < lb) return -1
    if (la > lb) return 1
    return 0
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatModifyDate(modifyDate: string | null) {
    if (!modifyDate) return null
    const d = new Date(modifyDate)
    if (Number.isNaN(d.getTime())) return null
    return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`
}

function toggleInArray(arr: string[], value: string) {
    return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
}

export function OrgDirectoryGrouped({ uploads }: Props) {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState('')
    const [groupFilter, setGroupFilter] = useState<string[]>([])
    const [industryFilter, setIndustryFilter] = useState<string[]>([])
    const [agingFilter, setAgingFilter] = useState<string[]>([])

    const agingCounts = useMemo(() => {
        const counts: Record<AgingBucket, number> = { fresh: 0, aging: 0, stale: 0, unknown: 0 }
        uploads.forEach(u => { counts[u.aging_bucket]++ })
        return counts
    }, [uploads])

    const groupOptions = useMemo(() => {
        const names = new Set(uploads.map(u => u.resolved_group))
        return [...names].sort((a, b) => {
            const ra = groupRank(a)
            const rb = groupRank(b)
            if (ra !== rb) return ra - rb
            return compareNames(a, b)
        })
    }, [uploads])

    const industryOptions = useMemo(() => {
        const names = new Set<string>()
        uploads.forEach(u => { if (u.resolved_industry) names.add(u.resolved_industry) })
        return [...names].sort(compareNames)
    }, [uploads])

    // Group -> Industry -> Companies (alphabetical)
    const groups = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        const filtered = uploads.filter(u => {
            if (groupFilter.length > 0 && !groupFilter.includes(u.resolved_group)) return false
            if (industryFilter.length > 0 && (!u.resolved_industry || !industryFilter.includes(u.resolved_industry))) return false
            if (agingFilter.length > 0 && !agingFilter.includes(AGING_META[u.aging_bucket].short)) return false
            if (!term) return true
            return (
                u.company_name.toLowerCase().includes(term) ||
                (u.notes && u.notes.toLowerCase().includes(term)) ||
                (u.resolved_industry && u.resolved_industry.toLowerCase().includes(term)) ||
                u.resolved_group.toLowerCase().includes(term)
            )
        })

        const byGroup = new Map<string, DirectoryUpload[]>()
        filtered.forEach(u => {
            if (!byGroup.has(u.resolved_group)) byGroup.set(u.resolved_group, [])
            byGroup.get(u.resolved_group)!.push(u)
        })

        const groupNames = [...byGroup.keys()].sort((a, b) => {
            const pa = PINNED_GROUPS.indexOf(a)
            const pb = PINNED_GROUPS.indexOf(b)
            if (pa !== -1 || pb !== -1) {
                if (pa === -1) return 1
                if (pb === -1) return -1
                return pa - pb
            }
            const countDiff = byGroup.get(b)!.length - byGroup.get(a)!.length
            if (countDiff !== 0) return countDiff
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
    }, [uploads, searchTerm, groupFilter, industryFilter, agingFilter])

    if (uploads.length === 0) return null

    return (
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col shrink-0">
            {/* Header / Search / Legend */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-900/10 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 shrink-0">
                    <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                        <Globe size={16} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 italic">Organization Directory</h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Grouped by industry</p>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Stats Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex flex-col items-center justify-center bg-slate-900 dark:bg-slate-800 text-white rounded-xl px-4 py-2 min-w-[80px] leading-none">
                            <span className="text-2xl font-black">{uploads.length}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wide opacity-70 mt-1">Total Org</span>
                        </div>
                        {AGING_ORDER.filter(b => b !== 'unknown' || agingCounts.unknown > 0).map(bucket => (
                            <div
                                key={bucket}
                                className={cn('flex flex-col items-center justify-center rounded-xl px-4 py-2 min-w-[80px] leading-none', AGING_META[bucket].bg)}
                                title={AGING_META[bucket].label}
                            >
                                <span className={cn('text-2xl font-black', AGING_META[bucket].text)}>{agingCounts[bucket]}</span>
                                <span className={cn('text-[10px] font-bold uppercase tracking-wide opacity-70 mt-1', AGING_META[bucket].text)}>{AGING_META[bucket].short}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                    <FilterMultiSelect
                        label="Group"
                        icon={Layers}
                        options={groupOptions}
                        selected={groupFilter}
                        onChange={(value) => setGroupFilter(prev => toggleInArray(prev, value))}
                    />
                    <FilterMultiSelect
                        label="Industry"
                        icon={Building2}
                        options={industryOptions}
                        selected={industryFilter}
                        onChange={(value) => setIndustryFilter(prev => toggleInArray(prev, value))}
                    />
                    <FilterMultiSelect
                        label="Aging"
                        icon={CalendarClock}
                        options={AGING_FILTER_OPTIONS}
                        selected={agingFilter}
                        onChange={(value) => setAgingFilter(prev => toggleInArray(prev, value))}
                    />
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search company, industry..."
                            className="h-9 pl-9 text-xs bg-white dark:bg-slate-950 shadow-sm border-slate-200 dark:border-slate-800 focus:ring-indigo-500 rounded-lg"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto overflow-y-hidden">
                <div className="p-4 flex gap-4 items-start w-max">
                    {groups.map(group => (
                        <div
                            key={group.groupName}
                            className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 w-[300px] shrink-0 flex flex-col"
                        >
                            <div className="px-3 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                                <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide truncate">
                                    {group.groupName}
                                </h3>
                                <span className="text-sm font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-full px-2.5 py-0.5 shrink-0 ml-2">
                                    {group.count}
                                </span>
                            </div>
                            <div className="p-3 flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-330px)]">
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
                                        <div className="flex flex-col gap-0.5 pl-3">
                                            {industry.companies.map(u => {
                                                const aging = AGING_META[u.aging_bucket]
                                                const hasBranch = !!(u.branch_name && u.branch_name !== u.company_name)
                                                const formattedDate = formatModifyDate(u.modify_date)
                                                return (
                                                    <button
                                                        key={u.upload_id}
                                                        onClick={() => router.push(`/org-chart/${u.upload_id}`)}
                                                        title={`${u.company_name}${u.branch_name ? ` — ${u.branch_name}` : ''}${u.notes ? `\n${u.notes}` : ''}\n${aging.label}`}
                                                        className="text-[11px] px-2 py-1 rounded-md text-left transition-all hover:bg-slate-50 dark:hover:bg-slate-900 hover:shadow-sm border border-transparent flex items-start gap-2"
                                                    >
                                                        <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-slate-800 dark:bg-slate-300 mt-1" />
                                                        <span className="flex flex-col flex-1 min-w-0">
                                                            <span className="font-medium text-slate-800 dark:text-slate-100 flex items-start justify-between gap-2">
                                                                <span className="break-words">
                                                                    {u.company_name}
                                                                </span>
                                                                {formattedDate && (
                                                                    <span className={cn('shrink-0 text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full', aging.bg, aging.text)}>
                                                                        {formattedDate}
                                                                    </span>
                                                                )}
                                                            </span>
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
                        <div className="text-center text-xs text-slate-400 py-10 italic w-full">
                            No organizations match your search.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
