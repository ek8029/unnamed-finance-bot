// lib/thesis-brief.ts
// Proactive daily brief, thesis-aware slice (agentic layer, feature 4).
//
// Composes the morning read from THESIS state: what moved against your theses,
// what is intact, what needs a look. Read-time (no writes): the brief route calls
// this and renders it. "What moved" is the honest 14-day replay (recentTransitions),
// not a since-last-scan diff. Neutral, factual; never advises.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PillarStatus } from '@/lib/thesis-status';
import { verdictSentence } from '@/lib/thesis-verdict';
import { recentTransitions, type HistoryPillar, type HistoryEvidence, type Transition } from '@/lib/thesis-history';

export interface BriefPillarState {
  ticker: string;
  claim: string;
  status: PillarStatus; // effective (override ?? status)
}

export interface ThesisBriefData {
  trackedCount: number;
  counts: { intact: number; weakening: number; broken: number; unverified: number };
  needsAttention: { ticker: string; status: PillarStatus; claim: string }[];
  moved: Transition[];
  headline: string;
  /** Per-thesis "on balance" sentence for the worst-standing ticker (spec F3); null when nothing needs attention. */
  onBalance: { ticker: string; sentence: string } | null;
}

const MAX_ATTENTION = 6;

function headlineFor(c: ThesisBriefData['counts'], tracked: number): string {
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (tracked === 0) return 'No tracked theses yet.';
  if (c.broken > 0) {
    const tail = c.weakening > 0 ? ` and ${plural(c.weakening, 'pillar')} weakened` : '';
    return `${plural(c.broken, 'thesis pillar')} broke${tail} across your ${tracked} theses.`;
  }
  if (c.weakening > 0) return `${plural(c.weakening, 'pillar')} weakening, none broken.`;
  if (c.intact > 0) return `All tracked pillars are intact.`;
  return 'No confirmed pillars yet.';
}

/** Pure summary of thesis state + recent honest transitions. */
export function summarizeThesisState(
  pillars: BriefPillarState[],
  transitions: Transition[],
): ThesisBriefData {
  const counts = { intact: 0, weakening: 0, broken: 0, unverified: 0 };
  for (const p of pillars) counts[p.status]++;

  const needsAttention = pillars
    .filter((p) => p.status === 'broken' || p.status === 'weakening')
    .sort((a, b) => (a.status === 'broken' ? 0 : 1) - (b.status === 'broken' ? 0 : 1))
    .slice(0, MAX_ATTENTION)
    .map((p) => ({ ticker: p.ticker, status: p.status, claim: p.claim }));

  const moved = transitions
    .filter((t) => t.to === 'broken' || t.to === 'weakening')
    .sort((a, b) => (b.movedOn ?? '').localeCompare(a.movedOn ?? ''));

  const trackedCount = new Set(pillars.map((p) => p.ticker)).size;

  // One "on balance" sentence for the worst-standing thesis, reused verbatim
  // from the theses page templates so the two surfaces never disagree.
  let onBalance: ThesisBriefData['onBalance'] = null;
  const worstTicker = needsAttention[0]?.ticker;
  if (worstTicker) {
    const thesisPillars = pillars.filter((p) => p.ticker === worstTicker);
    onBalance = { ticker: worstTicker, sentence: verdictSentence(thesisPillars) };
  }

  return { trackedCount, counts, needsAttention, moved, headline: headlineFor(counts, trackedCount), onBalance };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient | any;

/** Compose the thesis brief for a user from current state (read-only). */
export async function composeThesisBrief(
  db: AnyClient,
  userId: string,
  now: Date = new Date(),
): Promise<ThesisBriefData> {
  const empty: ThesisBriefData = {
    trackedCount: 0,
    counts: { intact: 0, weakening: 0, broken: 0, unverified: 0 },
    needsAttention: [],
    moved: [],
    headline: 'No tracked theses yet.',
    onBalance: null,
  };

  const { data: theses } = await db
    .from('theses')
    .select('id, ticker')
    .eq('user_id', userId)
    .eq('tracked', true);
  if (!theses || theses.length === 0) return empty;

  const tickerByThesis = new Map<string, string>();
  for (const t of theses as { id: string; ticker: string }[]) tickerByThesis.set(t.id, t.ticker);
  const thesisIds = [...tickerByThesis.keys()];

  const { data: pillarsRaw } = await db
    .from('thesis_pillars')
    .select('id, thesis_id, claim, status, status_override, confirmed, lifecycle')
    .in('thesis_id', thesisIds)
    .eq('confirmed', true);
  const pillarRows = (pillarsRaw ?? []) as {
    id: string; thesis_id: string; claim: string; status: PillarStatus; status_override: PillarStatus | null; lifecycle: string;
  }[];
  if (pillarRows.length === 0) return empty;

  const pillarIds = pillarRows.map((p) => p.id);
  const { data: evidenceRaw } = await db
    .from('pillar_evidence')
    .select('pillar_id, verdict, materiality, source_type, source_key, source_published_at, created_at')
    .in('pillar_id', pillarIds);
  const evidenceByPillar = new Map<string, HistoryEvidence[]>();
  for (const e of (evidenceRaw ?? []) as Record<string, unknown>[]) {
    const pid = e.pillar_id as string;
    const arr = evidenceByPillar.get(pid) ?? [];
    arr.push({
      verdict: e.verdict as HistoryEvidence['verdict'],
      materiality: e.materiality as HistoryEvidence['materiality'],
      source_type: e.source_type as HistoryEvidence['source_type'],
      source_key: e.source_key as string,
      source_published_at: (e.source_published_at as string | null) ?? null,
      created_at: e.created_at as string,
    });
    evidenceByPillar.set(pid, arr);
  }

  const states: BriefPillarState[] = pillarRows.map((p) => ({
    ticker: tickerByThesis.get(p.thesis_id) ?? '',
    claim: p.claim,
    status: p.status_override ?? p.status,
  }));

  const historyPillars: HistoryPillar[] = pillarRows.map((p) => ({
    id: p.id,
    ticker: tickerByThesis.get(p.thesis_id) ?? '',
    claim: p.claim,
    confirmed: true,
    lifecycle: p.lifecycle,
    evidence: evidenceByPillar.get(p.id) ?? [],
  }));

  const transitions = recentTransitions(historyPillars, now);
  return summarizeThesisState(states, transitions);
}
