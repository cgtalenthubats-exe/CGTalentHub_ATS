import { NextResponse } from 'next/server';
import { adminAuthClient } from '@/lib/supabase/admin';

export async function GET() {
    try {
        // Limit fetching to prevent massive timeouts, but enough for demo
        const limit = 20000;

        // 1. Fetch from 'candidate_experiences'
        // Columns: company, position, country, company_industry, company_group
        const { data: expData, error: expError } = await adminAuthClient
            .from('candidate_experiences')
            .select('company, position, country, company_industry, company_group')
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

        // Helper to extract unique sorted values
        const getUnique = (data: any[] | null, key: string) => {
            if (!data) return [];
            return Array.from(new Set(data.map(item => item[key]).filter(val => val !== null && val !== undefined && val !== ""))).sort();
        };

        const response = {
            // From candidate_experiences
            companies: getUnique(expData, 'company'),
            positions: getUnique(expData, 'position'), // Requested Position Filter
            countries: getUnique(expData, 'country'),
            industries: getUnique(expData, 'company_industry'),
            groups: getUnique(expData, 'company_group'),

            // From Candidate Profile
            jobGroupings: getUnique(profileData, 'job_grouping'),
            jobFunctions: getUnique(profileData, 'job_function'),
            genders: getUnique(profileData, 'gender'),
            statuses: getUnique(profileData, 'candidate_status'),

            // Mapping for dependencies (Country -> Company connection)
            mapping: expData ? expData.map(e => ({
                country: e.country,
                company: e.company,
                industry: e.company_industry,
                group: e.company_group
            })) : []
        };

        return NextResponse.json(response);
    } catch (error: any) {
        console.error("Filter API Critical Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
