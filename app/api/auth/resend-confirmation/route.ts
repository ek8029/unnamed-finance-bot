import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { confirmationUrl, safeNext } from '@/lib/checkout-intent';

/**
 * A fresh confirmation email for an address whose link expired or was opened
 * by a mail scanner before the person could. Answers the same whether or not
 * the address exists, so it cannot be used to enumerate accounts; Supabase
 * rate-limits the send per address on its side.
 */
export async function POST(request: Request) {
  let email = '';
  let next = '/dashboard';
  try {
    const body = await request.json() as { email?: unknown; next?: unknown };
    email = String(body.email ?? '').trim().toLowerCase();
    next = safeNext(typeof body.next === 'string' ? body.next : null);
  } catch {
    // fall through to the validation below
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 });
  }
  const origin = new URL(request.url).origin;
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: confirmationUrl(origin, next) },
  });
  if (error && !/rate limit|security purposes/i.test(error.message)) {
    console.error('[resend-confirmation]', error.message);
  }
  return NextResponse.json({ ok: true });
}
