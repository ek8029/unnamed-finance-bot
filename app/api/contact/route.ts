import { NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { resend, FROM_EMAIL } from '@/lib/emails/resend';

export async function POST(request: Request) {
  try {
    // Rate limit: 3 per hour per IP
    const ip = getClientIP(request);
    const { allowed, retryAfterSeconds } = rateLimit(`contact:${ip}`, 3, 3600);

    if (!allowed) {
      return NextResponse.json(
        { error: `Too many messages. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.` },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { name, email, message } = body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return NextResponse.json(
        { error: 'Message must be at least 10 characters.' },
        { status: 400 },
      );
    }

    const trimmedName = name.trim();
    const trimmedMessage = message.trim();

    // Send via Resend
    if (!resend) {
      console.error('Contact form: Resend not configured (missing RESEND_API_KEY)');
      return NextResponse.json({ error: 'Email service unavailable.' }, { status: 503 });
    }

    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: 'support@helmterminal.dev',
      replyTo: trimmedEmail,
      subject: `[Helm Contact] from ${trimmedName}`,
      text: [
        `Name: ${trimmedName}`,
        `Email: ${trimmedEmail}`,
        '',
        trimmedMessage,
      ].join('\n'),
    });

    if (sendError) {
      console.error('Contact form send error:', sendError);
      return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
