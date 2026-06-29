// Server data layer for the per-ticker living thesis page (/thesis/[ticker]).
// Joins the authored house thesis to its approved catches (content_queue -> content_events),
// buckets catches by pillar_id, and computes each pillar's current status + the thesis health
// via the pure math in ./thesis-status. No hardcoding: thesis text is authored, evidence/dates
// come from the DB, status is computed. Public reads use the cookie-free service client.

import { createStaticServiceClient } from '@/lib/supabase/server';
import { getHouseThesis } from './house-theses';
import {
  computePillarStatus,
  computeThesisHealth,
  STATUS_LABEL,
  type PillarStatus,
  type StatusCatch,
  type ThesisHealth,
  type Verdict,
  type SourceType,
} from './thesis-status';

const VALID_VERDICTS = new Set<Verdict>(['supports', 'contradicts']);
const VALID_SOURCE_TYPES = new Set<SourceType>(['filing', 'major_news', 'minor_news']);

function sourceLabel(t: SourceType): string {
  return t === 'filing' ? 'SEC filing' : 'News';
}

export interface PublicCatch {
  id: string;
  verdict: Verdict;
  verbatimCite: string;
  /** YYYY-MM-DD, cite_date ?? run_date. */
  dateISO: string;
  sourceUrl: string | null;
  sourceType: SourceType;
  sourceLabel: string;
  summary?: string;
}

export interface PublicPillar {
  id: string;
  claim: string;
  breaks_if: string;
  status: PillarStatus;
  statusLabel: string;
  score: number;
  catches: PublicCatch[];
}

export interface TickerThesisData {
  ticker: string;
  company: string;
  health: ThesisHealth;
  healthLabel: string;
  /** Latest evidence date across all catches (YYYY-MM-DD), or null if none. */
  asOfDate: string | null;
  /** Latest run_date across all catches (YYYY-MM-DD), or null if none. */
  lastChecked: string | null;
  pillars: PublicPillar[];
}

interface EventRow {
  id: string;
  ticker: string;
  company: string | null;
  pillar_id: string | null;
  pillar_claim: string | null;
  verdict: string;
  verbatim_cite: string;
  summary: string | null;
  cite_date: string | null;
  source_url: string | null;
  source_type: string;
  run_date: string | null;
}

/**
 * Build the public thesis view for a ticker, or null when no house thesis exists
 * (caller redirects to /analyze). Visibility gate is content_queue.status='approved';
 * we always read through the queue and never expose un-reviewed catches.
 */
export async function getTickerThesisData(ticker: string): Promise<TickerThesisData | null> {
  const SYM = ticker.toUpperCase().replace(/[^A-Z]/g, '');
  const ht = getHouseThesis(SYM);
  if (!ht) return null;

  const db = createStaticServiceClient();
  // Inner-join filter: only approved queue rows whose event matches this ticker.
  const { data } = await db
    .from('content_queue')
    .select(
      'content_events!inner(id, ticker, company, pillar_id, pillar_claim, verdict, verbatim_cite, summary, cite_date, source_url, source_type, run_date)',
    )
    .eq('status', 'approved')
    .eq('content_events.ticker', SYM);

  const rows = ((data ?? []) as unknown as { content_events: EventRow | null }[])
    .map((r) => r.content_events)
    // Defensive: re-assert ticker match in case embedded filtering is loose.
    .filter((e): e is EventRow => !!e && e.ticker === SYM);

  // Normalize to typed catches, keeping only valid verdict/source_type values.
  interface NormCatch extends PublicCatch {
    pillarId: string | null;
    runDate: string | null;
  }
  const allCatches: NormCatch[] = [];
  for (const e of rows) {
    const verdict = e.verdict as Verdict;
    const sourceType = e.source_type as SourceType;
    if (!VALID_VERDICTS.has(verdict) || !VALID_SOURCE_TYPES.has(sourceType)) continue;
    const dateISO = (e.cite_date ?? e.run_date ?? '').slice(0, 10);
    if (!dateISO) continue;
    allCatches.push({
      id: e.id,
      verdict,
      verbatimCite: e.verbatim_cite,
      dateISO,
      sourceUrl: e.source_url,
      sourceType,
      sourceLabel: sourceLabel(sourceType),
      summary: e.summary ?? undefined,
      pillarId: e.pillar_id,
      runDate: e.run_date,
    } as NormCatch);
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  // Bucket by pillar_id, compute status per authored pillar (preserve authored order).
  const pillars: PublicPillar[] = ht.pillars.map((p) => {
    const pc = allCatches
      .filter((c) => c.pillarId === p.id)
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO)); // newest first
    const statusCatches: StatusCatch[] = pc.map((c) => ({
      verdict: c.verdict,
      dateISO: c.dateISO,
      source_type: c.sourceType,
    }));
    const { status, score } = computePillarStatus(statusCatches, todayISO);
    return {
      id: p.id,
      claim: p.claim,
      breaks_if: p.breaks_if,
      status,
      statusLabel: STATUS_LABEL[status],
      score,
      catches: pc.map(({ pillarId: _pid, runDate: _rd, ...rest }) => rest),
    };
  });

  const health = computeThesisHealth(pillars.map((p) => p.status));

  const asOfDate = allCatches.length
    ? allCatches.reduce((m, c) => (c.dateISO > m ? c.dateISO : m), allCatches[0].dateISO)
    : null;
  const runDates = allCatches.map((c) => (c.runDate ?? '').slice(0, 10)).filter(Boolean);
  const lastChecked = runDates.length ? runDates.reduce((m, d) => (d > m ? d : m), runDates[0]) : null;

  return {
    ticker: SYM,
    company: ht.company,
    health,
    healthLabel: STATUS_LABEL[health],
    asOfDate,
    lastChecked,
    pillars,
  };
}
