import { fetchOrgChartUploads, fetchOrgChartData, getOrgNodesRaw } from '@/app/actions/org-chart-actions'
import { Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OrgNodeTable } from '@/components/org-chart/org-node-table'
import { OrgDirectory } from '@/components/org-chart/org-directory'
import { OrgChartClientWrapper } from '@/components/org-chart/org-chart-client-wrapper'

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

    if (currentUploadId) {
        // Parallel fetch
        const [chart, list] = await Promise.all([
            fetchOrgChartData(currentUploadId),
            getOrgNodesRaw(currentUploadId)
        ])
        chartData = chart
        tableData = list
    }

    return (
        <div className="container mx-auto py-2 space-y-2 flex flex-col h-screen overflow-hidden px-4 md:px-6">
            <div className="shrink-0 flex items-center justify-between">
                <div className="flex items-baseline gap-3">
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 italic">
                        Organization Chart
                    </h1>
                </div>

                {/* Secondary Tab Switcher - Horizontal Link style-ish */}
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                    {/* We'll use the Tabs component but more compact below */}
                </div>
            </div>

            {/* Top Area: Compact Directory Toolbar */}
            <OrgDirectory
                uploads={uploads}
                currentId={currentUploadId}
            />

            {/* Main Content: Chart/Table */}
            <div className="flex-1 min-h-0 relative">
                <Tabs defaultValue="chart" className="h-full flex flex-col">
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
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Current Org:
                                </span>
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                    {uploads.find(u => u.upload_id === currentUploadId)?.company_name}
                                </span>
                            </div>
                        )}
                    </div>

                    <TabsContent value="chart" className="flex-1 min-h-0 border rounded-xl overflow-hidden mt-0 bg-slate-50/50 dark:bg-slate-900/10">
                        <Suspense fallback={<div className="h-full w-full bg-slate-100 dark:bg-slate-800 animate-pulse" />}>
                            <OrgChartClientWrapper
                                initialData={chartData}
                            />
                        </Suspense>
                    </TabsContent>

                    <TabsContent value="list" className="flex-1 overflow-auto mt-0 border rounded-xl bg-white dark:bg-slate-950">
                        <OrgNodeTable nodes={tableData} uploadId={currentUploadId} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
