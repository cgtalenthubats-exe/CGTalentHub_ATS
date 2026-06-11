'use client'

import { useEffect, useRef, useState, useMemo, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { OrgChart } from 'd3-org-chart'
import { Download, Loader2, Plus, UserPlus, Focus, User, Building2, Trash2, Users, X, Maximize2, Minimize2, ZoomIn, ZoomOut, Sparkles, UserCheck, UploadCloud, Target, Search, ExternalLink, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
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
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/notifications'
import { exportOrgChartPptx } from '@/lib/org-chart-pptx'
import { createSingleOrgProfile, verifyOrgNode, deleteOrgNode, clearOrgNode, toggleGroupNode, moveOrgNode, bulkCreateOrgProfiles, verifyOrgChart, deleteOrgChart, updateMasterCompanyLogo, type RawOrgNode } from '@/app/actions/org-chart-actions'
import { VerificationDialog } from '@/components/org-chart/verification-dialog'
import { CandidateProfileSheet } from '@/components/candidate-profile-sheet'
import { NodeFormDialog } from '@/components/org-chart/node-form-dialog'
import { CandidateAvatar } from '@/components/candidate-avatar'
import type { OrgNodeV2 } from '@/app/actions/org-chart-v2-actions'
import { supabase } from '@/lib/supabase/client'

const DEFAULT_AVATAR = 'https://ddeqeaicjyrevqdognbn.supabase.co/storage/v1/object/public/system/Blank%20Profile.JPG'
const FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

// Node/chart sizing — kept compact so more of the org fits on screen at once
const NODE_WIDTH = 220
const NODE_HEIGHT = 86
const COMPACT_MARGIN_PAIR = 16
const COMPACT_MARGIN_BETWEEN = 8
const NEIGHBOUR_MARGIN = 24
const SIBLINGS_MARGIN = 12
const CHILDREN_MARGIN = 44

const STATUS_STYLES: Record<string, { border: string; bg: string; dashed?: boolean }> = {
    matched: { border: '#10b981', bg: '#ecfdf5' },
    mismatch_company: { border: '#f43f5e', bg: '#fff1f2' },
    mismatch_position: { border: '#fbbf24', bg: '#fffbeb' },
    n8n_processing: { border: '#818cf8', bg: '#eef2ff', dashed: true },
    unmapped: { border: '#e2e8f0', bg: '#ffffff' },
}

// Inline SVGs (lucide path data) — nodeContent() returns raw HTML strings, so React icons can't be used directly
const ICON_LINKEDIN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.27c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.76-1.75 1.76zm13.5 12.27h-3v-5.6c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97v5.7h-3v-11h2.88v1.5h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.59v6.47z"/></svg>`
const ICON_GLOBE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`
const ICON_USER_CHECK = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>`
const ICON_USER_PLUS = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>`
const ICON_LOADER = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`
const ICON_CHEVRON_UP = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`
const ICON_CHEVRON_DOWN = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`
const ICON_MORE = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`
const ICON_ALERT_TRIANGLE = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`
const ICON_INFO = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`

// Right-angle (R=0) connector — replaces d3-org-chart's default rounded-corner
// diagonal so parent/child links render as sharp elbow connectors.
function rightAngleDiagonal(s: any, t: any, m: any, offsets: { sy?: number } = {}): string {
    const x = s.x
    const y = s.y + (offsets.sy || 0)
    const ex = t.x
    const ey = t.y
    const mx = m && m.x != null ? m.x : x
    const my = m && m.y != null ? m.y : y
    const midY = (y + ey) / 2
    return `M ${mx} ${my} L ${x} ${my} L ${x} ${y} L ${x} ${midY} L ${ex} ${midY} L ${ex} ${ey}`
}

function escapeHtml(value: string | null | undefined): string {
    if (!value) return ''
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

type V2HierarchyDatum = OrgNodeV2 & {
    _directSubordinates?: number
    _totalSubordinates?: number
}

// "⋮" action menu trigger — sits on the card border so it doesn't collide with the
// profile/LinkedIn icons inside the card. Click is handled via the data-action delegation pattern.
function renderKebabButton(nodeId: string): string {
    return `<button type="button" data-action="menu" data-node-id="${escapeHtml(nodeId)}" title="Actions" style="position:absolute;top:-8px;right:-8px;width:20px;height:20px;border-radius:9999px;background:#ffffff;border:1px solid #cbd5e1;box-shadow:0 1px 3px rgba(0,0,0,0.12);display:flex;align-items:center;justify-content:center;color:#475569;cursor:pointer;padding:0;z-index:6;">${ICON_MORE}</button>`
}

function renderNodeContent(d: { data: V2HierarchyDatum; width: number; height: number }): string {
    const data = d.data
    const { width, height } = d

    if (data.id === 'root-wrapper') {
        return `
            <div style="width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;border:2px dashed #cbd5e1;border-radius:10px;background:#f8fafc;font-family:${FONT_FAMILY};color:#64748b;font-size:12px;font-weight:700;box-sizing:border-box;">
                ${escapeHtml(data.name)}
            </div>
        `
    }

    const childCount = data._directSubordinates || 0

    if (data.is_group_node) {
        return `
            <div draggable="true" data-drag-node="${escapeHtml(data.id)}" style="width:${width}px;height:${height}px;border:2px solid #6366f1;border-radius:10px;background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);box-shadow:0 1px 3px rgba(99,102,241,0.15);display:flex;flex-direction:column;align-items:center;font-family:${FONT_FAMILY};box-sizing:border-box;padding:8px;position:relative;cursor:grab;">
                ${renderKebabButton(data.id)}
                <div style="background:#6366f1;border-radius:7px;padding:4px;margin:1px 0 4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
                    </svg>
                </div>
                <div style="font-size:11px;font-weight:700;color:#3730a3;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;line-height:1.3;">
                    ${escapeHtml(data.name)}
                </div>
                ${data.title ? `<div style="font-size:9px;color:#6366f1;font-weight:500;text-align:center;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;line-height:1.3;">${escapeHtml(data.title)}</div>` : ''}
                <div style="display:flex;justify-content:space-between;align-items:center;width:100%;margin-top:auto;padding-top:6px;flex-shrink:0;">
                    <span style="font-size:8px;font-weight:700;color:#818cf8;text-transform:uppercase;letter-spacing:0.08em;">GROUP</span>
                    ${childCount > 0 ? `<div style="background:#6366f1;border-radius:999px;min-width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:white;padding:0 4px;">${childCount}</div>` : ''}
                </div>
            </div>
        `
    }

    const status = data.match_status || 'unmapped'
    const isMatch = !!data.candidate_id
    const style = STATUS_STYLES[status] || STATUS_STYLES.unmapped
    const photo = data.candidate_photo || DEFAULT_AVATAR

    // Top-right badge: VERIFY / RE-VERIFY / VERIFIED for matched nodes, CREATE for unmatched
    let label: string
    let actionHtml: string
    if (isMatch) {
        let btnStyle: string
        if (status === 'matched') {
            label = 'VERIFIED'
            btnStyle = 'border:none;background:#d1fae5;color:#059669;'
        } else if (status === 'mismatch_company') {
            label = 'RE-VERIFY'
            btnStyle = 'border:1px solid #f43f5e;background:#fee2e2;color:#e11d48;'
        } else {
            label = 'VERIFY'
            btnStyle = 'border:1px solid #f59e0b;background:#fef3c7;color:#b45309;'
        }
        actionHtml = `<button type="button" data-action="verify" data-node-id="${escapeHtml(data.id)}" style="position:absolute;top:8px;right:8px;display:inline-flex;align-items:center;gap:2px;font-size:8px;font-weight:700;border-radius:5px;padding:1px 5px;cursor:pointer;font-family:${FONT_FAMILY};z-index:5;${btnStyle}">${ICON_USER_CHECK}${label}</button>`
    } else {
        label = 'CREATE'
        actionHtml = `<button type="button" data-action="create" data-node-id="${escapeHtml(data.id)}" style="position:absolute;top:8px;right:8px;display:inline-flex;align-items:center;gap:2px;font-size:8px;font-weight:700;border-radius:5px;padding:1px 5px;border:1px dashed #818cf8;background:transparent;color:#4f46e5;cursor:pointer;font-family:${FONT_FAMILY};z-index:5;"><span data-role="icon" style="display:inline-flex;">${ICON_USER_PLUS}</span><span data-role="spinner" style="display:none;">${ICON_LOADER}</span>${label}</button>`
    }
    const titlePaddingRight = Math.ceil(label.length * 5) + 24

    // Bottom-left: clickable candidate ID badge that opens the profile (matched only)
    const candidateIdHtml = isMatch
        ? `<button type="button" data-action="profile" data-candidate-id="${escapeHtml(data.candidate_id)}" title="View Profile" style="font-size:10px;font-weight:700;font-family:ui-monospace,monospace;color:#4338ca;background:#eef2ff;border:1px solid #c7d2fe;border-radius:5px;padding:2px 7px;cursor:pointer;line-height:1.2;flex-shrink:0;">${escapeHtml(data.candidate_id)}</button>`
        : `<span style="font-size:9px;font-family:ui-monospace,monospace;font-weight:700;color:#94a3b8;">UNMATCHED</span>`

    // Bottom-right: LinkedIn (blue) or other profile link (grey globe), based on V1's `checked` differentiation
    let linkIconHtml = ''
    if (data.linkedin) {
        const normChecked = (data.checked || '').trim().toLowerCase()
        if (normChecked === 'individual link') {
            linkIconHtml = `<a href="${escapeHtml(data.linkedin)}" target="_blank" rel="noopener noreferrer" title="Profile Link" draggable="false" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;flex-shrink:0;">${ICON_GLOBE}</a>`
        } else {
            linkIconHtml = `<a href="${escapeHtml(data.linkedin)}" target="_blank" rel="noopener noreferrer" title="LinkedIn" draggable="false" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:#0A66C2;flex-shrink:0;">${ICON_LINKEDIN}</a>`
        }
    }

    // Inline warning icon for company/position mismatches — native title attr doubles as a tooltip
    let mismatchIconHtml = ''
    if (status === 'mismatch_company') {
        mismatchIconHtml = `<span title="Company Mismatch: ${escapeHtml(data.current_experience?.company || 'Unknown')}" style="display:inline-flex;flex-shrink:0;color:#f43f5e;cursor:help;">${ICON_ALERT_TRIANGLE}</span>`
    } else if (status === 'mismatch_position') {
        mismatchIconHtml = `<span title="Position Mismatch: ${escapeHtml(data.current_experience?.position || 'Unknown')}" style="display:inline-flex;flex-shrink:0;color:#f59e0b;cursor:help;">${ICON_INFO}</span>`
    }

    return `
        <div draggable="true" data-drag-node="${escapeHtml(data.id)}" style="width:${width}px;height:${height}px;border:2px ${style.dashed ? 'dashed' : 'solid'} ${style.border};border-radius:10px;background:${style.bg};box-shadow:0 1px 3px rgba(0,0,0,0.06);font-family:${FONT_FAMILY};box-sizing:border-box;padding:10px;position:relative;cursor:grab;">
            ${renderKebabButton(data.id)}
            ${actionHtml}
            <div style="display:flex;align-items:flex-start;gap:8px;width:100%;">
                <div style="flex-shrink:0;position:relative;">
                    <div style="width:36px;height:36px;border-radius:9999px;background-image:url('${escapeHtml(photo)}');background-size:cover;background-position:center;background-color:#f1f5f9;border:1px solid #e2e8f0;"></div>
                    ${childCount > 0 ? `<div style="position:absolute;bottom:-3px;right:-3px;background:#4f46e5;color:white;border:2px solid white;border-radius:9999px;min-width:14px;height:14px;font-size:7px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 2px;">${childCount}</div>` : ''}
                </div>
                <div style="flex:1;min-width:0;padding-right:${titlePaddingRight}px;">
                    <div style="display:flex;align-items:center;gap:3px;font-weight:700;color:#1e293b;font-size:12px;line-height:1.25;">
                        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(data.name)}">${escapeHtml(data.name)}</span>
                        ${mismatchIconHtml}
                    </div>
                    <div style="font-size:10px;color:#475569;font-weight:500;text-transform:uppercase;letter-spacing:0.02em;margin-top:2px;height:22px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.1;" title="${escapeHtml(data.title || '')}">
                        ${escapeHtml(data.title || 'Position Not Set')}
                    </div>
                </div>
            </div>
            <div style="position:absolute;left:10px;right:10px;bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
                ${candidateIdHtml}
                ${linkIconHtml}
            </div>
        </div>
    `
}

function renderButtonContent({ node }: { node: any }): string {
    const count = node.data._directSubordinates || 0
    const chevron = node.children ? ICON_CHEVRON_UP : ICON_CHEVRON_DOWN
    return `<div style="display:flex;align-items:center;gap:2px;border:1.5px solid #1e293b;border-radius:999px;padding:2px 6px;font-size:9px;font-weight:700;color:#1e293b;background:#ffffff;box-shadow:0 1px 2px rgba(0,0,0,0.08);font-family:${FONT_FAMILY};">${chevron}<span>${count}</span></div>`
}

type DialogState = {
    mode: 'add' | 'edit' | 'move'
    editingNode: RawOrgNode | null
    defaultParentName?: string
    hasChildren: boolean
    isStandaloneAdd?: boolean
}

type MenuState = {
    nodeId: string
    top: number
    right: number
}

type DragMoveState = {
    nodeId: string
    nodeName: string
    hasChildren: boolean
    targetId: string
    targetName: string
}

export function OrgChartViewerV2({ data, rawNodes, uploadId, companyName = 'Organization', companyId, companyLogoUrl: initialLogo, notes, chartFileUrl, modifyDate: initialModifyDate }: { data: OrgNodeV2[]; rawNodes: RawOrgNode[]; uploadId: string; companyName?: string; companyId?: string | null; companyLogoUrl?: string | null; notes?: string | null; chartFileUrl?: string | null; modifyDate?: string | null }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<OrgChart<OrgNodeV2> | null>(null)
    const hasFitRef = useRef(false)
    const creatingNodesRef = useRef<Set<string>>(new Set())
    const logoInputRef = useRef<HTMLInputElement>(null)
    const pendingHighlightRef = useRef<string | null>(null)
    const prevFocusedNodeIdRef = useRef<string | null>(null)
    const router = useRouter()

    const [isExporting, setIsExporting] = useState(false)
    const [profileSheetCandidateId, setProfileSheetCandidateId] = useState<string | null>(null)
    const [verifyNode, setVerifyNode] = useState<(OrgNodeV2 & { node_id: string }) | null>(null)
    const [isVerifying, setIsVerifying] = useState(false)

    // Company logo (top-left widget)
    const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(initialLogo || null)
    const [isUploadingLogo, setIsUploadingLogo] = useState(false)

    // Toolbar: bulk actions, legend, chart-level verify/delete
    const [showLegend, setShowLegend] = useState(false)
    const [isBulkLoading, setIsBulkLoading] = useState(false)
    const [isVerifyingChart, setIsVerifyingChart] = useState(false)
    const [isDeletingChart, setIsDeletingChart] = useState(false)
    const [modifyDate, setModifyDate] = useState<string | null>(initialModifyDate || null)

    // Global search (jump to a node by name / candidate ID)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<OrgNodeV2[]>([])

    // "Focus on this Team" mode
    const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)

    // CRUD action menu ("⋮" kebab) state
    const [menuState, setMenuState] = useState<MenuState | null>(null)
    const [dialogState, setDialogState] = useState<DialogState | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<{ node_id: string; name: string } | null>(null)
    const [isDeletingNodeAction, setIsDeletingNodeAction] = useState(false)

    // Drag-to-move state
    const [dragMoveTarget, setDragMoveTarget] = useState<DragMoveState | null>(null)
    const [isMovingViaDrag, setIsMovingViaDrag] = useState(false)
    const draggedNodeIdRef = useRef<string | null>(null)
    const dragOverElRef = useRef<HTMLElement | null>(null)

    const rawNodeById = useMemo(() => {
        const map = new Map<string, RawOrgNode>()
        rawNodes.forEach((n) => map.set(n.node_id, n))
        return map
    }, [rawNodes])

    // parentId -> direct child ids, used to block drag-drop onto a node's own descendants (cycle prevention)
    const childrenMap = useMemo(() => {
        const map = new Map<string, string[]>()
        data.forEach((n) => {
            if (!n.parentId) return
            const list = map.get(n.parentId)
            if (list) list.push(n.id)
            else map.set(n.parentId, [n.id])
        })
        return map
    }, [data])

    // Nodes without a matched candidate profile yet — same definition as the V1 "CREATE ALL" count
    const unmatchedCount = useMemo(
        () => rawNodes.filter((n) => !n.matched_candidate_id).length,
        [rawNodes]
    )

    // "Focus on this Team" — when active, render only the focused node + its descendants as a new root
    const focusedData = useMemo(() => {
        if (!focusedNodeId || !data.some((n) => n.id === focusedNodeId)) return data

        const idsToInclude = new Set<string>()
        const stack = [focusedNodeId]
        while (stack.length) {
            const cur = stack.pop() as string
            if (idsToInclude.has(cur)) continue
            idsToInclude.add(cur)
            const kids = childrenMap.get(cur)
            if (kids) stack.push(...kids)
        }

        return data
            .filter((n) => idsToInclude.has(n.id))
            .map((n) => (n.id === focusedNodeId ? { ...n, parentId: undefined } : n))
    }, [data, focusedNodeId, childrenMap])

    const handleExportPptx = async () => {
        try {
            setIsExporting(true)
            toast.info('กำลังสร้างไฟล์ PowerPoint อาจใช้เวลาสักครู่...', { duration: 5000 })
            await exportOrgChartPptx(data, companyName, companyLogoUrl)
            toast.success('Export PowerPoint สำเร็จ! 🎉')
        } catch (err) {
            console.error('Export PPTX error:', err)
            toast.error('Export PowerPoint ล้มเหลว กรุณาลองใหม่')
        } finally {
            setIsExporting(false)
        }
    }

    const handleCreate = async (nodeId: string, btn: HTMLElement) => {
        if (creatingNodesRef.current.has(nodeId)) return
        creatingNodesRef.current.add(nodeId)

        const icon = btn.querySelector<HTMLElement>('[data-role="icon"]')
        const spinner = btn.querySelector<HTMLElement>('[data-role="spinner"]')
        if (icon) icon.style.display = 'none'
        if (spinner) spinner.style.display = 'inline-flex'
        btn.style.pointerEvents = 'none'
        btn.style.opacity = '0.7'

        try {
            const res = await createSingleOrgProfile(nodeId)
            toast.success(res.mode === 'n8n'
                ? 'Profile created! Webhook sent to n8n for experience retrieval.'
                : 'Profile and Current Job experience created successfully.')
            router.refresh()
        } catch (err) {
            console.error('[CreateSingle] Error:', err)
            toast.error('Profile creation failed.')
            if (icon) icon.style.display = 'inline-flex'
            if (spinner) spinner.style.display = 'none'
            btn.style.pointerEvents = ''
            btn.style.opacity = ''
        } finally {
            creatingNodesRef.current.delete(nodeId)
        }
    }

    const handleConfirmVerification = async (nodeId: string, status: 'TRUE' | 'NOT_MATCH') => {
        setIsVerifying(true)
        try {
            await verifyOrgNode(nodeId, status)
            toast.success(status === 'TRUE' ? 'Verified as Correct Match' : 'Flagged as Error')
            setVerifyNode(null)
            router.refresh()
        } catch {
            toast.error('Failed to update verification status')
        } finally {
            setIsVerifying(false)
        }
    }

    const handleToggleGroupNode = async (nodeId: string, isGroupNode: boolean) => {
        const result = await toggleGroupNode(nodeId, isGroupNode)
        if (result.success) {
            toast.success(isGroupNode ? 'Switched to Group Node' : 'Switched to Person Node')
            router.refresh()
        } else {
            toast.error(result.error || 'Failed to toggle node type')
        }
    }

    const handleClearNode = async () => {
        if (!deleteTarget) return
        setIsDeletingNodeAction(true)
        try {
            await clearOrgNode(deleteTarget.node_id)
            toast.success('Node info cleared to (Vacant)')
            setDeleteTarget(null)
            router.refresh()
        } catch {
            toast.error('Failed to clear node info')
        } finally {
            setIsDeletingNodeAction(false)
        }
    }

    const handleDeleteNode = async () => {
        if (!deleteTarget) return
        setIsDeletingNodeAction(true)
        try {
            await deleteOrgNode(deleteTarget.node_id)
            toast.success('Node removed and team re-parented')
            setDeleteTarget(null)
            router.refresh()
        } catch {
            toast.error('Failed to remove node')
        } finally {
            setIsDeletingNodeAction(false)
        }
    }

    const handleConfirmDragMove = async () => {
        if (!dragMoveTarget) return
        setIsMovingViaDrag(true)
        try {
            await moveOrgNode(dragMoveTarget.nodeId, dragMoveTarget.targetName, dragMoveTarget.hasChildren)
            toast.success(`Moved "${dragMoveTarget.nodeName}" under "${dragMoveTarget.targetName}"`)
            setDragMoveTarget(null)
            router.refresh()
        } catch {
            toast.error('Failed to move node')
        } finally {
            setIsMovingViaDrag(false)
        }
    }

    const handleExpandAll = () => {
        chartRef.current?.expandAll().fit()
    }

    const handleCollapseAll = () => {
        chartRef.current?.collapseAll().fit()
    }

    const handleRecenter = () => {
        chartRef.current?.fit()
    }

    const handleZoomIn = () => {
        chartRef.current?.zoomIn()
    }

    const handleZoomOut = () => {
        chartRef.current?.zoomOut()
    }

    const handleSearchInput = (e: ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value
        setSearchQuery(q)
        if (!q || q.length < 2) {
            setSearchResults([])
            return
        }
        const lowerQ = q.toLowerCase()
        const results = data.filter((n) =>
            n.id !== 'root-wrapper' &&
            (n.name.toLowerCase().includes(lowerQ) ||
                (n.candidate_id && n.candidate_id.toLowerCase().includes(lowerQ)))
        )
        setSearchResults(results.slice(0, 8))
    }

    const executeSearchResult = (nodeId: string) => {
        setSearchQuery('')
        setSearchResults([])

        if (focusedNodeId && !focusedData.some((n) => n.id === nodeId)) {
            // Target node is outside the focused subtree — exit focus mode first,
            // then highlight once the full chart re-renders (see chart effect below)
            setFocusedNodeId(null)
            pendingHighlightRef.current = nodeId
            return
        }

        chartRef.current?.setHighlighted(nodeId).render()
        setTimeout(() => chartRef.current?.clearHighlighting(), 4000)
    }

    const handleFocusTeam = (nodeId: string) => {
        setFocusedNodeId(nodeId)
    }

    const handleExitFocus = () => {
        setFocusedNodeId(null)
    }

    const handleBulkCreate = async () => {
        try {
            setIsBulkLoading(true)
            const res = await bulkCreateOrgProfiles(uploadId)
            toast.success(`Successfully created ${res.count} profiles! ${(res.webhookCount ?? 0) > 0 ? `${res.webhookCount} webhooks sent to n8n.` : ''}`)
            router.refresh()
        } catch {
            toast.error('Bulk creation failed. Check logs.')
        } finally {
            setIsBulkLoading(false)
        }
    }

    const handleVerifyChart = async () => {
        try {
            setIsVerifyingChart(true)
            const res = await verifyOrgChart(uploadId)
            if (res.success) {
                setModifyDate(new Date().toISOString())
                toast.success('Org Chart verified and timestamp updated 🛡️')
            } else {
                toast.error('Failed to verify chart')
            }
        } catch {
            toast.error('An error occurred during verification')
        } finally {
            setIsVerifyingChart(false)
        }
    }

    const handleDeleteChart = async () => {
        try {
            setIsDeletingChart(true)
            const res = await deleteOrgChart(uploadId)
            if (res.success) {
                toast.success('Org Chart deleted successfully')
                router.push('/org-chart')
            } else {
                toast.error(res.error || 'Failed to delete chart')
            }
        } catch {
            toast.error('An error occurred during deletion')
        } finally {
            setIsDeletingChart(false)
        }
    }

    const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !companyId) return

        setIsUploadingLogo(true)
        try {
            const fileExt = file.name.split('.').pop() || 'png'
            const fileName = `logo_${companyId}_${Date.now()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('org_charts')
                .upload(fileName, file, { upsert: true })

            if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

            const { data: urlData } = supabase.storage
                .from('org_charts')
                .getPublicUrl(fileName)

            const publicUrl = urlData.publicUrl

            await updateMasterCompanyLogo(companyId, publicUrl)

            setCompanyLogoUrl(publicUrl)
            toast.success('Company logo updated successfully')
        } catch (err: any) {
            toast.error('Failed to upload logo: ' + err.message)
        } finally {
            setIsUploadingLogo(false)
        }
    }

    // Sync local logo state if the server-fetched prop changes (e.g. after router.refresh())
    useEffect(() => {
        setCompanyLogoUrl(initialLogo || null)
    }, [initialLogo])

    // Realtime: refresh whenever another user edits this company's org nodes
    useEffect(() => {
        if (!companyId) return
        const channel = supabase
            .channel('org-chart-v2-updates-' + companyId)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'all_org_nodes', filter: `company_id=eq.${companyId}` },
                () => { router.refresh() }
            )
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [companyId, router])

    // Creates the chart on first run, then re-renders in place on subsequent data
    // changes (e.g. after router.refresh()) so zoom/pan/expand state is preserved.
    useEffect(() => {
        const container = containerRef.current
        if (!container || focusedData.length === 0) return

        if (!chartRef.current) {
            const height = Math.max(window.innerHeight - 220, 500)

            chartRef.current = new OrgChart<OrgNodeV2>()
                .container(container)
                .nodeId((d) => d.id)
                .parentNodeId((d) => d.parentId)
                .nodeWidth(() => NODE_WIDTH)
                .nodeHeight(() => NODE_HEIGHT)
                .compact(true)
                .compactMarginPair(() => COMPACT_MARGIN_PAIR)
                .compactMarginBetween(() => COMPACT_MARGIN_BETWEEN)
                .neighbourMargin(() => NEIGHBOUR_MARGIN)
                .siblingsMargin(() => SIBLINGS_MARGIN)
                .childrenMargin(() => CHILDREN_MARGIN)
                .initialExpandLevel(2)
                .svgHeight(height)
                .nodeContent(renderNodeContent as (d: any) => string)
                .nodeButtonWidth(() => 28)
                .nodeButtonHeight(() => 18)
                .nodeButtonX(() => -14)
                .nodeButtonY(() => -9)
                .buttonContent(renderButtonContent)
                .diagonal(rightAngleDiagonal)
                .linkUpdate(function (this: SVGPathElement) {
                    this.setAttribute('stroke', '#000000')
                    this.setAttribute('stroke-width', '1.5')
                    this.setAttribute('stroke-opacity', '1')
                })
        }

        // Preserve the user's current expand/collapse state across data refreshes.
        // d3-org-chart collapses every node back to its default state whenever
        // .data() is called with fresh objects (the new objects carry no _expanded
        // flags), so we copy that flag forward for every node that's currently visible.
        const prevState = chartRef.current.getChartState()
        const visibleIds = new Set<string>((prevState.allNodes || []).map((n: any) => n.data.id))
        const dataToRender = visibleIds.size > 0
            ? focusedData.map((d) => visibleIds.has(d.id) ? { ...d, _expanded: true } : d)
            : focusedData

        chartRef.current.data(dataToRender).render()

        // Let native HTML5 drag-and-drop on cards take precedence over d3-zoom's
        // pan gesture — without this, d3-zoom's mousedown.preventDefault() blocks
        // dragstart from ever firing on [data-drag-node] elements.
        const zoomBehavior = chartRef.current.getChartState().zoomBehavior
        if (zoomBehavior) {
            zoomBehavior.filter((event: MouseEvent & { type: string }) => {
                if (event.type !== 'wheel' && (event.target as HTMLElement)?.closest?.('[data-drag-node]')) {
                    return false
                }
                return (!event.ctrlKey || event.type === 'wheel') && !event.button
            })
        }

        // Re-fit on first render and whenever "Focus on this Team" is entered/exited
        const focusChanged = prevFocusedNodeIdRef.current !== focusedNodeId
        prevFocusedNodeIdRef.current = focusedNodeId
        if (!hasFitRef.current || focusChanged) {
            chartRef.current.fit()
            hasFitRef.current = true
        }

        // Apply a search highlight that was deferred while exiting focus mode
        if (pendingHighlightRef.current) {
            const pendingId = pendingHighlightRef.current
            pendingHighlightRef.current = null
            chartRef.current.setHighlighted(pendingId).render()
            setTimeout(() => chartRef.current?.clearHighlighting(), 4000)
        }

        const handleClick = (e: MouseEvent) => {
            const actionEl = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null
            if (!actionEl) return

            const action = actionEl.dataset.action
            const nodeId = actionEl.dataset.nodeId

            if (action === 'profile') {
                const candidateId = actionEl.dataset.candidateId
                if (candidateId) setProfileSheetCandidateId(candidateId)
            } else if (action === 'verify') {
                const node = data.find((n) => n.id === nodeId)
                if (node) setVerifyNode({ ...node, node_id: node.id })
            } else if (action === 'create') {
                if (nodeId) handleCreate(nodeId, actionEl)
            } else if (action === 'menu') {
                e.stopPropagation()
                if (!nodeId) return
                const rect = actionEl.getBoundingClientRect()
                setMenuState((prev) => (prev?.nodeId === nodeId ? null : {
                    nodeId,
                    top: rect.bottom + 4,
                    right: window.innerWidth - rect.right,
                }))
            }
        }

        container.addEventListener('click', handleClick)

        // --- Drag-to-move ---
        const isDescendantOrSelf = (ancestorId: string, nodeId: string): boolean => {
            if (ancestorId === nodeId) return true
            const stack = [...(childrenMap.get(ancestorId) || [])]
            while (stack.length) {
                const cur = stack.pop() as string
                if (cur === nodeId) return true
                const kids = childrenMap.get(cur)
                if (kids) stack.push(...kids)
            }
            return false
        }

        const clearDragHighlight = () => {
            if (dragOverElRef.current) {
                dragOverElRef.current.style.outline = ''
                dragOverElRef.current.style.outlineOffset = ''
                dragOverElRef.current = null
            }
        }

        const resetDraggedOpacity = () => {
            const draggedId = draggedNodeIdRef.current
            if (!draggedId) return
            const sourceEl = container.querySelector<HTMLElement>(`[data-drag-node="${CSS.escape(draggedId)}"]`)
            if (sourceEl) sourceEl.style.opacity = ''
        }

        const handleDragStart = (e: DragEvent) => {
            const target = (e.target as HTMLElement).closest('[data-drag-node]') as HTMLElement | null
            if (!target) return
            const nodeId = target.dataset.dragNode || ''
            draggedNodeIdRef.current = nodeId
            e.dataTransfer?.setData('text/plain', nodeId)
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
            target.style.opacity = '0.4'
        }

        const handleDragOver = (e: DragEvent) => {
            const draggedId = draggedNodeIdRef.current
            if (!draggedId) return
            const target = (e.target as HTMLElement).closest('[data-drag-node]') as HTMLElement | null
            const targetId = target?.dataset.dragNode
            if (!target || !targetId || targetId === draggedId || isDescendantOrSelf(draggedId, targetId)) {
                clearDragHighlight()
                return
            }
            e.preventDefault()
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
            if (dragOverElRef.current !== target) {
                clearDragHighlight()
                target.style.outline = '3px solid #4f46e5'
                target.style.outlineOffset = '2px'
                dragOverElRef.current = target
            }
        }

        const handleDrop = (e: DragEvent) => {
            e.preventDefault()
            clearDragHighlight()
            const draggedId = draggedNodeIdRef.current
            resetDraggedOpacity()
            draggedNodeIdRef.current = null
            if (!draggedId) return

            const target = (e.target as HTMLElement).closest('[data-drag-node]') as HTMLElement | null
            const targetId = target?.dataset.dragNode
            if (!targetId || targetId === draggedId || isDescendantOrSelf(draggedId, targetId)) return

            const draggedNode = data.find((n) => n.id === draggedId) as V2HierarchyDatum | undefined
            const targetNode = data.find((n) => n.id === targetId)
            if (!draggedNode || !targetNode || draggedNode.parentId === targetId) return

            setDragMoveTarget({
                nodeId: draggedId,
                nodeName: draggedNode.name,
                hasChildren: (draggedNode._directSubordinates || 0) > 0,
                targetId,
                targetName: targetNode.name,
            })
        }

        const handleDragEnd = () => {
            clearDragHighlight()
            resetDraggedOpacity()
            draggedNodeIdRef.current = null
        }

        container.addEventListener('dragstart', handleDragStart)
        container.addEventListener('dragover', handleDragOver)
        container.addEventListener('drop', handleDrop)
        container.addEventListener('dragend', handleDragEnd)

        return () => {
            container.removeEventListener('click', handleClick)
            container.removeEventListener('dragstart', handleDragStart)
            container.removeEventListener('dragover', handleDragOver)
            container.removeEventListener('drop', handleDrop)
            container.removeEventListener('dragend', handleDragEnd)
        }
    }, [data, focusedData, childrenMap])

    // Close the action menu / drag-move confirm whenever the chart re-renders (e.g. after a mutation)
    useEffect(() => {
        setMenuState(null)
        setDragMoveTarget(null)
    }, [data])

    // Unmount cleanup only
    useEffect(() => {
        return () => {
            if (containerRef.current) containerRef.current.innerHTML = ''
            chartRef.current = null
            hasFitRef.current = false
        }
    }, [])

    if (data.length === 0) {
        return (
            <div className="h-[600px] flex items-center justify-center text-slate-400">
                No org chart data found.
            </div>
        )
    }

    return (
        <div className="relative w-full">
            <div ref={containerRef} className="w-full" style={{ minHeight: '600px' }} />

            {/* Focus Mode Banner */}
            {focusedNodeId && (
                <div className="absolute top-0 left-0 w-full z-10 flex justify-center mt-2 animate-in slide-in-from-top-4">
                    <div className="bg-indigo-600 text-white px-5 py-2 rounded-full shadow-lg flex items-center gap-3 text-xs font-bold border border-indigo-500">
                        <Target size={16} className="animate-pulse" />
                        FOCUS MODE ACTIVE: VIEWING SUB-TEAM
                        <button
                            type="button"
                            onClick={handleExitFocus}
                            className="ml-2 bg-indigo-800 hover:bg-rose-500 transition-colors px-2.5 py-1 rounded-full flex items-center gap-1"
                        >
                            <X size={12} />
                            EXIT
                        </button>
                    </div>
                </div>
            )}

            {/* Global Employee Search */}
            <div className="absolute top-4 right-64 z-10 w-64 max-w-sm">
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
                            {searchResults.map((res) => (
                                <div
                                    key={res.id}
                                    onClick={() => executeSearchResult(res.id)}
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

            {/* Chart Notes */}
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

            {/* Last Verified (Top Center) */}
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

            {/* Company Logo Top Left */}
            {companyId && (
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
                    <span className="text-xs font-black text-slate-700 bg-white/90 border border-slate-200 rounded-full px-3 py-1 shadow-sm w-fit">
                        {companyName}
                    </span>
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

            {/* Action Toolbar (Bottom Right) */}
            <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-3">
                {/* Legend Panel (Collapsible) */}
                {showLegend && (
                    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-4 rounded-xl shadow-2xl border border-indigo-100 dark:border-indigo-900/30 text-[10px] text-slate-500 space-y-3 w-64 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest text-[9px] border-b pb-2">
                            Legend &amp; Help
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
                                <Focus size={12} className="text-indigo-400" /> Drag Background to Pan
                            </div>
                            <div className="flex items-center gap-2 italic">
                                <Plus size={12} className="text-indigo-400" /> Click Card to Expand / Collapse Team
                            </div>
                            <div className="flex items-center gap-2 italic">
                                <Users size={12} className="text-indigo-400" /> Drag a Card onto Another to Move It
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap justify-end gap-2 items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-1.5 rounded-full border border-slate-200/50 shadow-sm max-w-[92vw]">
                    {/* Export PPTX */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-4 gap-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 shadow-sm bg-white rounded-full font-bold text-[11px]"
                        disabled={isExporting}
                        onClick={handleExportPptx}
                    >
                        {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        EXPORT PPTX
                    </Button>

                    {/* Add Standalone Node */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-4 gap-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 shadow-sm bg-white rounded-full font-bold text-[11px]"
                        onClick={() => setDialogState({ mode: 'add', editingNode: null, hasChildren: false, isStandaloneAdd: true })}
                    >
                        <Plus size={14} />
                        ADD NODE
                    </Button>

                    <Separator orientation="vertical" className="h-4 bg-slate-300 mx-0.5" />

                    {/* Expand / Collapse All */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 gap-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-full text-xs text-slate-600 hover:bg-slate-50"
                        onClick={handleExpandAll}
                        title="Expand All"
                    >
                        <Maximize2 size={14} />
                        EXPAND ALL
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 gap-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-full text-xs text-slate-600 hover:bg-slate-50"
                        onClick={handleCollapseAll}
                        title="Collapse All"
                    >
                        <Minimize2 size={14} />
                        COLLAPSE ALL
                    </Button>

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
                            onClick={handleZoomOut}
                            className="h-8 w-8 rounded-full hover:bg-slate-50"
                            title="Zoom Out"
                        >
                            <ZoomOut size={16} className="text-slate-600" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleRecenter}
                            className="h-8 w-8 rounded-full border-none hover:bg-slate-50"
                            title="Recenter Chart"
                        >
                            <Focus size={16} className="text-slate-600" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleZoomIn}
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

                    {/* Verify Chart */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-4 gap-2 bg-indigo-600 border-none text-white hover:bg-indigo-700 shadow-md rounded-full text-[11px] font-bold"
                        onClick={handleVerifyChart}
                        disabled={isVerifyingChart}
                    >
                        {isVerifyingChart ? (
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
                                disabled={isDeletingChart}
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
                                    <br /><br />
                                    <strong className="text-rose-600">Note:</strong> Candidate profiles themselves will NOT be deleted, only their association with this specific chart.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeletingChart}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteChart} disabled={isDeletingChart} className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg">
                                    {isDeletingChart && <Loader2 size={14} className="mr-2 animate-spin inline" />}
                                    Yes, Delete Chart
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            <VerificationDialog
                isOpen={!!verifyNode}
                onClose={() => setVerifyNode(null)}
                node={verifyNode}
                chartCompanyName={companyName}
                onConfirmMatch={(id) => handleConfirmVerification(id, 'TRUE')}
                onFlagError={(id) => handleConfirmVerification(id, 'NOT_MATCH')}
                isProcessing={isVerifying}
            />
            <CandidateProfileSheet
                candidateId={profileSheetCandidateId}
                open={!!profileSheetCandidateId}
                onOpenChange={(open) => !open && setProfileSheetCandidateId(null)}
            />

            {menuState && (() => {
                const node = rawNodeById.get(menuState.nodeId)
                if (!node) return null
                const v2Node = data.find((n) => n.id === menuState.nodeId) as V2HierarchyDatum | undefined
                const isMatch = !!node.matched_candidate_id
                const hasChildren = (v2Node?._directSubordinates || 0) > 0

                return (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuState(null)} />
                        <div
                            className="fixed z-50 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 text-xs overflow-hidden"
                            style={{ top: menuState.top, right: menuState.right }}
                        >
                            <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                onClick={() => { setMenuState(null); setDialogState({ mode: 'add', editingNode: null, defaultParentName: node.name, hasChildren: false }) }}
                            >
                                <Plus size={14} /> Add Subordinate
                            </button>
                            <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                onClick={() => { setMenuState(null); setDialogState({ mode: 'edit', editingNode: node, hasChildren: false }) }}
                            >
                                <UserPlus size={14} /> {node.is_group_node ? 'Edit Label' : 'Replace / Edit'}
                            </button>
                            <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                onClick={() => { setMenuState(null); setDialogState({ mode: 'move', editingNode: node, hasChildren }) }}
                            >
                                <Focus size={14} /> Move Node
                            </button>
                            <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600"
                                onClick={() => { setMenuState(null); handleFocusTeam(node.node_id) }}
                            >
                                <Target size={14} /> Focus on this Team
                            </button>
                            {node.is_group_node ? (
                                <button
                                    type="button"
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                    onClick={() => { setMenuState(null); handleToggleGroupNode(node.node_id, false) }}
                                >
                                    <User size={14} /> Switch to Person Node
                                </button>
                            ) : !isMatch && (
                                <button
                                    type="button"
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                    onClick={() => { setMenuState(null); handleToggleGroupNode(node.node_id, true) }}
                                >
                                    <Building2 size={14} /> Switch to Group Node
                                </button>
                            )}
                            <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 border-t border-slate-100 dark:border-slate-800"
                                onClick={() => { setMenuState(null); setDeleteTarget({ node_id: node.node_id, name: node.name }) }}
                            >
                                <Trash2 size={14} /> Remove Node
                            </button>
                        </div>
                    </>
                )
            })()}

            <NodeFormDialog
                isOpen={!!dialogState}
                onOpenChange={(open) => !open && setDialogState(null)}
                uploadId={uploadId}
                nodes={rawNodes}
                editingNode={dialogState?.editingNode ?? null}
                defaultParentName={dialogState?.defaultParentName}
                isAddMode={dialogState?.mode === 'add'}
                isMoveMode={dialogState?.mode === 'move'}
                isStandaloneAddMode={dialogState?.isStandaloneAdd}
                hasChildren={dialogState?.hasChildren ?? false}
            />

            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-500">
                                <Trash2 size={18} />
                            </div>
                            Manage Removal
                        </DialogTitle>
                        <DialogDescription>
                            How would you like to handle <strong>{deleteTarget?.name}</strong> and their team?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <button
                            type="button"
                            disabled={isDeletingNodeAction}
                            onClick={handleClearNode}
                            className="w-full flex items-start gap-3 p-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-200 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-left transition-colors disabled:opacity-50"
                        >
                            <div className="mt-0.5 p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                <Users size={16} />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Clear Info & Keep Box</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                    Remove the person but keep the position as <span className="font-semibold text-slate-600 dark:text-slate-300">(Vacant)</span>. Team structure stays the same.
                                </p>
                            </div>
                        </button>
                        <button
                            type="button"
                            disabled={isDeletingNodeAction}
                            onClick={handleDeleteNode}
                            className="w-full flex items-start gap-3 p-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 hover:border-rose-200 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 text-left transition-colors disabled:opacity-50"
                        >
                            <div className="mt-0.5 p-2 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-lg">
                                <X size={16} />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400">Remove Entire Node</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                    Delete this position entirely. Subordinates are <span className="font-semibold text-slate-600 dark:text-slate-300">re-parented to the manager above</span>.
                                </p>
                            </div>
                        </button>
                    </div>
                    <DialogFooter>
                        {isDeletingNodeAction ? (
                            <Button disabled className="gap-2">
                                <Loader2 size={14} className="animate-spin" /> Processing...
                            </Button>
                        ) : (
                            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!dragMoveTarget} onOpenChange={(open) => !open && !isMovingViaDrag && setDragMoveTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-500">
                                <Focus size={18} />
                            </div>
                            Move Node
                        </DialogTitle>
                        <DialogDescription>
                            Move <strong>{dragMoveTarget?.nodeName}</strong> to report under <strong>{dragMoveTarget?.targetName}</strong>?
                            {dragMoveTarget?.hasChildren && (
                                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                                    Their direct reports will stay in place under a new <span className="font-semibold">(Vacant)</span> position.
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDragMoveTarget(null)} disabled={isMovingViaDrag}>Cancel</Button>
                        <Button onClick={handleConfirmDragMove} disabled={isMovingViaDrag} className="gap-2">
                            {isMovingViaDrag && <Loader2 size={14} className="animate-spin" />}
                            Move
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
