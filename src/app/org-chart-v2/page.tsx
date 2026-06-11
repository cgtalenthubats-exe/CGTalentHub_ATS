import Link from 'next/link'
import { fetchOrgDirectoryUploads } from '@/app/actions/org-chart-actions'

export default async function OrgChartV2DirectoryPage() {
    const uploads = await fetchOrgDirectoryUploads()

    return (
        <div className="container mx-auto py-4 px-4 md:px-6 space-y-4 mb-10">
            <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 italic">
                    Organization Chart — V2 Preview (d3-org-chart)
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Read-only preview using the d3-org-chart compact layout. Pick a chart below to compare against the existing OrgChart.
                </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {uploads.map((u) => (
                    <Link
                        key={u.upload_id}
                        href={`/org-chart-v2/${u.upload_id}`}
                        className="block border rounded-xl p-4 bg-white dark:bg-slate-900 hover:border-indigo-400 hover:shadow-sm transition-all"
                    >
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{u.company_name}</div>
                        {u.branch_name && <div className="text-xs text-slate-500 truncate">{u.branch_name}</div>}
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] uppercase tracking-wide text-slate-400">{u.resolved_group}</span>
                            {u.status && <span className="text-[10px] font-semibold text-indigo-500">{u.status}</span>}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
