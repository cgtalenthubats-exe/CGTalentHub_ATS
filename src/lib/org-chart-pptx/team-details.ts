import type { HierarchyNode, HierarchyPointNode } from 'd3-hierarchy'
import type { OrgNodeV2 } from '@/app/actions/org-chart-v2-actions'
import {
    BOX_W, BOX_H, GAP_X, GAP_Y,
    buildHierarchy, computeSubCounts,
    renderNodesToSlide, injectConnectors, finalizePptx, addBranding, BRAND_LOGO_H,
} from './shared'

// Standard 16:9 widescreen slide, in inches
const SLIDE_W = 13.333
const SLIDE_H = 7.5
const MARGIN = 0.4
const TITLE_H = 0.8
const BRAND_GAP = 0.08
const MAX_SCALE = 1.5

/**
 * Collects the ids of a team's subtree: the team root plus its descendants,
 * stopping at (but including) any nested group node — those get their own slide.
 */
function getSubtreeIds(root: HierarchyNode<OrgNodeV2>): Set<string> {
    const ids = new Set<string>()
    const stack: HierarchyNode<OrgNodeV2>[] = [root]
    while (stack.length) {
        const cur = stack.pop()!
        ids.add(cur.data.id)
        if (cur === root || !cur.data.is_group_node) {
            (cur.children || []).forEach((c) => stack.push(c))
        }
    }
    return ids
}

/**
 * Builds a 16:9 "Team Details" PPTX with one slide per team/group node (excluding
 * the root), each showing that team's members at a readable scale.
 * Returns null if the chart has no group nodes (nothing to show).
 */
export async function buildTeamDetailsPptx(data: OrgNodeV2[], companyName: string, logoDataUri: string | null): Promise<Blob | null> {
    const PptxGenJS = (await import('pptxgenjs')).default
    const { tree } = await import('d3-hierarchy')

    const fullRoot = await buildHierarchy(data)
    const subCounts = computeSubCounts(fullRoot)

    const teamRoots = fullRoot.descendants().filter((n) => n !== fullRoot && n.data.is_group_node)
    if (teamRoots.length === 0) return null

    const pptx = new PptxGenJS()
    pptx.defineLayout({ name: 'ORG_TEAM_DETAILS', width: SLIDE_W, height: SLIDE_H })
    pptx.layout = 'ORG_TEAM_DETAILS'

    const slideXmlTransforms: Array<(xml: string) => string> = []

    for (const teamRoot of teamRoots) {
        const idSet = getSubtreeIds(teamRoot)
        const subData: OrgNodeV2[] = data
            .filter((d) => idSet.has(d.id))
            .map((d) => (d.id === teamRoot.data.id ? { ...d, parentId: undefined } : d))

        const subRoot = await buildHierarchy(subData)
        const layout = tree<OrgNodeV2>().nodeSize([BOX_W + GAP_X, BOX_H + GAP_Y])
        layout(subRoot)

        const nodes = subRoot.descendants() as HierarchyPointNode<OrgNodeV2>[]

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        nodes.forEach((n) => {
            minX = Math.min(minX, n.x)
            maxX = Math.max(maxX, n.x)
            minY = Math.min(minY, n.y)
            maxY = Math.max(maxY, n.y)
        })

        const totalW = (maxX - minX) + BOX_W
        const totalH = (maxY - minY) + BOX_H

        const availW = SLIDE_W - MARGIN * 2
        const availH = SLIDE_H - TITLE_H - MARGIN

        const scale = Math.min(availW / totalW, availH / totalH, MAX_SCALE)

        const contentW = totalW * scale
        const contentH = totalH * scale
        const offsetX = (SLIDE_W - contentW) / 2
        const offsetY = TITLE_H + Math.max((availH - contentH) / 2, 0)

        const toX = (x: number) => (x - minX) * scale + offsetX
        const toY = (y: number) => (y - minY) * scale + offsetY

        const slide = pptx.addSlide()
        addBranding(pptx, slide, companyName, logoDataUri, MARGIN, 0.06)
        slide.addText(teamRoot.data.name, {
            x: MARGIN, y: BRAND_LOGO_H + BRAND_GAP, w: SLIDE_W - MARGIN * 2, h: TITLE_H - BRAND_LOGO_H - BRAND_GAP,
            fontSize: 20, bold: true, color: '3730A3', fontFace: 'Tahoma',
            align: 'left', valign: 'middle',
        })

        await renderNodesToSlide(pptx, slide, nodes, { toX, toY, scale }, subCounts)
        slideXmlTransforms.push((xml) => injectConnectors(xml, nodes, { toX, toY, scale }))
    }

    return finalizePptx(pptx, slideXmlTransforms)
}
