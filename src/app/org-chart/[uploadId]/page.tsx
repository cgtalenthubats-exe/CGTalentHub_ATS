import { redirect } from 'next/navigation'
import { fetchOrgChartUploads, fetchOrgChartData, getOrgNodesRaw, fetchCompanyLogo } from '@/app/actions/org-chart-actions'
import { OrgChartClientPage } from '../org-chart-client-page'

export default async function OrgChartViewerRoute({
    params,
}: {
    params: Promise<{ uploadId: string }>
}) {
    const { uploadId } = await params
    const uploads = await fetchOrgChartUploads()
    const currentUpload = uploads.find((u: any) => u.upload_id === uploadId)

    if (!currentUpload) {
        redirect('/org-chart')
    }

    const companyId = currentUpload?.company_id || null
    const notes = currentUpload?.notes || null
    const chartFileUrl = currentUpload?.chart_file || null
    const modifyDate = currentUpload?.modify_date || null

    const [chartData, tableData, companyLogoUrl] = await Promise.all([
        fetchOrgChartData(uploadId),
        getOrgNodesRaw(uploadId),
        fetchCompanyLogo(companyId)
    ])

    return (
        <OrgChartClientPage
            uploads={uploads}
            currentUploadId={uploadId}
            currentCompanyId={companyId}
            chartData={chartData}
            tableData={tableData}
            companyLogoUrl={companyLogoUrl}
            notes={notes}
            chartFileUrl={chartFileUrl}
            modifyDate={modifyDate}
            status={currentUpload?.status}
        />
    )
}
