'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { OrgChart } from 'd3-org-chart'
import { Download, Loader2, Plus, UserPlus, Focus, User, Building2, Trash2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/lib/notifications'
import { exportOrgChartPptx } from '@/lib/org-chart-pptx'
import { createSingleOrgProfile, verifyOrgNode, deleteOrgNode, clearOrgNode, toggleGroupNode, moveOrgNode, type RawOrgNode } from '@/app/actions/org-chart-actions'
import { VerificationDialog } from '@/components/org-chart/verification-dialog'
import { CandidateProfileSheet } from '@/components/candidate-profile-sheet'
import { NodeFormDialog } from '@/components/org-chart/node-form-dialog'
import type { OrgNodeV2 } from '@/app/actions/org-chart-v2-actions'

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
const ICON_EXTERNAL_LINK = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`
const ICON_LINKEDIN = `<svg width="9" height="9" viewBox="0 0 24 24" fill="white"><path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.27c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.76-1.75 1.76zm13.5 12.27h-3v-5.6c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97v5.7h-3v-11h2.88v1.5h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.59v6.47z"/></svg>`
const ICON_USER_CHECK = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>`
const ICON_USER_PLUS = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>`
const ICON_LOADER = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`
const ICON_CHEVRON_UP = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`
const ICON_CHEVRON_DOWN = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`
const ICON_MORE = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`

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

    // Top-right icons: open candidate profile (matched only) + LinkedIn link
    const topIcons: string[] = []
    if (isMatch) {
        topIcons.push(`<button type="button" data-action="profile" data-candidate-id="${escapeHtml(data.candidate_id)}" title="View Profile" style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:4px;background:#f1f5f9;color:#64748b;padding:0;line-height:0;border:none;cursor:pointer;">${ICON_EXTERNAL_LINK}</button>`)
    }
    if (data.linkedin) {
        topIcons.push(`<a href="${escapeHtml(data.linkedin)}" target="_blank" rel="noopener noreferrer" title="LinkedIn" draggable="false" style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:4px;background:#0A66C2;line-height:0;">${ICON_LINKEDIN}</a>`)
    }
    const topIconsHtml = topIcons.length > 0
        ? `<div style="position:absolute;top:6px;right:6px;display:flex;gap:3px;align-items:center;">${topIcons.join('')}</div>`
        : ''
    const titlePaddingRight = topIcons.length === 2 ? 36 : topIcons.length === 1 ? 18 : 0

    // Bottom-right action: VERIFY / RE-VERIFY / VERIFIED for matched nodes, +CREATE for unmatched
    let actionHtml: string
    if (isMatch) {
        let label: string
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
        actionHtml = `<button type="button" data-action="verify" data-node-id="${escapeHtml(data.id)}" style="display:inline-flex;align-items:center;gap:2px;font-size:8px;font-weight:700;border-radius:5px;padding:1px 5px;cursor:pointer;font-family:${FONT_FAMILY};${btnStyle}">${ICON_USER_CHECK}${label}</button>`
    } else {
        actionHtml = `<button type="button" data-action="create" data-node-id="${escapeHtml(data.id)}" style="display:inline-flex;align-items:center;gap:2px;font-size:8px;font-weight:700;border-radius:5px;padding:1px 5px;border:1px dashed #818cf8;background:transparent;color:#4f46e5;cursor:pointer;font-family:${FONT_FAMILY};"><span data-role="icon" style="display:inline-flex;">${ICON_USER_PLUS}</span><span data-role="spinner" style="display:none;">${ICON_LOADER}</span>CREATE</button>`
    }

    return `
        <div draggable="true" data-drag-node="${escapeHtml(data.id)}" style="width:${width}px;height:${height}px;border:2px ${style.dashed ? 'dashed' : 'solid'} ${style.border};border-radius:10px;background:${style.bg};box-shadow:0 1px 3px rgba(0,0,0,0.06);font-family:${FONT_FAMILY};box-sizing:border-box;padding:8px;display:flex;flex-direction:column;position:relative;cursor:grab;">
            ${renderKebabButton(data.id)}
            <div style="display:flex;align-items:flex-start;gap:8px;width:100%;">
                <div style="flex-shrink:0;position:relative;">
                    <div style="width:36px;height:36px;border-radius:9999px;background-image:url('${escapeHtml(photo)}');background-size:cover;background-position:center;background-color:#f1f5f9;border:1px solid #e2e8f0;"></div>
                    ${childCount > 0 ? `<div style="position:absolute;bottom:-3px;right:-3px;background:#4f46e5;color:white;border:2px solid white;border-radius:9999px;min-width:14px;height:14px;font-size:7px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 2px;">${childCount}</div>` : ''}
                </div>
                <div style="flex:1;min-width:0;${titlePaddingRight ? `padding-right:${titlePaddingRight}px;` : ''}">
                    <div style="font-weight:700;color:#1e293b;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;" title="${escapeHtml(data.name)}">
                        ${escapeHtml(data.name)}
                    </div>
                    <div style="font-size:9px;color:#64748b;font-weight:500;text-transform:uppercase;letter-spacing:0.02em;margin-top:2px;height:23px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.28;" title="${escapeHtml(data.title || '')}">
                        ${escapeHtml(data.title || 'Position Not Set')}
                    </div>
                </div>
            </div>
            ${topIconsHtml}
            <div style="display:flex;justify-content:space-between;align-items:center;width:100%;margin-top:auto;padding-top:6px;">
                <span style="font-size:8px;font-family:ui-monospace,monospace;font-weight:700;color:#94a3b8;">
                    ${isMatch ? escapeHtml(data.candidate_id) : 'UNMATCHED'}
                </span>
                ${actionHtml}
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

export function OrgChartViewerV2({ data, rawNodes, uploadId, companyName = 'Organization' }: { data: OrgNodeV2[]; rawNodes: RawOrgNode[]; uploadId: string; companyName?: string }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<OrgChart<OrgNodeV2> | null>(null)
    const hasFitRef = useRef(false)
    const creatingNodesRef = useRef<Set<string>>(new Set())
    const router = useRouter()

    const [isExporting, setIsExporting] = useState(false)
    const [profileSheetCandidateId, setProfileSheetCandidateId] = useState<string | null>(null)
    const [verifyNode, setVerifyNode] = useState<(OrgNodeV2 & { node_id: string }) | null>(null)
    const [isVerifying, setIsVerifying] = useState(false)

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

    const handleExportPptx = async () => {
        try {
            setIsExporting(true)
            toast.info('กำลังสร้างไฟล์ PowerPoint อาจใช้เวลาสักครู่...', { duration: 5000 })
            await exportOrgChartPptx(data, companyName)
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

    // Creates the chart on first run, then re-renders in place on subsequent data
    // changes (e.g. after router.refresh()) so zoom/pan/expand state is preserved.
    useEffect(() => {
        const container = containerRef.current
        if (!container || data.length === 0) return

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
                .linkUpdate(function (this: SVGPathElement) {
                    this.setAttribute('stroke', '#000000')
                    this.setAttribute('stroke-width', '1.5')
                    this.setAttribute('stroke-opacity', '1')
                })
        }

        chartRef.current.data(data).render()

        if (!hasFitRef.current) {
            chartRef.current.fit()
            hasFitRef.current = true
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
    }, [data, childrenMap])

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
            <div className="absolute top-3 right-3 z-10">
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
            </div>
            <div ref={containerRef} className="w-full" style={{ minHeight: '600px' }} />

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
