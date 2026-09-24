import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    
    // 1. Find main grand event (priority >= 50 or highest priority) for main timer
    let currentEvent = await prisma.event.findFirst({
      where: {
        priority: { gte: 50 },
        startTime: { lte: now },
        endTime: { gt: now },
      },
      orderBy: { priority: 'desc' },
    });

    if (!currentEvent) {
      currentEvent = await prisma.event.findFirst({
        where: {
          startTime: { lte: now },
          endTime: { gt: now },
        },
        orderBy: { priority: 'desc' },
      });
    }

    // 2. Find next main event
    const nextEvent = await prisma.event.findFirst({
      where: {
        priority: { gte: 50 },
        startTime: { gt: now },
      },
      orderBy: { startTime: 'asc' },
    });

    // 3. Find active timeline milestone (priority < 50)
    const activeMilestone = await prisma.event.findFirst({
      where: {
        priority: { lt: 50 },
        startTime: { lte: now },
        endTime: { gt: now },
      },
      orderBy: { startTime: 'desc' },
    });

    // 4. Find next timeline milestone (priority < 50)
    const nextMilestone = await prisma.event.findFirst({
      where: {
        priority: { lt: 50 },
        startTime: { gt: now },
      },
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json({
      currentEvent,
      nextEvent,
      activeMilestone,
      nextMilestone,
      serverTime: now.toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
