import { NextRequest, NextResponse } from 'next/server';
import { getPendingUploads } from '@/app/actions/resume-actions';

export const dynamic = 'force-dynamic'; // Ensure not cached

export async function GET(req: NextRequest) {
    // Optional: Add API Key security here if needed
    // const authHeader = req.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({error: 'Unauthorized'}, {status: 401});

    const result = await getPendingUploads();

    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Limit to 5 for batch processing
    const pending = result.data ? result.data.slice(0, 5) : [];

    return NextResponse.json({
        count: pending.length,
        tasks: pending
    });
}
