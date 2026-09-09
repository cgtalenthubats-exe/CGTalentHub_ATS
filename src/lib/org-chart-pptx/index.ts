import type { OrgNodeV2 } from '@/app/actions/org-chart-v2-actions'
import { getOrgChartProfileCards } from '@/app/actions/org-chart-actions'
import { buildOverviewPptx } from './overview'
import { buildTeamDetailsPptx } from './team-details'
import { buildShortProfileCardsPptx } from './short-profile'
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
 * - ShortProfile.pptx: 16:9, one card per matched candidate (photo, position, company,
 *   nationality, location, age, education, LinkedIn, rating, recent experience) — same
 *   card layout as the JR Report / AI Search "Short Profile" exports
 *
 * Files with nothing to show (e.g. no team/group nodes, or no matched candidates) are
 * skipped. If only one file ends up produced, it's downloaded directly (no zip needed).
 */
export async function exportOrgChartPptx(data: OrgNodeV2[], companyName: string, companyLogoUrl?: string | null): Promise<void> {
    const logoDataUri = companyLogoUrl ? await toDataUri(companyLogoUrl) : null

    const candidateIds = [...new Set(data.map((d) => d.candidate_id).filter((id): id is string => !!id))]

    const [overviewBlob, teamDetailsBlob, profileCards] = await Promise.all([
        buildOverviewPptx(data, companyName, logoDataUri),
        buildTeamDetailsPptx(data, companyName, logoDataUri),
        candidateIds.length ? getOrgChartProfileCards(candidateIds) : Promise.resolve([]),
    ])

    const shortProfileBlob = profileCards.length
        ? await buildShortProfileCardsPptx(profileCards, companyName, logoDataUri)
        : null

    const baseName = sanitizeFilename(companyName)
    const timestamp = Date.now()

    const files: { name: string; blob: Blob }[] = [{ name: `${baseName}_Overview.pptx`, blob: overviewBlob }]
    if (teamDetailsBlob) files.push({ name: `${baseName}_TeamDetails.pptx`, blob: teamDetailsBlob })
    if (shortProfileBlob) files.push({ name: `${baseName}_ShortProfile.pptx`, blob: shortProfileBlob })

    if (files.length === 1) {
        downloadBlob(files[0].blob, files[0].name.replace(/\.pptx$/, `_${timestamp}.pptx`))
        return
    }

    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    files.forEach((f) => zip.file(f.name, f.blob))

    const zipBlob = (await zip.generateAsync({ type: 'blob' })) as Blob
    downloadBlob(zipBlob, `${baseName}_OrgChart_${timestamp}.zip`)
}
