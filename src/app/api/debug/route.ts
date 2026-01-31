import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET() {
    const results: any = {
        env: {
            url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Loaded' : 'Missing',
            key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Loaded' : 'Missing',
        },
        tests: {}
    };

    // Test 1: Standard snake_case
    try {
        const { data, error } = await supabase.from('candidate_profile').select('*').limit(1);
        results.tests.snake_case = { success: !error, error: error?.message, count: data?.length };
    } catch (e: any) {
        results.tests.snake_case = { success: false, error: e.message };
    }

    // Test 2: Quoted Title Case (User's screenshot style)
    try {
        const { data, error } = await supabase.from('Candidate Profile').select('*').limit(1);
        results.tests.title_case = { success: !error, error: error?.message, count: data?.length };
    } catch (e: any) {
        results.tests.title_case = { success: false, error: e.message };
    }

    // Test 3: Quoted "Candidate_Profile"
    try {
        const { data, error } = await supabase.from('Candidate_Profile').select('*').limit(1);
        results.tests.pascal_snake_case = { success: !error, error: error?.message, count: data?.length };
    } catch (e: any) {
        results.tests.pascal_snake_case = { success: false, error: e.message };
    }

    return NextResponse.json(results);
}
