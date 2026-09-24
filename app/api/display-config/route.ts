import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await prisma.displayConfig.findUnique({
      where: { id: 'global' },
    });

    return NextResponse.json(
      {
        config: config || {
          showCountdown: true,
          showSchedule: true,
          showAlertCentre: true,
          showLogo: true,
          customAnnouncement: "",
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch display config' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { showCountdown, showSchedule, showAlertCentre, showLogo, customAnnouncement } = body;

    const updated = await prisma.displayConfig.upsert({
      where: { id: 'global' },
      create: {
        id: 'global',
        showCountdown: showCountdown ?? true,
        showSchedule: showSchedule ?? true,
        showAlertCentre: showAlertCentre ?? true,
        showLogo: showLogo ?? true,
        customAnnouncement: customAnnouncement ?? '',
      },
      update: {
        ...(showCountdown !== undefined && { showCountdown }),
        ...(showSchedule !== undefined && { showSchedule }),
        ...(showAlertCentre !== undefined && { showAlertCentre }),
        ...(showLogo !== undefined && { showLogo }),
        ...(customAnnouncement !== undefined && { customAnnouncement }),
      },
    });

    // Real-time broadcast to all End Screens
    const io = (global as any).io;
    if (io) {
      io.emit('DISPLAY_CONFIG_UPDATED', { config: updated });
    }

    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    console.error('Failed to update display config:', error);
    return NextResponse.json({ error: 'Failed to update display config' }, { status: 500 });
  }
}
