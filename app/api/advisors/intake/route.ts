import { NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { resend, FROM_EMAIL } from '@/lib/emails/resend';

// Advisor research intake (/advisors). Same shape as /api/contact: rate
// limit, validate, forward via Resend.
export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const { allowed, retryAfterSeconds } = rateLimit(`advisor-intake:${ip}`, 3, 3600);

    if (!allowed) {
      return NextResponse.json(
        { error: `Too many submissions. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.` },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { name, email, firm, note, website } = body;

    // Honeypot: real people never fill the hidden field. Pretend success.
    if (typeof website === 'string' && website.trim().length > 0) {
      return NextResponse.json({ success: true });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    const trimmedName = name.trim().slice(0, 200);
    const trimmedFirm = typeof firm === 'string' ? firm.trim().slice(0, 300) : '';
    const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 2000) : '';

    if (!resend) {
      console.error('Advisor intake: Resend not configured (missing RESEND_API_KEY)');
      return NextResponse.json({ error: 'Email service unavailable.' }, { status: 503 });
    }

    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: 'evan@helmterminal.dev',
      replyTo: trimmedEmail,
      subject: `[Advisor Intake] ${trimmedName}${trimmedFirm ? ` · ${trimmedFirm}` : ''}`,
      text: [
        `Name: ${trimmedName}`,
        `Email: ${trimmedEmail}`,
        `Firm & role: ${trimmedFirm || '(not given)'}`,
        '',
        'What they cannot see:',
        trimmedNote || '(not given)',
      ].join('\n'),
    });

    if (sendError) {
      console.error('Advisor intake send error:', sendError);
      return NextResponse.json({ error: 'Failed to send. Try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Advisor intake error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
