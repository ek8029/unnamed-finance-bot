// Re-judge stale mechanism groupings across tracked tickers, capped per run.
//
// The cache key is a hash of the pillar's finding-id set, so "stale" is exactly
// "evidence changed since the last judgment". On a quiet day this makes zero
// model calls; after a busy scan it works through the stalest pillars up to the
// cap and catches the rest on the next run. gpt-4o per call — the cap is the
// cost ceiling (cap 8 ≈ low single-digit cents per run at current pricing).

import type { SupabaseClient } from '@supabase/supabase-js';
import { getScoringThesisData } from './scoring-thesis';
import { judgeMechanisms, MECHANISM_MODEL } from './mechanism-judge';
import { evidenceHash, readMechanismCache, writeMechanismCache, scopeKey } from './mechanism-cache';

export interface RejudgeResult {
  tickers: number;
  pillarsChecked: number;
  judged: number;
  skippedFresh: number;
  errors: string[];
}

export async function rejudgeStaleMechanisms(
  db: SupabaseClient,
  opts: { cap?: number; tickers?: string[] } = {},
): Promise<RejudgeResult> {
  const cap = opts.cap ?? 8;
  const result: RejudgeResult = { tickers: 0, pillarsChecked: 0, judged: 0, skippedFresh: 0, errors: [] };

  let tickers = opts.tickers?.map((t) => t.toUpperCase());
  if (!tickers) {
    const { data } = await db.from('theses').select('ticker').eq('tracked', true);
    tickers = [...new Set((data ?? []).map((t) => String(t.ticker).toUpperCase()))];
  }
  result.tickers = tickers.length;

  for (const ticker of tickers) {
    if (result.judged >= cap) break;
    try {
      const data = await getScoringThesisData(ticker);
      if (!data.pillars.length) continue;
      const cache = await readMechanismCache(db, data.pillars.map((p) => scopeKey(ticker, p.key)));
      for (const p of data.pillars) {
        if (result.judged >= cap) break;
        if (p.catches.length < 2) continue;
        result.pillarsChecked++;
        const key = scopeKey(ticker, p.key);
        const hash = evidenceHash(p.catches.map((c) => c.id));
        if (cache.get(key)?.evidenceHash === hash) {
          result.skippedFresh++;
          continue;
        }
        const judged = await judgeMechanisms(
          p.claim,
          p.breaksIf,
          p.catches.map((c) => ({ id: c.id, title: c.title, excerpt: c.excerpt, dateISO: c.dateISO })),
        );
        const ok = await writeMechanismCache(db, key, hash, judged, MECHANISM_MODEL);
        if (!ok) result.errors.push(`${ticker}: cache write failed (migration 058?)`);
        result.judged++;
      }
    } catch (err) {
      result.errors.push(`${ticker}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
  return result;
}
