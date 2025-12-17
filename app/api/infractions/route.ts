import { fetchInfractions } from '@/lib/infractions';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const infractions = await fetchInfractions();
    return NextResponse.json(infractions);
}
