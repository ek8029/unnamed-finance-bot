import { NextResponse } from 'next/server';
import { subscribeWatch } from '@/lib/watch';
import { checkSignupRateLimits } from '@/lib/signup-protection';
import { extractEmailDomain } from '@/lib/email-validation';

export async function POST(request: Request) {
  let body: { email?: unknown; tickers?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email : '';
  const tickers = Array.isArray(body.tickers) ? body.tickers.map(String) : [];
  if (!email || tickers.length === 0) {
    return NextResponse.json({ error: 'Email and at least one ticker required' }, { status: 400 });
  }

  // Reuse the signup rate-limit chain (IP + domain + global); fails open in dev.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const domain = extractEmailDomain(email) ?? 'unknown';
  const rl = await checkSignupRateLimits({ ip, emailDomain: domain });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  const result = await subscribeWatch(email, tickers);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
