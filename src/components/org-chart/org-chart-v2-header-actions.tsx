'use client'

import React, { useState } from 'react'
import { AddNodeDialog } from './add-node-dialog'
import { CloneOrgDialog } from './clone-org-dialog'
import { ParseImageDialog } from './parse-image-dialog'
import { Button } from '@/components/ui/button'
import { Plus, GitFork, ScanLine } from 'lucide-react'

type Props = {
    uploadId: string
    uploads: { upload_id: string; company_name: string; branch_name?: string | null }[]
    existingNodes: { name: string; parent_name: string | null }[]
}

export function OrgChartV2HeaderActions({ uploadId, uploads, existingNodes }: Props) {
    const [addNodeOpen, setAddNodeOpen] = useState(false)
    const [cloneOrgOpen, setCloneOrgOpen] = useState(false)
    const [parseImageOpen, setParseImageOpen] = useState(false)

    return (
        <div className="flex items-center gap-2">
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

            <AddNodeDialog
                open={addNodeOpen}
                onOpenChange={setAddNodeOpen}
                uploadId={uploadId}
            />
            <CloneOrgDialog
                open={cloneOrgOpen}
                onOpenChange={setCloneOrgOpen}
                targetUploadId={uploadId}
                allUploads={uploads}
            />
            <ParseImageDialog
                open={parseImageOpen}
                onOpenChange={setParseImageOpen}
                uploadId={uploadId}
                existingNodes={existingNodes}
            />
        </div>
    )
}
