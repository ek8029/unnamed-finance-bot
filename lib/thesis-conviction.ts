import type { SupabaseClient } from '@supabase/supabase-js';
import { summarizePillars, type SummaryPillar } from '@/lib/thesis-summary';

// Thesis conviction for a position, reused across surfaces (TLH, actions, brief).
export type Conviction = 'intact' | 'weakening' | 'broken';

/**
 * Map<tickerUpper, conviction> for a user's tracked theses. Conviction is the
 * worst-of among CONFIRMED pillars (broken > weakening > intact). A thesis whose
 * confirmed pillars are only 'unverified' (no live read yet) is omitted, so the
 * map only ever contains a real signal. Reuses summarizePillars, so it matches
 * the theses UI exactly.
 */
export async function getConvictionByTicker(
  db: SupabaseClient,
  userId: string,
): Promise<Map<string, Conviction>> {
  const { data } = await db
    .from('theses')
    .select('ticker, thesis_pillars(confirmed, status, status_override, lifecycle)')
    .eq('user_id', userId)
    .eq('tracked', true);

  const map = new Map<string, Conviction>();
  for (const row of data ?? []) {
    const t = row as { ticker: string; thesis_pillars?: SummaryPillar[] };
    const counts = summarizePillars(t.thesis_pillars ?? []).statusCounts;
    const conviction: Conviction | null =
      counts.broken > 0 ? 'broken' : counts.weakening > 0 ? 'weakening' : counts.intact > 0 ? 'intact' : null;
    if (conviction) map.set(t.ticker.toUpperCase(), conviction);
  }
  return map;
}

/**
 * Centralized, RIA-safe tax-loss-harvesting guidance given conviction. Framed as
 * a consideration the user weighs, never a directive (non-discretionary posture).
 * One source of this copy so it can't drift across surfaces.
 */
export function thesisTlhNote(status: Conviction): string {
  switch (status) {
    case 'broken':
      return 'Your thesis on this position is broken. Beyond the tax loss, consider whether you still want to own it at all, rather than simply rebuying after the wash-sale window.';
    case 'weakening':
      return 'Your thesis here is weakening. If you harvest, consider waiting out the wash-sale window before rebuying, and watch the next data point closely.';
    case 'intact':
      return 'Your thesis is intact. This looks like a tax move, not a change of conviction. Consider rebuying after the wash-sale window to stay positioned.';
  }
}
