import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
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

    const db = prisma as any;
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

    const db = prisma as any;

    if (latestOnly) {
      // Find voice note created within the last 45 seconds
      const recentThreshold = new Date(Date.now() - 45 * 1000);
      const latest = await db.voiceNote.findFirst({
        where: {
          createdAt: { gte: recentThreshold },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ latest: latest || null });
    }

    // Return the 10 most recent voice notes
    const voiceNotes = await db.voiceNote.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        mimeType: true,
        duration: true,
        targetVenues: true,
        adminName: true,
        createdAt: true,
        // omit audioData for list queries to keep payload lightweight
      },
    });

    return NextResponse.json({ voiceNotes });
  } catch (error) {
    console.error('Failed to fetch voice notes:', error);
    return NextResponse.json({ error: 'Failed to fetch voice notes' }, { status: 500 });
  }
}
