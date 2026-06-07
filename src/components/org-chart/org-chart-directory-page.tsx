'use client'

import React from 'react'
import { ImportOrgDialog } from './import-org-dialog'
import { OrgDirectoryGrouped } from './org-directory-grouped'
import type { DirectoryUpload } from '@/app/actions/org-chart-actions'

type Props = {
    uploads: DirectoryUpload[]
}

export function OrgChartDirectoryPage({ uploads }: Props) {
    return (
        <div className="container mx-auto py-2 space-y-4 flex flex-col min-h-screen px-4 md:px-6 mb-10">
            <div className="shrink-0 flex items-center justify-between">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 italic">
                    Organization Chart
                </h1>
                <ImportOrgDialog />
            </div>
            <OrgDirectoryGrouped uploads={uploads} />
        </div>
    )
}
