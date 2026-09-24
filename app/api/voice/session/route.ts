import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action = 'start', adminName = 'Admin', adminId = 'admin-1', channel = 'ALL', sessionId, isMuted } = body;

    const io = (global as any).io;

    const db = prisma as any;

    if (action === 'start') {
      // Check if an existing session is already active by another admin (within last 30 minutes)
      const existing = await db.voiceSession.findFirst({
        where: {
          status: { in: ['ACTIVE', 'MUTED'] },
          startedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
        },
        orderBy: { startedAt: 'desc' },
      });

      if (existing && existing.adminName && existing.adminName !== adminName) {
        return NextResponse.json({
          success: false,
          error: 'CONTROLLED_BY_ANOTHER_ADMIN',
          owner: existing.adminName,
        });
      }

      const activeSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // Clear any prior active sessions
      await db.voiceSession.updateMany({
        where: { status: { in: ['ACTIVE', 'MUTED'] } },
        data: { status: 'ENDED', endedAt: new Date() },
      });

      // Create new active session in Neon PostgreSQL
      const session = await db.voiceSession.create({
        data: {
          sessionId: activeSessionId,
          adminId,
          adminName,
          status: 'ACTIVE',
          roomName: 'hth-central-voice',
          channel,
          startedAt: new Date(),
        },
      });

      if (io) {
        io.emit('voice-session-started', { session });
        io.emit('VOICE_STARTED', { session });
      }

      return NextResponse.json({ success: true, session });
    }

    if (action === 'end') {
      await db.voiceSession.updateMany({
        where: { status: { in: ['ACTIVE', 'MUTED'] } },
        data: { status: 'ENDED', endedAt: new Date() },
      });

      if (io) {
        io.emit('voice-session-ended');
        io.emit('VOICE_ENDED');
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'mute') {
      const nextStatus = isMuted ? 'MUTED' : 'ACTIVE';
      await db.voiceSession.updateMany({
        where: { status: { in: ['ACTIVE', 'MUTED'] } },
        data: { status: nextStatus },
      });

      if (io) {
        io.emit('voice-mute-updated', { isMuted: !!isMuted });
        io.emit(isMuted ? 'VOICE_MUTED' : 'VOICE_UNMUTED', { isMuted: !!isMuted });
      }

      return NextResponse.json({ success: true, isMuted });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to manage voice session:', error);
    return NextResponse.json({ error: 'Failed to manage voice session' }, { status: 500 });
  }
}
