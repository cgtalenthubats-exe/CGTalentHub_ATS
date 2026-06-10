import { redirect } from 'next/navigation'
import Link from 'next/link'
import { fetchOrgChartUploads } from '@/app/actions/org-chart-actions'
import { fetchOrgChartFlatData } from '@/app/actions/org-chart-v2-actions'
import { OrgChartClientWrapperV2 } from '@/components/org-chart/org-chart-client-wrapper-v2'

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
    const data = await fetchOrgChartFlatData(uploadId, companyName)

    return (
        <div className="container mx-auto py-2 flex flex-col h-screen px-4 md:px-6">
            <div className="shrink-0 flex items-center justify-between py-2 gap-2">
                <div className="min-w-0">
                    <Link href="/org-chart-v2" className="text-xs text-slate-400 hover:text-indigo-600">
                        &larr; OrgChart V2 Directory
                    </Link>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 italic truncate">
                        {companyName}
                        {currentUpload?.branch_name ? ` — ${currentUpload.branch_name}` : ''}
                        <span className="ml-2 text-xs font-normal text-indigo-500 not-italic align-middle border border-indigo-200 bg-indigo-50 rounded px-1.5 py-0.5">
                            V2 Preview
                        </span>
                    </h1>
                </div>
                <Link href={`/org-chart/${uploadId}`} className="shrink-0 text-xs text-slate-400 hover:text-indigo-600">
                    View V1 &rarr;
                </Link>
            </div>
            <div className="flex-1 border rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                <OrgChartClientWrapperV2 data={data} companyName={companyName} />
            </div>
        </div>
    )
}
