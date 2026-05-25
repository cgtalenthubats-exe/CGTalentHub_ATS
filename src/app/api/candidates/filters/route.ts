import { NextResponse } from 'next/server';
import { adminAuthClient } from '@/lib/supabase/admin';

export async function GET() {
    try {
        // Limit fetching to prevent massive timeouts, but enough for demo
        const limit = 20000;

        // 1. Fetch from 'candidate_experiences'
        // Columns: company, position, country, company_industry, company_group
        // NOTE: We only need distinct countries, industries, groups from here now. 
        // Company and Position are handled via Async Search.
        const { data: expData, error: expError } = await adminAuthClient
            .from('candidate_experiences')
            .select('country, company_industry, company_group')
            .limit(limit);

        if (expError) {
            console.error("Error fetching experience filters:", expError);
            // Don't throw, try to continue with empty
        }

        // 2. Fetch from 'Candidate Profile'
        // Columns: job_grouping, job_function, gender, candidate_status
        const { data: profileData, error: profError } = await adminAuthClient
            .from('Candidate Profile')
            .select('job_grouping, job_function, candidate_status, gender')
            .limit(limit);

        if (profError) {
            console.error("Error fetching profile filters:", profError);
        }

        // 3. Fetch from 'candidate_status_master'
        const { data: masterStatuses } = await adminAuthClient
            .from('candidate_status_master')
            .select('status');

        const uniqueMasterStatuses = masterStatuses ? masterStatuses.map(s => s.status) : [];

        // Helper to extract unique sorted values
        const getUnique = (data: any[] | null, key: string) => {
            if (!data) return [];
            return Array.from(new Set(data.map(item => item[key]).filter(val => val !== null && val !== undefined && val !== ""))).sort();
        };

        const response = {
            // From candidate_experiences
            countries: getUnique(expData, 'country'),
            industries: getUnique(expData, 'company_industry'),
            groups: getUnique(expData, 'company_group'),

            // From Candidate Profile
            jobGroupings: getUnique(profileData, 'job_grouping'),
            jobFunctions: getUnique(profileData, 'job_function'),
            genders: getUnique(profileData, 'gender'),

            // Status Master (Master Table + Existing in Candidates)
            // candidate_status is a string[] field — must flatMap to extract individual values
            statuses: Array.from(new Set([
                ...uniqueMasterStatuses,
                ...(profileData ?? []).flatMap(item => {
                    const s = item.candidate_status;
                    if (Array.isArray(s)) return s.filter(Boolean);
                    return s ? [s] : [];
                }),
            ])).filter(Boolean).sort(),

            // Mapping removed as it was too heavy
            // mapping: ...

            // companies: ... // REMOVED: Async
        };

        return NextResponse.json(response);
    } catch (error: any) {
        console.error("Filter API Critical Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

