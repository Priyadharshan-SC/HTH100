import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function broadcastScheduleUpdate(io: any) {
  if (!io) return;
  try {
    const now = new Date();
    const currentEvent = await prisma.event.findFirst({
      where: {
        startTime: { lte: now },
        endTime: { gt: now },
      },
      orderBy: { priority: 'desc' },
    });

    const nextEvent = await prisma.event.findFirst({
      where: {
        startTime: { gt: now },
      },
      orderBy: { startTime: 'asc' },
    });

    const payload = {
      currentEvent: currentEvent || null,
      nextEvent: nextEvent || null,
      serverTime: now.toISOString(),
    };

    io.emit('SCHEDULE_UPDATED', payload);
    io.emit('events-updated', payload);
  } catch (err) {
    console.error('Error broadcasting schedule update:', err);
  }
}

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, startTime, endTime, status, priority } = body;

    const newEvent = await prisma.event.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: status || 'UPCOMING',
        priority: priority ? parseInt(priority, 10) : 0,
      },
    });

    const io = (global as any).io;
    if (io) {
      io.emit('EVENT_CREATED', { event: newEvent });
      await broadcastScheduleUpdate(io);
    }

    return NextResponse.json({ success: true, event: newEvent });
  } catch (error) {
    console.error('Failed to create event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, title, description, startTime, endTime, status, priority } = body;

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(startTime && { startTime: new Date(startTime) }),
        ...(endTime && { endTime: new Date(endTime) }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority: parseInt(priority, 10) }),
      },
    });

    const io = (global as any).io;
    if (io) {
      io.emit('EVENT_UPDATED', { event: updated });
      await broadcastScheduleUpdate(io);
    }

    return NextResponse.json({ success: true, event: updated });
  } catch (error) {
    console.error('Failed to update event:', error);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await prisma.event.deleteMany({
      where: { id },
    });

    const io = (global as any).io;
    if (io) {
      io.emit('EVENT_DELETED', { id });
      await broadcastScheduleUpdate(io);
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Failed to delete event:', error);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
