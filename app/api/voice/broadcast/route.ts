import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = prisma as any;

    // Handle Re-dispatch of an existing voice note
    if (body.action === 'redispatch') {
      const { id, targetVenues, adminName } = body;
      if (!id) {
        return NextResponse.json({ error: 'Missing voice note ID for re-dispatch' }, { status: 400 });
      }

      const original = await db.voiceNote.findUnique({
        where: { id },
      });

      if (!original) {
        return NextResponse.json({ error: 'Voice note not found' }, { status: 404 });
      }

      const venuesString = targetVenues
        ? Array.isArray(targetVenues)
          ? targetVenues.join(',')
          : targetVenues
        : original.targetVenues;

      // Create a fresh broadcast instance so End Screens receive a new ID and current timestamp
      const redispatched = await db.voiceNote.create({
        data: {
          title: original.title,
          audioData: original.audioData,
          mimeType: original.mimeType,
          duration: original.duration,
          targetVenues: venuesString,
          adminName: adminName || original.adminName || 'Admin',
        },
      });

      // Broadcast in real-time
      const io = (global as any).io;
      if (io) {
        io.emit('VOICE_NOTE_BROADCAST', redispatched);
        io.emit('voice-note-broadcast', redispatched);
      }

      return NextResponse.json({ success: true, voiceNote: redispatched });
    }

    // Standard new voice note dispatch
    const {
      audioData,
      mimeType = 'audio/webm',
      duration = 0,
      targetVenues = 'ALL',
      title = 'Central Voice Note',
      adminName = 'Admin',
    } = body;

    if (!audioData) {
      return NextResponse.json({ error: 'Missing audioData payload' }, { status: 400 });
    }

    const venuesString = Array.isArray(targetVenues) ? targetVenues.join(',') : targetVenues;

    const voiceNote = await db.voiceNote.create({
      data: {
        title,
        audioData,
        mimeType,
        duration: Number(duration) || 0,
        targetVenues: venuesString,
        adminName,
      },
    });

    // Notify connected Smart Boards in real-time
    const io = (global as any).io;
    if (io) {
      io.emit('VOICE_NOTE_BROADCAST', voiceNote);
      io.emit('voice-note-broadcast', voiceNote);
    }

    return NextResponse.json({ success: true, voiceNote });
  } catch (error) {
    console.error('Failed to broadcast voice note:', error);
    return NextResponse.json({ error: 'Failed to broadcast voice note' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const latestOnly = searchParams.get('latest') === 'true';
    const singleId = searchParams.get('id');

    const db = prisma as any;

    // Fetch single voice note by ID (includes audioData for audio preview)
    if (singleId) {
      const voiceNote = await db.voiceNote.findUnique({
        where: { id: singleId },
      });
      if (!voiceNote) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ voiceNote });
    }

    if (latestOnly) {
      // Find voice note created within the last 45 seconds
      const recentThreshold = new Date(Date.now() - 45 * 1000);
      const latest = await db.voiceNote.findFirst({
        where: {
          createdAt: { gte: recentThreshold },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(
        { latest: latest || null },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
      );
    }

    // Return the 15 most recent voice notes (lightweight list query)
    const voiceNotes = await db.voiceNote.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        mimeType: true,
        duration: true,
        targetVenues: true,
        adminName: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { voiceNotes },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch voice notes:', error);
    return NextResponse.json({ error: 'Failed to fetch voice notes' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch (_) {}
    }

    if (!id) {
      return NextResponse.json({ error: 'Voice note ID is required' }, { status: 400 });
    }

    const db = prisma as any;
    await db.voiceNote.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Failed to delete voice note:', error);
    return NextResponse.json({ error: 'Failed to delete voice note' }, { status: 500 });
  }
}
