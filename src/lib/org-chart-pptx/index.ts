import type { OrgNodeV2 } from '@/app/actions/org-chart-v2-actions'
import { buildOverviewPptx } from './overview'
import { buildTeamDetailsPptx } from './team-details'
import { toDataUri } from './shared'

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'OrgChart'
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/**
 * Exports the org chart as PowerPoint file(s):
 * - Overview.pptx: single slide, every team collapsed to one card, sized to fit the whole chart
 * - TeamDetails.pptx: 16:9, one slide per team showing its members
 *
 * If there are no team/group nodes, only the Overview file is produced (no zip needed).
 */
export async function exportOrgChartPptx(data: OrgNodeV2[], companyName: string, companyLogoUrl?: string | null): Promise<void> {
    const logoDataUri = companyLogoUrl ? await toDataUri(companyLogoUrl) : null

    const [overviewBlob, teamDetailsBlob] = await Promise.all([
        buildOverviewPptx(data, companyName, logoDataUri),
        buildTeamDetailsPptx(data, companyName, logoDataUri),
    ])

    const baseName = sanitizeFilename(companyName)
    const timestamp = Date.now()

    if (!teamDetailsBlob) {
        downloadBlob(overviewBlob, `${baseName}_Overview_${timestamp}.pptx`)
        return
    }

    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    zip.file(`${baseName}_Overview.pptx`, overviewBlob)
    zip.file(`${baseName}_TeamDetails.pptx`, teamDetailsBlob)

    const zipBlob = (await zip.generateAsync({ type: 'blob' })) as Blob
    downloadBlob(zipBlob, `${baseName}_OrgChart_${timestamp}.zip`)
}
