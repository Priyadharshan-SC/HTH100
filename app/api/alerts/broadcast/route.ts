import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      title,
      message,
      imageUrl,
      type,
      priority,
      duration,
      targetType = 'ALL',
      targetVenues = 'ALL',
      targetDisplay,
    } = body;

    const normalizedTargetVenues = Array.isArray(targetVenues)
      ? targetVenues.join(',')
      : targetVenues || 'ALL';

    const nowTime = new Date();

    // Save or update in Database
    const alert = await prisma.alert.upsert({
      where: { id: id || crypto.randomUUID() },
      create: {
        id: id || crypto.randomUUID(),
        title,
        message,
        imageUrl: imageUrl || null,
        type: type || 'INFO',
        priority: priority || 'NORMAL',
        duration: duration ? parseInt(duration, 10) : 15,
        status: 'SENT',
        targetType: targetType || 'ALL',
        targetVenues: normalizedTargetVenues,
        createdAt: nowTime,
        updatedAt: nowTime,
      },
      update: {
        title,
        message,
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        type: type || 'INFO',
        priority: priority || 'NORMAL',
        duration: duration ? parseInt(duration, 10) : 15,
        status: 'SENT',
        targetType: targetType || 'ALL',
        targetVenues: normalizedTargetVenues,
        createdAt: nowTime,
        updatedAt: nowTime,
      },
    });

    // Server-Side Audience Targeting Broadcast via global Socket.io instance
    const io = (global as any).io;
    if (io) {
      // 1. Notify Admin Portal / Monitor
      io.emit('ALERT_CREATED', { alert });

      if (targetType === 'ALL') {
        // Emit to all smart boards
        io.to('all-displays').emit('new-alert', alert);
        io.to('all-displays').emit('ALERT_BROADCASTED', { alert });
      } else if (targetType === 'VENUE') {
        // Emit only to selected venue rooms
        const venues = normalizedTargetVenues.split(',').map((v: string) => v.trim()).filter(Boolean);
        venues.forEach((v: string) => {
          io.to(`venue:${v}`).emit('new-alert', alert);
          io.to(`venue:${v}`).emit('ALERT_BROADCASTED', { alert });
        });
      } else if (targetType === 'DISPLAY') {
        // Emit to specific display room (e.g., VENUE-01:DISPLAY-01)
        if (targetDisplay) {
          io.to(`display:${targetDisplay}`).emit('new-alert', alert);
          io.to(`display:${targetDisplay}`).emit('ALERT_BROADCASTED', { alert });
        }
      }
    } else {
      console.warn('Socket.io instance not found on global object. Is server.js running?');
    }

    return NextResponse.json({ success: true, alert });
  } catch (error) {
    console.error('Failed to broadcast alert:', error);
    return NextResponse.json({ error: 'Failed to broadcast alert' }, { status: 500 });
  }
}
