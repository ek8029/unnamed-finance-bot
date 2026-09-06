// lib/market/severe-move.ts
// The severe-move trigger (perpetual watch, section 4).
//
// The intraday tick already knows every held name's move from the prior close.
// A move at or past the E1 severe threshold on a name with a tracked thesis
// becomes an `investigate` judge job keyed `price:{ticker}:{day}`, the same key
// the daily close move uses in the scorer, so one day's move can only ever be
// filed once. The tick enqueues and returns; the model runs from the worker.

import type { SupabaseClient } from '@supabase/supabase-js';
import { SEVERE_MOVE_PCT } from '@/lib/thesis-investigation';
import { entitledToMonitoring } from '@/lib/thesis-entitlement';
import { enqueueJudgeJobs, type NewJudgeJob } from '@/lib/agent/judge-queue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export interface SevereMove {
  ticker: string;
  /** Fraction: -0.213 is a 21.3% fall. */
  pct: number;
  price: number;
  prevClose: number;
}

/** Names at or past the threshold (percent, shared with the scorer's status math). */
export function severeMoves(
  prices: Map<string, number>,
  prevClose: Map<string, number>,
  thresholdPct: number = SEVERE_MOVE_PCT,
): SevereMove[] {
  const out: SevereMove[] = [];
  for (const [ticker, price] of prices) {
    const prev = prevClose.get(ticker);
    if (!prev || prev <= 0 || !price || price <= 0) continue;
    const pct = (price - prev) / prev;
    if (Math.abs(pct) * 100 >= thresholdPct) out.push({ ticker, pct, price, prevClose: prev });
  }
  return out;
}

export function severeMoveKey(ticker: string, day: string): string {
  return `price:${ticker}:${day}`;
}

export async function enqueueSevereMoves(
  db: Db,
  moves: SevereMove[],
  day: string,
): Promise<{ theses: number; queued: number; error: string | null }> {
  if (moves.length === 0) return { theses: 0, queued: 0, error: null };
  const byTicker = new Map(moves.map((m) => [m.ticker, m]));
  const { data, error } = await db
    .from('theses')
    .select('id, user_id, ticker')
    .in('ticker', [...byTicker.keys()])
    .eq('tracked', true)
    .limit(500);
  if (error) return { theses: 0, queued: 0, error: error.message };
  const rows = (data ?? []) as { id: string; user_id: string; ticker: string }[];
  if (rows.length === 0) return { theses: 0, queued: 0, error: null };

  const entitled = await entitledToMonitoring(db, [...new Set(rows.map((r) => r.user_id))]);
  const jobs: NewJudgeJob[] = [];
  for (const r of rows) {
    const m = byTicker.get(r.ticker.toUpperCase());
    if (!m || !entitled.has(r.user_id)) continue;
    jobs.push({
      kind: 'investigate',
      user_id: r.user_id,
      thesis_id: r.id,
      ticker: r.ticker,
      source_key: severeMoveKey(m.ticker, day),
      payload: { ticker: m.ticker, date: day, pct: m.pct, price: m.price, prevClose: m.prevClose, trigger_kind: 'severe_move' },
    });
  }
  const q = await enqueueJudgeJobs(db, jobs);
  return { theses: rows.length, queued: q.inserted, error: q.error };
}
