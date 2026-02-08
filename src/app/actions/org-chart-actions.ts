'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export type OrgNode = {
    node_id: string
    name: string
    title: string
    parent_name: string | null
    matched_candidate_id: string | null
    candidate_photo?: string | null
    candidate_id?: string | null
    children?: OrgNode[]
}

export type RawOrgNode = {
    node_id: string
    upload_id: string
    name: string
    title: string | null
    parent_name: string | null
    matched_candidate_id: string | null
    created_at: string
    candidate?: {
        first_name: string
        last_name: string
        photo: string | null
    } | null
}

export async function fetchOrgChartUploads() {
    const { data, error } = await supabase
        .from('org_chart_uploads')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching uploads:', error)
        return []
    }
    return data
}

export async function getOrgNodesRaw(uploadId: string): Promise<RawOrgNode[]> {
    const { data: nodes, error } = await supabase
        .from('all_org_nodes')
        .select('*')
        .eq('upload_id', uploadId)
        .order('name', { ascending: true })

    if (error) throw error

    // Fetch candidate details for display
    const candidateIds = nodes
        .filter(n => n.matched_candidate_id)
        .map(n => n.matched_candidate_id)

    const candidateMap: Record<string, any> = {}

    if (candidateIds.length > 0) {
        const { data: candidates } = await (supabase
            .from('Candidate Profile' as any)
            .select('candidate_id, photo, "First Name", "Last Name"')
            .in('candidate_id', candidateIds) as any)

        if (candidates) {
            candidates.forEach(c => {
                candidateMap[c.candidate_id] = {
                    first_name: c['First Name'],
                    last_name: c['Last Name'],
                    photo: c.photo
                }
            })
        }
    }

    return nodes.map(n => ({
        ...n,
        candidate: n.matched_candidate_id ? candidateMap[n.matched_candidate_id] : null
    }))
}

export async function createOrgNode(uploadId: string, node: Omit<RawOrgNode, 'node_id' | 'created_at' | 'upload_id' | 'candidate'>) {
    const { data, error } = await supabase
        .from('all_org_nodes')
        .insert({
            upload_id: uploadId,
            name: node.name,
            title: node.title,
            parent_name: node.parent_name,
            matched_candidate_id: node.matched_candidate_id
        })
        .select()
        .single()

    if (error) throw error
    revalidatePath('/org-chart')
    return data
}

export async function searchCandidates(query: string) {
    const { data, error } = await supabase
        .from('Candidate Profile')
        .select('candidate_id, photo, "First Name", "Last Name"')
        .or(`"First Name".ilike.%${query}%,"Last Name".ilike.%${query}%`)
        .limit(10)

    if (error) throw error
    return data.map(c => ({
        id: c.candidate_id,
        name: `${c['First Name']} ${c['Last Name']}`,
        photo: c.photo
    }))
}

export async function updateOrgNode(nodeId: string, updates: Partial<RawOrgNode>) {
    const { error } = await supabase
        .from('all_org_nodes')
        .update({
            name: updates.name,
            title: updates.title,
            parent_name: updates.parent_name,
            matched_candidate_id: updates.matched_candidate_id
        })
        .eq('node_id', nodeId)

    if (error) throw error
    revalidatePath('/org-chart')
}

export async function fetchOrgChartData(uploadId: string) {
    // 1. Fetch text nodes
    const { data: nodes, error } = await supabase
        .from('all_org_nodes')
        .select('*')
        .eq('upload_id', uploadId)

    if (error) throw error
    if (!nodes || nodes.length === 0) return null

    // 2. Fetch matched candidate profiles to get Photos
    const candidateIds = nodes
        .filter(n => n.matched_candidate_id)
        .map(n => n.matched_candidate_id)

    const candidateMap: Record<string, any> = {}

    if (candidateIds.length > 0) {
        const { data: candidates } = await (supabase
            .from('Candidate Profile' as any)
            .select('candidate_id, photo, "First Name", "Last Name"')
            .in('candidate_id', candidateIds) as any)

        if (candidates) {
            candidates.forEach(c => {
                candidateMap[c.candidate_id] = c
            })
        }
    }

    // 3. Build Hierarchy
    // Map raw nodes to enriched objects
    const nodeMap = new Map<string, OrgNode>()
    const rawData = nodes.map(n => {
        const candidate = n.matched_candidate_id ? candidateMap[n.matched_candidate_id] : null
        const nodeObj = {
            ...n,
            candidate_photo: candidate?.photo || null,
            candidate_id: candidate?.candidate_id || null,
            children: []
        }
        nodeMap.set(n.name, nodeObj)
        return nodeObj
    })

    const rootNodes: OrgNode[] = []

    rawData.forEach(node => {
        if (!node.parent_name || node.parent_name.trim() === '') {
            rootNodes.push(node)
        } else {
            const parent = nodeMap.get(node.parent_name)
            if (parent) {
                parent.children = parent.children || []
                parent.children.push(node)
            } else {
                rootNodes.push(node)
            }
        }
    })

    if (rootNodes.length === 1) return rootNodes[0]
    if (rootNodes.length > 1) {
        return {
            node_id: 'root-wrapper',
            name: 'Organization',
            title: 'Chart',
            parent_name: null,
            matched_candidate_id: null,
            children: rootNodes
        }
    }
    return null
}
