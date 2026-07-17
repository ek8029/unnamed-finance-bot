// lib/watch.ts
// "Watch my tickers" — email + tickers capture with no account, the funnel step
// between a public /analyze visit and a full signup. Double opt-in, one-click
// unsubscribe, digest sent only when something happened (or Friday roundup).
// Server-only: uses the service-role client (watch_subscriptions has RLS with
// no policies) and Resend.

import { createServiceClient } from '@/lib/supabase/server';
import { resend, FROM_EMAIL } from '@/lib/emails/resend';
import { validateEmailDomain } from '@/lib/email-validation';
import { INDEXABLE_TICKERS } from '@/lib/indexable-tickers';
import {
  getWatchConfirmTemplate,
  getWatchDigestTemplate,
  type WatchDigestTicker,
} from '@/lib/emails/templates';
import { captureServer } from '@/lib/posthog-server';
import { getTickerThesisData } from '@/lib/content/public-thesis';

const MAX_TICKERS = 5;
const SITE = 'https://helmterminal.dev';

export interface SubscribeResult {
  ok: boolean;
  error?: string;
}

export function normalizeTickers(raw: string[]): string[] {
  const out: string[] = [];
  for (const r of raw) {
    const t = String(r).trim().toUpperCase();
    if (!t || !/^[A-Z.\-]{1,6}$/.test(t)) continue;
    if (!INDEXABLE_TICKERS.has(t)) continue;
    if (!out.includes(t)) out.push(t);
    if (out.length >= MAX_TICKERS) break;
  }
  return out;
}

/** Create or update a subscription and (re)send the confirm email. */
export async function subscribeWatch(email: string, rawTickers: string[]): Promise<SubscribeResult> {
  const cleanEmail = email.trim().toLowerCase();
  const domainCheck = validateEmailDomain(cleanEmail);
  if (!domainCheck.valid) return { ok: false, error: 'That email address does not look right.' };

  const tickers = normalizeTickers(rawTickers);
  if (tickers.length === 0) return { ok: false, error: 'Add at least one valid US ticker.' };

  const supabase = await createServiceClient();

  // Upsert by email: re-subscribing replaces tickers and revives an unsubscribed row.
  const { data: existing } = await supabase
    .from('watch_subscriptions')
    .select('id, confirmed_at, confirm_token')
    .ilike('email', cleanEmail)
    .maybeSingle();

  let confirmToken: string | null = null;
  if (existing) {
    const { error } = await supabase
      .from('watch_subscriptions')
      .update({ tickers, unsubscribed_at: null })
      .eq('id', existing.id);
    if (error) return { ok: false, error: 'Could not save. Try again.' };
    if (!existing.confirmed_at) confirmToken = existing.confirm_token;
  } else {
    const { data: row, error } = await supabase
      .from('watch_subscriptions')
      .insert({ email: cleanEmail, tickers })
      .select('confirm_token')
      .maybeSingle();
    if (error || !row) return { ok: false, error: 'Could not save. Try again.' };
    confirmToken = row.confirm_token;
  }

  if (confirmToken && resend) {
    const tpl = getWatchConfirmTemplate(tickers, `${SITE}/api/watch/confirm?token=${confirmToken}`);
    try {
      await resend.emails.send({ from: FROM_EMAIL, to: cleanEmail, subject: tpl.subject, html: tpl.html, text: tpl.text });
    } catch (e) {
      console.error('[watch] confirm email failed', e);
      return { ok: false, error: 'Could not send the confirmation email. Try again.' };
    }
  }

  captureServer('watch_subscribed', cleanEmail, { tickers: tickers.length, revived: !!existing });
  return { ok: true };
}

export async function confirmWatch(token: string): Promise<boolean> {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return false;
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('watch_subscriptions')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('confirm_token', token)
    .is('confirmed_at', null)
    .select('id, email');
  if (error) return false;
  // Re-clicking an already-confirmed link is fine: treat as success if the row exists.
  if (data && data.length > 0) {
    captureServer('watch_confirmed', (data[0].email as string) ?? token, {});
    return true;
  }
  const { data: already } = await supabase
    .from('watch_subscriptions')
    .select('id')
    .eq('confirm_token', token)
    .not('confirmed_at', 'is', null)
    .maybeSingle();
  return !!already;
}

export async function unsubscribeWatch(token: string): Promise<boolean> {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return false;
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('watch_subscriptions')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('unsub_token', token)
    .select('id');
  return !error && !!data && data.length > 0;
}

/**
 * Send digests to all confirmed, non-unsubscribed watchers.
 * Send-only-if-something-happened: a ticker contributes when it has an approved
 * catch since the last digest, or (Friday) as part of the weekly roundup.
 * Returns counts for the cron log.
 */
export async function sendWatchDigests(now = new Date()): Promise<{ sent: number; skipped: number; errors: number }> {
  const supabase = await createServiceClient();
  const isFriday = now.getUTCDay() === 5;

  const { data: subs } = await supabase
    .from('watch_subscriptions')
    .select('id, email, tickers, unsub_token, last_digest_at')
    .not('confirmed_at', 'is', null)
    .is('unsubscribed_at', null);
  if (!subs?.length) return { sent: 0, skipped: 0, errors: 0 };

  // One query for all approved catches in the last 8 days across all watched tickers.
  const allTickers = [...new Set(subs.flatMap((s) => s.tickers ?? []))];
  const since = new Date(now.getTime() - 8 * 86400000).toISOString().slice(0, 10);
  const { data: queue } = await supabase
    .from('content_queue')
    .select('status, content_events!inner(ticker, pillar_claim, verdict, verbatim_cite, source_url, source_type, cite_date, run_date)')
    .eq('status', 'approved')
    .gte('content_events.run_date', since)
    .in('content_events.ticker', allTickers);

  type EventRow = { ticker: string; pillar_claim: string; verdict: string; verbatim_cite: string; source_url: string; source_type: string; cite_date: string | null; run_date: string };
  const catchesByTicker = new Map<string, EventRow[]>();
  for (const row of (queue ?? []) as unknown as { content_events: EventRow | null }[]) {
    const e = row.content_events;
    if (!e) continue;
    const arr = catchesByTicker.get(e.ticker) ?? [];
    arr.push(e);
    catchesByTicker.set(e.ticker, arr);
  }

  // E3 delta: per-ticker thesis health for house-thesis tickers, computed once
  // per digest run. The chip the paid product shows is the chip the email shows.
  const healthByTicker = new Map<string, string>();
  for (const t of allTickers) {
    try {
      const data = await getTickerThesisData(t);
      if (data) healthByTicker.set(t, data.healthLabel);
    } catch { /* no house thesis or fetch issue — line simply omitted */ }
  }

  let sent = 0, skipped = 0, errors = 0;
  for (const sub of subs) {
    const lastSent = sub.last_digest_at ? new Date(sub.last_digest_at) : null;
    const items: WatchDigestTicker[] = [];
    for (const t of sub.tickers ?? []) {
      const fresh = (catchesByTicker.get(t) ?? []).filter((e) => {
        const d = new Date(`${e.cite_date ?? e.run_date}`);
        return !lastSent || d > lastSent;
      });
      if (fresh.length > 0) {
        const top = fresh[0];
        items.push({
          ticker: t,
          verdict: top.verdict,
          claim: top.pillar_claim,
          cite: top.verbatim_cite,
          sourceUrl: top.source_url,
          sourceType: top.source_type,
          health: healthByTicker.get(t),
        });
      } else if (isFriday) {
        items.push({ ticker: t, verdict: 'quiet', claim: '', cite: '', sourceUrl: '', sourceType: '', health: healthByTicker.get(t) });
      }
    }

    const hasNews = items.some((i) => i.verdict !== 'quiet');
    if (!hasNews && !isFriday) { skipped++; continue; }
    if (items.length === 0) { skipped++; continue; }

    const tpl = getWatchDigestTemplate(items, {
      unsubUrl: `${SITE}/api/watch/unsub?token=${sub.unsub_token}`,
      signupUrl: `${SITE}/signup?email=${encodeURIComponent(sub.email)}`,
      isRoundup: !hasNews,
    });
    if (!resend) { skipped++; continue; }
    try {
      await resend.emails.send({ from: FROM_EMAIL, to: sub.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
      await supabase.from('watch_subscriptions').update({ last_digest_at: now.toISOString() }).eq('id', sub.id);
      sent++;
    } catch (e) {
      console.error('[watch] digest send failed', sub.email, e);
      errors++;
    }
  }
  return { sent, skipped, errors };
}
