// The starting watchlist, and the rule for when a move on it is worth an email.
//
// These used to be implied at READ time in two places, which produced two bugs:
// the list collapsed the moment a user edited it (they saw four tickers, added
// one, and were left with one), and the alerts cron treated the same implicit
// default as consent, emailing every signup about tickers they never chose.
// Defaults are now materialized into real rows before any mutation, and the
// cron sends only to users who actually have rows.

import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_WATCHLIST_TICKERS = ['SPY', 'QQQ', 'VIXY', 'TLT'] as const;

/** Baseline daily move that counts as newsworthy. */
export const DEFAULT_MOVE_THRESHOLD = 3;

/**
 * Instruments whose ordinary daily range makes the baseline threshold noise
 * rather than signal. VIXY is the reason this exists: it is a volatility
 * product that clears 3% on quiet days, so it was the loudest ticker in a
 * default list the user never picked, and it trained people to ignore the
 * alert channel entirely.
 */
const HIGH_VOLATILITY_THRESHOLDS: Record<string, number> = {
  VIXY: 10,
  VXX: 10,
  UVXY: 12,
  SVXY: 10,
  TQQQ: 6,
  SQQQ: 6,
  SOXL: 8,
  SOXS: 8,
  TMF: 6,
  TMV: 6,
};

/** Percent daily move required before `ticker` is worth emailing about. */
export function alertThresholdFor(ticker: string): number {
  return HIGH_VOLATILITY_THRESHOLDS[ticker.toUpperCase()] ?? DEFAULT_MOVE_THRESHOLD;
}

/**
 * Turn the implied default list into real rows, once, before the user's first
 * edit. Returns true when rows were created.
 *
 * Idempotent and safe to call on every mutation: it only writes when the user
 * has no rows at all, and the insert ignores duplicates.
 */
export async function materializeDefaultWatchlist(
  db: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { count, error: countError } = await db
    .from('user_watchlist')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (countError || (count ?? 0) > 0) return false;

  const { error } = await db
    .from('user_watchlist')
    .insert(DEFAULT_WATCHLIST_TICKERS.map((ticker) => ({ user_id: userId, ticker })));
  // A concurrent request may have seeded first; the unique constraint says so.
  return !error;
}
