import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    const where: any = {};

    if (type && type !== 'ALL') {
      where.type = type;
    }

    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim() } },
        { message: { contains: search.trim() } },
      ];
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(
      { alerts },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, title, message, imageUrl, type, priority, duration, createdBy } = body;

    const alert = await prisma.alert.create({
      data: {
        id: id || crypto.randomUUID(),
        title,
        message,
        imageUrl: imageUrl || null,
        type: type || 'INFO',
        priority: priority || 'NORMAL',
        duration: duration ? parseInt(duration, 10) : 15,
        status: 'SENT',
        createdBy: createdBy || 'Admin',
      },
    });

    const io = (global as any).io;
    if (io) {
      io.emit('ALERT_CREATED', { alert });
    }

    return NextResponse.json({ success: true, alert });
  } catch (error) {
    console.error('Failed to create alert:', error);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}
