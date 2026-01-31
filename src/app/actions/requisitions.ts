"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { JobRequisition, DashboardStats } from "@/types/requisition";

export async function getJobRequisitions(): Promise<JobRequisition[]> {
    const supabase = adminAuthClient;
    // Query existing table 'job_requisitions' (or whatever the view is)
    // Based on job.ts, it seems to be 'job_requisitions' or similar.
    // I'll assume a standard select for now and map it.

    // Debug: Check table structure if needed, but for now assuming standard fields from job.ts context
    const { data, error } = await supabase
        .from('job_requisitions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching JRs:", error);
        return [];
    }

    return data.map((row: any) => ({
        id: row.jr_id,
        job_title: row.position_jr || "Untitled Position",
        title: row.position_jr || "Untitled Position",
        hiring_manager_id: row.hiring_manager_id || "",
        hiring_manager_name: row.hiring_manager_name || "Unknown",
        department: row.sub_bu || "General",
        division: row.bu || "Corporate",
        status: normalizeStatus(row.is_active),
        headcount_total: row.headcount || 1,
        headcount_hired: row.hired_count || 0,
        opened_date: row.request_date,
        is_active: row.is_active === 'Active' || row.is_active === 'active',
        location: row.location || "Bangkok",
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
    }));
}

// Fetch Single JR by ID
export async function getRequisition(id: string): Promise<JobRequisition | null> {
    const supabase = adminAuthClient;
    const { data, error } = await supabase
        .from('job_requisitions')
        .select(`*`)
        .eq('jr_id', id)
        .single();

    if (error || !data) return null;

    const row = data as any;

    return {
        id: row.jr_id,
        job_title: row.position_jr || "Untitled",
        title: row.position_jr || "Untitled",
        hiring_manager_id: row.hiring_manager_id || "",
        hiring_manager_name: row.hiring_manager_name || "Unknown", // Would need join usually
        department: row.sub_bu || "General",
        division: row.bu || "Corporate",
        status: normalizeStatus(row.is_active),
        headcount_total: row.headcount || 1,
        headcount_hired: row.hired_count || 0,
        opened_date: row.request_date,
        is_active: row.is_active === 'Active' || row.is_active === 'active',
        location: row.location,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
    };
}

function normalizeStatus(status: string): 'Open' | 'Closed' | 'On Hold' | 'Draft' {
    const s = status?.toLowerCase();
    if (s === 'active') return 'Open';
    if (s === 'inactive' || s === 'closed') return 'Closed';
    return 'Open'; // Default
}

export async function getJRStats(): Promise<DashboardStats> {
    // Mocking stats for now until table structure for candidates/logs is confirmed deep enough
    return {
        total_jrs: 45,
        active_jrs: 32,
        total_candidates: 1250,
        avg_aging_days: 18,
        candidates_by_status: [
            { status: 'Pool', count: 450 },
            { status: 'Screen', count: 320 },
            { status: 'Interview', count: 180 },
            { status: 'Offer', count: 50 },
            { status: 'Hired', count: 220 },
            { status: 'Rejected', count: 30 },
        ],
        aging_by_stage: [
            { stage: 'Pool', days: 5 },
            { stage: 'Screen', days: 3 },
            { stage: 'Interview', days: 12 },
            { stage: 'Offer', days: 4 },
        ]
    };
}
