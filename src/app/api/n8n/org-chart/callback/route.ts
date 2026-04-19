import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client (Service Role for backend ops)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * API Endpoint: /api/n8n/org-chart/callback
 * Purpose: Allows the n8n OrgChart workflow to notify the app when processing is finished.
 * It updates the status in org_chart_uploads to 'Completed'.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { upload_id, status = 'Completed' } = body;

        console.log(`[OrgChart-Callback] Updating Upload ID: ${upload_id} to status: ${status}`);

        if (!upload_id) {
            return NextResponse.json({ error: 'Missing upload_id' }, { status: 400 });
        }

        // Update the status in the database
        const { error } = await supabase
            .from('org_chart_uploads')
            .update({ 
                status: status,
                modify_date: new Date().toISOString()
            })
            .eq('upload_id', upload_id);

        if (error) {
            console.error('[OrgChart-Callback] DB Update Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Status updated to ${status} for upload ${upload_id}`
        });

    } catch (error: any) {
        console.error("[OrgChart-Callback] API Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
