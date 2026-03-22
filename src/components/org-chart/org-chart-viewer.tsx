'use client'

import React, { useState, useEffect } from 'react'
import Tree from 'react-d3-tree'
import { OrgNode, bulkCreateOrgProfiles, createSingleOrgProfile } from '@/app/actions/org-chart-actions'
import { Badge } from '@/components/ui/badge'
import { 
    UserCheck, UserPlus, Focus, ZoomIn, ZoomOut, Plus, 
    ExternalLink, Sparkles, Loader2, Trash2, Info, UploadCloud 
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from "@/lib/utils"
import { CandidateAvatar } from '@/components/candidate-avatar'
import { CandidateLinkedinButton } from '@/components/candidate-linkedin-button'
import { getCheckedStatus } from '@/lib/candidate-utils'
import { toast } from 'sonner'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { updateMasterCompanyLogo, deleteOrgChart, verifyOrgChart } from '@/app/actions/org-chart-actions'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useRouter } from 'next/navigation'

// Use client-side envs for Supabase Storage uploads
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

type OrgChartViewerProps = {
    initialData: OrgNode | null
    companyLogoUrl?: string | null
    companyId?: string | null
    uploadId?: string | null
    notes?: string | null
    chartFileUrl?: string | null
    modifyDate?: string | null
}

// Custom Node Component
const NodeCard = ({ nodeDatum, toggleNode, onCreateProfile, isCreating }: any) => {
    const isMatch = !!nodeDatum.matched_candidate_id
    const hasChildren = nodeDatum.children && nodeDatum.children.length > 0

    // Prevent click propagation for links
    const handleLinkClick = (e: React.MouseEvent) => {
        e.stopPropagation()
    }

    return (
        <g>
            <foreignObject width="300" height="180" x="-150" y="-90">
                <div className="p-2 h-full flex items-center justify-center">
                    <div
                        className={`
                  border rounded-xl shadow-md hover:shadow-xl transition-all duration-300
                  flex flex-col items-center p-4 text-center group
                  ${isMatch ? 'border-emerald-400 bg-emerald-50/90 dark:bg-emerald-950/40 ring-1 ring-emerald-100' : 'border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95'}
                  ${hasChildren ? 'cursor-pointer' : ''}
                `}
                        onClick={hasChildren ? toggleNode : undefined}
                    >
                        {/* Status Indicator & LinkedIn */}
                        <div className="absolute top-3 right-3 flex gap-1.5 items-center">
                            {nodeDatum.linkedin && (
                                <div onClick={handleLinkClick}>
                                    <CandidateLinkedinButton
                                        checked={nodeDatum.checked || getCheckedStatus(nodeDatum.linkedin)}
                                        linkedin={nodeDatum.linkedin}
                                        candidateId={nodeDatum.candidate_id || `temp-${nodeDatum.node_id}`}
                                        className="h-6 w-6"
                                    />
                                </div>
                            )}

                            {isMatch ? (
                                <div className="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 p-1 rounded-full border border-emerald-200" title="Matched Candidate">
                                    <UserCheck size={14} />
                                </div>
                            ) : (
                                <div className="text-slate-400 bg-slate-50 dark:bg-slate-800 p-1 rounded-full border border-slate-100 dark:border-slate-700" title="No Candidate Profile">
                                    <UserPlus size={14} />
                                </div>
                            )}
                        </div>

                        {/* External Link Action */}
                        {isMatch && nodeDatum.candidate_id && (
                            <Link
                                href={`/candidates/${nodeDatum.candidate_id}`}
                                target="_blank"
                                onClick={handleLinkClick}
                                className="absolute top-3 left-3 text-slate-400 hover:text-emerald-600 transition-colors"
                            >
                                <ExternalLink size={14} />
                            </Link>
                        )}

                        {/* Avatar */}
                        <div className="mb-3 relative">
                            <div className={`p-0.5 rounded-full border-2 ${isMatch ? 'border-emerald-200 bg-emerald-100' : 'border-slate-100 bg-slate-50 shadow-sm'}`}>
                                <CandidateAvatar
                                    src={nodeDatum.candidate_photo}
                                    name={nodeDatum.name}
                                    className="h-14 w-14"
                                />
                            </div>
                            {hasChildren && (
                                <Badge className="absolute -bottom-1 -right-1 px-1.5 py-0 h-5 text-[10px] bg-indigo-600 text-white border-white border-2">
                                    {nodeDatum.children.length}
                                </Badge>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex flex-col items-center">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm line-clamp-1">
                                {nodeDatum.name}
                            </h3>
                            {isMatch && nodeDatum.candidate_id && (
                                <div className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mt-0.5 mb-1">
                                    {nodeDatum.candidate_id}
                                </div>
                            )}
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold line-clamp-1 uppercase tracking-tight">
                                {nodeDatum.title || 'Position Not Set'}
                            </p>

                            {!isMatch && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] px-2 gap-1 border-dashed border-emerald-500 text-emerald-600 hover:bg-emerald-50 mt-3"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCreateProfile(nodeDatum.node_id);
                                    }}
                                    disabled={isCreating}
                                >
                                    {isCreating ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                        <UserPlus size={12} />
                                    )}
                                    Create Profile
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </foreignObject>
        </g>
    )
}

export function OrgChartViewer({ initialData, companyLogoUrl: initialLogo, companyId, uploadId: propUploadId, notes, chartFileUrl, modifyDate: initialModifyDate }: OrgChartViewerProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const uploadId = propUploadId || searchParams.get('id')
    const [translate, setTranslate] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(0.7)
    const [showLegend, setShowLegend] = useState(false)
    const [isBulkLoading, setIsBulkLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)
    const [modifyDate, setModifyDate] = useState<string | null>(initialModifyDate || null)
    const [creatingNodes, setCreatingNodes] = useState<Set<string>>(new Set())
    const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(initialLogo || null)
    const [isUploadingLogo, setIsUploadingLogo] = useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const logoInputRef = React.useRef<HTMLInputElement>(null)

    // Sync state if prop changes
    useEffect(() => {
        setCompanyLogoUrl(initialLogo || null)
    }, [initialLogo])

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !companyId) return

        setIsUploadingLogo(true)
        try {
            // Random prefix to bust cache
            const fileExt = file.name.split('.').pop() || 'png'
            const fileName = `logo_${companyId}_${Date.now()}.${fileExt}`

            // Upload to org_charts bucket
            const { error: uploadError } = await supabase.storage
                .from('org_charts')
                .upload(fileName, file, { upsert: true })

            if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

            // Get Public URL
            const { data: urlData } = supabase.storage
                .from('org_charts')
                .getPublicUrl(fileName)

            const publicUrl = urlData.publicUrl

            // Save to company_master
            await updateMasterCompanyLogo(companyId, publicUrl)

            setCompanyLogoUrl(publicUrl)
            toast.success("Company logo updated successfully")
        } catch (err: any) {
            toast.error("Failed to upload logo: " + err.message)
        } finally {
            setIsUploadingLogo(false)
        }
    }

    // Find all unmatched nodes for bulk creation
    const getUnmatchedNodes = (node: OrgNode | null): OrgNode[] => {
        if (!node) return []
        let results: OrgNode[] = []
        if (!node.matched_candidate_id && node.node_id !== 'root-wrapper') {
            results.push(node)
        }
        if (node.children) {
            node.children.forEach(child => {
                results = [...results, ...getUnmatchedNodes(child)]
            })
        }
        return results
    }

    const unmatchedCount = getUnmatchedNodes(initialData).length

    const handleBulkCreate = async () => {
        if (!uploadId) return
        try {
            setIsBulkLoading(true)
            const res = await bulkCreateOrgProfiles(uploadId as string)
            const msg = `Successfully created ${res.count} profiles! ${(res.webhookCount ?? 0) > 0 ? `${res.webhookCount} webhooks sent to n8n.` : ''}`
            toast.success(msg)
        } catch (err) {
            toast.error("Bulk creation failed. Check logs.")
        } finally {
            setIsBulkLoading(false)
        }
    }

    const handleSingleCreate = async (nodeId: string) => {
        try {
            setCreatingNodes(prev => new Set(prev).add(nodeId))
            const res = await createSingleOrgProfile(nodeId)
            if (res.mode === 'n8n') {
                toast.success("Profile created! Webhook sent to n8n for experience retrieval.")
            } else {
                toast.success("Profile and Current Job experience created successfully.")
            }
        } catch (err) {
            console.error('[CreateSingle] Error:', err)
            toast.error("Profile creation failed.")
        } finally {
            setCreatingNodes(prev => {
                const next = new Set(prev)
                next.delete(nodeId)
                return next
            })
        }
    }
    const handleDeleteChart = async () => {
        if (!uploadId) return
        try {
            setIsDeleting(true)
            const res = await deleteOrgChart(uploadId as string)
            if (res.success) {
                toast.success("Org Chart deleted successfully")
                router.push('/org-chart')
            } else {
                toast.error(res.error || "Failed to delete chart")
            }
        } catch (err) {
            toast.error("An error occurred during deletion")
        } finally {
            setIsDeleting(false)
        }
    }
    const handleVerifyChart = async () => {
        if (!uploadId) return
        try {
            setIsVerifying(true)
            const res = await verifyOrgChart(uploadId as string)
            if (res.success) {
                const now = new Date().toISOString()
                setModifyDate(now)
                toast.success("Org Chart verified and timestamp updated 🛡️")
            } else {
                toast.error("Failed to verify chart")
            }
        } catch (err) {
            toast.error("An error occurred during verification")
        } finally {
            setIsVerifying(false)
        }
    }

    const centerChart = () => {
        if (containerRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect()
            setTranslate({ x: width / 2, y: height / 4 })
            setZoom(1.0)
        }
    }

    // Center tree on load
    useEffect(() => {
        centerChart()
    }, [initialData])

    if (!initialData) {
        return (
            <div className="h-[600px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed rounded-xl bg-slate-50/50">
                <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                    <UserPlus size={32} className="text-slate-300" />
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">No Chart Structure Found</p>
                <p className="text-sm mt-1">Select an organization or upload a PDF to see the structure.</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full w-full relative rounded-xl overflow-hidden border shadow-sm group">
            {/* Notes Display Top Right */}
            {notes && (
                <div className="absolute top-4 right-4 z-10 max-w-[30%]">
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-md flex gap-3">
                        <div className="mt-0.5 text-indigo-500">
                            <Info size={16} />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Chart Notes</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed italic">
                                "{notes}"
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Verification Status (Top Center) */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-full px-4 py-1.5 shadow-sm flex items-center gap-3">
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Last Verified</span>
                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                            {modifyDate ? new Date(modifyDate).toLocaleString('th-TH', { 
                                day: '2-digit', month: '2-digit', year: 'numeric', 
                                hour: '2-digit', minute: '2-digit' 
                            }) : 'Never'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Deletion Button (Wait for selection? No, just the whole chart) Bottom Right */}
                        {/* Action Buttons & Deletion (Bottom Right) */}
            <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-3">
                {/* Legend Panel (Collapsible) - Stacks above buttons */}
                {showLegend && (
                    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-4 rounded-xl shadow-2xl border border-indigo-100 dark:border-indigo-900/30 text-[10px] text-slate-500 space-y-3 w-64 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest text-[9px] border-b pb-2 flex items-center justify-between">
                            <span>Legend & Help</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-50 dark:ring-indigo-900/20" />
                            <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">Internal Matched Profile</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="h-2.5 w-2.5 rounded-full bg-slate-300 ring-4 ring-slate-50 dark:ring-slate-800/20" />
                            <span className="font-medium text-slate-500 text-xs">External / Unmatched Info</span>
                        </div>
                        <div className="pt-2 flex flex-col gap-2 border-t mt-1 opacity-80">
                            <div className="flex items-center gap-2 italic">
                                <ZoomIn size={12} className="text-indigo-400" /> Scroll to Zoom
                            </div>
                            <div className="flex items-center gap-2 italic">
                                <Focus size={12} className="text-indigo-400" /> Drag to Pan
                            </div>
                            <div className="flex items-center gap-2 italic">
                                <Plus size={12} className="text-indigo-400" /> Click Card to Expand Team
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex gap-2 items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-1.5 rounded-full border border-slate-200/50 shadow-sm">
                    {/* Bulk Create */}
                    <Button
                        variant="default"
                        size="sm"
                        className={cn(
                            "h-9 px-4 shadow-md rounded-full text-[11px] font-bold gap-2 transition-all border-none",
                            unmatchedCount > 0 ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                        )}
                        onClick={handleBulkCreate}
                        disabled={isBulkLoading || unmatchedCount === 0}
                    >
                        {isBulkLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Sparkles size={14} className={unmatchedCount > 0 ? "text-emerald-100" : "text-slate-300"} />
                        )}
                        CREATE ALL ({unmatchedCount})
                    </Button>

                    <Separator orientation="vertical" className="h-4 bg-slate-300 mx-0.5" />

                    {/* Chart Key Toggle */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowLegend(!showLegend)}
                        className={cn(
                            "h-9 px-3 shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-full text-xs gap-2 transition-all",
                            showLegend ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-50"
                        )}
                        title="Toggle Legend"
                    >
                        <Plus size={14} className={cn("transition-transform", showLegend && "rotate-45")} />
                        CHART KEY
                    </Button>

                    {/* Recenter */}
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={centerChart}
                        className="h-9 w-9 shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 rounded-full"
                        title="Recenter Chart"
                    >
                        <Focus size={16} className="text-slate-600" />
                    </Button>

                    <Separator orientation="vertical" className="h-4 bg-slate-200 mx-0.5" />
                    
                    {/* View Original PDF */}
                    {chartFileUrl && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-3 gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm bg-white rounded-full"
                            onClick={() => window.open(chartFileUrl, '_blank')}
                        >
                            <ExternalLink size={14} />
                            VIEW PDF
                        </Button>
                    )}

                    <Separator orientation="vertical" className="h-4 bg-slate-200 mx-0.5" />

                    {/* Verify Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-4 gap-2 bg-indigo-600 border-none text-white hover:bg-indigo-700 shadow-md rounded-full text-[11px] font-bold"
                        onClick={handleVerifyChart}
                        disabled={isVerifying}
                    >
                        {isVerifying ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <UserCheck size={14} />
                        )}
                        VERIFY CHART
                    </Button>

                    <Separator orientation="vertical" className="h-4 bg-slate-200 mx-0.5" />

                    {/* Delete Chart */}
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-3 gap-2 border-rose-100 text-rose-500 hover:bg-rose-50 hover:text-rose-600 shadow-sm bg-white rounded-full"
                                disabled={isDeleting}
                            >
                                <Trash2 size={14} />
                                DELETE
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete this Org Chart and all its mappings. 
                                    <br/><br/>
                                    <strong className="text-rose-600">Note:</strong> Candidate profiles themselves will NOT be deleted, only their association with this specific chart.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteChart} className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg">
                                    Yes, Delete Chart
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {/* Company Logo Top Left */}
            {companyId && (
                <div className="absolute top-4 left-4 z-10">
                    <div 
                        className={cn(
                            "relative group rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center cursor-pointer transition-all",
                            companyLogoUrl ? "h-16 w-32 p-1" : "h-9 px-4 hover:border-indigo-300 hover:bg-slate-50 rounded-full"
                        )}
                        onClick={() => !isUploadingLogo && logoInputRef.current?.click()}
                        title="Upload Company Logo"
                    >
                        {isUploadingLogo ? (
                            <div className="flex flex-col items-center gap-1 justify-center w-full h-full text-indigo-500">
                                <Loader2 size={16} className="animate-spin" />
                            </div>
                        ) : companyLogoUrl ? (
                            <>
                                <img src={companyLogoUrl} alt="Company Logo" className="max-h-full max-w-full object-contain" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold">
                                    <UploadCloud size={16} className="mb-0.5" />
                                    UPDATE
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold group-hover:text-indigo-600 transition-colors">
                                <UploadCloud size={14} />
                                ADD LOGO
                            </div>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            ref={logoInputRef}
                            className="hidden"
                            onChange={handleLogoUpload}
                        />
                    </div>
                </div>
            )}



            {/* Tree Container */}
            <div ref={containerRef} className="flex-1 w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] relative">
                <Tree
                    data={initialData}
                    translate={translate}
                    zoom={zoom}
                    renderCustomNodeElement={(rd3tProps) => (
                        <NodeCard
                            {...rd3tProps}
                            onCreateProfile={handleSingleCreate}
                            isCreating={creatingNodes.has((rd3tProps.nodeDatum as any).node_id)}
                        />
                    )}
                    orientation="vertical"
                    pathFunc="step"
                    separation={{ siblings: 1.5, nonSiblings: 2 }}
                    zoomable={true}
                    draggable={true}
                    collapsible={true}
                    nodeSize={{ x: 300, y: 220 }}
                    enableLegacyTransitions={true}
                    transitionDuration={400}
                    onUpdate={(target: any) => {
                        if (target.zoom !== zoom) setZoom(target.zoom)
                        if (target.translate.x !== translate.x || target.translate.y !== translate.y) {
                            setTranslate(target.translate)
                        }
                    }}
                />
            </div>
        </div>
    )
}
