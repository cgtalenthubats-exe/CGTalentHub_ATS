import type { OrgNodeV2 } from '@/app/actions/org-chart-v2-actions'
import { ROOT_WRAPPER_ID } from './shared'

function csvEscape(value: string | number | null | undefined): string {
    const s = value == null ? '' : String(value)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'OrgChart'
}

const HEADERS = [
    'Name', 'Title', 'Reports To', 'Company', 'Position', 'Age', 'Nationality',
    'LinkedIn', 'Candidate ID', 'Verified', 'Ex-Central',
]

/**
 * Exports the org chart's current node list as a CSV — one row per person
 * (group/team nodes excluded), including age/nationality and the Ex-Central tag.
 * Runs entirely client-side, same pattern as the PPTX export.
 */
export function exportOrgChartCsv(data: OrgNodeV2[], companyName: string): void {
    const nameById = new Map(data.map((n) => [n.id, n.name]))

    const rows = data
        .filter((n) => n.id !== ROOT_WRAPPER_ID && !n.is_group_node)
        .map((n) => [
            n.name,
            n.title || '',
            n.parentId ? nameById.get(n.parentId) || '' : '',
            n.current_experience?.company || '',
            n.current_experience?.position || '',
            n.age ?? '',
            n.nationality || '',
            n.linkedin || '',
            n.candidate_id || '',
            n.is_verified === 'TRUE' ? 'Yes' : 'No',
            n.is_ex_central ? 'Yes' : 'No',
        ])

    const csv = [HEADERS, ...rows]
        .map((row) => row.map(csvEscape).join(','))
        .join('\r\n')

    // BOM so Excel opens UTF-8 (Thai names etc.) correctly
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sanitizeFilename(companyName)}_OrgChart_${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
