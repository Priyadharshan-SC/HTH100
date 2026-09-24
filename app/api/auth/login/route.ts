import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    const validEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@hth.com';
    const validPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    if (email.trim().toLowerCase() === validEmail.trim().toLowerCase() && password === validPassword) {
      const sessionToken = Buffer.from(
        JSON.stringify({
          email: validEmail,
          role: 'ADMIN',
          issuedAt: Date.now(),
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        })
      ).toString('base64');

      return NextResponse.json({
        success: true,
        token: sessionToken,
        user: {
          email: validEmail,
          name: 'Command Centre Admin',
          role: 'ADMIN',
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid credentials. Please verify your admin username and password.' },
      { status: 401 }
    );
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Authentication service error' }, { status: 500 });
  }
}
