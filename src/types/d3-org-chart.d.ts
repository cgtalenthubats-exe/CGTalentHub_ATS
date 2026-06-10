declare module 'd3-org-chart' {
    export class OrgChart<T = any> {
        constructor()
        container(selector: string | HTMLElement): this
        data(data: T[]): this
        nodeId(fn: (d: T) => string): this
        parentNodeId(fn: (d: T) => string | undefined): this
        nodeWidth(fn: (d: any) => number): this
        nodeHeight(fn: (d: any) => number): this
        compact(value: boolean): this
        compactMarginPair(fn: (d: any) => number): this
        compactMarginBetween(fn: (d: any) => number): this
        childrenMargin(fn: (d: any) => number): this
        neighbourMargin(fn: (d: any, d2: any) => number): this
        siblingsMargin(fn: (d: any) => number): this
        initialExpandLevel(value: number): this
        svgHeight(value: number): this
        svgWidth(value: number): this
        nodeContent(fn: (d: any) => string): this
        onNodeClick(fn: (d: any) => void): this
        render(): this
        fit(opts?: { animate?: boolean; nodes?: any[]; scale?: boolean; onCompleted?: () => void }): this
        expandAll(): this
        collapseAll(): this
        setExpanded(id: string, expanded?: boolean): this
    }
}
