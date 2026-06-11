'use client'

import dynamic from 'next/dynamic'
import type { OrgNodeV2 } from '@/app/actions/org-chart-v2-actions'
import type { RawOrgNode } from '@/app/actions/org-chart-actions'

const DynamicViewer = dynamic(
    () => import('./org-chart-viewer-v2').then((mod) => mod.OrgChartViewerV2),
    {
        ssr: false,
        loading: () => (
            <div className="h-[600px] flex items-center justify-center text-slate-400">
                Loading Visualization...
            </div>
        )
    }
)

type Props = {
    data: OrgNodeV2[]
    rawNodes: RawOrgNode[]
    uploadId: string
    companyName?: string
    companyId?: string | null
    companyLogoUrl?: string | null
    notes?: string | null
    chartFileUrl?: string | null
    modifyDate?: string | null
}

export function OrgChartClientWrapperV2({ data, rawNodes, uploadId, companyName, companyId, companyLogoUrl, notes, chartFileUrl, modifyDate }: Props) {
    return (
        <div className="flex-1 w-full flex flex-col">
            <DynamicViewer
                data={data}
                rawNodes={rawNodes}
                uploadId={uploadId}
                companyName={companyName}
                companyId={companyId}
                companyLogoUrl={companyLogoUrl}
                notes={notes}
                chartFileUrl={chartFileUrl}
                modifyDate={modifyDate}
            />
        </div>
    )
}
