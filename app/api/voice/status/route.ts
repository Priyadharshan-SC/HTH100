import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = prisma as any;
    const activeSession = await db.voiceSession.findFirst({
      where: {
        status: { in: ['ACTIVE', 'MUTED'] },
      },
      orderBy: { startedAt: 'desc' },
    });

    return NextResponse.json({
      active: !!activeSession,
      session: activeSession || null,
    });
  } catch (error) {
    console.error('Failed to get voice status:', error);
    return NextResponse.json({ active: false, session: null }, { status: 500 });
  }
}
