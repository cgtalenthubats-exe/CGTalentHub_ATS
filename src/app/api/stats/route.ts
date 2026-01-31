import { NextResponse } from 'next/server';
import { adminAuthClient } from '@/lib/supabase/admin';

export async function GET() {
    try {
        // 1. Get Candidate Count (Bypass RLS)
        const { count: candCount, error: candError } = await adminAuthClient
            .from('Candidate Profile')
            .select('*', { count: 'exact', head: true });

        if (candError) throw candError;

        // 2. Get Job Stats
        const { data: jobs, error: jobError } = await adminAuthClient
            .from('job_requisitions')
            .select('is_active');

        if (jobError) throw jobError;

        const active = jobs?.filter(j => j.is_active?.toLowerCase() === 'active').length || 0;
        const inactive = (jobs?.length || 0) - active;

        return NextResponse.json({
            totalCandidates: candCount || 0,
            activeJobs: active,
            inactiveJobs: inactive
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
