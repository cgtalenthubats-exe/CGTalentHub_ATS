'use client'

import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OrgChartClientWrapperV2 } from './org-chart-client-wrapper-v2'
import { OrgChartV2HeaderActions } from './org-chart-v2-header-actions'
import { OrgNodeTable } from './org-node-table'
import { UnmappedCandidates } from './unmapped-candidates'
import { EditOrgMetaDialog } from './edit-org-meta-dialog'
import type { OrgNodeV2 } from '@/app/actions/org-chart-v2-actions'
import type { RawOrgNode } from '@/app/actions/org-chart-actions'

type Props = {
    data: OrgNodeV2[]
    rawNodes: RawOrgNode[]
    uploadId: string
    uploads: { upload_id: string; company_name: string; branch_name?: string | null }[]
    companyName: string
    branchName?: string | null
    companyId: string | null
    companyLogoUrl: string | null
    notes: string | null
    chartFileUrl: string | null
    modifyDate: string | null
}

export function OrgChartV2PageContent({
    data, rawNodes, uploadId, uploads, companyName, branchName, companyId, companyLogoUrl, notes, chartFileUrl, modifyDate,
}: Props) {
    return (
        <div className="container mx-auto py-2 flex flex-col h-screen px-4 md:px-6">
            <Tabs defaultValue="chart" className="flex flex-col flex-1 min-h-0">
                <div className="shrink-0 flex flex-col gap-1 py-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                            <Link href="/org-chart" className="text-xs text-slate-400 hover:text-indigo-600">
                                &larr; Org Chart Directory
                            </Link>
                            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 italic truncate flex items-center gap-1.5">
                                <span className="truncate">
                                    {companyName}
                                    {branchName ? ` — ${branchName}` : ''}
                                </span>
                                <EditOrgMetaDialog
                                    uploadId={uploadId}
                                    companyName={companyName}
                                    notes={notes}
                                    branchName={branchName}
                                />
                            </h1>
                        </div>
                        <div className="shrink-0 flex items-center gap-3">
                            <OrgChartV2HeaderActions
                                uploadId={uploadId}
                                uploads={uploads}
                                existingNodes={rawNodes.map((n) => ({ name: n.name, parent_name: n.parent_name }))}
                            />
                            <Link href={`/org-chart/${uploadId}`} className="text-xs text-slate-400 hover:text-indigo-600">
                                View V1 &rarr;
                            </Link>
                        </div>
                    </div>

                    <div className="flex items-center bg-white/50 dark:bg-slate-950/50 p-1 rounded-lg border border-slate-100 dark:border-slate-800 px-3 self-start">
                        <TabsList className="h-8 bg-transparent p-0 gap-1">
                            <TabsTrigger
                                value="chart"
                                className="h-7 text-xs px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
                            >
                                Chart View
                            </TabsTrigger>
                            <TabsTrigger
                                value="list"
                                className="h-7 text-xs px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
                            >
                                Data Table
                            </TabsTrigger>
                        </TabsList>
                    </div>
                </div>

                <TabsContent value="chart" className="flex-1 min-h-0 mt-0 flex flex-col border rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                    <OrgChartClientWrapperV2
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
                </TabsContent>

                <TabsContent value="list" className="flex-1 min-h-0 mt-0 overflow-hidden">
                    <div className="flex items-start gap-4 h-full w-full">
                        <div className="flex-1 h-full border rounded-xl bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                            <OrgNodeTable
                                nodes={rawNodes}
                                uploadId={uploadId}
                                chartCompanyName={companyName}
                                modifyDate={modifyDate}
                            />
                        </div>
                        {companyId && (
                            <div className="w-[340px] shrink-0 h-full overflow-y-auto hidden lg:block rounded-xl">
                                <UnmappedCandidates companyId={companyId} uploadId={uploadId} />
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
