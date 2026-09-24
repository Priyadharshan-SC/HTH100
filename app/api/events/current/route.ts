import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    
    // Find current event
    const currentEvent = await prisma.event.findFirst({
      where: {
        startTime: { lte: now },
        endTime: { gt: now },
      },
      orderBy: { priority: 'desc' },
    });

    // Find next event
    const nextEvent = await prisma.event.findFirst({
      where: {
        startTime: { gt: now },
      },
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json({
      currentEvent,
      nextEvent,
      serverTime: now.toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
