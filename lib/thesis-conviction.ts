import type { SupabaseClient } from '@supabase/supabase-js';
import { summarizePillars, effectiveStatus, type SummaryPillar } from '@/lib/thesis-summary';

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

export interface ActionCite {
  excerpt: string;          // RAW verbatim from pillar_evidence.excerpt
  sourceTitle: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  whatItMeans: string | null;
}
export interface ActionThesisContext {
  ticker: string;
  status: Conviction;       // intact | weakening | broken
  cite?: ActionCite;
}

/**
 * For thesis-native actions (related_entity_type='thesis', related_entity_ids=[thesisId,pillarId]),
 * resolve conviction (per ticker) + ONE best verbatim contradiction cite (per pillar). Returns
 * Map<insightId, ActionThesisContext>. Reuses getConvictionByTicker so status matches the theses UI.
 * Cite ranking: verdict='contradicts' AND materiality='material' AND is_backfill=false, ordered
 * source_type (filing>form4>xbrl>price_move>news) then source_published_at desc; take the first per pillar.
 * No qualifying evidence => no cite (status only). Verbatim excerpt passed through raw.
 */
export async function getThesisContextForActions(
  db: SupabaseClient,
  userId: string,
  actions: { id: string; thesisId: string; pillarId: string | null }[],
  injectedConviction?: Map<string, Conviction>,
): Promise<Map<string, ActionThesisContext>> {
  const out = new Map<string, ActionThesisContext>();
  if (actions.length === 0) return out;

  // Callers that already hold a conviction map (e.g. the insights route, which also
  // needs it for rule-based actions) can inject it to avoid a second identical query.
  const conviction = injectedConviction ?? await getConvictionByTicker(db, userId);

  // thesisId -> tickerUpper
  const thesisIds = [...new Set(actions.map(a => a.thesisId))];
  const { data: thesisRows } = await db
    .from('theses')
    .select('id, ticker')
    .eq('user_id', userId)
    .in('id', thesisIds);
  const tickerByThesis = new Map<string, string>();
  for (const r of (thesisRows ?? []) as { id: string; ticker: string }[]) {
    tickerByThesis.set(r.id, r.ticker.toUpperCase());
  }

  // pillarId -> best contradiction cite
  const pillarIds = [...new Set(actions.map(a => a.pillarId).filter((p): p is string => !!p))];
  const sourcePriority: Record<string, number> = { filing: 0, form4: 1, xbrl: 2, price_move: 3, news: 4 };
  const bestCiteByPillar = new Map<string, ActionCite>();
  if (pillarIds.length > 0) {
    const { data: evidence } = await db
      .from('pillar_evidence')
      .select('pillar_id, verdict, materiality, source_type, source_title, source_url, source_published_at, excerpt, what_it_means, is_backfill')
      .in('pillar_id', pillarIds);

    type EvRow = {
      pillar_id: string;
      verdict: string;
      materiality: string;
      source_type: string;
      source_title: string;
      source_url: string | null;
      source_published_at: string | null;
      excerpt: string;
      what_it_means: string | null;
      is_backfill: boolean;
    };
    const qualifying = ((evidence ?? []) as EvRow[]).filter(
      e => e.verdict === 'contradicts' && e.materiality === 'material' && !e.is_backfill,
    );
    // Rank: source_type priority asc, then source_published_at desc.
    qualifying.sort((a, b) => {
      const pa = sourcePriority[a.source_type] ?? 99;
      const pb = sourcePriority[b.source_type] ?? 99;
      if (pa !== pb) return pa - pb;
      const ta = a.source_published_at ? Date.parse(a.source_published_at) : 0;
      const tb = b.source_published_at ? Date.parse(b.source_published_at) : 0;
      return tb - ta;
    });
    for (const e of qualifying) {
      if (bestCiteByPillar.has(e.pillar_id)) continue; // first = best after sort
      bestCiteByPillar.set(e.pillar_id, {
        excerpt: e.excerpt,
        sourceTitle: e.source_title,
        sourceUrl: e.source_url,
        publishedAt: e.source_published_at,
        whatItMeans: e.what_it_means,
      });
    }
  }

  for (const a of actions) {
    const ticker = tickerByThesis.get(a.thesisId);
    if (!ticker) continue;
    const status = conviction.get(ticker);
    if (!status) continue; // unverified-only thesis: no signal
    const cite = a.pillarId ? bestCiteByPillar.get(a.pillarId) : undefined;
    out.set(a.id, cite ? { ticker, status, cite } : { ticker, status });
  }

  return out;
}

export interface ThesisEarningsContext {
  status: Conviction;
  testPillar: string; // the claim of a confirmed pillar at the conviction status (the at-risk pillar)
}

/**
 * Per tracked thesis: conviction (same rule as getConvictionByTicker) plus the claim
 * of a confirmed pillar that sits at that status, so the Earnings page can frame the
 * report as the next test of that specific pillar. Omits theses with no real signal.
 */
export async function getThesisEarningsContext(
  db: SupabaseClient,
  userId: string,
): Promise<Map<string, ThesisEarningsContext>> {
  const { data } = await db
    .from('theses')
    .select('ticker, thesis_pillars(claim, confirmed, status, status_override, lifecycle)')
    .eq('user_id', userId)
    .eq('tracked', true);

  const map = new Map<string, ThesisEarningsContext>();
  for (const row of data ?? []) {
    const t = row as { ticker: string; thesis_pillars?: (SummaryPillar & { claim: string })[] };
    const pillars = t.thesis_pillars ?? [];
    const counts = summarizePillars(pillars).statusCounts;
    const status: Conviction | null =
      counts.broken > 0 ? 'broken' : counts.weakening > 0 ? 'weakening' : counts.intact > 0 ? 'intact' : null;
    if (!status) continue;
    const testPillar =
      pillars.find(
        (p) => p.confirmed && p.lifecycle !== 'dismissed' && effectiveStatus(p) === status,
      )?.claim ?? '';
    map.set(t.ticker.toUpperCase(), { status, testPillar });
  }
  return map;
}

/**
 * Best verbatim contradiction cite per ticker for the given tracked tickers. Same
 * qualifying filter + ranking as getThesisContextForActions (verdict='contradicts'
 * AND materiality='material' AND is_backfill=false, ordered source_type
 * filing>form4>xbrl>price_move>news then source_published_at desc; first per ticker
 * wins). Used by the Tax Center to show *why* a broken-thesis loss is worth harvesting.
 * Verbatim excerpt passed through raw. Tickers with no qualifying evidence are omitted.
 */
export async function getContradictionCitesByTicker(
  db: SupabaseClient,
  userId: string,
  tickers: string[],
): Promise<Map<string, ActionCite>> {
  const out = new Map<string, ActionCite>();
  const want = new Set(tickers.map((t) => t.toUpperCase()));
  if (want.size === 0) return out;

  const { data: thesisRows } = await db
    .from('theses')
    .select('ticker, thesis_pillars(id)')
    .eq('user_id', userId)
    .eq('tracked', true);

  // pillarId -> tickerUpper, limited to the tickers asked for.
  const tickerByPillar = new Map<string, string>();
  for (const r of (thesisRows ?? []) as { ticker: string; thesis_pillars?: { id: string }[] }[]) {
    const t = r.ticker.toUpperCase();
    if (!want.has(t)) continue;
    for (const p of r.thesis_pillars ?? []) tickerByPillar.set(p.id, t);
  }
  const pillarIds = [...tickerByPillar.keys()];
  if (pillarIds.length === 0) return out;

  const { data: evidence } = await db
    .from('pillar_evidence')
    .select('pillar_id, verdict, materiality, source_type, source_title, source_url, source_published_at, excerpt, what_it_means, is_backfill')
    .in('pillar_id', pillarIds);

  type EvRow = {
    pillar_id: string;
    verdict: string;
    materiality: string;
    source_type: string;
    source_title: string;
    source_url: string | null;
    source_published_at: string | null;
    excerpt: string;
    what_it_means: string | null;
    is_backfill: boolean;
  };
  const priority: Record<string, number> = { filing: 0, form4: 1, xbrl: 2, price_move: 3, news: 4 };
  const qualifying = ((evidence ?? []) as EvRow[]).filter(
    (e) => e.verdict === 'contradicts' && e.materiality === 'material' && !e.is_backfill,
  );
  qualifying.sort((a, b) => {
    const pa = priority[a.source_type] ?? 99;
    const pb = priority[b.source_type] ?? 99;
    if (pa !== pb) return pa - pb;
    const ta = a.source_published_at ? Date.parse(a.source_published_at) : 0;
    const tb = b.source_published_at ? Date.parse(b.source_published_at) : 0;
    return tb - ta;
  });
  for (const e of qualifying) {
    const t = tickerByPillar.get(e.pillar_id);
    if (!t || out.has(t)) continue; // first per ticker = best after sort
    out.set(t, {
      excerpt: e.excerpt,
      sourceTitle: e.source_title,
      sourceUrl: e.source_url,
      publishedAt: e.source_published_at,
      whatItMeans: e.what_it_means,
    });
  }
  return out;
}
