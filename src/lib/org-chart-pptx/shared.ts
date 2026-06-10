import type { HierarchyNode, HierarchyPointNode } from 'd3-hierarchy'
import type PptxGenJS from 'pptxgenjs'
import type { OrgNodeV2 } from '@/app/actions/org-chart-v2-actions'

export const BOX_W = 3.0
export const BOX_H = 1.2
export const GAP_X = 0.4
export const GAP_Y = 1.0
export const PHOTO_SIZE = 0.6
export const PHOTO_MARGIN = 0.1
export const BADGE_SIZE = 0.32
export const BADGE_MARGIN = 0.06
export const ROOT_WRAPPER_ID = 'root-wrapper'

export type ColorStyle = { fill: string; line: string; dash?: 'dash' }

export function colorFor(d: OrgNodeV2): ColorStyle {
    if (d.id === ROOT_WRAPPER_ID) return { fill: 'F8FAFC', line: 'CBD5E1', dash: 'dash' }
    if (d.is_group_node) return { fill: 'EEF2FF', line: '6366F1' }
    const isMatch = !!d.candidate_id
    const isVerified = d.is_verified === 'TRUE'
    const isNotMatch = d.is_verified === 'NOT_MATCH'
    const status = d.match_status || (isMatch ? 'matched' : 'unmapped')
    if (isVerified || status === 'matched') return { fill: 'ECFDF5', line: '10B981' }
    if (isNotMatch || status === 'mismatch_company') return { fill: 'FFF1F2', line: 'F43F5E' }
    if (status === 'mismatch_position') return { fill: 'FFFBEB', line: 'FBBF24' }
    if (status === 'n8n_processing') return { fill: 'EEF2FF', line: '818CF8', dash: 'dash' }
    return { fill: 'FFFFFF', line: 'E2E8F0' }
}

// Extract a clean LinkedIn URL — the field sometimes has extra notes appended after the link
export function getLinkedinUrl(raw?: string | null): string | null {
    if (!raw) return null
    const m = raw.match(/https?:\/\/[^\s]*linkedin\.com[^\s]*/i)
    return m ? m[0] : null
}

// Fetch an image and convert it to a base64 data URI (pptxgenjs needs data/path, not a remote URL it can fetch itself)
export async function toDataUri(url: string): Promise<string | null> {
    try {
        const res = await fetch(url)
        if (!res.ok) return null
        const blob = await res.blob()
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
        })
    } catch {
        return null
    }
}

export type SubCounts = { direct: Map<string, number>; total: Map<string, number> }

export async function buildHierarchy(data: OrgNodeV2[]) {
    const { stratify } = await import('d3-hierarchy')
    return stratify<OrgNodeV2>()
        .id((d) => d.id)
        .parentId((d) => d.parentId)(data)
}

export function computeSubCounts(root: HierarchyNode<OrgNodeV2>): SubCounts {
    const direct = new Map<string, number>()
    const total = new Map<string, number>()
    root.each((n) => {
        direct.set(n.data.id, n.children?.length ?? 0)
        total.set(n.data.id, n.descendants().length - 1)
    })
    return { direct, total }
}

export type CoordTransform = {
    toX: (x: number) => number
    toY: (y: number) => number
    scale: number
}

// Scales a base font size (defined for scale=1) with the box so text fits without
// relying on PowerPoint's shrink-to-fit, which only kicks in after the user clicks the box
function scaledFont(base: number, scale: number, min = 6): number {
    return Math.max(Math.round(base * scale), min)
}

/**
 * Renders org chart nodes as PowerPoint shapes onto a slide.
 */
export async function renderNodesToSlide(
    pptx: PptxGenJS,
    slide: PptxGenJS.Slide,
    nodes: HierarchyPointNode<OrgNodeV2>[],
    { toX, toY, scale }: CoordTransform,
    subCounts: SubCounts
): Promise<void> {
    const boxW = BOX_W * scale
    const boxH = BOX_H * scale

    // Pre-fetch all candidate photos in parallel
    const photoByNode = new Map<HierarchyPointNode<OrgNodeV2>, string | null>()
    await Promise.all(nodes.map(async (n) => {
        const photoUrl = n.data.candidate_photo
        photoByNode.set(n, (!n.data.is_group_node && photoUrl) ? await toDataUri(photoUrl) : null)
    }))

    let boxCounter = 0

    nodes.forEach((n) => {
        const d = n.data
        const { fill, line, dash } = colorFor(d)
        const x = toX(n.x)
        const y = toY(n.y)
        const objectName = `OrgNode_${boxCounter++}`

        // Root wrapper — dashed placeholder card with just the company name
        if (d.id === ROOT_WRAPPER_ID) {
            slide.addText(d.name || '', {
                x, y, w: boxW, h: boxH,
                shape: pptx.ShapeType.roundRect,
                rectRadius: 0.06,
                fill: { color: fill },
                line: { color: line, width: 1.5, dashType: 'dash' },
                align: 'center',
                valign: 'middle',
                bold: true,
                fontSize: scaledFont(13, scale),
                color: '64748B',
                fontFace: 'Tahoma',
                shrinkText: true,
                objectName,
            })
            return
        }

        const isGroup = !!d.is_group_node
        const isMatch = !!d.candidate_id
        const totalSub = subCounts.total.get(d.id) || 0
        const idLabel = isGroup
            ? `GROUP${totalSub > 0 ? ` (${totalSub})` : ''}`
            : (isMatch ? (d.candidate_id || '') : 'UNMATCHED')

        const photoData = photoByNode.get(n)
        const photoSize = PHOTO_SIZE * scale
        const linkedinUrl = isGroup ? null : getLinkedinUrl(d.linkedin)

        const baseMargin = Math.max(4 * scale, 1)
        const leftMargin = (!isGroup && photoData) ? (PHOTO_MARGIN + PHOTO_SIZE + PHOTO_MARGIN) * scale * 72 : baseMargin
        const rightMargin = linkedinUrl ? (BADGE_SIZE + BADGE_MARGIN) * scale * 72 + Math.max(2 * scale, 0.5) : baseMargin

        slide.addText(
            [
                { text: d.name || '', options: { bold: true, fontSize: scaledFont(13, scale), color: isGroup ? '3730A3' : '1E293B', breakLine: true } },
                { text: d.title || '', options: { fontSize: scaledFont(10, scale), color: isGroup ? '6366F1' : '64748B', breakLine: true } },
                { text: idLabel, options: { fontSize: scaledFont(10, scale), color: '94A3B8' } },
            ],
            {
                x, y, w: boxW, h: boxH,
                shape: pptx.ShapeType.roundRect,
                rectRadius: Math.max(0.06 * scale, 0.02),
                fill: { color: fill },
                line: { color: line, width: 1.5, dashType: dash },
                // margin order is [left, right, bottom, top] in points
                margin: [leftMargin, rightMargin, baseMargin, baseMargin],
                valign: 'middle',
                align: isGroup ? 'center' : 'left',
                shrinkText: true,
                fontFace: 'Tahoma',
                objectName,
            }
        )

        // Profile photo (left, circular)
        if (photoData) {
            slide.addImage({
                data: photoData,
                x: x + PHOTO_MARGIN * scale,
                y: y + (boxH - photoSize) / 2,
                w: photoSize,
                h: photoSize,
                rounding: true,
            })
        }

        // LinkedIn badge (top-right, clickable)
        if (linkedinUrl) {
            slide.addText('in', {
                x: x + boxW - (BADGE_SIZE + BADGE_MARGIN) * scale,
                y: y + BADGE_MARGIN * scale,
                w: BADGE_SIZE * scale,
                h: BADGE_SIZE * scale,
                shape: pptx.ShapeType.roundRect,
                rectRadius: 0.04,
                fill: { color: '0A66C2' },
                line: { type: 'none' },
                fontFace: 'Tahoma',
                bold: true,
                fontSize: scaledFont(9, scale, 5),
                color: 'FFFFFF',
                align: 'center',
                valign: 'middle',
                hyperlink: { url: linkedinUrl },
            })
        }
    })
}

/**
 * Draws elbow connectors between parent/child node boxes as plain straight-line shapes
 * (pptx.ShapeType.line) — three segments per edge: across to the horizontal midpoint,
 * down to the child's row, then across to the child's top-center. Each segment is a
 * simple 2-point line (no presets/custom geometry/glue), which PowerPoint always renders
 * correctly on first open.
 *
 * Must be called before renderNodesToSlide so the lines render behind the node boxes.
 */
export function renderConnectors(
    pptx: PptxGenJS,
    slide: PptxGenJS.Slide,
    nodes: HierarchyPointNode<OrgNodeV2>[],
    { toX, toY, scale }: CoordTransform
): void {
    const boxW = BOX_W * scale
    const boxH = BOX_H * scale
    const MIN = 0.005 // inches — avoid zero-size shapes for perfectly aligned segments

    const segment = (x1: number, y1: number, x2: number, y2: number) => {
        slide.addShape(pptx.ShapeType.line, {
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            w: Math.max(Math.abs(x2 - x1), MIN),
            h: Math.max(Math.abs(y2 - y1), MIN),
            line: { color: '000000', width: 1 },
        })
    }

    nodes.forEach((n) => {
        if (!n.parent) return

        const px = toX(n.parent.x) + boxW / 2
        const py = toY(n.parent.y) + boxH
        const cx = toX(n.x) + boxW / 2
        const cy = toY(n.y)
        const midX = (px + cx) / 2

        segment(px, py, midX, py)   // parent's bottom-center → horizontal midpoint
        segment(midX, py, midX, cy) // down to the child's row
        segment(midX, cy, cx, cy)   // across to the child's top-center
    })
}
