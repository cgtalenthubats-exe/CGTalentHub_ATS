'use client'

import React, { useState, useEffect } from 'react'
import Tree from 'react-d3-tree'
import { OrgNode, bulkCreateOrgProfiles, createSingleOrgProfile, clearOrgNode, deleteOrgNode } from '@/app/actions/org-chart-actions'
import { Badge } from '@/components/ui/badge'
import { 
    UserCheck, UserPlus, Focus, ZoomIn, ZoomOut, Plus, 
    ExternalLink, Sparkles, Loader2, Trash2, Info, UploadCloud,
    Users, ChevronUp, Download, Image as ImageIcon, FileText,
    AlertTriangle, X, MoreHorizontal, Target, Search, ArrowLeft
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { NodeFormDialog } from './node-form-dialog'

const extractNodes = (node: any): any[] => {
    if (!node) return [];
    let nodes = [node];
    if (node.children) {
        node.children.forEach((child: any) => {
            nodes = nodes.concat(extractNodes(child));
        });
    }
    return nodes;
};
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from "@/lib/utils"
import { CandidateAvatar } from '@/components/candidate-avatar'
import { CandidateLinkedinButton } from '@/components/candidate-linkedin-button'
import { getCheckedStatus } from '@/lib/candidate-utils'
import { toast } from "@/lib/notifications"
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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

const TeamMemberMiniCard = ({ nodeDatum, onToggleVerify, onCreateProfile, isCreating, onExpand, onDeleteNode, onAddSubordinate, onReplaceNode, onMoveNode }: any) => {
    const isMatch = !!nodeDatum.matched_candidate_id
    const isVerified = nodeDatum.is_verified === 'TRUE'
    const isNotMatch = nodeDatum.is_verified === 'NOT_MATCH'
    const childCount = nodeDatum._childCount || 0
    const hasChildren = childCount > 0

    const status = nodeDatum.match_status || (isMatch ? 'matched' : 'unmapped')
    const current = nodeDatum.current_experience

    let cardColorClass = 'border-slate-200 bg-white'
    if ((isVerified || status === 'matched')) cardColorClass = 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-100'
    else if ((isNotMatch || status === 'mismatch_company')) cardColorClass = 'border-rose-500 bg-rose-50 ring-1 ring-rose-100'
    else if (status === 'mismatch_position') cardColorClass = 'border-amber-400 bg-amber-50 ring-1 ring-amber-100'
    else if (status === 'n8n_processing') cardColorClass = 'border-indigo-400 bg-indigo-50 border-dashed animate-pulse'

    return (
        <div 
            className={cn(
                "relative w-full border-2 rounded-xl flex flex-col justify-between p-2.5 transition-all shadow-sm group",
                cardColorClass,
                hasChildren && "cursor-pointer hover:ring-indigo-400 hover:shadow-md"
            )}
            onClick={hasChildren ? () => onExpand(nodeDatum.node_id) : undefined}
            style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', padding: '10px',
                borderWidth: '2px', borderRadius: '12px', borderStyle: 'solid', boxSizing: 'border-box', position: 'relative',
                backgroundColor: (isVerified || status === 'matched') ? '#ecfdf5' : ((isNotMatch || status === 'mismatch_company') ? '#fff1f2' : (status === 'mismatch_position' ? '#fffbeb' : (status === 'n8n_processing' ? '#eef2ff' : '#ffffff'))),
                borderColor: (isVerified || status === 'matched') ? '#10b981' : ((isNotMatch || status === 'mismatch_company') ? '#f43f5e' : (status === 'mismatch_position' ? '#fbbf24' : (status === 'n8n_processing' ? '#818cf8' : '#e2e8f0'))),
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}
        >
            <div className="flex items-start w-full relative">
                <div className="flex-shrink-0 mr-2.5 relative">
                    <CandidateAvatar 
                        src={nodeDatum.candidate_photo} 
                        name={nodeDatum.name} 
                        className="h-10 w-10 shrink-0" 
                    />
                    {hasChildren && (
                        <Badge className="absolute -bottom-1 -right-1 px-1 py-0 h-4 min-w-[16px] text-[8px] bg-indigo-600 text-white border-white border-2 flex items-center justify-center rounded-full pointer-events-none">
                            {childCount}
                        </Badge>
                    )}
                </div>

                <div className="flex-1 min-w-0 pr-5">
                    <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-slate-800 text-[12px] truncate leading-tight" title={nodeDatum.name}>
                            {nodeDatum.name}
                        </h3>
                        {status === 'mismatch_company' && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertTriangle size={10} className="text-rose-500 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="text-[10px]">Company Mismatch: {current?.company || 'Unknown'}</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                        {status === 'mismatch_position' && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info size={10} className="text-amber-500 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="text-[10px]">Position Mismatch: {current?.position || 'Unknown'}</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium truncate uppercase tracking-tight mt-0.5 leading-tight" title={nodeDatum.title}>
                        {nodeDatum.title || 'Position Not Set'}
                    </p>
                </div>

                <div className="absolute top-0 right-0 flex gap-1 z-10" onClick={(e) => e.stopPropagation()}>
                    {isMatch && nodeDatum.candidate_id && (
                        <Link href={`/candidates/${nodeDatum.candidate_id}`} target="_blank" className="text-slate-400 hover:text-indigo-600 p-0.5">
                            <ExternalLink size={12} />
                        </Link>
                    )}
                    {nodeDatum.linkedin && (
                        <CandidateLinkedinButton 
                            linkedin={nodeDatum.linkedin} 
                            candidateId={nodeDatum.candidate_id || nodeDatum.node_id}
                            className="h-5 w-5" 
                        />
                    )}
                </div>
                
                <div className="absolute -top-1.5 -right-1.5 z-50">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-full p-0 flex items-center justify-center hover:bg-slate-50 transition-all hover:scale-110">
                                <MoreHorizontal size={14} strokeWidth={3} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAddSubordinate(nodeDatum.name); }}>
                                <Plus size={14} className="mr-2" /> Add Subordinate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReplaceNode(nodeDatum); }}>
                                <UserPlus size={14} className="mr-2" /> Replace / Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMoveNode(nodeDatum); }}>
                                <Focus size={14} className="mr-2" /> Move Node
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-rose-600" onClick={(e) => { e.stopPropagation(); onDeleteNode({ node_id: nodeDatum.node_id, name: nodeDatum.name }); }}>
                                <Trash2 size={14} className="mr-2" /> Remove Node
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="flex justify-between items-end w-full mt-auto">
                <p className="text-[9px] font-mono font-bold text-slate-400 mb-0.5">
                    {isMatch ? nodeDatum.candidate_id : 'UNMATCHED'}
                </p>
                <div className="z-10" onClick={(e) => e.stopPropagation()}>
                    {isMatch ? (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn("h-6 text-[9px] px-1.5 gap-1 rounded-lg", isVerified ? "text-emerald-700 bg-emerald-100/50" : "text-amber-700 bg-amber-100/50 border border-amber-300")} 
                            onClick={() => onToggleVerify(nodeDatum)}
                        >
                            <UserCheck size={10} />
                            {isVerified ? "V" : "VERIFY"}
                        </Button>
                    ) : (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-6 text-[9px] px-1.5 border-dashed border-indigo-400 text-indigo-600" 
                            onClick={() => onCreateProfile(nodeDatum.node_id)} 
                            disabled={isCreating}
                        >
                            + CREATE
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

// Custom Node Component
const NodeCard = ({ nodeDatum, onToggleVerify, onCreateProfile, isCreating, isVerifying, onToggleExpand, expandedSet, onDeleteNode, onAddSubordinate, onReplaceNode, onMoveNode, onFocusTeam, highlightNodeId }: any) => {
    // Hide phantom nodes (Standard Grid columns)
    if (nodeDatum.isPhantom && !nodeDatum.isTeamGrid) {
        return <g />
    }

    // Hide Organization root, but keep it in the DOM tree
    if (nodeDatum.name === 'Organization' && !nodeDatum.matched_candidate_id) {
        return (
            <g>
                <circle r={1} fill="transparent" />
                <foreignObject width="200" height="40" x="-100" y="-30">
                    <div className="flex items-center justify-center h-full text-[10px] font-bold text-slate-400 opacity-50 tracking-widest">
                        ORGANIZATION
                    </div>
                </foreignObject>
            </g>
        )
    }

    const isTeamGrid = !!nodeDatum.isTeamGrid
    const isMatch = !!nodeDatum.matched_candidate_id
    const isVerified = nodeDatum.is_verified === 'TRUE'
    const isNotMatch = nodeDatum.is_verified === 'NOT_MATCH'
    const childCount = nodeDatum._childCount || 0
    const hasChildren = childCount > 0

    const status = nodeDatum.match_status || (isMatch ? 'matched' : 'unmapped')
    const current = nodeDatum.current_experience

    // Color logic
    let cardColorClass = 'border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-sm'
    if ((isVerified || status === 'matched')) cardColorClass = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-emerald-100'
    else if ((isNotMatch || status === 'mismatch_company')) cardColorClass = 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 ring-2 ring-rose-100'
    else if (status === 'mismatch_position') cardColorClass = 'border-amber-400 bg-amber-50/80 dark:bg-amber-950/40 ring-2 ring-amber-100/50'
    else if (status === 'n8n_processing') cardColorClass = 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-dashed animate-pulse'

    if (isTeamGrid && nodeDatum.members) {
        // Absolute positioning for TeamGrid to bypass html-to-image CSS Grid bugs
        const memberCount = nodeDatum.members.length;
        const columns = Math.ceil(memberCount / 5); // 5 rows max
        const rowsCount = Math.min(memberCount, 5);
        
        const cardWidth = 280;
        const cardHeight = 140;
        const gap = 8;
        const padding = 8;

        const gridWidth = columns * cardWidth + Math.max(0, columns - 1) * gap;
        const gridHeight = rowsCount * cardHeight + Math.max(0, rowsCount - 1) * gap;
        
        const foreignObjectX = -(gridWidth + padding * 2) / 2;

        const startY = -50;

        return (
            <g>
                {/* Background Box for the Grid */}
                <foreignObject width={gridWidth + padding * 2} height={gridHeight + padding * 2} x={foreignObjectX} y={startY}>
                    <div style={{ 
                        width: '100%',
                        height: '100%',
                        borderRadius: '16px', 
                        borderWidth: '2px', 
                        borderStyle: 'solid', 
                        backgroundColor: '#f1f5f9',
                        borderColor: '#e2e8f0',
                    }} />
                </foreignObject>

                {/* Individual Cards drawn natively in SVG space */}
                {nodeDatum.members.map((member: any, i: number) => {
                    const col = Math.floor(i / 5);
                    const row = i % 5;
                    const x = foreignObjectX + padding + col * (cardWidth + gap);
                    const y = startY + padding + row * (cardHeight + gap);
                    
                    return (
                        <foreignObject key={member.node_id} width={cardWidth} height={cardHeight} x={x} y={y}>
                            <div style={{ width: '100%', height: '100%' }}>
                                <TeamMemberMiniCard 
                                    nodeDatum={member} 
                                    onToggleVerify={onToggleVerify}
                                    onCreateProfile={onCreateProfile}
                                    isCreating={isCreating}
                                    onExpand={onToggleExpand}
                                    onDeleteNode={onDeleteNode}
                                    onAddSubordinate={onAddSubordinate}
                                    onReplaceNode={onReplaceNode}
                                    onMoveNode={onMoveNode}
                                />
                            </div>
                        </foreignObject>
                    );
                })}
            </g>
        )
    }

    // Prevent click propagation for links
    const handleLinkClick = (e: React.MouseEvent) => {
        e.stopPropagation()
    }

    return (
        <g id={`node-card-${nodeDatum.node_id}`}>
            <foreignObject width="280" height="160" x="-140" y="-80">
                <div className="p-1 flex items-start justify-center">
                    <div
                        className={cn(
                            "relative w-full border-2 rounded-xl transition-all duration-300 flex flex-col p-3 group",
                            cardColorClass,
                            hasChildren && "cursor-pointer hover:ring-2 hover:ring-indigo-400 hover:ring-offset-1",
                            highlightNodeId === nodeDatum.node_id && "ring-4 ring-indigo-500 ring-offset-2 animate-pulse shadow-xl shadow-indigo-200 bg-indigo-50"
                        )}
                        onClick={hasChildren ? () => onToggleExpand(nodeDatum.node_id) : undefined}
                        style={{
                            display: 'flex', flexDirection: 'column', width: '100%', padding: '12px', borderWidth: '2px', borderRadius: '12px', borderStyle: 'solid', boxSizing: 'border-box', position: 'relative',
                            backgroundColor: (isVerified || status === 'matched') ? '#ecfdf5' : ((isNotMatch || status === 'mismatch_company') ? '#fff1f2' : (status === 'mismatch_position' ? '#fffbeb' : (status === 'n8n_processing' ? '#eef2ff' : '#ffffff'))),
                            borderColor: (isVerified || status === 'matched') ? '#10b981' : ((isNotMatch || status === 'mismatch_company') ? '#f43f5e' : (status === 'mismatch_position' ? '#fbbf24' : (status === 'n8n_processing' ? '#818cf8' : '#e2e8f0'))),
                            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}
                    >
                        {/* More Actions Menu - Top Right Corner */}
                        <div className="absolute -top-2.5 -right-2.5 z-50" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md rounded-full p-0 flex items-center justify-center hover:bg-slate-100 transition-all hover:scale-110">
                                        <MoreHorizontal size={16} strokeWidth={3} />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => onAddSubordinate(nodeDatum.name)}>
                                        <Plus size={16} className="mr-2" /> Add Subordinate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onReplaceNode(nodeDatum)}>
                                        <UserPlus size={16} className="mr-2" /> Replace / Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onMoveNode(nodeDatum)}>
                                        <Focus size={16} className="mr-2" /> Move Node
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onFocusTeam(nodeDatum.node_id)} className="text-indigo-600 focus:text-indigo-600 focus:bg-indigo-50">
                                        <Target size={16} className="mr-2" /> Focus on this Team
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-rose-600 focus:text-rose-600 focus:bg-rose-50" onClick={() => onDeleteNode({ node_id: nodeDatum.node_id, name: nodeDatum.name })}>
                                        <Trash2 size={16} className="mr-2" /> Remove Node
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        {/* Top Area: Avatar & Text */}
                        <div className="flex items-start w-full relative" style={{ display: 'flex', alignItems: 'flex-start', width: '100%', position: 'relative' }}>
                            <div className="flex-shrink-0 mr-3 relative" style={{ flexShrink: 0, marginRight: '12px', position: 'relative' }}>
                                <div className={cn("p-0.5 rounded-full border-2", isMatch ? "border-emerald-200 bg-emerald-100" : "border-slate-100 bg-slate-50")} style={{ padding: '2px', borderRadius: '9999px', borderWidth: '2px', borderStyle: 'solid', backgroundColor: isMatch ? '#ecfdf5' : '#f8fafc', borderColor: isMatch ? '#a7f3d0' : '#f1f5f9' }}>
                                    <CandidateAvatar src={nodeDatum.candidate_photo} name={nodeDatum.name} className="h-12 w-12" style={{ width: 48, height: 48, minWidth: 48, minHeight: 48 }} />
                                </div>
                                {hasChildren && (
                                    <Badge className="absolute -bottom-1 -right-1 px-1.5 py-0 h-5 text-[10px] bg-indigo-600 text-white border-white border-2" style={{ position: 'absolute', bottom: '-4px', right: '-4px', padding: '0 6px', height: '20px', fontSize: '10px', backgroundColor: '#4f46e5', color: 'white', borderColor: 'white', borderWidth: '2px', borderStyle: 'solid', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                        {childCount}
                                    </Badge>
                                )}
                            </div>

                            <div className="flex-1 min-w-0 pr-10" style={{ flex: '1 1 0%', minWidth: 0, paddingRight: '40px' }}> {/* Space for top right icons */}
                                <div className="flex items-center gap-1.5">
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate leading-tight" title={nodeDatum.name} style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0, lineHeight: 1.25 }}>
                                        {nodeDatum.name}
                                    </h3>
                                    {status === 'mismatch_company' && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <AlertTriangle size={12} className="text-rose-500 cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="text-xs">Company Mismatch: {current?.company || 'Unknown'}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                    {status === 'mismatch_position' && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info size={12} className="text-amber-500 cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="text-xs">Position Mismatch: {current?.position || 'Unknown'}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium line-clamp-2 uppercase tracking-tight leading-tight mt-0.5" title={nodeDatum.title} style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, textTransform: 'uppercase', margin: '2px 0 0 0', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {nodeDatum.title || 'Position Not Set'}
                                </p>
                            </div>

                            {/* Icons Top Right */}
                            <div className="absolute top-0 right-0 flex gap-1 items-center z-10" onClick={handleLinkClick} style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: '4px', alignItems: 'center', zIndex: 10 }}>
                                {isMatch && nodeDatum.candidate_id && (
                                    <Link href={`/candidates/${nodeDatum.candidate_id}`} target="_blank" className="text-slate-400 hover:text-indigo-600 p-0.5" title="View Profile" style={{ display: 'flex', alignItems: 'center', padding: '2px' }}>
                                        <ExternalLink size={14} style={{ width: 14, height: 14, color: '#94a3b8' }} />
                                    </Link>
                                )}
                                {nodeDatum.linkedin && (
                                    <CandidateLinkedinButton
                                        checked={nodeDatum.checked || getCheckedStatus(nodeDatum.linkedin)}
                                        linkedin={nodeDatum.linkedin}
                                        candidateId={nodeDatum.candidate_id || nodeDatum.node_id}
                                        className="h-6 w-6"
                                        style={{ width: 24, height: 24 }}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Bottom Area: ID & Actions */}
                        <div className="mt-auto pt-2 flex items-end justify-between w-full h-8" style={{ marginTop: 'auto', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', height: '32px' }}>
                            <p className="text-[10px] font-mono font-bold text-slate-400 mb-0.5" style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#94a3b8', margin: '0 0 2px 0' }}>
                                {isMatch ? nodeDatum.candidate_id : 'UNMATCHED'}
                            </p>
                            
                            <div className="z-10" onClick={handleLinkClick} style={{ zIndex: 10 }}>
                                {isMatch ? (
                                    <Button
                                        variant={isVerified ? "ghost" : "outline"}
                                        size="sm"
                                        className={cn(
                                            "h-7 text-[10px] px-2 gap-1 rounded-lg transition-all",
                                            status === 'matched' ? "text-emerald-600 bg-emerald-100/50 hover:bg-emerald-100 border-none" : 
                                            status === 'mismatch_company' ? "border-rose-500 text-rose-700 bg-rose-100/50 hover:bg-rose-100" :
                                            "border-amber-500 text-amber-700 bg-amber-100/50 hover:bg-amber-100"
                                        )}
                                        onClick={() => onToggleVerify(nodeDatum)}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '28px', padding: '0 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, border: status === 'matched' ? 'none' : (status === 'mismatch_company' ? '1px solid #f43f5e' : '1px solid #f59e0b'), backgroundColor: status === 'matched' ? '#d1fae5' : (status === 'mismatch_company' ? '#fee2e2' : '#fef3c7'), color: status === 'matched' ? '#059669' : (status === 'mismatch_company' ? '#e11d48' : '#b45309'), cursor: 'pointer' }}
                                    >
                                        <UserCheck size={12} className={cn(status === 'matched' ? "text-emerald-600" : (status === 'mismatch_company' ? "text-rose-600" : "text-amber-600"))} style={{ width: 12, height: 12 }} />
                                        {status === 'matched' ? "VERIFIED" : (status === 'mismatch_company' ? "RE-VERIFY" : "VERIFY")}
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px] px-2 gap-1 border-dashed border-indigo-400 text-indigo-600 hover:bg-indigo-50"
                                        onClick={() => onCreateProfile(nodeDatum.node_id)}
                                        disabled={isCreating}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '28px', padding: '0 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, border: '1px dashed #818cf8', backgroundColor: 'transparent', color: '#4f46e5', cursor: 'pointer' }}
                                    >
                                        {isCreating ? <Loader2 size={12} className="animate-spin" style={{ width: 12, height: 12 }} /> : <UserPlus size={12} style={{ width: 12, height: 12 }} />}
                                        CREATE
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </foreignObject>
        </g>
    )
}

import { VerificationDialog } from './verification-dialog'
import { verifyOrgNode } from '@/app/actions/org-chart-actions'

export function OrgChartViewer({ initialData, companyLogoUrl: initialLogo, companyId, uploadId: propUploadId, chartCompanyName = 'Unknown', notes, chartFileUrl, modifyDate: initialModifyDate }: any) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const uploadId = propUploadId || searchParams.get('id')

    useEffect(() => {
        if (!companyId) return;
        const channel = supabase
            .channel('org-chart-updates-' + companyId)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'all_org_nodes', filter: `company_id=eq.${companyId}` },
                () => { router.refresh(); }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [companyId, router]);
    
    // Transform data for grid layout & handling custom expansions
    const [transformedData, setTransformedData] = useState<OrgNode | null>(null)
    const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set())
    
    // Verification Dialog States
    const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false)
    const [nodeToVerify, setNodeToVerify] = useState<any | null>(null)
    const [isVerifyingNode, setIsVerifyingNode] = useState(false)

    // Node Deletion States
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{ node_id: string, name: string } | null>(null)
    const [isDeletingNodeAction, setIsDeletingNodeAction] = useState(false)
    
    // Add Node Dialog States
    const [isAddNodeDialogOpen, setIsAddNodeDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<'add' | 'edit' | 'move'>('add')
    const [selectedParentForAdd, setSelectedParentForAdd] = useState<string | null>(null)
    const [editingNode, setEditingNode] = useState<any | null>(null)
    const [hasChildrenForMove, setHasChildrenForMove] = useState(false)

    useEffect(() => {
        if (initialData) {
            const initial = new Set<string>();
            const initExpand = (node: any, depth: number) => {
                if (!node) return;
                if (depth < 2) initial.add(node.node_id);
                node.children?.forEach((c: any) => initExpand(c, depth + 1));
            };
            initExpand(initialData, 0);
            setExpandedSet(initial);
        }
    }, [initialData]);

    const buildCustomTree = (node: any, depth: number = 0): any => {
        if (!node) return null;
        
        const cloned = { ...node };
        cloned._childCount = cloned.children ? cloned.children.length : 0;

        if (cloned.children && cloned.children.length > 0) {
            if (!expandedSet.has(cloned.node_id)) {
                cloned.children = [];
                return cloned;
            }

            const newChildren = [];
            let currentGroupMembers: any[] = [];

            for (const child of cloned.children) {
                const isSeparated = depth < 1 || expandedSet.has(child.node_id);

                if (isSeparated) {
                    newChildren.push(buildCustomTree(child, depth + 1));
                } else {
                    currentGroupMembers.push(buildCustomTree(child, depth + 1));
                }
            }

            if (currentGroupMembers.length > 0) {
                const teamNodeId = `team-grid-${cloned.node_id}`;
                
                const columns = Math.ceil(currentGroupMembers.length / 5);
                const gridCSSWidth = columns * 280 + Math.max(0, columns - 1) * 8;
                const gridCSSHeight = Math.min(currentGroupMembers.length, 5) * 102;
                
                const NODE_SIZE_X = 310;
                const NODE_SIZE_Y = 160;
                
                let rightSpill = (-140 + gridCSSWidth) - (NODE_SIZE_X / 2);
                let paddingNodes = 0;
                if (rightSpill > 0) paddingNodes = Math.ceil(rightSpill / NODE_SIZE_X);

                let extraLayers = 0;
                if (gridCSSHeight > NODE_SIZE_Y) {
                    extraLayers = Math.ceil((gridCSSHeight - NODE_SIZE_Y) / NODE_SIZE_Y);
                }

                const buildSpine = (baseId: string, depthRemaining: number): any[] => {
                    if (depthRemaining <= 0) return [];
                    return [{
                        node_id: `${baseId}-spine-${depthRemaining}`,
                        name: 'Spacer',
                        isPhantom: true,
                        isSpacer: true,
                        isTeamGrid: false,
                        children: buildSpine(baseId, depthRemaining - 1)
                    }];
                };

                newChildren.push({
                    node_id: teamNodeId,
                    name: 'Team',
                    isTeamGrid: true,
                    isPhantom: true,
                    members: currentGroupMembers,
                    children: buildSpine(teamNodeId, extraLayers)
                });

                for (let i = 0; i < paddingNodes; i++) {
                    const spacerId = `spacer-R-${teamNodeId}-${i}`;
                    newChildren.push({
                        node_id: spacerId,
                        name: 'Spacer',
                        isPhantom: true,
                        isSpacer: true,
                        isTeamGrid: false,
                        children: buildSpine(spacerId, extraLayers)
                    });
                }
            }

            cloned.children = newChildren;
        }

        return cloned;
    };

    useEffect(() => {
        if (initialData && expandedSet.size > 0) {
            setTransformedData(buildCustomTree(initialData));
        }
    }, [initialData, expandedSet]);

    const openVerifyDialog = (node: any) => {
        // Only open dialog for Red or Yellow nodes (Mismatches)
        // If it's already Green (Matched) or Unverified (Gray/White), just toggle normally or open dialog
        // The user said: "ขั้นตอนการ verify มันไม่ใช่ค่กด แต่ควรจะเปนการกดแล้วเป็น pop up"
        // So I'll open the dialog for ALL verification attempts on matched nodes.
        setNodeToVerify(node);
        setIsVerifyDialogOpen(true);
    };

    const handleConfirmVerification = async (nodeId: string, status: 'TRUE' | 'NOT_MATCH') => {
        setIsVerifyingNode(true);
        try {
            await verifyOrgNode(nodeId, status);
            toast.success(status === 'TRUE' ? 'Verified as Correct Match' : 'Flagged as Error');
            setIsVerifyDialogOpen(false);
            // Router refresh to sync server components, Realtime will handle the immediate UI update
            router.refresh();
        } catch (err) {
            toast.error('Failed to update verification status');
        } finally {
            setIsVerifyingNode(false);
        }
    };

    const handleToggleExpand = (nodeId: string) => {
        setExpandedSet(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    };

    const openDeleteDialog = (node: { node_id: string, name: string }) => {
        setDeleteTarget(node);
        setIsDeleteDialogOpen(true);
    };

    const handleClearNode = async () => {
        if (!deleteTarget) return;
        setIsDeletingNodeAction(true);
        try {
            await clearOrgNode(deleteTarget.node_id);
            toast.success('Node info cleared to (Vacant)');
            setIsDeleteDialogOpen(false);
            router.refresh();
        } catch (err) {
            toast.error('Failed to clear node info');
        } finally {
            setIsDeletingNodeAction(false);
        }
    };

    const handleDeleteNode = async () => {
        if (!deleteTarget) return;
        setIsDeletingNodeAction(true);
        try {
            await deleteOrgNode(deleteTarget.node_id);
            toast.success('Node removed and team re-parented');
            setIsDeleteDialogOpen(false);
            router.refresh();
        } catch (err) {
            toast.error('Failed to remove node');
        } finally {
            setIsDeletingNodeAction(false);
        }
    };

    const handleAddSubordinate = (parentName: string) => {
        setDialogMode('add');
        setSelectedParentForAdd(parentName);
        setEditingNode(null);
        setIsAddNodeDialogOpen(true);
    };

    const handleReplaceNode = (node: any) => {
        setDialogMode('edit');
        setEditingNode(node);
        setSelectedParentForAdd(null);
        setIsAddNodeDialogOpen(true);
    };

    const handleMoveNode = (node: any) => {
        setDialogMode('move');
        setEditingNode(node);
        // Important: check if it has actual children (beyond the _childCount from d3)
        setHasChildrenForMove(node.children && node.children.length > 0);
        setIsAddNodeDialogOpen(true);
    };

    const [translate, setTranslate] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(0.7)
    const [showLegend, setShowLegend] = useState(false)
    const [isBulkLoading, setIsBulkLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)
    const [modifyDate, setModifyDate] = useState<string | null>(initialModifyDate || null)
    const [creatingNodes, setCreatingNodes] = useState<Set<string>>(new Set())
    const [verifyingNodes, setVerifyingNodes] = useState<Set<string>>(new Set())
    const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(initialLogo || null)
    const [isUploadingLogo, setIsUploadingLogo] = useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const logoInputRef = React.useRef<HTMLInputElement>(null)
    const captureRef = React.useRef<HTMLDivElement>(null)
    const [isExporting, setIsExporting] = useState(false)
    const [renderKey, setRenderKey] = useState(0)

    // Phase 2 Features: Focus & Search
    const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<OrgNode[]>([])
    const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null)

    const allChartNodes = React.useMemo(() => extractNodes(initialData), [initialData])

    const findSubTree = (node: OrgNode | null, targetId: string): OrgNode | null => {
        if (!node) return null
        if (node.node_id === targetId) return JSON.parse(JSON.stringify(node))
        if (node.children) {
            for (const child of node.children) {
                const found = findSubTree(child, targetId)
                if (found) return found
            }
        }
        return null
    }

    const findPathToNode = (root: OrgNode | null, targetId: string): string[] => {
        if (!root) return []
        if (root.node_id === targetId) return [root.node_id]
        if (root.children) {
            for (const child of root.children) {
                const path = findPathToNode(child, targetId)
                if (path.length > 0) return [root.node_id, ...path]
            }
        }
        return []
    }

    const activeData = React.useMemo(() => {
        const baseData = transformedData || initialData;
        if (focusedNodeId) return findSubTree(baseData, focusedNodeId) || baseData
        return baseData
    }, [transformedData, initialData, focusedNodeId])

    const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value
        setSearchQuery(q)
        if (!q || q.length < 2) {
            setSearchResults([])
            return
        }
        const lowerQ = q.toLowerCase()
        const results = allChartNodes.filter(n => 
            n.name.toLowerCase().includes(lowerQ) || 
            (n.candidate_id && n.candidate_id.toLowerCase().includes(lowerQ))
        )
        setSearchResults(results.slice(0, 8))
    }

    const executeSearchResult = (nodeId: string) => {
        setSearchQuery('')
        setSearchResults([])
        if (focusedNodeId) setFocusedNodeId(null)

        const path = findPathToNode(initialData, nodeId)
        if (path.length > 0) {
            setExpandedSet(prev => {
                const next = new Set(prev)
                path.forEach(id => next.add(id))
                return next
            })
            // Animate pan and highlight
            setTimeout(() => {
                const el = document.getElementById(`node-card-${nodeId}`)
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
                    setHighlightNodeId(nodeId)
                    setTimeout(() => setHighlightNodeId(null), 4000)
                }
            }, 300)
        }
    }

    const handleFocusTeam = (nodeId: string) => {
        setFocusedNodeId(nodeId)
        setZoom(0.8)
        centerChart()
    }

    useEffect(() => {
        if (!containerRef.current) return;
        let lastWidth = 0;
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const width = entry.contentRect.width;
                if (lastWidth === 0 && width > 0) {
                    setRenderKey(prev => prev + 1);
                }
                lastWidth = width;
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const exportImage = async (format: 'png' | 'jpeg' | 'pdf') => {
        if (!captureRef.current || !containerRef.current) return
        try {
            setIsExporting(true)
            toast.info("กำลังจัดเตรียมไฟล์ export อาจใช้เวลาสักครู่...", { duration: 5000 })

            const htmlToImage = await import('html-to-image')

            // Save current view and element state
            const origZoom = zoom;
            const origTranslate = translate;
            const element = captureRef.current;
            
            const origWidth = element.style.width;
            const origHeight = element.style.height;
            const origPosition = element.style.position;
            const origTop = element.style.top;
            const origLeft = element.style.left;
            const origZIndex = element.style.zIndex;
            const origOverflow = element.style.overflow;

            // Calculate full tree bounding box
            const svgG = containerRef.current.querySelector('.rd3t-g') as SVGGElement;
            const bbox = svgG?.getBBox();

            let dataUrl: string;

            try {
                if (bbox) {
                    // Calculate required container size to fit the entire tree
                    const reqWidth = Math.max(element.offsetWidth, (Math.abs(bbox.x) + bbox.width) * 2 + 200);
                    const reqHeight = Math.max(element.offsetHeight, (Math.abs(bbox.y) + bbox.height) + 400);

                    // Expand the element to fit the full tree — position:fixed off-screen
                    element.style.position = 'fixed';
                    element.style.top = '0px';
                    element.style.left = '0px';
                    element.style.zIndex = '-9999';
                    element.style.overflow = 'visible';
                    element.style.width = `${reqWidth}px`;
                    element.style.height = `${reqHeight}px`;

                    // Center the tree at zoom 1.0 inside the enlarged container
                    setZoom(1.0);
                    setTranslate({ x: reqWidth / 2, y: 200 });

                    // Wait for tree to re-render at the new size
                    await new Promise(r => setTimeout(r, 1000));
                }

                // Counteract devicePixelRatio to prevent foreignObject content scaling
                const dpr = window.devicePixelRatio || 1;

                const options: any = {
                    quality: 1,
                    pixelRatio: 1 / dpr,
                    skipAutoScale: true,
                    cacheBust: true,
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
                    filter: (node: HTMLElement) => {
                        if (node.id === 'export-exclude-zone') return false;
                        return true;
                    },
                };

                if (format === 'jpeg' || format === 'pdf') {
                    dataUrl = await htmlToImage.toJpeg(element, { ...options, quality: 0.95 });
                } else {
                    dataUrl = await htmlToImage.toPng(element, options);
                }
            } finally {
                // Always restore original element state
                element.style.width = origWidth;
                element.style.height = origHeight;
                element.style.position = origPosition;
                element.style.top = origTop;
                element.style.left = origLeft;
                element.style.zIndex = origZIndex;
                element.style.overflow = origOverflow;

                setZoom(origZoom);
                setTranslate(origTranslate);
                await new Promise(r => setTimeout(r, 100));
            }

            // Export file
            if (format === 'pdf') {
                const jsPDFModule = await import('jspdf')
                const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF

                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'px',
                    format: 'a4',
                    hotfixes: ['px_scaling']
                });

                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                const img = new Image();
                img.src = dataUrl;
                await new Promise((res) => { img.onload = res; });

                const imgRatio = img.width / img.height;
                const pdfRatio = pdfWidth / pdfHeight;

                const maxW = pdfWidth * 0.96;
                const maxH = pdfHeight * 0.96;
                let drawW: number, drawH: number;

                if (imgRatio > pdfRatio) {
                    drawW = maxW;
                    drawH = maxW / imgRatio;
                } else {
                    drawH = maxH;
                    drawW = maxH * imgRatio;
                }

                const x = (pdfWidth - drawW) / 2;
                const y = (pdfHeight - drawH) / 2;

                pdf.addImage(dataUrl, 'JPEG', x, y, drawW, drawH, undefined, 'FAST');
                pdf.save(`OrgChart_${companyId || 'Export'}_${Date.now()}.pdf`);
            } else {
                const link = document.createElement('a');
                link.download = `OrgChart_${companyId || 'Export'}_${Date.now()}.${format}`;
                link.href = dataUrl;
                link.click();
            }

            toast.success(`Export ${format.toUpperCase()} สำเร็จ! 🎉`)
        } catch (err) {
            console.error('Export error:', err)
            toast.error("Export ล้มเหลว กรุณาลองใหม่")
        } finally {
            setIsExporting(false)
        }
    }

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
        <TooltipProvider>
            <div ref={captureRef} className="flex flex-col h-full w-full relative rounded-xl overflow-hidden border shadow-sm group bg-white dark:bg-slate-950">
            
            {/* Focus Mode Banner */}
            {focusedNodeId && (
                <div className="absolute top-0 left-0 w-full z-10 flex justify-center mt-2 animate-in slide-in-from-top-4">
                    <div className="bg-indigo-600 text-white px-5 py-2 rounded-full shadow-lg flex items-center gap-3 text-xs font-bold border border-indigo-500">
                        <Target size={16} className="animate-pulse" />
                        FOCUS MODE ACTIVE: VIEWING SUB-TEAM
                        <button 
                            onClick={() => { setFocusedNodeId(null); centerChart() }}
                            className="ml-2 bg-indigo-800 hover:bg-rose-500 transition-colors px-2.5 py-1 rounded-full flex items-center gap-1"
                        >
                            <X size={12} />
                            EXIT
                        </button>
                    </div>
                </div>
            )}

            {/* Global Tree Search */}
            <div className="absolute top-4 right-64 z-10 w-64 max-w-sm" id="export-exclude-zone-search">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                        <Search size={14} />
                    </div>
                    <input
                        type="text"
                        className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block pl-9 p-2 shadow-sm"
                        placeholder="Search employee or ID..."
                        value={searchQuery}
                        onChange={handleSearchInput}
                    />
                    {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 rounded-xl max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 p-1">
                            {searchResults.map(res => (
                                <div 
                                    key={res.node_id} 
                                    onClick={() => executeSearchResult(res.node_id)}
                                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-3 rounded-lg border-b last:border-0 border-slate-100 dark:border-slate-800 transition-colors"
                                >
                                    <CandidateAvatar src={res.candidate_photo} name={res.name} className="h-8 w-8" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{res.name}</p>
                                        <p className="text-[10px] text-slate-500 truncate">{res.title || 'No Title'}</p>
                                    </div>
                                    {res.candidate_id && <Badge variant="outline" className="text-[8px] px-1 py-0 border-indigo-200 bg-indigo-50 text-indigo-700">{res.candidate_id}</Badge>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

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

                <div id="export-exclude-zone" className="flex gap-2 items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-1.5 rounded-full border border-slate-200/50 shadow-sm">
                    {/* Export Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-4 gap-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 shadow-sm bg-white rounded-full font-bold text-[11px]"
                                disabled={isExporting}
                            >
                                {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                EXPORT
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 z-[100] font-medium">
                            <DropdownMenuItem onClick={() => exportImage('png')} className="cursor-pointer gap-2">
                                <ImageIcon size={14} className="text-slate-400" /> Save as PNG
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportImage('jpeg')} className="cursor-pointer gap-2">
                                <ImageIcon size={14} className="text-slate-400" /> Save as JPEG
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportImage('pdf')} className="cursor-pointer gap-2">
                                <FileText size={14} className="text-slate-400" /> Save as PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Separator orientation="vertical" className="h-4 bg-slate-300 mx-0.5" />

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

                    {/* Zoom / Recenter Controls */}
                    <div className="flex items-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-0.5 shadow-sm">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
                            className="h-8 w-8 rounded-full hover:bg-slate-50"
                            title="Zoom Out"
                        >
                            <ZoomOut size={16} className="text-slate-600" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={centerChart}
                            className="h-8 w-8 rounded-full border-none hover:bg-slate-50"
                            title="Recenter Chart"
                        >
                            <Focus size={16} className="text-slate-600" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setZoom(prev => Math.min(2.0, prev + 0.1))}
                            className="h-8 w-8 rounded-full hover:bg-slate-50"
                            title="Zoom In"
                        >
                            <ZoomIn size={16} className="text-slate-600" />
                        </Button>
                    </div>

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
                <style dangerouslySetInnerHTML={{ __html: `
                    .rd3t-link.hidden-path {
                        display: none !important;
                        stroke: transparent !important;
                        stroke-width: 0 !important;
                    }
                `}} />
                <Tree
                    key={`org-tree-${renderKey}`}
                    data={activeData || initialData}
                    translate={translate}
                    zoom={zoom}
                    renderCustomNodeElement={(rd3tProps) => (
                        <NodeCard
                            {...rd3tProps}
                            onCreateProfile={handleSingleCreate}
                            onToggleVerify={openVerifyDialog}
                            onToggleExpand={handleToggleExpand}
                            isCreating={creatingNodes.has((rd3tProps.nodeDatum as any).node_id)}
                            isVerifying={verifyingNodes.has((rd3tProps.nodeDatum as any).node_id)}
                            expandedSet={expandedSet}
                            onDeleteNode={openDeleteDialog}
                            onAddSubordinate={handleAddSubordinate}
                            onReplaceNode={handleReplaceNode}
                            onMoveNode={handleMoveNode}
                            onFocusTeam={handleFocusTeam}
                            highlightNodeId={highlightNodeId}
                        />
                    )}
                    orientation="vertical"
                    pathFunc="step"
                    pathClassFunc={(linkDatum: any) => {
                        if (linkDatum?.target?.data?.isSpacer) {
                            return "hidden-path";
                        }
                        return "";
                    }}
                    separation={{ 
                        siblings: 1.0, 
                        nonSiblings: 1.1 
                    }}
                    zoomable={true}
                    draggable={true}
                    collapsible={false}
                    nodeSize={{ x: 310, y: 220 }}
                    enableLegacyTransitions={false}
                    transitionDuration={isExporting ? 0 : 400}
                    onUpdate={(target: any) => {
                        if (target.zoom !== zoom) setZoom(target.zoom)
                        if (target.translate.x !== translate.x || target.translate.y !== translate.y) {
                            setTranslate(target.translate)
                        }
                    }}
                />
            </div>

            <NodeFormDialog
                isOpen={isAddNodeDialogOpen}
                onOpenChange={setIsAddNodeDialogOpen}
                uploadId={uploadId}
                nodes={extractNodes(initialData)}
                editingNode={editingNode}
                defaultParentName={selectedParentForAdd || undefined}
                isAddMode={dialogMode === 'add'}
                isMoveMode={dialogMode === 'move'}
                hasChildren={hasChildrenForMove}
            />

            {/* Node Deletion/Clear Selection Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl rounded-2xl overflow-hidden p-0">
                    <DialogHeader className="p-6 pb-2 text-left">
                        <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold">
                           <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-500">
                               <Trash2 size={20} />
                           </div>
                           Management Removal
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 dark:text-slate-400 pt-2 text-sm leading-relaxed">
                            How would you like to handle <strong>{deleteTarget?.name}</strong> and their team?
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="p-6 pt-2 space-y-4">
                        {/* Option 1: Keep Box */}
                        <div 
                            className={cn(
                                "group relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer",
                                "border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 bg-white dark:bg-slate-800 dark:border-slate-700 dark:hover:border-emerald-900/50"
                            )}
                            onClick={!isDeletingNodeAction ? handleClearNode : undefined}
                        >
                            <div className="mt-1 p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                                <Users size={18} />
                            </div>
                            <div className="flex-1 text-left">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Clear Info & Keep Box</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                    Remove the person but keep the position as <span className="font-semibold text-slate-600 dark:text-slate-300">(Vacant)</span>. 
                                    Team structure remains exactly the same.
                                </p>
                            </div>
                        </div>

                        {/* Option 2: Remove Box */}
                        <div 
                            className={cn(
                                "group relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer",
                                "border-slate-100 hover:border-rose-200 hover:bg-rose-50/30 bg-white dark:bg-slate-800 dark:border-slate-700 dark:hover:border-rose-900/50"
                            )}
                            onClick={!isDeletingNodeAction ? handleDeleteNode : undefined}
                        >
                            <div className="mt-1 p-2 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-lg group-hover:scale-110 transition-transform">
                                <X size={18} />
                            </div>
                            <div className="flex-1 text-left">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 text-rose-600 dark:text-rose-400">Remove Entire Node</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                    Delete this position entirely. Subordinates will be automatically 
                                    <span className="font-semibold text-slate-600 dark:text-slate-300"> re-parented to the manager above</span>.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 items-center">
                        {isDeletingNodeAction ? (
                            <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse font-medium mr-auto pl-2">
                                <Loader2 size={14} className="animate-spin" />
                                Processing...
                            </div>
                        ) : null}
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setIsDeleteDialogOpen(false)}
                            className="text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg"
                        >
                            Cancel
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <VerificationDialog 
                isOpen={isVerifyDialogOpen}
                onClose={() => setIsVerifyDialogOpen(false)}
                node={nodeToVerify}
                chartCompanyName={chartCompanyName}
                onConfirmMatch={(id) => handleConfirmVerification(id, 'TRUE')}
                onFlagError={(id) => handleConfirmVerification(id, 'NOT_MATCH')}
                isProcessing={isVerifyingNode}
            />
        </div>
        </TooltipProvider>
    )
}
