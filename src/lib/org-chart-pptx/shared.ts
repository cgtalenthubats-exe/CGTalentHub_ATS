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

/**
 * Renders org chart nodes as PowerPoint shapes onto a slide.
 * Returns a map from node -> generated shape objectName, used to wire up connectors afterwards.
 */
export async function renderNodesToSlide(
    pptx: PptxGenJS,
    slide: PptxGenJS.Slide,
    nodes: HierarchyPointNode<OrgNodeV2>[],
    { toX, toY, scale }: CoordTransform,
    subCounts: SubCounts
): Promise<Map<HierarchyPointNode<OrgNodeV2>, string>> {
    const boxW = BOX_W * scale
    const boxH = BOX_H * scale

    // Pre-fetch all candidate photos in parallel
    const photoByNode = new Map<HierarchyPointNode<OrgNodeV2>, string | null>()
    await Promise.all(nodes.map(async (n) => {
        const photoUrl = n.data.candidate_photo
        photoByNode.set(n, (!n.data.is_group_node && photoUrl) ? await toDataUri(photoUrl) : null)
    }))

    const objectNameByNode = new Map<HierarchyPointNode<OrgNodeV2>, string>()
    let boxCounter = 0

    nodes.forEach((n) => {
        const d = n.data
        const { fill, line, dash } = colorFor(d)
        const x = toX(n.x)
        const y = toY(n.y)
        const objectName = `OrgNode_${boxCounter++}`
        objectNameByNode.set(n, objectName)

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
                fontSize: 13,
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

        const leftMargin = (!isGroup && photoData) ? (PHOTO_MARGIN + PHOTO_SIZE + PHOTO_MARGIN) * scale * 72 : 4
        const rightMargin = linkedinUrl ? (BADGE_SIZE + BADGE_MARGIN) * scale * 72 + 2 : 4

        slide.addText(
            [
                { text: d.name || '', options: { bold: true, fontSize: 13, color: isGroup ? '3730A3' : '1E293B', breakLine: true } },
                { text: d.title || '', options: { fontSize: 10, color: isGroup ? '6366F1' : '64748B', breakLine: true } },
                { text: idLabel, options: { fontSize: 10, color: '94A3B8' } },
            ],
            {
                x, y, w: boxW, h: boxH,
                shape: pptx.ShapeType.roundRect,
                rectRadius: 0.06,
                fill: { color: fill },
                line: { color: line, width: 1.5, dashType: dash },
                // margin order is [left, right, bottom, top] in points
                margin: [leftMargin, rightMargin, 4, 4],
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
                fontSize: 9,
                color: 'FFFFFF',
                align: 'center',
                valign: 'middle',
                hyperlink: { url: linkedinUrl },
            })
        }
    })

    return objectNameByNode
}

/**
 * Injects real glued elbow connector shapes (<p:cxnSp>, bentConnector3) between parent/child
 * node shapes into a slide's raw XML — pptxgenjs cannot create glued connectors directly.
 */
export function injectConnectors(
    slideXml: string,
    nodes: HierarchyPointNode<OrgNodeV2>[],
    objectNameByNode: Map<HierarchyPointNode<OrgNodeV2>, string>,
    { toX, toY, scale }: CoordTransform
): string {
    const boxW = BOX_W * scale
    const boxH = BOX_H * scale

    // Map our objectName -> the shape id PowerPoint assigned it
    const idByName = new Map<string, string>()
    let maxId = 1
    for (const m of slideXml.matchAll(/<p:cNvPr id="(\d+)" name="([^"]*)"/g)) {
        idByName.set(m[2], m[1])
        maxId = Math.max(maxId, parseInt(m[1], 10))
    }

    const EMU = 914400
    let connectorXml = ''
    let cxnId = maxId + 1

    nodes.forEach((n) => {
        if (!n.parent) return

        const parentId = idByName.get(objectNameByNode.get(n.parent) || '')
        const childId = idByName.get(objectNameByNode.get(n) || '')
        if (!parentId || !childId) return

        const px = toX(n.parent.x) + boxW / 2
        const py = toY(n.parent.y) + boxH
        const cx = toX(n.x) + boxW / 2
        const cy = toY(n.y)

        const offX = Math.round(Math.min(px, cx) * EMU)
        const offY = Math.round(py * EMU)
        const extCx = Math.max(Math.round(Math.abs(cx - px) * EMU), 1)
        const extCy = Math.max(Math.round((cy - py) * EMU), 1)
        const flipH = cx < px

        // bentConnector3 (elbow, 1 bend) glued to the parent's bottom-center (idx 2)
        // and the child's top-center (idx 0) connection sites
        connectorXml += `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${cxnId}" name="Connector ${cxnId}"/><p:cNvCxnSpPr><a:stCxn id="${parentId}" idx="2"/><a:endCxn id="${childId}" idx="0"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm${flipH ? ' flipH="1"' : ''}><a:off x="${offX}" y="${offY}"/><a:ext cx="${extCx}" cy="${extCy}"/></a:xfrm><a:prstGeom prst="bentConnector3"><a:avLst><a:gd name="adj1" fmla="val 50000"/></a:avLst></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></p:spPr></p:cxnSp>`
        cxnId++
    })

    // Insert connectors right after the spTree's <p:grpSpPr> so they render behind the boxes
    return slideXml.replace('</p:grpSpPr>', `</p:grpSpPr>${connectorXml}`)
}

/**
 * Writes a pptx to a raw arraybuffer, then post-processes each slide's XML
 * (in order) via JSZip and returns the final .pptx as a Blob.
 */
export async function finalizePptx(
    pptx: PptxGenJS,
    slideXmlTransforms: Array<(xml: string) => string>
): Promise<Blob> {
    const arrayBuffer = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer

    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(arrayBuffer)

    for (let i = 0; i < slideXmlTransforms.length; i++) {
        const slideFile = zip.file(`ppt/slides/slide${i + 1}.xml`)
        if (!slideFile) continue
        let xml = await slideFile.async('text')
        xml = slideXmlTransforms[i](xml)
        zip.file(`ppt/slides/slide${i + 1}.xml`, xml)
    }

    return (await zip.generateAsync({ type: 'blob' })) as Blob
}
