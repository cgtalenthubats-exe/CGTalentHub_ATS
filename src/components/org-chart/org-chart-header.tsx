'use client'

import React, { useState } from 'react'
import { ImportOrgDialog } from './import-org-dialog'
import { AddNodeDialog } from './add-node-dialog'
import { CloneOrgDialog } from './clone-org-dialog'
import { ParseImageDialog } from './parse-image-dialog'
import { Button } from '@/components/ui/button'
import { Plus, GitFork, ScanLine } from 'lucide-react'

type Props = {
    currentUploadId: string | null
    uploads: { upload_id: string; company_name: string; branch_name?: string | null }[]
    existingNodes?: { name: string; parent_name: string | null }[]
}

export function OrgChartHeader({ currentUploadId, uploads, existingNodes = [] }: Props) {
    const [addNodeOpen, setAddNodeOpen] = useState(false)
    const [cloneOrgOpen, setCloneOrgOpen] = useState(false)
    const [parseImageOpen, setParseImageOpen] = useState(false)

    return (
        <div className="shrink-0 flex items-center justify-between">
            <div className="flex items-baseline gap-3">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 italic">
                    Organization Chart
                </h1>
            </div>

            <div className="flex items-center gap-2">
                {currentUploadId && (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs font-bold gap-1.5 border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200"
                            onClick={() => setAddNodeOpen(true)}
                        >
                            <Plus size={13} className="stroke-[3]" /> Add Node
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs font-bold gap-1.5 border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200"
                            onClick={() => setCloneOrgOpen(true)}
                        >
                            <GitFork size={13} /> Clone Org
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs font-bold gap-1.5 border-slate-200 text-slate-600 hover:text-violet-600 hover:border-violet-200"
                            onClick={() => setParseImageOpen(true)}
                        >
                            <ScanLine size={13} /> Parse Image
                        </Button>
                    </>
                )}
                <ImportOrgDialog />
            </div>

            {currentUploadId && (
                <>
                    <AddNodeDialog
                        open={addNodeOpen}
                        onOpenChange={setAddNodeOpen}
                        uploadId={currentUploadId}
                    />
                    <CloneOrgDialog
                        open={cloneOrgOpen}
                        onOpenChange={setCloneOrgOpen}
                        targetUploadId={currentUploadId}
                        allUploads={uploads}
                    />
                    <ParseImageDialog
                        open={parseImageOpen}
                        onOpenChange={setParseImageOpen}
                        uploadId={currentUploadId}
                        existingNodes={existingNodes}
                    />
                </>
            )}
        </div>
    )
}
