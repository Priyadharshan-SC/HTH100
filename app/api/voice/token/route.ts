import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { role = 'DISPLAY', identity, name, roomName = 'hth-central-voice', token: sessionToken } = body;

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: 'LiveKit server credentials not configured on backend.' },
        { status: 500 }
      );
    }

    if (!identity) {
      return NextResponse.json({ error: 'Identity is required' }, { status: 400 });
    }

    const isAdmin = role === 'ADMIN';

    // Verify admin identity and session token
    if (isAdmin) {
      if (sessionToken) {
        try {
          const decoded = JSON.parse(Buffer.from(sessionToken, 'base64').toString());
          if (decoded.role !== 'ADMIN' || decoded.expiresAt < Date.now()) {
            return NextResponse.json({ error: 'Invalid or expired admin session token' }, { status: 401 });
          }
        } catch {
          return NextResponse.json({ error: 'Malformed session token' }, { status: 401 });
        }
      }
    }

    // Short-lived JWT token (1 hour)
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: name || identity,
      ttl: '1h',
    });

    if (isAdmin) {
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canPublishData: true,
        canSubscribe: false, // Admin only publishes microphone
      });
    } else {
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: false, // End Screen strictly receives only
        canPublishData: false,
        canSubscribe: true,
      });
    }

    const jwt = await at.toJwt();

    return NextResponse.json({
      success: true,
      token: jwt,
      roomName,
      wsUrl: livekitUrl,
    });
  } catch (error) {
    console.error('Failed to generate LiveKit token:', error);
    return NextResponse.json({ error: 'Failed to mint LiveKit access token' }, { status: 500 });
  }
}
