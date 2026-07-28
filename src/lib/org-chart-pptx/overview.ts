import type { HierarchyPointNode } from 'd3-hierarchy'
import type { OrgNodeV2 } from '@/app/actions/org-chart-v2-actions'
import {
    BOX_W, BOX_H, GAP_X, GAP_Y,
    buildHierarchy, computeSubCounts,
    renderNodesToSlide, injectConnectors, finalizePptx, addBranding,
} from './shared'

const MARGIN = 0.5
const HEADER_H = 0.5 // extra space at the top for the company logo/name
const MAX_DIM = 50 // inches — stay safely under PowerPoint's ~56in slide size cap
const MAX_VISIBLE_DEPTH = 3 // shows n / n-1 / n-2 (depth 1-3 below the root wrapper); deeper nodes collapse into their n-2 ancestor

/**
 * Builds a single-slide "Overview" PPTX: every group node (except the root) is
 * collapsed to a single card, so the whole org structure fits on one slide
 * sized to its bounding box.
 */
export async function buildOverviewPptx(data: OrgNodeV2[], companyName: string, logoDataUri: string | null): Promise<Blob> {
    const PptxGenJS = (await import('pptxgenjs')).default
    const { tree } = await import('d3-hierarchy')

    const fullRoot = await buildHierarchy(data)
    const subCounts = computeSubCounts(fullRoot)

    // Show only the top MAX_VISIBLE_DEPTH levels below the root wrapper (n, n-1, n-2) —
    // group and individual nodes alike. Anything deeper is dropped; the node at the
    // cutoff depth shows a "+N" count instead (see renderNodesToSlide's isTruncated).
    fullRoot.descendants().forEach((n) => {
        if (n.depth === MAX_VISIBLE_DEPTH) {
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
    const totalH = (maxY - minY) + BOX_H + MARGIN * 2 + HEADER_H
    const scale = Math.min(1, MAX_DIM / totalW, MAX_DIM / totalH)

    const pptx = new PptxGenJS()
    pptx.defineLayout({ name: 'ORG_OVERVIEW', width: Math.max(totalW * scale, 1), height: Math.max(totalH * scale, 1) })
    pptx.layout = 'ORG_OVERVIEW'

    const slide = pptx.addSlide()

    const toX = (x: number) => (x - minX + MARGIN) * scale
    const toY = (y: number) => (y - minY + MARGIN + HEADER_H) * scale

    await renderNodesToSlide(pptx, slide, nodes, { toX, toY, scale }, subCounts)
    addBranding(pptx, slide, companyName, logoDataUri, 0.15, 0.08)

    return finalizePptx(pptx, [
        (xml) => injectConnectors(xml, nodes, { toX, toY, scale }),
    ])
}
