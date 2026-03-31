'use client'

import React, { Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OrgChartHeader } from '@/components/org-chart/org-chart-header'
import { OrgDirectory } from '@/components/org-chart/org-directory'
import { OrgNodeTable } from '@/components/org-chart/org-node-table'
import { OrgChartClientWrapper } from '@/components/org-chart/org-chart-client-wrapper'
import { UnmappedCandidates } from '@/components/org-chart/unmapped-candidates'

type OrgChartClientPageProps = {
    uploads: any[]
    currentUploadId: string | null
    currentCompanyId: string | null
    chartData: any
    tableData: any[]
    companyLogoUrl: string | null
    notes: string | null
    chartFileUrl: string | null
    modifyDate: string | null
}

export function OrgChartClientPage({
    uploads,
    currentUploadId,
    currentCompanyId,
    chartData,
    tableData,
    companyLogoUrl,
    notes,
    chartFileUrl,
    modifyDate
}: OrgChartClientPageProps) {
    return (
        <div className="container mx-auto py-2 space-y-4 flex flex-col min-h-screen px-4 md:px-6 mb-10">
            <OrgChartHeader />

            {/* Top Area: Compact Directory Toolbar */}
            <OrgDirectory
                uploads={uploads}
                currentId={currentUploadId}
            />

            {/* Main Content: Chart/Table */}
            <div className="relative h-[800px] md:h-[85vh] w-full">
                <Tabs defaultValue="chart" className="flex flex-col h-full">
                    <div className="flex mb-1 shrink-0 justify-between items-center bg-white/50 dark:bg-slate-950/50 p-1 rounded-lg border border-slate-100 dark:border-slate-800 px-3">
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

                        {currentUploadId && (
                            <div className="flex flex-col items-end gap-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        Current Org:
                                    </span>
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                        {uploads.find((u: any) => u.upload_id === currentUploadId)?.company_name}
                                    </span>
                                </div>
                                {modifyDate && (
                                    <span className="text-[9px] text-slate-400 font-medium">
                                        Uploaded: {new Date(modifyDate).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <TabsContent value="chart" className="flex-1 flex flex-col h-full border rounded-xl overflow-hidden mt-0 shadow-sm relative">
                        <Suspense fallback={<div className="h-full w-full bg-slate-100 dark:bg-slate-800 animate-pulse" />}>
                            <OrgChartClientWrapper
                                initialData={chartData}
                                companyLogoUrl={companyLogoUrl}
                                companyId={currentCompanyId}
                                uploadId={currentUploadId}
                                chartCompanyName={uploads.find((u: any) => u.upload_id === currentUploadId)?.company_name || 'Unknown'}
                                notes={notes}
                                chartFileUrl={chartFileUrl}
                                modifyDate={modifyDate}
                            />
                        </Suspense>
                    </TabsContent>

                    <TabsContent value="list" className="flex-1 min-h-[750px] md:min-h-[85vh] mt-0">
                        <div className="flex items-start gap-4 h-full w-full">
                            <div className="flex-1 h-full border rounded-xl bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                                <OrgNodeTable 
                                    nodes={tableData} 
                                    uploadId={currentUploadId} 
                                    chartCompanyName={uploads.find((u: any) => u.upload_id === currentUploadId)?.company_name || 'Unknown'}
                                    modifyDate={modifyDate} 
                                />
                            </div>
                            {currentCompanyId && (
                                <div className="w-[340px] shrink-0 h-full overflow-y-auto hidden lg:block rounded-xl">
                                    <UnmappedCandidates companyId={currentCompanyId} uploadId={currentUploadId} />
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
