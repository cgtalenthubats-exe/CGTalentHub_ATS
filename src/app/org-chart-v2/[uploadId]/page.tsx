import { redirect } from 'next/navigation'
import { fetchOrgChartUploads, getOrgNodesRaw, fetchCompanyLogo } from '@/app/actions/org-chart-actions'
import { fetchOrgChartFlatData } from '@/app/actions/org-chart-v2-actions'
import { OrgChartV2PageContent } from '@/components/org-chart/org-chart-v2-page-content'

export default async function OrgChartV2ViewerRoute({
    params,
}: {
    params: Promise<{ uploadId: string }>
}) {
    const { uploadId } = await params
    const uploads = await fetchOrgChartUploads()
    const currentUpload = uploads.find((u: any) => u.upload_id === uploadId)

    if (!currentUpload) {
        redirect('/org-chart-v2')
    }

    const companyName = currentUpload?.company_name || 'Organization'
    const branchName = currentUpload?.branch_name || null
    const companyId = currentUpload?.company_id || null
    const notes = currentUpload?.notes || null
    const chartFileUrl = currentUpload?.chart_file || null
    const modifyDate = currentUpload?.modify_date || null
    const [data, rawNodes, companyLogoUrl] = await Promise.all([
        fetchOrgChartFlatData(uploadId, companyName),
        getOrgNodesRaw(uploadId),
        fetchCompanyLogo(companyId),
    ])

    return (
        <OrgChartV2PageContent
            data={data}
            rawNodes={rawNodes}
            uploadId={uploadId}
            uploads={uploads}
            companyName={companyName}
            branchName={branchName}
            companyId={companyId}
            companyLogoUrl={companyLogoUrl}
            notes={notes}
            chartFileUrl={chartFileUrl}
            modifyDate={modifyDate}
        />
    )
}
