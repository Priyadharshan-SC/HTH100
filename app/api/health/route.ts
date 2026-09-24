import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;
  let venuesCount = 0;

  try {
    const t0 = Date.now();
    venuesCount = await prisma.venue.count();
    dbLatencyMs = Date.now() - t0;
  } catch (err) {
    dbStatus = 'unhealthy';
    console.error('Database health check failed:', err);
  }

  const io = (global as any).io;
  const connectedDisplaysMap = (global as any).connectedDisplays;
  const connectedDisplaysCount = connectedDisplaysMap ? connectedDisplaysMap.size : 0;

  const isHealthy = dbStatus === 'healthy' && !!io;

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        venuesCount,
      },
      realtime: {
        status: io ? 'connected' : 'disconnected',
        activeDisplaysCount: connectedDisplaysCount,
      },
      system: {
        nodeVersion: process.version,
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      responseLatencyMs: Date.now() - startTime,
    },
    { status: isHealthy ? 200 : 503 }
  );
}
