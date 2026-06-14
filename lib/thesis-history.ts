// lib/thesis-history.ts
// Honest conviction history via as-of-date replay of derivePillarStatus.
//
// The shipped board derives status with `created_at` (= ingest/seed time) driving
// the 30-day "recent contradiction" window, so on a backfilled book every live
// contradiction looks recent regardless of when it actually published. This module
// reconstructs each past day's status using ONLY evidence whose source had published
// by that day, with liveness (is_backfill) recomputed relative to that day off the
// real `source_published_at`. No seed-time bias, no fabricated series: every point is
// what the same derivation would have concluded with only what was knowable then.

import { derivePillarStatus, type PillarStatus, type EvidenceForStatus } from '@/lib/thesis-status';

const DAY_MS = 86_400_000;
/** Trailing window (days) within which evidence counts as "live" — mirrors the seed/scoring live window. */
export const LIVE_WINDOW_DAYS = 90;

export interface HistoryEvidence {
  verdict: 'supports' | 'contradicts' | 'neutral';
  materiality: 'material' | 'context';
  source_type: 'filing' | 'form4' | 'xbrl' | 'news' | 'price_move';
  source_key: string;
  source_published_at: string | null; // the honest timeline
  created_at: string;                 // fallback only when publish date is missing
}

export interface HistoryPillar {
  id: string;
  ticker: string;
  claim: string;
  confirmed: boolean;
  lifecycle: string;
  evidence: HistoryEvidence[];
}

/** Effective publish instant for an evidence row (honest timeline, created_at fallback). */
function publishTime(e: HistoryEvidence): number {
  return new Date(e.source_published_at ?? e.created_at).getTime();
}

function isConfirmed(p: HistoryPillar): boolean {
  return p.confirmed && p.lifecycle !== 'dismissed';
}

/**
 * Derive a pillar's status AS OF `asOf`, using only evidence published by then,
 * with is_backfill + the recency window recomputed relative to asOf (not seed time).
 * History is derived-only: manual status overrides are intentionally ignored so the
 * series reflects what the evidence said, not what the user later asserted.
 */
export function statusAsOf(ev: HistoryEvidence[], asOf: Date): PillarStatus {
  const asOfMs = asOf.getTime();
  const liveCutoffMs = asOfMs - LIVE_WINDOW_DAYS * DAY_MS;
  const mapped: EvidenceForStatus[] = [];
  for (const e of ev) {
    const pub = publishTime(e);
    if (pub > asOfMs) continue; // not yet known as of asOf
    mapped.push({
      verdict: e.verdict,
      materiality: e.materiality,
      source_type: e.source_type,
      source_key: e.source_key,
      is_backfill: pub < liveCutoffMs,         // live iff within the trailing window as of asOf
      created_at: new Date(pub).toISOString(), // feed the honest timeline into the recency check
    });
  }
  return derivePillarStatus(mapped, null, asOf);
}

export type StatusCounts = Record<PillarStatus, number>;

/** Derived status counts across confirmed pillars as of `asOf`. */
export function countsAsOf(pillars: HistoryPillar[], asOf: Date): StatusCounts {
  const counts: StatusCounts = { unverified: 0, intact: 0, weakening: 0, broken: 0 };
  for (const p of pillars) {
    if (!isConfirmed(p)) continue;
    counts[statusAsOf(p.evidence, asOf)]++;
  }
  return counts;
}

export interface TrendPoint { date: string; intact: number; }

/** N-day intact-count series ending at `now` (inclusive), one point per day. */
export function convictionTrend(pillars: HistoryPillar[], now: Date, days = 14): TrendPoint[] {
  const out: TrendPoint[] = [];
  const end = now.getTime();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end - i * DAY_MS);
    out.push({ date: d.toISOString().slice(0, 10), intact: countsAsOf(pillars, d).intact });
  }
  return out;
}

export interface Transition {
  ticker: string;
  pillarId: string;
  claim: string;
  from: PillarStatus;
  to: PillarStatus;
  /** publish date (YYYY-MM-DD) of the most recent evidence in the window that drove the change */
  movedOn: string | null;
}

/** Pillars whose derived status changed between (now - sinceDays) and now, weakest-first. */
export function recentTransitions(pillars: HistoryPillar[], now: Date, sinceDays = 14): Transition[] {
  const past = new Date(now.getTime() - sinceDays * DAY_MS);
  const rank: Record<PillarStatus, number> = { broken: 0, weakening: 1, unverified: 2, intact: 3 };
  const out: Transition[] = [];
  for (const p of pillars) {
    if (!isConfirmed(p)) continue;
    const from = statusAsOf(p.evidence, past);
    const to = statusAsOf(p.evidence, now);
    if (from === to) continue;
    const driver = p.evidence
      .filter((e) => { const t = publishTime(e); return t > past.getTime() && t <= now.getTime(); })
      .sort((a, b) => publishTime(b) - publishTime(a))[0];
    out.push({
      ticker: p.ticker,
      pillarId: p.id,
      claim: p.claim,
      from,
      to,
      movedOn: driver ? new Date(publishTime(driver)).toISOString().slice(0, 10) : null,
    });
  }
  return out.sort((a, b) => rank[a.to] - rank[b.to]);
}
