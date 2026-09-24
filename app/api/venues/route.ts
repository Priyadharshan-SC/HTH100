import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const venues = await prisma.venue.findMany({
      orderBy: { venueCode: 'asc' },
    });

    const now = Date.now();
    const evaluatedVenues = venues.map((v: any) => {
      const lastUpdated = v.updatedAt ? new Date(v.updatedAt).getTime() : 0;
      const isRecent = (now - lastUpdated) < 45000;
      return {
        ...v,
        status: isRecent ? (v.status || 'ONLINE') : 'OFFLINE',
      };
    });

    return NextResponse.json({ venues: evaluatedVenues });
  } catch (error) {
    console.error('Failed to fetch venues:', error);
    return NextResponse.json({ error: 'Failed to fetch venues' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { venueCode, status = 'ONLINE' } = body;

    if (!venueCode) {
      return NextResponse.json({ error: 'venueCode is required' }, { status: 400 });
    }

    const updated = await prisma.venue.update({
      where: { venueCode },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    const io = (global as any).io;
    if (io) {
      io.emit('VENUE_UPDATED', { venueCode, status });
    }

    return NextResponse.json({ success: true, venue: updated });
  } catch (error) {
    console.error('Failed to record venue heartbeat:', error);
    return NextResponse.json({ error: 'Failed to record venue heartbeat' }, { status: 500 });
  }
}
