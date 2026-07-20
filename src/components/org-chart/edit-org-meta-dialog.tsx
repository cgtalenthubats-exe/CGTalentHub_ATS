'use client'

import React, { useState, useEffect } from 'react'
import { Pencil, Loader2, Search, Building2 } from 'lucide-react'
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
import { globalCompanySearch, getCompanyMasterById, getCompanySidebarStats } from '@/app/actions/company-mgmt'
import CompanyDetailDialog from '@/components/admin/CompanyDetailDialog'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/notifications'

type Props = {
    uploadId: string
    companyName: string
    notes?: string | null
    branchName?: string | null
    companyId?: string | null
}

type MappedCompany = {
    company_id: number
    company_master: string
    group: string | null
    industry: string | null
} | null

const KNOWN_UNKNOWN_GROUPS = new Set([
    "Unknown", "Unassigned", "N/A", "Not Found",
    "No Match Found", "Undetermined", "Unclassified",
])

export function EditOrgMetaDialog({ uploadId, companyName, notes, branchName, companyId }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [name, setName] = useState(companyName)
    const [note, setNote] = useState(notes ?? '')
    const [branch, setBranch] = useState(branchName ?? '')

    const [mapped, setMapped] = useState<MappedCompany>(null)
    const [loadingMapped, setLoadingMapped] = useState(false)
    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)

    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [searching, setSearching] = useState(false)

    const [groups, setGroups] = useState<string[]>([])
    const [industriesByGroup, setIndustriesByGroup] = useState<Record<string, Record<string, number>>>({})
    const [editingCompany, setEditingCompany] = useState(false)

    const handleOpen = async () => {
        setName(companyName)
        setNote(notes ?? '')
        setBranch(branchName ?? '')
        setSearchTerm('')
        setSearchResults([])
        setOpen(true)

        const initialId = companyId ? Number(companyId) : null
        setSelectedCompanyId(initialId)

        setLoadingMapped(true)
        const [info, stats] = await Promise.all([
            initialId ? getCompanyMasterById(initialId) : Promise.resolve(null),
            getCompanySidebarStats(),
        ])
        setMapped(info)
        setGroups(Object.keys(stats.groups).filter(g => !KNOWN_UNKNOWN_GROUPS.has(g)))
        setIndustriesByGroup(stats.industriesByGroup)
        setLoadingMapped(false)
    }

    useEffect(() => {
        if (searchTerm.trim().length < 2) {
            setSearchResults([])
            return
        }
        const timer = setTimeout(async () => {
            setSearching(true)
            const results = await globalCompanySearch(searchTerm.trim())
            setSearchResults(results)
            setSearching(false)
        }, 400)
        return () => clearTimeout(timer)
    }, [searchTerm])

    const handlePick = (result: any) => {
        setSelectedCompanyId(result.company_id)
        setMapped({
            company_id: result.company_id,
            company_master: result.company_master,
            group: result.group ?? null,
            industry: result.industry ?? null,
        })
        setSearchTerm('')
        setSearchResults([])
    }

    const refreshMapped = async () => {
        if (!selectedCompanyId) return
        const info = await getCompanyMasterById(selectedCompanyId)
        setMapped(info)
    }

    const handleSave = async () => {
        if (!name.trim()) return
        setSaving(true)
        const result = await updateOrgUploadMeta(uploadId, {
            company_name: name.trim(),
            notes: note.trim() || undefined,
            branch_name: branch.trim() || undefined,
            company_id: selectedCompanyId,
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

                        <div className="space-y-1.5 pt-2 border-t">
                            <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                                <Building2 size={12} />
                                Mapped Company (company_master)
                            </Label>

                            {loadingMapped ? (
                                <div className="h-10 flex items-center text-xs text-slate-400 gap-1.5">
                                    <Loader2 size={12} className="animate-spin" /> Loading...
                                </div>
                            ) : mapped ? (
                                <div className="flex items-center justify-between gap-2 rounded-lg border bg-slate-50 px-3 py-2">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-slate-900 truncate">{mapped.company_master}</div>
                                        <div className="text-[11px] text-slate-400 truncate">
                                            #{mapped.company_id} · {mapped.group ?? 'No group'} / {mapped.industry ?? 'No industry'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setEditingCompany(true)}
                                        className="shrink-0 text-slate-400 hover:text-indigo-600 p-1"
                                        title="Edit group / industry"
                                        type="button"
                                    >
                                        <Pencil size={13} />
                                    </button>
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-slate-400 italic">
                                    Not mapped to any company_master record
                                </div>
                            )}

                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                                <Input
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search company to (re)map..."
                                    className="h-8 pl-8 text-xs"
                                />
                                {searching && (
                                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-slate-400" />
                                )}
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl p-1 max-h-[220px] overflow-y-auto z-50">
                                        {searchResults.map((res: any) => (
                                            <button
                                                key={res.company_id}
                                                onClick={() => handlePick(res)}
                                                type="button"
                                                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 rounded-md transition-colors flex flex-col gap-0.5"
                                            >
                                                <span className="text-xs font-semibold text-slate-900 truncate">{res.company_master}</span>
                                                <span className="text-[10px] text-slate-400 truncate">
                                                    #{res.company_id} · {res.group ?? 'No group'} / {res.industry ?? 'No industry'}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
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

            {editingCompany && mapped && (
                <CompanyDetailDialog
                    company={{
                        company_id: mapped.company_id,
                        company_master: mapped.company_master,
                        industry: mapped.industry || '',
                        group: mapped.group || '',
                    }}
                    groups={groups}
                    industriesByGroup={industriesByGroup}
                    onClose={() => setEditingCompany(false)}
                    onSuccess={() => {
                        setEditingCompany(false)
                        refreshMapped()
                    }}
                />
            )}
        </>
    )
}
