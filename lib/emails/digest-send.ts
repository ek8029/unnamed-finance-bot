// lib/emails/digest-send.ts
// The pieces of the morning send that are pure: when a brief day is, what one
// outgoing email looks like, and how a list is cut into batches. Kept free of
// the model clients so they can be tested without keys.

import { getDigestTemplate } from '@/lib/emails/templates';
import { FROM_EMAIL } from '@/lib/emails/resend';
import { unsubUrl } from '@/lib/emails/unsubscribe';

/** Saturday or Sunday in New York. Markets are closed, nothing in the brief has moved, so no brief goes out. */
export function isWeekendET(now: Date = new Date()): boolean {
  const day = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
  return day === 'Sat' || day === 'Sun';
}

export interface DigestRecipient {
  id: string;
  email: string;
  firstName: string;
}

export interface DigestEmailPayload {
  from: string;
  to: string;
  subject: string;
  headers: Record<string, string>;
  html: string;
  text: string;
}

/** One morning email, exactly as it goes to Resend. */
export function digestEmailPayload(
  user: DigestRecipient,
  digest: string,
  material?: { html: string; text: string } | null,
): DigestEmailPayload {
  const unsub = unsubUrl(user.id, 'brief');
  const tpl = getDigestTemplate({
    firstName: user.firstName,
    digestPreview: digest.split('\n\n')[0].slice(0, 200),
    briefUrl: 'https://helmterminal.dev/dashboard/brief',
    unsub,
    material,
  });
  return {
    from: FROM_EMAIL,
    to: user.email,
    subject: tpl.subject,
    headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    html: tpl.html,
    text: tpl.text,
  };
}

/** Resend's batch endpoint takes up to 100 emails per request. */
export const BATCH_MAX = 100;

export function chunk<T>(xs: T[], size: number = BATCH_MAX): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}
