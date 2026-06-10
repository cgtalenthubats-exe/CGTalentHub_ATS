'use client'

import dynamic from 'next/dynamic'
import type { OrgNodeV2 } from '@/app/actions/org-chart-v2-actions'

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

export function OrgChartClientWrapperV2({ data, companyName }: { data: OrgNodeV2[]; companyName?: string }) {
    return (
        <div className="flex-1 w-full flex flex-col">
            <DynamicViewer data={data} companyName={companyName} />
        </div>
    )
}
