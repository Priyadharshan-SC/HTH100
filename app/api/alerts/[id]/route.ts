import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { title, message, type, priority, duration, status } = body;

    const updatedAlert = await prisma.alert.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(message !== undefined && { message }),
        ...(type !== undefined && { type }),
        ...(priority !== undefined && { priority }),
        ...(duration !== undefined && { duration: parseInt(duration, 10) }),
        ...(status !== undefined && { status }),
      },
    });

    const io = (global as any).io;
    if (io) {
      io.emit('ALERT_UPDATED', { alert: updatedAlert });
    }

    return NextResponse.json({ success: true, alert: updatedAlert });
  } catch (error) {
    console.error('Failed to update alert:', error);
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.alert.deleteMany({
      where: { id },
    });

    const io = (global as any).io;
    if (io) {
      io.emit('ALERT_DELETED', { id });
      io.emit('ALERT_ARCHIVED', { id });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Failed to delete alert:', error);
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
  }
}
