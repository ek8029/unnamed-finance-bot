// One-click email unsubscribe, HMAC-signed so a logged-out click is trustworthy
// without storing a per-user token. The link carries the user id + kind + a
// signature; the route recomputes the signature to authorize the opt-out.
import { createHmac } from 'crypto';

export type UnsubKind = 'brief' | 'market' | 'weekly' | 'all';

// Server-only secret. CRON_SECRET is always set in prod (the cron won't run
// without it) and never ships to the client.
function secret(): string {
  return process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'insecure-dev-secret';
}

export function signUnsub(userId: string, kind: UnsubKind): string {
  return createHmac('sha256', secret()).update(`${userId}:${kind}`).digest('hex').slice(0, 32);
}

export function verifyUnsub(userId: string, kind: UnsubKind, token: string): boolean {
  const expected = signUnsub(userId, kind);
  // constant-length compare (both are 32-char hex from the same function)
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export function unsubUrl(userId: string, kind: UnsubKind): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://helmterminal.dev';
  return `${base}/api/emails/unsubscribe?u=${encodeURIComponent(userId)}&k=${kind}&t=${signUnsub(userId, kind)}`;
}
