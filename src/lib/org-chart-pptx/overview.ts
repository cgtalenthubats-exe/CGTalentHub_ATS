import type { HierarchyPointNode } from 'd3-hierarchy'
import type { OrgNodeV2 } from '@/app/actions/org-chart-v2-actions'
import {
    BOX_W, BOX_H, GAP_X, GAP_Y,
    buildHierarchy, computeSubCounts,
    renderNodesToSlide, injectConnectors, finalizePptx,
} from './shared'

const MARGIN = 0.5
const MAX_DIM = 50 // inches — stay safely under PowerPoint's ~56in slide size cap

/**
 * Builds a single-slide "Overview" PPTX: every group node (except the root) is
 * collapsed to a single card, so the whole org structure fits on one slide
 * sized to its bounding box.
 */
export async function buildOverviewPptx(data: OrgNodeV2[]): Promise<Blob> {
    const PptxGenJS = (await import('pptxgenjs')).default
    const { tree } = await import('d3-hierarchy')

    const fullRoot = await buildHierarchy(data)
    const subCounts = computeSubCounts(fullRoot)

    // Collapse every group node (except the root itself) — its descendants are
    // dropped from this view since the node already shows a subordinate count.
    fullRoot.descendants().forEach((n) => {
        if (n !== fullRoot && n.data.is_group_node) {
            n.children = undefined
        }
    })

    const layout = tree<OrgNodeV2>().nodeSize([BOX_W + GAP_X, BOX_H + GAP_Y])
    layout(fullRoot)

    const nodes = fullRoot.descendants() as HierarchyPointNode<OrgNodeV2>[]

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    nodes.forEach((n) => {
        minX = Math.min(minX, n.x)
        maxX = Math.max(maxX, n.x)
        minY = Math.min(minY, n.y)
        maxY = Math.max(maxY, n.y)
    })

    const totalW = (maxX - minX) + BOX_W + MARGIN * 2
    const totalH = (maxY - minY) + BOX_H + MARGIN * 2
    const scale = Math.min(1, MAX_DIM / totalW, MAX_DIM / totalH)

    const pptx = new PptxGenJS()
    pptx.defineLayout({ name: 'ORG_OVERVIEW', width: Math.max(totalW * scale, 1), height: Math.max(totalH * scale, 1) })
    pptx.layout = 'ORG_OVERVIEW'

    const slide = pptx.addSlide()

    const toX = (x: number) => (x - minX + MARGIN) * scale
    const toY = (y: number) => (y - minY + MARGIN) * scale

    await renderNodesToSlide(pptx, slide, nodes, { toX, toY, scale }, subCounts)

    return finalizePptx(pptx, [
        (xml) => injectConnectors(xml, nodes, { toX, toY, scale }),
    ])
}
