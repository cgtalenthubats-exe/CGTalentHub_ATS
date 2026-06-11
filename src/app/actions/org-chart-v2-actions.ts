'use server'

import { getOrgNodesRaw } from './org-chart-actions'
import { getCheckedStatus } from '@/lib/candidate-utils'

export type OrgNodeV2 = {
    id: string
    parentId?: string
    name: string
    title: string | null
    is_group_node: boolean
    match_status: string
    is_verified: string | null
    candidate_id: string | null
    candidate_photo: string | null
    linkedin: string | null
    checked: string | null
    current_experience?: {
        company: string
        position: string
        is_current_job: string
        start_date: string | null
    } | null
}

/**
 * Flattens all_org_nodes (resolved via getOrgNodesRaw, same matching/color logic
 * as the V1 chart) into the {id, parentId} shape d3-org-chart expects.
 * Read-only — does not modify any data.
 */
export async function fetchOrgChartFlatData(uploadId: string, chartCompanyName = 'Organization'): Promise<OrgNodeV2[]> {
    const nodes = await getOrgNodesRaw(uploadId)
    if (!nodes || nodes.length === 0) return []

    const nameToId = new Map<string, string>()
    nodes.forEach((n) => nameToId.set(n.name, n.node_id))

    const flat: OrgNodeV2[] = nodes.map((n) => ({
        id: n.node_id,
        parentId: n.parent_name ? nameToId.get(n.parent_name) : undefined,
        name: n.name,
        title: n.title,
        is_group_node: !!n.is_group_node,
        match_status: n.match_status || 'unmapped',
        is_verified: n.is_verified ?? null,
        candidate_id: n.candidate?.candidate_id || null,
        candidate_photo: n.candidate?.photo || null,
        linkedin: n.candidate?.linkedin || n.linkedin || null,
        checked: n.candidate?.checked || (n.linkedin ? getCheckedStatus(n.linkedin) : null),
        current_experience: n.current_experience || null,
    }))

    const idSet = new Set(flat.map((n) => n.id))
    const roots = flat.filter((n) => !n.parentId || !idSet.has(n.parentId))

    if (roots.length <= 1) {
        const rootId = roots[0]?.id
        return flat.map((n) => (n.id === rootId ? { ...n, parentId: undefined } : n))
    }

    const rootIds = new Set(roots.map((r) => r.id))
    const wrapper: OrgNodeV2 = {
        id: 'root-wrapper',
        parentId: undefined,
        name: chartCompanyName,
        title: 'Organization',
        is_group_node: true,
        match_status: 'unmapped',
        is_verified: null,
        candidate_id: null,
        candidate_photo: null,
        linkedin: null,
        checked: null,
        current_experience: null,
    }

    return [wrapper, ...flat.map((n) => (rootIds.has(n.id) ? { ...n, parentId: 'root-wrapper' } : n))]
}
