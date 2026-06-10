'use client'

import { useEffect, useRef } from 'react'
import { OrgChart } from 'd3-org-chart'
import type { OrgNodeV2 } from '@/app/actions/org-chart-v2-actions'

const DEFAULT_AVATAR = 'https://ddeqeaicjyrevqdognbn.supabase.co/storage/v1/object/public/system/Blank%20Profile.JPG'
const FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

const STATUS_STYLES: Record<string, { border: string; bg: string; dashed?: boolean }> = {
    matched: { border: '#10b981', bg: '#ecfdf5' },
    mismatch_company: { border: '#f43f5e', bg: '#fff1f2' },
    mismatch_position: { border: '#fbbf24', bg: '#fffbeb' },
    n8n_processing: { border: '#818cf8', bg: '#eef2ff', dashed: true },
    unmapped: { border: '#e2e8f0', bg: '#ffffff' },
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

function renderNodeContent(d: { data: V2HierarchyDatum; width: number; height: number }): string {
    const data = d.data
    const { width, height } = d

    if (data.id === 'root-wrapper') {
        return `
            <div style="width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;border:2px dashed #cbd5e1;border-radius:12px;background:#f8fafc;font-family:${FONT_FAMILY};color:#64748b;font-size:13px;font-weight:700;box-sizing:border-box;">
                ${escapeHtml(data.name)}
            </div>
        `
    }

    const childCount = data._directSubordinates || 0

    if (data.is_group_node) {
        return `
            <div style="width:${width}px;height:${height}px;border:2px solid #6366f1;border-radius:12px;background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);box-shadow:0 1px 3px rgba(99,102,241,0.15);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:${FONT_FAMILY};box-sizing:border-box;position:relative;">
                <div style="background:#6366f1;border-radius:8px;padding:5px;margin-bottom:4px;display:flex;align-items:center;justify-content:center;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
                    </svg>
                </div>
                <div style="font-size:12px;font-weight:700;color:#3730a3;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90%;">
                    ${escapeHtml(data.name)}
                </div>
                ${data.title ? `<div style="font-size:10px;color:#6366f1;font-weight:500;text-align:center;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90%;">${escapeHtml(data.title)}</div>` : ''}
                <div style="position:absolute;bottom:8px;left:10px;right:10px;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:9px;font-weight:700;color:#818cf8;text-transform:uppercase;letter-spacing:0.08em;">GROUP</span>
                    ${childCount > 0 ? `<div style="background:#6366f1;border-radius:999px;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:white;padding:0 5px;">${childCount}</div>` : ''}
                </div>
            </div>
        `
    }

    const status = data.match_status || 'unmapped'
    const isVerified = data.is_verified === 'TRUE'
    const isMatch = !!data.candidate_id
    const style = STATUS_STYLES[status] || STATUS_STYLES.unmapped
    const photo = data.candidate_photo || DEFAULT_AVATAR

    return `
        <div style="width:${width}px;height:${height}px;border:2px ${style.dashed ? 'dashed' : 'solid'} ${style.border};border-radius:12px;background:${style.bg};box-shadow:0 1px 3px rgba(0,0,0,0.06);font-family:${FONT_FAMILY};box-sizing:border-box;padding:10px;display:flex;flex-direction:column;justify-content:space-between;position:relative;">
            <div style="display:flex;align-items:flex-start;width:100%;">
                <div style="flex-shrink:0;margin-right:10px;position:relative;">
                    <div style="width:40px;height:40px;border-radius:9999px;background-image:url('${escapeHtml(photo)}');background-size:cover;background-position:center;background-color:#f1f5f9;border:1px solid #e2e8f0;"></div>
                    ${childCount > 0 ? `<div style="position:absolute;bottom:-4px;right:-4px;background:#4f46e5;color:white;border:2px solid white;border-radius:9999px;min-width:16px;height:16px;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 3px;">${childCount}</div>` : ''}
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;color:#1e293b;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;" title="${escapeHtml(data.name)}">
                        ${escapeHtml(data.name)}
                    </div>
                    <div style="font-size:10px;color:#64748b;font-weight:500;text-transform:uppercase;letter-spacing:0.02em;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.3;" title="${escapeHtml(data.title || '')}">
                        ${escapeHtml(data.title || 'Position Not Set')}
                    </div>
                </div>
                ${data.linkedin ? `
                <a href="${escapeHtml(data.linkedin)}" target="_blank" rel="noopener noreferrer" style="position:absolute;top:0;right:0;color:#94a3b8;padding:2px;line-height:0;" title="LinkedIn">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.27c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.76-1.75 1.76zm13.5 12.27h-3v-5.6c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97v5.7h-3v-11h2.88v1.5h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.59v6.47z"/></svg>
                </a>` : ''}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:flex-end;width:100%;">
                <span style="font-size:9px;font-family:ui-monospace,monospace;font-weight:700;color:#94a3b8;">
                    ${isMatch ? escapeHtml(data.candidate_id) : 'UNMATCHED'}
                </span>
                ${isMatch
                    ? `<span style="font-size:9px;font-weight:700;border-radius:6px;padding:2px 6px;display:inline-flex;align-items:center;gap:3px;${isVerified ? 'color:#047857;background:rgba(16,185,129,0.1);' : 'color:#b45309;background:rgba(251,191,36,0.15);border:1px solid #fbbf24;'}">${isVerified ? 'V' : 'VERIFY'}</span>`
                    : `<span style="font-size:9px;font-weight:700;border-radius:6px;padding:2px 6px;border:1px dashed #818cf8;color:#4f46e5;">+ CREATE</span>`
                }
            </div>
        </div>
    `
}

export function OrgChartViewerV2({ data }: { data: OrgNodeV2[] }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<OrgChart<OrgNodeV2> | null>(null)

    useEffect(() => {
        const container = containerRef.current
        if (!container || data.length === 0) return

        const height = Math.max(window.innerHeight - 220, 500)

        const chart = new OrgChart<OrgNodeV2>()
            .container(container)
            .data(data)
            .nodeId((d) => d.id)
            .parentNodeId((d) => d.parentId)
            .nodeWidth(() => 280)
            .nodeHeight(() => 160)
            .compact(true)
            .compactMarginPair(() => 30)
            .compactMarginBetween(() => 16)
            .neighbourMargin(() => 40)
            .siblingsMargin(() => 20)
            .childrenMargin(() => 70)
            .initialExpandLevel(2)
            .svgHeight(height)
            .nodeContent(renderNodeContent as (d: any) => string)
            .render()

        chartRef.current = chart
        chart.fit()

        return () => {
            container.innerHTML = ''
            chartRef.current = null
        }
    }, [data])

    if (data.length === 0) {
        return (
            <div className="h-[600px] flex items-center justify-center text-slate-400">
                No org chart data found.
            </div>
        )
    }

    return <div ref={containerRef} className="w-full" style={{ minHeight: '600px' }} />
}
