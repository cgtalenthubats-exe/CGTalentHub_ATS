'use client'

import dynamic from 'next/dynamic'
import { OrgNode } from '@/app/actions/org-chart-actions'

const DynamicViewer = dynamic(
    () => import('./org-chart-viewer').then((mod) => mod.OrgChartViewer),
    {
        ssr: false,
        loading: () => (
            <div className="h-[600px] flex items-center justify-center text-slate-400">
                Loading Visualization...
            </div>
        )
    }
)

export function OrgChartClientWrapper({ 
    initialData,
    companyLogoUrl,
    companyId,
    uploadId,
    notes,
    chartFileUrl,
    modifyDate,
    chartCompanyName
}: { 
    initialData: OrgNode | null,
    companyLogoUrl?: string | null,
    companyId?: string | null,
    uploadId?: string | null,
    notes?: string | null,
    chartFileUrl?: string | null,
    modifyDate?: string | null,
    chartCompanyName: string
}) {
    return (
        <div className="flex-1 w-full flex flex-col">
            <DynamicViewer 
                initialData={initialData} 
                companyLogoUrl={companyLogoUrl}
                companyId={companyId}
                uploadId={uploadId}
                chartCompanyName={chartCompanyName}
                notes={notes}
                chartFileUrl={chartFileUrl}
                modifyDate={modifyDate}
            />
        </div>
    )
}
