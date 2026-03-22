'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { adminAuthClient } from '@/lib/supabase/admin'
import { triggerCandidateRefresh } from '@/app/actions/n8n-actions'
import { getCheckedStatus } from '@/lib/candidate-utils'
import { getN8nUrl } from './admin-actions'
import { v4 as uuidv4 } from 'uuid'

const supabase = adminAuthClient as any

export type OrgNode = {
    node_id: string
    name: string
    title: string
    parent_name: string | null
    matched_candidate_id: string | null
    candidate_photo?: string | null
    candidate_id?: string | null
    linkedin?: string | null
    checked?: string | null
    children?: OrgNode[]
}

export type RawOrgNode = {
    node_id: string
    upload_id: string
    name: string
    title: string | null
    parent_name: string | null
    matched_candidate_id: string | null
    linkedin: string | null
    created_at: string
    candidate?: {
        first_name?: string
        last_name?: string
        name?: string
        photo: string | null
        linkedin?: string | null
        checked?: string | null
        candidate_id?: string | null
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

export async function verifyOrgChart(uploadId: string) {
    if (!uploadId) return { success: false, error: 'Upload ID is required' }
    
    const { error } = await supabase
        .from('org_chart_uploads')
        .update({ modify_date: new Date().toISOString() })
        .eq('upload_id', uploadId)

    if (error) {
        console.error('Error verifying org chart:', error)
        throw error
    }
    
    revalidatePath('/org-chart')
    return { success: true }
}

export async function fetchCompanyLogo(companyId: string | null) {
    if (!companyId) return null
    const { data } = await supabase
        .from('company_master')
        .select('company_logo')
        .eq('company_id', companyId)
        .single()
    return data?.company_logo || null
}

export async function updateMasterCompanyLogo(companyId: string, logoUrl: string) {
    const { error } = await supabase
        .from('company_master')
        .update({ company_logo: logoUrl })
        .eq('company_id', companyId)

    if (error) throw error
    revalidatePath('/org-chart')
    return { success: true }
}

/**
 * Helper to fetch candidates by multiple criteria safely (V7 - Schema Aligned)
 */
async function fetchCandidatesRobust(ids: string[], names: string[]) {
    const client = adminAuthClient as any
    const allCandidates: any[] = []

    // Exact columns from DB: candidate_id, photo, name, linkedin, checked
    const selectStr = 'candidate_id, photo, name, linkedin, checked'

    // 1. Fetch by IDs
    if (ids.length > 0) {
        const { data, error } = await client
            .from('Candidate Profile')
            .select(selectStr)
            .in('candidate_id', ids)

        if (error) {
            console.error('[OrgChart] Error fetching by IDs:', error.message, error.details)
        } else if (data) {
            allCandidates.push(...data)
        }
    }

    // 2. Fetch by Names
    if (names.length > 0) {
        const { data, error } = await client
            .from('Candidate Profile')
            .select(selectStr)
            .in('name', names)

        if (error) {
            console.error('[OrgChart] Error fetching by Names:', error.message, error.details)
        } else if (data) {
            // Merge results, avoid duplicates
            data.forEach((c: any) => {
                if (!allCandidates.find(existing => existing.candidate_id === c.candidate_id)) {
                    allCandidates.push(c)
                }
            })
        }
    }

    return allCandidates
}

export async function getOrgNodesRaw(uploadId: string): Promise<RawOrgNode[]> {
    const { data: nodes, error } = await supabase
        .from('all_org_nodes')
        .select('*')
        .eq('upload_id', uploadId)
        .order('name', { ascending: true })

    if (error) throw error

    const candidateIds = nodes
        .filter((n: any) => n.matched_candidate_id)
        .map((n: any) => n.matched_candidate_id?.trim())
        .filter(Boolean)

    const candidateNames = nodes
        .map((n: any) => n.name?.trim())
        .filter(Boolean)

    const idMap = new Map<string, any>()
    const nameMap = new Map<string, any>()

    const candidates = await fetchCandidatesRobust(candidateIds, candidateNames)

    candidates.forEach((c: any) => {
        const cId = c.candidate_id?.trim().toUpperCase();
        const cName = c.name?.trim().toLowerCase();

        if (cId) idMap.set(cId, c)
        if (cName) nameMap.set(cName, c)
    })

    return nodes.map((n: any) => {
        const targetId = n.matched_candidate_id?.trim().toUpperCase();
        const targetName = n.name?.trim().toLowerCase();

        let candidate = targetId ? idMap.get(targetId) : null
        if (!candidate && targetName) {
            candidate = nameMap.get(targetName)
        }

        return {
            ...n,
            candidate: candidate ? {
                name: candidate.name,
                photo: candidate.photo,
                linkedin: candidate.linkedin || n.linkedin, // Prefer candidate's linkedin, fallback to node's
                checked: candidate.checked,
                candidate_id: candidate.candidate_id
            } : (n.linkedin ? {
                name: n.name,
                photo: null,
                linkedin: n.linkedin,
                checked: null,
                candidate_id: null
            } : null)
        };
    })
}

export async function createOrgNode(uploadId: string, node: Omit<RawOrgNode, 'node_id' | 'created_at' | 'upload_id' | 'candidate'>) {
    const { data, error } = await supabase
        .from('all_org_nodes')
        .insert({
            upload_id: uploadId,
            name: node.name,
            title: node.title,
            parent_name: node.parent_name,
            matched_candidate_id: node.matched_candidate_id,
            linkedin: node.linkedin
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
        .select('candidate_id, photo, name')
        .or(`name.ilike.%${query}%,candidate_id.ilike.%${query}%`)
        .limit(10)

    if (error) throw error
    return data.map((c: any) => ({
        id: c.candidate_id,
        name: c.name,
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
            matched_candidate_id: updates.matched_candidate_id,
            linkedin: updates.linkedin
        })
        .eq('node_id', nodeId)

    if (error) throw error

    // Trigger webhook if linkedin was updated to a LinkedIN profile
    if (updates.linkedin && getCheckedStatus(updates.linkedin) === 'LinkedIN profile') {
        const { data: node } = await supabase.from('all_org_nodes').select('name, node_id').eq('node_id', nodeId).single()
        if (node) {
            await triggerCandidateRefresh([{ id: updates.matched_candidate_id || `node-${nodeId}`, name: node.name, linkedin: updates.linkedin }], 'System (OrgChart Update)')
        }
    }

    revalidatePath('/org-chart')
}

export async function bulkCreateOrgProfiles(uploadId: string) {
    try {
        // 1. Fetch all unmatched nodes for this upload
        const { data: nodes, error: nodesError } = await supabase
            .from('all_org_nodes')
            .select('node_id, name, title, linkedin')
            .eq('upload_id', uploadId)
            .is('matched_candidate_id', null)

        if (nodesError) throw nodesError
        if (!nodes || nodes.length === 0) return { success: true, count: 0 }

        // Fetch upload details to get Company Master name
        const { data: uploadData } = await supabase
            .from('org_chart_uploads')
            .select('company_name')
            .eq('upload_id', uploadId)
            .single()

        const masterCompany = uploadData?.company_name || 'Unknown'

        const count = nodes.length

        // 2. Reserve Candidate IDs
        const { data: idRange, error: rpcError } = await supabase.rpc('reserve_candidate_ids', { batch_size: count })
        if (rpcError || !idRange || idRange.length === 0) throw new Error('ID Reservation Failed')

        const startId = idRange[0].start_id
        const candidatesToRefresh: { id: string, name: string, linkedin: string }[] = []

        // 3. Prepare Batch Data
        const candidateProfiles = nodes.map((node: any, index: number) => {
            const numericId = startId + index
            const newId = `C${numericId.toString().padStart(5, '0')}`

            if (node.linkedin && getCheckedStatus(node.linkedin) === 'LinkedIN profile') {
                candidatesToRefresh.push({ id: newId, name: node.name, linkedin: node.linkedin })
            }

            return {
                candidate_id: newId,
                name: node.name,
                linkedin: node.linkedin || null,
                checked: getCheckedStatus(node.linkedin),
                created_date: new Date().toISOString(),
                modify_date: new Date().toISOString()
            }
        })

        const candidateEnhancements = nodes.map((node: any, index: number) => {
            const numericId = startId + index
            const newId = `C${numericId.toString().padStart(5, '0')}`
            return {
                candidate_id: newId,
                name: node.name,
                linkedin_url: node.linkedin || null,
                education_summary: node.title ? `Target Position: ${node.title}` : null
            }
        })

        const { error: pError } = await supabase.from('Candidate Profile').insert(candidateProfiles)
        if (pError) throw pError

        const { error: eError } = await supabase.from('candidate_profile_enhance').insert(candidateEnhancements)
        if (eError) throw eError

        // Prepare and insert backgrounds (experiences) for non-LinkedIn users
        const directExperiences = nodes.map((node: any, index: number) => {
            const numericId = startId + index
            const newId = `C${numericId.toString().padStart(5, '0')}`

            if (!node.linkedin) {
                return {
                    candidate_id: newId,
                    name: node.name,
                    company: masterCompany,
                    position: node.title || 'Unknown Position',
                    start_date: null,
                    end_date: null,
                    is_current_job: 'Current',
                    row_status: 'Active'
                }
            }
            return null
        }).filter(Boolean)

        if (directExperiences.length > 0) {
            const { error: expError } = await supabase.from('candidate_experiences').insert(directExperiences)
            if (expError) {
                console.error('[BulkCreate] Experience Error:', expError)
                // Non-blocking but log it
            }
        }

        // 5. Update Org Nodes to link them
        for (let i = 0; i < nodes.length; i++) {
            const newId = candidateProfiles[i].candidate_id
            await supabase.from('all_org_nodes').update({ matched_candidate_id: newId }).eq('node_id', nodes[i].node_id)
        }

        // 6. Trigger Webhook for all qualifying candidates
        if (candidatesToRefresh.length > 0) {
            await triggerCandidateRefresh(candidatesToRefresh, 'System (OrgChart Bulk)')
        }

        revalidatePath('/org-chart')
        return { success: true, count, webhookCount: candidatesToRefresh.length }

    } catch (err: any) {
        console.error('[BulkCreate] Error:', err)
        throw err
    }
}

/**
 * Creates a single profile from an OrgChart node in the background.
 */
export async function createSingleOrgProfile(nodeId: string) {
    try {
        // 1. Fetch Node Data
        const { data: node, error: nodeError } = await supabase
            .from('all_org_nodes')
            .select('*')
            .eq('node_id', nodeId)
            .single()

        if (nodeError || !node) throw new Error('Node not found')
        if (node.matched_candidate_id) throw new Error('Candidate already matched')

        // 2. Fetch Master Company Name
        const { data: uploadData } = await supabase
            .from('org_chart_uploads')
            .select('company_name')
            .eq('upload_id', node.upload_id)
            .single()

        const masterCompany = uploadData?.company_name || 'Unknown'

        // 3. Reserve Candidate ID
        const { data: idRange, error: rpcError } = await supabase.rpc('reserve_candidate_ids', { batch_size: 1 })
        if (rpcError || !idRange || idRange.length === 0) throw new Error('ID Reservation Failed')

        const numericId = idRange[0].start_id
        const newCandidateId = `C${numericId.toString().padStart(5, '0')}`
        const now = new Date().toISOString()

        // 4. Prepare Data
        const profileData = {
            candidate_id: newCandidateId,
            name: node.name,
            linkedin: node.linkedin || null,
            checked: getCheckedStatus(node.linkedin),
            created_date: now,
            modify_date: now
        }

        const enhanceData = {
            candidate_id: newCandidateId,
            name: node.name,
            current_position: node.title || null,
            current_company: masterCompany,
            linkedin_url: node.linkedin || null,
            education_summary: node.title ? `Target Position: ${node.title}` : null
        }

        // 5. Database Pipeline
        // Profile
        const { error: pError } = await supabase.from('Candidate Profile').insert(profileData)
        if (pError) throw pError

        // Enhance
        await supabase.from('candidate_profile_enhance').insert(enhanceData)

        // Experiences (Only if NO LinkedIn)
        let mode: 'n8n' | 'direct' = 'direct'
        if (!node.linkedin) {
            const expData = {
                candidate_id: newCandidateId,
                name: node.name,
                company: masterCompany,
                position: node.title || 'Unknown Position',
                start_date: null,
                end_date: null,
                is_current_job: 'Current',
                row_status: 'Active'
            }
            await supabase.from('candidate_experiences').insert(expData)
        } else if (getCheckedStatus(node.linkedin) === 'LinkedIN profile') {
            // Trigger Webhook
            await triggerCandidateRefresh([{ id: newCandidateId, name: node.name, linkedin: node.linkedin }], 'System (OrgChart Single Create)')
            mode = 'n8n'
        }

        // 6. Link Node to Candidate
        await supabase.from('all_org_nodes').update({ matched_candidate_id: newCandidateId }).eq('node_id', nodeId)

        revalidatePath('/org-chart')
        return { success: true, candidateId: newCandidateId, mode }

    } catch (err: any) {
        console.error('[CreateSingle] Error:', err)
        throw err
    }
}

export async function importOrgChart(uploadId: string, companyName: string, fileName: string, publicUrl: string, notes: string = '') {
    try {
        console.log(`[ImportOrg] Starting processing for Upload ID: ${uploadId}, Company: ${companyName}`)

        // 0. Check for duplicate Org Chart Name
        const { data: existingChart } = await supabase
            .from('org_chart_uploads')
            .select('upload_id')
            .ilike('company_name', companyName.trim())
            .maybeSingle()

        if (existingChart) {
            return { success: false, error: 'An Org Chart with this name already exists. Please use a unique name.' }
        }

        // 1. Lookup company_id
        let companyId = null
        if (companyName) {
            // Check Variation first (as requested by user)
            const { data: variation } = await supabase
                .from('company_variation')
                .select('company_id')
                .ilike('variation_name', companyName.trim())
                .maybeSingle()
            
            if (variation) {
                companyId = variation.company_id
                console.log(`[ImportOrg] Found matching company_id from variation: ${companyId}`)
            } else {
                // AUTO-CREATE: Find next IDs for both tables
                const [{ data: masterMax }, { data: variationMax }] = await Promise.all([
                    supabase.from('company_master').select('company_id').order('company_id', { ascending: false }).limit(1).maybeSingle(),
                    supabase.from('company_variation').select('variation_id').order('variation_id', { ascending: false }).limit(1).maybeSingle()
                ])
                
                const nextMasterId = (Number(masterMax?.company_id) || 0) + 1
                const nextVariationId = (Number(variationMax?.variation_id) || 0) + 1
                
                console.log(`[ImportOrg] Generating new IDs: Master=${nextMasterId}, Variation=${nextVariationId}`)

                // A. Insert into company_master
                const { error: masterErr } = await supabase
                    .from('company_master')
                    .insert({
                        company_id: nextMasterId,
                        company_master: companyName.trim()
                    })
                
                if (masterErr) {
                    console.error('[ImportOrg] Failed to create master record:', masterErr)
                    throw new Error(`Master creation failed: ${masterErr.message}`)
                }

                // B. Insert into company_variation
                const { error: variationErr } = await supabase
                    .from('company_variation')
                    .insert({
                        variation_id: nextVariationId,
                        company_id: nextMasterId,
                        variation_name: companyName.trim(),
                        company_master_name: companyName.trim()
                    })
                
                if (variationErr) {
                    console.error('[ImportOrg] Failed to create variation record:', variationErr)
                    // If variation fails but master succeeded, we still have a master ID 
                    // but it's better to fail the whole thing to keep it consistent
                    throw new Error(`Variation creation failed: ${variationErr.message}`)
                }

                companyId = nextMasterId
                console.log(`[ImportOrg] Created new company with ID: ${companyId}`)
            }
        }

        // 2. Track in Database BEFORE triggering Webhook
        const { error: dbError } = await supabase
            .from('org_chart_uploads')
            .insert({
                upload_id: uploadId,
                company_name: companyName,
                company_id: companyId,
                chart_file: publicUrl,
                notes: notes || null,
                status: 'Processing',
                modify_date: new Date().toISOString()
            })

        if (dbError) {
            console.error('[ImportOrg] DB Insert Error:', dbError)
            throw new Error(`Failed to track upload in database: ${dbError.message}`)
        }

        // 3. Trigger Webhook
        const config = await getN8nUrl('OrgChart Workflow')
        if (config) {
            const payload = {
                upload_id: uploadId,
                company_master: companyName,
                company_id: companyId, // Added company_id to payload
                image_filename: publicUrl
            }

            console.log('[ImportOrg] Triggering Webhook:', config.url)
            
            // Add a 10s timeout to prevent UI from hanging if n8n is slow or unresponsive
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000)

            try {
                const response = await fetch(config.url, {
                    method: config.method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                })
                clearTimeout(timeoutId)

                if (!response.ok) {
                    console.error('[ImportOrg] Webhook Failed:', response.status)
                }
            } catch (fetchErr: any) {
                clearTimeout(timeoutId)
                if (fetchErr.name === 'AbortError') {
                    console.warn('[ImportOrg] Webhook trigger timed out (10s), but assumed received by n8n.')
                } else {
                    console.error('[ImportOrg] Webhook fetch error:', fetchErr)
                }
            }
        } else {
            console.warn('[ImportOrg] Webhook "OrgChart Workflow" not configured')
        }

        revalidatePath('/org-chart')
        return { success: true, uploadId, fileName }

    } catch (err: any) {
        console.error('[ImportOrg] Error:', err)
        return { success: false, error: err.message }
    }
}

export async function fetchOrgChartData(uploadId: string) {
    const { data: nodes, error } = await supabase
        .from('all_org_nodes')
        .select('*')
        .eq('upload_id', uploadId)

    if (error) throw error
    if (!nodes || nodes.length === 0) return null

    const candidateIds = nodes
        .filter((n: any) => n.matched_candidate_id)
        .map((n: any) => n.matched_candidate_id?.trim())
        .filter(Boolean)

    const candidateNames = nodes
        .map((n: any) => n.name?.trim())
        .filter(Boolean)

    const idMap = new Map<string, any>()
    const nameMap = new Map<string, any>()

    const candidates = await fetchCandidatesRobust(candidateIds, candidateNames)

    console.log(`[OrgChart] fetchOrgChartData: Matches found in DB: ${candidates.length}`)

    candidates.forEach((c: any) => {
        const cId = c.candidate_id?.trim().toUpperCase();
        const cName = c.name?.trim().toLowerCase();
        if (cId) idMap.set(cId, c)
        if (cName) nameMap.set(cName, c)
    })

    const nodeMap = new Map<string, OrgNode>()
    const rawData = nodes.map((n: any) => {
        const targetId = n.matched_candidate_id?.trim().toUpperCase()
        const targetName = n.name?.trim().toLowerCase()

        let candidate = targetId ? idMap.get(targetId) : null
        if (!candidate && targetName) {
            candidate = nameMap.get(targetName)
        }

        if (candidate) {
            console.log(`[OrgChart] MATCH SUCCESS: Node '${n.name}' -> Candidate '${candidate.name}'`)
        }

        const nodeObj: OrgNode = {
            ...n,
            candidate_photo: candidate?.photo || null,
            candidate_id: candidate?.candidate_id || null,
            linkedin: candidate?.linkedin || n.linkedin || null, // Logic: UI shows LinkedIn from Candidate OR Node
            checked: candidate?.checked || null,
            children: []
        }
        nodeMap.set(n.name, nodeObj)
        return nodeObj
    })

    const rootNodes: OrgNode[] = []
    rawData.forEach((node: any) => {
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

// ==========================================
// UNMAPPED CANDIDATES FEATURE
// ==========================================

export async function getUnmappedCompanyCandidates(companyId: string, uploadId: string) {
    // 1. Get all employees currently at this company
    const { data: experiences, error: expError } = await supabase
        .from('candidate_experiences')
        .select('candidate_id, position')
        .eq('company_id', companyId)
        .eq('is_current_job', 'Current')

    if (expError || !experiences || experiences.length === 0) return []

    // 2. Get all matched candidates currently in the org chart
    const { data: orgNodes, error: orgError } = await supabase
        .from('all_org_nodes')
        .select('matched_candidate_id')
        .eq('upload_id', uploadId)
        .not('matched_candidate_id', 'is', null)

    const mappedIds = new Set(orgNodes?.map((n: any) => n.matched_candidate_id) || [])

    // 3. Filter out mapped candidates
    const unmappedExperiences = experiences.filter((exp: any) => !mappedIds.has(exp.candidate_id))
    if (unmappedExperiences.length === 0) return []

    // Distinct IDs
    const unmappedIds = Array.from(new Set(unmappedExperiences.map((exp: any) => exp.candidate_id)))

    // 4. Fetch Candidate Profiles
    const { data: profiles } = await supabase
        .from('Candidate Profile')
        .select('candidate_id, name, linkedin, photo')
        .in('candidate_id', unmappedIds)

    // 5. Combine profile info with position
    return profiles?.map((p: any) => {
        const exp = unmappedExperiences.find((e: any) => e.candidate_id === p.candidate_id)
        return {
            candidate_id: p.candidate_id,
            name: p.name,
            linkedin: p.linkedin,
            photo: p.photo,
            current_position: exp?.position
        }
    }) || []
}

export async function addUnmappedCandidateToOrgChart(uploadId: string, candidateId: string, name: string, title?: string, linkedin?: string) {
    // We need to generate a node_id if 'id' is generated locally?
    // Actually all_org_nodes has UUID default for node_id, so inserting is enough.
    const { error } = await supabase
        .from('all_org_nodes')
        .insert({
            upload_id: uploadId,
            matched_candidate_id: candidateId,
            name: name,
            title: title || 'Added from ATS',
            parent_name: null, // Puts them at the root level of the diagram
            linkedin: linkedin || null
        })

    if (error) {
        console.error('Error adding unmapped candidate:', error)
        throw error
    }
    
    revalidatePath('/org-chart')
    return { success: true }
}

export async function getCandidateOrgCharts(candidateId: string) {
    if (!candidateId) return []
    
    // 1. Get nodes
    const { data: nodes } = await supabase
        .from('all_org_nodes')
        .select('upload_id')
        .eq('matched_candidate_id', candidateId)
        
    if (!nodes || nodes.length === 0) return []
    
    const uploadIds = Array.from(new Set(nodes.map((n: any) => n.upload_id)))
    
    // 2. Get uploads
    const { data: uploads } = await supabase
        .from('org_chart_uploads')
        .select('upload_id, company_name, company_id')
        .in('upload_id', uploadIds)

    if (!uploads || uploads.length === 0) return []

    // 3. Get logos
    const companyIds = Array.from(new Set(uploads.map((u: any) => u.company_id).filter(Boolean)))

    const logos = new Map<string, string>()
    if (companyIds.length > 0) {
        const { data: comp } = await supabase
            .from('company_master')
            .select('company_id, company_logo')
            .in('company_id', companyIds)
        
        comp?.forEach((c: any) => {
            if (c.company_logo) logos.set(c.company_id, c.company_logo)
        })
    }

    return uploads.map((u: any) => ({
        upload_id: u.upload_id,
        company_name: u.company_name,
        company_logo: logos.get(u.company_id) || null
    }))
}

export async function getBulkCandidateOrgCharts(candidateIds: string[]) {
    if (!candidateIds || candidateIds.length === 0) return {}
    
    // 1. Get all nodes for these candidates
    const { data: nodes, error: nodeError } = await supabase
        .from('all_org_nodes')
        .select('upload_id, matched_candidate_id')
        .in('matched_candidate_id', candidateIds)
        
    if (nodeError || !nodes || nodes.length === 0) return {}
    
    const uploadIds = Array.from(new Set(nodes.map((n: any) => n.upload_id)))
    
    // 2. Get upload details
    const { data: uploads, error: uploadError } = await supabase
        .from('org_chart_uploads')
        .select('upload_id, company_name, company_id')
        .in('upload_id', uploadIds)

    if (uploadError || !uploads || uploads.length === 0) return {}

    // 3. Get logos
    const companyIds = Array.from(new Set(uploads.map((u: any) => u.company_id).filter(Boolean)))
    const logos = new Map<string, string>()
    if (companyIds.length > 0) {
        const { data: comp } = await supabase
            .from('company_master')
            .select('company_id, company_logo')
            .in('company_id', companyIds)
        
        comp?.forEach((c: any) => {
            if (c.company_logo) logos.set(c.company_id, c.company_logo)
        })
    }

    // 4. Map everything together
    const result: Record<string, any[]> = {}
    
    // Initialize result with empty arrays for all requested IDs
    candidateIds.forEach(id => { result[id] = [] })

    nodes.forEach((n: any) => {
        const upload = uploads.find((u: any) => u.upload_id === n.upload_id)
        if (upload && n.matched_candidate_id) {
            result[n.matched_candidate_id].push({
                upload_id: upload.upload_id,
                company_name: upload.company_name,
                company_logo: logos.get(upload.company_id) || null
            })
        }
    })

    return result
}

export async function deleteOrgChart(uploadId: string) {
    if (!uploadId) return { success: false, error: 'Upload ID is required' }
    
    // First delete nodes (though cascade might do this, being explicit is safe)
    const { error: nodesError } = await supabase
        .from('all_org_nodes')
        .delete()
        .eq('upload_id', uploadId)
    if (nodesError) {
        console.error('[DeleteOrgChart] Error clearing nodes:', nodesError)
        return { success: false, error: 'Failed to clear org chart nodes' }
    }

    // Then delete the upload record
    const { error: uploadError } = await supabase
        .from('org_chart_uploads')
        .delete()
        .eq('upload_id', uploadId)
    if (uploadError) {
        console.error('[DeleteOrgChart] Error deleting upload:', uploadError)
        return { success: false, error: 'Failed to delete org chart upload' }
    }

    revalidatePath('/org-chart')
    // Also revalidate candidate details list just in case
    revalidatePath('/candidates/[id]', 'page')
    
    return { success: true }
}

export async function getCandidateExperiences(candidateId: string) {
    if (!candidateId) return []
    const { data, error } = await supabase
        .from('candidate_experiences')
        .select('position, company, is_current_job')
        .eq('candidate_id', candidateId)
        .order('is_current_job', { ascending: false }) // Current jobs first
    
    if (error) {
        console.error('[GetExperiences] Error:', error)
        return []
    }
    return data
}

export async function assignCandidateToOrgChart({
    candidateId,
    uploadId,
    parentName,
    position,
    name,
    linkedin
}: {
    candidateId: string
    uploadId: string
    parentName: string | null
    position: string
    name: string
    linkedin: string | null
}) {
    try {
        const { error } = await supabase
            .from('all_org_nodes')
            .insert({
                upload_id: uploadId,
                name: name,
                title: position,
                parent_name: parentName,
                matched_candidate_id: candidateId,
                linkedin: linkedin || null
            })

        if (error) throw error

        revalidatePath('/org-chart')
        revalidatePath(`/candidates/${candidateId}`)
        return { success: true }
    } catch (err: any) {
        console.error('[AssignCandidate] Error:', err)
        return { success: false, error: err.message }
    }
}

export async function getOrgChartNodesBrief(uploadId: string) {
    if (!uploadId) return []
    const { data, error } = await supabase
        .from('all_org_nodes')
        .select('name, title')
        .eq('upload_id', uploadId)
        .order('name', { ascending: true })
        
    if (error) {
        console.error('[GetNodesBrief] Error:', error)
        return []
    }
    return data 
}
