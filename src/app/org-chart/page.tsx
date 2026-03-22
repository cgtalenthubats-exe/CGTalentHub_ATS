import { fetchOrgChartUploads, fetchOrgChartData, getOrgNodesRaw, fetchCompanyLogo } from '@/app/actions/org-chart-actions'
import { OrgChartClientPage } from './org-chart-client-page'

export default async function OrgChartPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const uploads = await fetchOrgChartUploads()

    // Default to the first (latest) upload if no ID provided
    const latestUploadId = uploads.length > 0 ? uploads[0].upload_id : null
    const currentUploadId = (params.id as string) || latestUploadId

    let chartData = null
    let tableData: any[] = []
    let companyLogoUrl = null
    let companyId = null
    let notes = null
    let chartFileUrl = null

    if (currentUploadId) {
        const currentUpload = uploads.find((u: any) => u.upload_id === currentUploadId)
        companyId = currentUpload?.company_id || null
        notes = currentUpload?.notes || null
        chartFileUrl = currentUpload?.chart_file || null

        // Parallel server-side fetch
        const [chart, list, logo] = await Promise.all([
            fetchOrgChartData(currentUploadId),
            getOrgNodesRaw(currentUploadId),
            fetchCompanyLogo(companyId)
        ])
        chartData = chart
        tableData = list
        companyLogoUrl = logo
    }

    return (
        <OrgChartClientPage
            uploads={uploads}
            currentUploadId={currentUploadId}
            currentCompanyId={companyId}
            chartData={chartData}
            tableData={tableData}
            companyLogoUrl={companyLogoUrl}
            notes={notes}
            chartFileUrl={chartFileUrl}
        />
    )
}
