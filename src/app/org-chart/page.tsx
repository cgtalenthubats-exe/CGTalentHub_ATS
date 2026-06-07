import { redirect } from 'next/navigation'
import { fetchOrgDirectoryUploads } from '@/app/actions/org-chart-actions'
import { OrgChartDirectoryPage } from '@/components/org-chart/org-chart-directory-page'

export default async function OrgChartPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const legacyId = params.id

    if (typeof legacyId === 'string' && legacyId) {
        redirect(`/org-chart/${legacyId}`)
    }

    const uploads = await fetchOrgDirectoryUploads()

    return <OrgChartDirectoryPage uploads={uploads} />
}
