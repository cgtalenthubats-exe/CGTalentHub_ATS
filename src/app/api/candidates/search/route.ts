import { NextResponse } from 'next/server';
import { adminAuthClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
    try {
        const { filters, page = 1, pageSize = 20, search } = await req.json();
        const offset = (page - 1) * pageSize;

        // Check if any "Experience Level" filters are applied
        const hasExperienceFilters =
            filters?.country?.length > 0 ||
            filters?.company?.length > 0 ||
            filters?.industry?.length > 0 ||
            filters?.group?.length > 0 ||
            filters?.position?.length > 0 ||
            (filters?.isCurrent !== undefined);

        let profileQuery = adminAuthClient
            .from('Candidate Profile')
            .select('*', { count: 'exact' });

        // --- APPLY PROFILE FILTERS ---
        // --- SEARCH LOGIC ---
        let searchCandidateIds: string[] = [];

        if (search) {
            // 1. Search in Profile (Name, Email, ID)
            profileQuery = profileQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%,candidate_id.ilike.%${search}%`);

            // 2. Search in Experiences (Company, Position) - Added per user request
            // We need to find IDs that match the search term in experiences
            const { data: expSearchMatches, error: expSearchError } = await adminAuthClient
                .from('candidate_experiences')
                .select('candidate_id')
                .or(`company.ilike.%${search}%,position.ilike.%${search}%`)
                .limit(5000);

            if (!expSearchError && expSearchMatches && expSearchMatches.length > 0) {
                const ids = expSearchMatches.map((e: any) => e.candidate_id);
                // We want to OR this with the profile query. 
                // However, Supabase .or() works better on columns within the same table.
                // Mixing OR updates across tables is tricky.
                // STRATEGY: 
                // If search finds matches in experiences, we ADD those IDs to the profile query explicitly?
                // OR logically: (Profile Match) OR (ID in Experience Matches)

                // Let's try combining logic:
                // Since we can't easily do a cross-table OR in a single .from('Candidate Profile') call efficiently without a join view,
                // We will collect the IDs from Experience search and use an `.or()` on candidate_id with the profile attributes.

                // Construct OR filter: name ILIKE.. or email ILIKE.. or candidate_id IN (...)
                // But `candidate_id.in` isn't directly compatible inside an `.or()` string syntax usually.

                // SIMPLER STRATEGY: 
                // If we found experience matches, we add their IDs to a list.
                // Then we query Profile where (Name match OR Email match ... OR candidate_id in list)

                // Limitation: .or() string doesn't support an array IN check easily.
                // Alternative: We fetch matching Profile IDs first? No.

                // Working Approach for OR with external IDs:
                // We can't easily modify the existing `profileQuery` variable which is a strict builder.
                // Instead, we might need to modify how we build `profileQuery`.

                searchCandidateIds = ids;
            }
        }

        // Apply Search Filter with Experience IDs support
        if (search) {
            let orString = `name.ilike.%${search}%,email.ilike.%${search}%,candidate_id.ilike.%${search}%`;

            if (searchCandidateIds.length > 0) {
                // Creating a massive OR string with IDs is risky if too many.
                // If IDs < 100, we can do `candidate_id.in.(${ids})`.
                // If IDs are many, this strategy is hard.

                // Better: If we have experience matches, strict filtering becomes ambiguous.
                // "Search" usually means Partial Match.

                // Let's try this: 
                // If we found IDs from experience search, we add `candidate_id.in.(${searchCandidateIds.join(',')})` to the OR group?
                // Supabase PostgREST: `or=(col.eq.val,col2.in.(val1,val2))`

                // However, safely joining many IDs into a query string is not ideal.

                // Fallback: If exp matches found, we relax the profile query to include them?
                // or maybe we execute two queries and merge? (Pagination pain)

                // Let's stick effectively to: Filter Profile matching text OR ID is in [ExpMatches].
                if (searchCandidateIds.length > 0) {
                    // Note: syntax `candidate_id.in.("id1","id2")`
                    // We limit to top 100 matches from experience to prevent URL overflow.
                    const limitedIds = searchCandidateIds.slice(0, 100);
                    const idList = limitedIds.map(id => `"${id}"`).join(',');
                    orString += `,candidate_id.in.(${idList})`;
                }
            }

            profileQuery = profileQuery.or(orString);
        }
        if (filters?.gender?.length) profileQuery = profileQuery.in('gender', filters.gender);
        if (filters?.status?.length) profileQuery = profileQuery.in('candidate_status', filters.status);
        if (filters?.jobGrouping?.length) profileQuery = profileQuery.in('job_grouping', filters.jobGrouping);
        if (filters?.jobFunction?.length) profileQuery = profileQuery.in('job_function', filters.jobFunction);
        if (filters?.ageMin) profileQuery = profileQuery.gte('age', filters.ageMin);
        if (filters?.ageMax) profileQuery = profileQuery.lte('age', filters.ageMax);

        // --- Aging Group Filter ---
        if (filters?.agingGroup) {
            const now = new Date();
            const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
            const d90 = new Date(now); d90.setDate(d90.getDate() - 90);
            const d180 = new Date(now); d180.setDate(d180.getDate() - 180);

            // Migration completed: modify_date is now ISO 8601 string.
            // Direct comparison works correctly.
            const field = 'modify_date';

            if (filters.agingGroup === 'fresh') {
                profileQuery = profileQuery.gt(field, d30.toISOString());
            } else if (filters.agingGroup === '1-3m') {
                profileQuery = profileQuery.lte(field, d30.toISOString()).gt(field, d90.toISOString());
            } else if (filters.agingGroup === '4-6m') {
                profileQuery = profileQuery.lte(field, d90.toISOString()).gt(field, d180.toISOString());
            } else if (filters.agingGroup === '6m+') {
                profileQuery = profileQuery.lte(field, d180.toISOString());
            }
        }

        // --- STRATEGY SWITCH ---

        if (hasExperienceFilters) {
            // STRATEGY A: Experience Filters Applied
            // We must first find candidates who match the experience criteria
            // Note: For large datasets, this linking should be done via a View or RPC. 
            // Note: For large datasets, this linking should be done via a View or RPC.
            // For 25k rows, we can fetch matching IDs.

            // STRATEGY: Find matching IDs from experiences first
            let expQuery = adminAuthClient
                .from('candidate_experiences')
                .select('candidate_id'); // We need ALL matches to correct count? No, just IDs.

            if (filters.position?.length) expQuery = expQuery.in('position', filters.position);
            if (filters.company?.length) expQuery = expQuery.in('company', filters.company);
            if (filters.country?.length) expQuery = expQuery.in('country', filters.country);
            if (filters.industry?.length) expQuery = expQuery.in('company_industry', filters.industry);
            if (filters.group?.length) expQuery = expQuery.in('company_group', filters.group);

            // Increase limit to scan more experiences (Supabase default is 1000)
            // Warning: This is not scalable to millions, but fine for 25k.
            // We limit to 5000 matches for now to prevent timeout, or use range if needed.
            // Get unique IDs (limit 10000 to be safe, or use a better strategy for huge datasets)
            const { data: expMatches, error: expError } = await expQuery.limit(10000);

            if (expError) throw expError;

            const candidateIds = Array.from(new Set((expMatches as any)?.map((e: any) => e.candidate_id) || []));

            if (candidateIds.length === 0) {
                return NextResponse.json({ data: [], total: 0, page, pageSize });
            }

            // Apply ID filter to Profile Query
            profileQuery = profileQuery.in('candidate_id', candidateIds);
        }

        // --- EXECUTE PAGINATED PROFILE QUERY ---
        // Now running the final query on Profiles (either filtered by IDs from Exp, or just raw Profile filters)
        // User Request: Sort by candidate_id ASC (numeric string C00001...)
        const { data: profiles, count, error: profileError } = await profileQuery
            .range(offset, offset + pageSize - 1)
            .order('candidate_id', { ascending: true }); // Changed to ASC // Show recently modified first

        if (profileError) throw profileError;

        // --- HYDRATE EXPERIENCES ---
        // Fetch experiences ONLY for the displayed page of candidates
        const pageCandidateIds = (profiles as any)?.map((p: any) => p.candidate_id) || [];

        const fullExpQuery = adminAuthClient
            .from('candidate_experiences')
            .select('*')
            .in('candidate_id', pageCandidateIds)
            .order('start_date', { ascending: false });

        // Optional: If we want to highlight "matching" experiences vs "all", we could do logic here.
        // For now, return ALL experiences for the candidate so the timeline is complete.

        const { data: fullExp, error: fullExpError } = await fullExpQuery;
        if (fullExpError) throw fullExpError;
        // Merge Profile Data
        const finalResults = (profiles as any).map((p: any) => ({
            ...p,
            candidate_id: p.candidate_id, // Ensure explicit mapping
            match_score: 0, // Simplified for now
            skills_match: [],
            experiences: (fullExp as any)?.filter((e: any) => e.candidate_id === p.candidate_id) || []
        }));

        return NextResponse.json({
            data: finalResults,
            total: count
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
