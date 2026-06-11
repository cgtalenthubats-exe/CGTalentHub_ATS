'use client'

import React, { useMemo, useState } from 'react'
import { Search, Download, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { updateOrgChartUploadField, type EditableUploadField } from '@/app/actions/org-chart-actions'
import type { DirectoryUpload } from '@/app/actions/org-chart-actions'
import { toast } from '@/lib/notifications'

type Props = {
    uploads: DirectoryUpload[]
}

type Column = {
    field: EditableUploadField
    label: string
    width?: string
    type: 'text' | 'number' | 'date' | 'textarea'
}

const COLUMNS: Column[] = [
    { field: 'company_name', label: 'Company Name', width: 'min-w-[220px]', type: 'text' },
    { field: 'branch_name', label: 'Branch Name', width: 'min-w-[180px]', type: 'text' },
    { field: 'company_id', label: 'Company ID', width: 'w-[110px]', type: 'number' },
    { field: 'notes', label: 'Notes', width: 'min-w-[240px]', type: 'textarea' },
    { field: 'modify_date', label: 'Modify Date', width: 'w-[150px]', type: 'date' },
    { field: 'created_at', label: 'Created At', width: 'w-[150px]', type: 'date' },
]

function toDateInputValue(value: string | null | undefined) {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 10)
}

function csvEscape(value: unknown) {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

export function OrgUploadsTable({ uploads }: Props) {
    const [rows, setRows] = useState<DirectoryUpload[]>(uploads)
    const [searchTerm, setSearchTerm] = useState('')
    const [savingKey, setSavingKey] = useState<string | null>(null)

    const filteredRows = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        if (!term) return rows
        return rows.filter(u =>
            u.company_name.toLowerCase().includes(term) ||
            (u.branch_name && u.branch_name.toLowerCase().includes(term)) ||
            (u.notes && u.notes.toLowerCase().includes(term)) ||
            (u.company_id !== null && String(u.company_id).includes(term))
        )
    }, [rows, searchTerm])

    const handleSave = async (uploadId: string, field: EditableUploadField, rawValue: string) => {
        const cellKey = `${uploadId}:${field}`
        const current = rows.find(r => r.upload_id === uploadId)
        if (!current) return

        let nextValue: string | null = rawValue

        if (field === 'modify_date' || field === 'created_at') {
            nextValue = rawValue ? new Date(rawValue).toISOString() : null
        }

        const currentValue = field === 'company_id'
            ? (current.company_id !== null && current.company_id !== undefined ? String(current.company_id) : '')
            : field === 'modify_date' || field === 'created_at'
                ? toDateInputValue((current as any)[field])
                : ((current as any)[field] ?? '')

        // No-op if unchanged
        if (rawValue === currentValue) return

        setSavingKey(cellKey)
        const result = await updateOrgChartUploadField(uploadId, field, rawValue)
        setSavingKey(null)

        if (!result.success) {
            toast.error(result.error ?? 'บันทึกไม่สำเร็จ')
            return
        }

        setRows(prev => prev.map(r => {
            if (r.upload_id !== uploadId) return r
            if (field === 'company_id') {
                return { ...r, company_id: rawValue === '' ? null : rawValue }
            }
            if (field === 'modify_date' || field === 'created_at') {
                return { ...r, [field]: nextValue } as DirectoryUpload
            }
            return { ...r, [field]: rawValue } as DirectoryUpload
        }))
    }

    const handleExportCsv = () => {
        const headers = ['Company Name', 'Branch Name', 'Company ID', 'Notes', 'Modify Date', 'Created At']
        const lines = [headers.join(',')]

        filteredRows.forEach(u => {
            lines.push([
                csvEscape(u.company_name),
                csvEscape(u.branch_name),
                csvEscape(u.company_id),
                csvEscape(u.notes),
                csvEscape(u.modify_date),
                csvEscape(u.created_at),
            ].join(','))
        })

        const csvContent = '﻿' + lines.join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `org_chart_uploads_${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search company, branch, notes..."
                        className="h-9 pl-9 text-xs bg-white dark:bg-slate-950 shadow-sm border-slate-200 dark:border-slate-800 focus:ring-indigo-500 rounded-lg"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">{filteredRows.length} rows</span>
                    <Button size="sm" variant="outline" onClick={handleExportCsv} className="h-9 text-xs gap-1.5">
                        <Download size={14} />
                        Export CSV
                    </Button>
                </div>
            </div>

            <div className="overflow-auto max-h-[calc(100vh-260px)]">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 shadow-sm">
                        <TableRow>
                            {COLUMNS.map(col => (
                                <TableHead key={col.field} className={cn('text-xs font-bold text-slate-600 dark:text-slate-300', col.width)}>
                                    {col.label}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredRows.map(row => (
                            <TableRow key={row.upload_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                {COLUMNS.map(col => (
                                    <EditableCell
                                        key={col.field}
                                        column={col}
                                        value={(row as any)[col.field]}
                                        saving={savingKey === `${row.upload_id}:${col.field}`}
                                        onSave={(value) => handleSave(row.upload_id, col.field, value)}
                                    />
                                ))}
                            </TableRow>
                        ))}
                        {filteredRows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={COLUMNS.length} className="text-center text-xs text-slate-400 py-10 italic">
                                    No records found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

function EditableCell({
    column,
    value,
    saving,
    onSave,
}: {
    column: Column
    value: string | number | null | undefined
    saving: boolean
    onSave: (value: string) => void
}) {
    const initial = column.type === 'date'
        ? toDateInputValue(value as string | null)
        : (value === null || value === undefined ? '' : String(value))

    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(initial)

    const startEdit = () => {
        setDraft(initial)
        setEditing(true)
    }

    const commit = () => {
        setEditing(false)
        if (draft !== initial) onSave(draft)
    }

    if (editing) {
        return (
            <TableCell className={cn('p-1', column.width)}>
                {column.type === 'textarea' ? (
                    <textarea
                        autoFocus
                        className="w-full text-xs border border-indigo-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-950 resize-y min-h-[32px]"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={commit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
                            if (e.key === 'Escape') setEditing(false)
                        }}
                    />
                ) : (
                    <input
                        autoFocus
                        type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
                        className="w-full text-xs border border-indigo-300 rounded-md px-2 py-1 h-8 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-950"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={commit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') commit()
                            if (e.key === 'Escape') setEditing(false)
                        }}
                    />
                )}
            </TableCell>
        )
    }

    return (
        <TableCell
            className={cn('text-xs text-slate-700 dark:text-slate-300 cursor-text hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-colors', column.width)}
            onClick={startEdit}
            title="Click to edit"
        >
            <div className="flex items-center gap-1.5 min-h-[20px]">
                <span className={cn('truncate', !initial && 'text-slate-300 italic')}>
                    {initial || '—'}
                </span>
                {saving && <Loader2 size={12} className="animate-spin text-indigo-400 shrink-0" />}
            </div>
        </TableCell>
    )
}
