import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function broadcastScheduleUpdate(io: any) {
  if (!io) return;
  try {
    const now = new Date();
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

    const nextEvent = await prisma.event.findFirst({
      where: {
        priority: { gte: 50 },
        startTime: { gt: now },
      },
      orderBy: { startTime: 'asc' },
    });

    const activeMilestone = await prisma.event.findFirst({
      where: {
        priority: { lt: 50 },
        startTime: { lte: now },
        endTime: { gt: now },
      },
      orderBy: { startTime: 'desc' },
    });

    const nextMilestone = await prisma.event.findFirst({
      where: {
        priority: { lt: 50 },
        startTime: { gt: now },
      },
      orderBy: { startTime: 'asc' },
    });

    const payload = {
      currentEvent: currentEvent || null,
      nextEvent: nextEvent || null,
      activeMilestone: activeMilestone || null,
      nextMilestone: nextMilestone || null,
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
    const io = (global as any).io;

    // Handle Seed/Reset to Official 24-25 September Timeline
    if (body.action === 'seed_official_timeline') {
      const timeline = [
        {
          title: "HACK THE HORIZON 2.0",
          description: "24-Hour National Hackathon",
          startTime: new Date("2026-09-24T10:00:00+05:30"),
          endTime: new Date("2026-09-25T12:30:00+05:30"),
          priority: 100,
        },
        {
          title: "Participant Registration & Check-in",
          description: "Registration desk open, kit distribution & badge check",
          startTime: new Date("2026-09-24T08:15:00+05:30"),
          endTime: new Date("2026-09-24T09:15:00+05:30"),
          priority: 1,
        },
        {
          title: "Inauguration Ceremony",
          description: "Welcome address, dignitaries speech & lighting the lamp",
          startTime: new Date("2026-09-24T09:15:00+05:30"),
          endTime: new Date("2026-09-24T09:50:00+05:30"),
          priority: 1,
        },
        {
          title: "Hackathon Briefing & Instructions",
          description: "Rules, evaluation criteria, mentor protocols & logistics briefing",
          startTime: new Date("2026-09-24T09:50:00+05:30"),
          endTime: new Date("2026-09-24T10:00:00+05:30"),
          priority: 1,
        },
        {
          title: "Hacking & Development - Phase 1",
          description: "Official hackathon begins. Architecture setup and foundational sprint",
          startTime: new Date("2026-09-24T10:00:00+05:30"),
          endTime: new Date("2026-09-24T13:00:00+05:30"),
          priority: 2,
        },
        {
          title: "Lunch",
          description: "Lunch break for all participants and mentors",
          startTime: new Date("2026-09-24T13:00:00+05:30"),
          endTime: new Date("2026-09-24T14:00:00+05:30"),
          priority: 1,
        },
        {
          title: "Hacking & Development - Phase 2",
          description: "Core feature development and API integrations",
          startTime: new Date("2026-09-24T14:00:00+05:30"),
          endTime: new Date("2026-09-24T16:45:00+05:30"),
          priority: 2,
        },
        {
          title: "Evening Snack",
          description: "Refreshment & evening tea break",
          startTime: new Date("2026-09-24T16:45:00+05:30"),
          endTime: new Date("2026-09-24T17:00:00+05:30"),
          priority: 1,
        },
        {
          title: "Hacking & Development - Phase 3",
          description: "Mentorship review round and module progress check",
          startTime: new Date("2026-09-24T17:00:00+05:30"),
          endTime: new Date("2026-09-24T19:30:00+05:30"),
          priority: 2,
        },
        {
          title: "Dinner",
          description: "Dinner break & recharge session",
          startTime: new Date("2026-09-24T19:30:00+05:30"),
          endTime: new Date("2026-09-24T20:30:00+05:30"),
          priority: 1,
        },
        {
          title: "Hacking & Development - Phase 4",
          description: "Deep work session & advanced algorithm integration",
          startTime: new Date("2026-09-24T20:30:00+05:30"),
          endTime: new Date("2026-09-25T00:30:00+05:30"),
          priority: 2,
        },
        {
          title: "Night Snack",
          description: "Midnight energy snacks and hot beverages",
          startTime: new Date("2026-09-25T00:30:00+05:30"),
          endTime: new Date("2026-09-25T01:00:00+05:30"),
          priority: 1,
        },
        {
          title: "Hacking & Development - Night Session",
          description: "Overnight hack sprint and prototype refinement",
          startTime: new Date("2026-09-25T01:00:00+05:30"),
          endTime: new Date("2026-09-25T04:00:00+05:30"),
          priority: 2,
        },
        {
          title: "Final Development, Testing & Integration",
          description: "Bug fixing, QA validation, and edge case resolution",
          startTime: new Date("2026-09-25T04:00:00+05:30"),
          endTime: new Date("2026-09-25T05:30:00+05:30"),
          priority: 2,
        },
        {
          title: "Early Morning Snack",
          description: "Morning coffee and light refreshments",
          startTime: new Date("2026-09-25T05:30:00+05:30"),
          endTime: new Date("2026-09-25T06:00:00+05:30"),
          priority: 1,
        },
        {
          title: "Final Development, Testing & Integration",
          description: "Deployment, code freeze preparation, and presentation decks",
          startTime: new Date("2026-09-25T06:00:00+05:30"),
          endTime: new Date("2026-09-25T07:30:00+05:30"),
          priority: 2,
        },
        {
          title: "Breakfast",
          description: "Morning breakfast and preparation for evaluation",
          startTime: new Date("2026-09-25T07:30:00+05:30"),
          endTime: new Date("2026-09-25T08:30:00+05:30"),
          priority: 1,
        },
        {
          title: "Final Evaluation",
          description: "Jury presentation, live demo evaluation & scorecards",
          startTime: new Date("2026-09-25T08:45:00+05:30"),
          endTime: new Date("2026-09-25T12:30:00+05:30"),
          priority: 3,
        },
        {
          title: "HACKATHON ENDS",
          description: "Closing ceremony, winner announcements & felicitations",
          startTime: new Date("2026-09-25T12:30:00+05:30"),
          endTime: new Date("2026-09-25T13:30:00+05:30"),
          priority: 3,
        },
      ];

      await prisma.event.deleteMany();
      for (const item of timeline) {
        await prisma.event.create({
          data: {
            title: item.title,
            description: item.description,
            startTime: item.startTime,
            endTime: item.endTime,
            status: "UPCOMING",
            priority: item.priority,
          },
        });
      }

      if (io) {
        await broadcastScheduleUpdate(io);
      }

      return NextResponse.json({ success: true, count: timeline.length });
    }

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
