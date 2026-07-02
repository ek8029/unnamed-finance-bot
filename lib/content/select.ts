// lib/content/select.ts
// Daily content event selection: for every house-thesis ticker, gather source
// docs (SEC filings + today's news), score them against the pillars with the
// LLM judge, apply the verbatim guard, then rank and return the single most
// newsworthy event. Returns null on a slow-news day.

import { createServiceClient } from '@/lib/supabase/server';
import { getRecentFilings } from '@/lib/edgar';
import { extractFilingSection, stripFilingHtml } from '@/lib/filing-extract';
import { excerptFoundInSource } from '@/lib/thesis-evidence';
import { CONTENT_UNIVERSE } from './universe';
import { getHouseThesis } from './house-theses';
import { scoreItemsForPillars, type SourceDoc, type ScoredHit } from './score-helper';
import type { ContentEvent } from './types';

const SEC_FETCH_TRUNCATE = 8000;
const CANDIDATE_TEXT_TRUNCATE = 2000;
const MIN_THRESHOLD = 1.0;

const IMPACT: Record<ScoredHit['verdict'], number> = {
  contradicts: 1,
  supports: 0.5,
  neutral: 0,
};
const SOURCE_WEIGHT: Record<SourceDoc['sourceType'], number> = {
  filing: 3,
  major_news: 2,
  minor_news: 1,
};

interface ScoredItem {
  hit: ScoredHit;
  pillarClaim: string;
  score: number;
}

/** Earlier-in-universe tickers score slightly higher (gentle prominence prior). */
function prominence(ticker: string): number {
  const idx = CONTENT_UNIVERSE.indexOf(ticker.toUpperCase());
  if (idx < 0) return 0.5;
  return 1 - idx / (CONTENT_UNIVERSE.length * 2);
}

/** Fetch + strip + section-extract a filing's substantive text (MD&A). */
async function fetchFilingText(url: string, form = ''): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Helm Terminal hello@helmterminal.dev' },
    });
    if (!res.ok) return '';
    const raw = await res.text();
    const stripped = stripFilingHtml(raw);
    return extractFilingSection(stripped, form, SEC_FETCH_TRUNCATE);
  } catch {
    return '';
  }
}

/** Gather source docs (filings + today's news) for one ticker. */
async function gatherSources(
  ticker: string,
  runDate: string,
  db: Awaited<ReturnType<typeof createServiceClient>>,
): Promise<SourceDoc[]> {
  const sources: SourceDoc[] = [];

  // 1. Recent SEC filings from the last 3 days (not just runDate: the cron runs
  //    after close, and a filing that landed yesterday is still fresh material —
  //    the 35d verbatim-cite dedup in the cron prevents double-queueing).
  const filingsSince = new Date(Date.parse(runDate) - 3 * 86400000).toISOString().slice(0, 10);
  try {
    const filings = await getRecentFilings(ticker, filingsSince);
    for (const f of filings) {
      const text = await fetchFilingText(f.url, f.form);
      await new Promise((r) => setTimeout(r, 150)); // stay under SEC 10 req/s
      if (!text) continue;
      sources.push({
        text,
        date: f.filingDate,
        url: f.url,
        sourceType: 'filing',
      });
    }
  } catch {
    // network/rate-limit: skip filings for this ticker
  }

  // 2. News for the ticker since yesterday (covers late-evening items and Monday
  //    runs picking up weekend coverage). market_news has no major/minor field, so
  //    macro_tier='mover' rows are treated as major_news, the rest as minor_news.
  const newsSince = new Date(Date.parse(runDate) - 1 * 86400000).toISOString().slice(0, 10);
  try {
    const { data: newsRows } = await db
      .from('market_news')
      .select('title, summary, url, published_at, macro_tier')
      .eq('primary_ticker', ticker)
      .gte('published_at', newsSince)
      .order('published_at', { ascending: false })
      .limit(50);
    for (const n of newsRows ?? []) {
      const text = `${n.title}\n${n.summary ?? ''}`.trim().slice(0, CANDIDATE_TEXT_TRUNCATE);
      if (!text) continue;
      sources.push({
        text,
        date: (n.published_at as string) ?? runDate,
        url: n.url as string,
        sourceType: n.macro_tier === 'mover' ? 'major_news' : 'minor_news',
      });
    }
  } catch {
    // query error: skip news for this ticker
  }

  return sources;
}

/**
 * Select the single most newsworthy content event for the run date across the
 * house-thesis universe. Returns null when nothing clears MIN_THRESHOLD.
 */
export async function selectTopEvents(
  runDate: string,
  limit = 1,
  minThreshold: number = MIN_THRESHOLD,
): Promise<ContentEvent[]> {
  const db = await createServiceClient();

  const scored: Array<ScoredItem & { ticker: string; company: string }> = [];

  for (const ticker of CONTENT_UNIVERSE) {
    const thesis = getHouseThesis(ticker);
    if (!thesis) continue;

    const sources = await gatherSources(ticker, runDate, db);
    if (sources.length === 0) continue;

    const hits = await scoreItemsForPillars(ticker, thesis.pillars, sources);

    for (const hit of hits) {
      if (hit.verdict === 'neutral') continue;
      // Verbatim guard at selection: drop fabricated quotes.
      if (!excerptFoundInSource(hit.excerpt, hit.sourceText)) continue;

      const pillar = thesis.pillars.find((p) => p.id === hit.pillarId);
      if (!pillar) continue;

      const score =
        IMPACT[hit.verdict] * SOURCE_WEIGHT[hit.sourceType] * prominence(ticker);

      scored.push({
        hit,
        pillarClaim: pillar.claim,
        score,
        ticker: thesis.ticker,
        company: thesis.company,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  // Keep the single best hit per ticker (variety), above threshold, up to limit.
  const seen = new Set<string>();
  const out: ContentEvent[] = [];
  for (const top of scored) {
    if (top.score < minThreshold) break; // sorted desc: nothing below clears it
    if (seen.has(top.ticker)) continue;
    seen.add(top.ticker);
    out.push({
      id: '', // filled on persist
      ticker: top.ticker,
      company: top.company,
      pillarId: top.hit.pillarId,
      pillarClaim: top.pillarClaim,
      verdict: top.hit.verdict,
      verbatimCite: top.hit.excerpt,
      citeDate: top.hit.date,
      sourceUrl: top.hit.url,
      sourceType: top.hit.sourceType,
      summary: top.hit.summary,
      date: runDate,
      newsworthiness: top.score,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Single most newsworthy event for the day (cron path). Null on a slow day. */
export async function selectTopEvent(
  runDate: string,
  minThreshold: number = MIN_THRESHOLD,
): Promise<ContentEvent | null> {
  const [top] = await selectTopEvents(runDate, 1, minThreshold);
  return top ?? null;
}

/**
 * Tier-3 fallback ("signal or noise"): when no pillar-relevant hit exists anywhere
 * in the universe, take the most-covered house ticker of the day and produce a
 * NEUTRAL event — "the market is loud on X today; none of the reasons we watch
 * changed." verdict='neutral' keeps these off the public /thesis archive (it only
 * accepts supports/contradicts); they exist for the daily social cadence.
 * Cite = the top headline verbatim, so the cite-integrity validator still holds.
 */
export async function selectNoiseEvent(runDate: string): Promise<ContentEvent | null> {
  const db = await createServiceClient();
  const newsSince = new Date(Date.parse(runDate) - 1 * 86400000).toISOString().slice(0, 10);

  const { data: rows } = await db
    .from('market_news')
    .select('primary_ticker, title, summary, url, published_at, macro_tier')
    .in('primary_ticker', CONTENT_UNIVERSE)
    .gte('published_at', newsSince)
    .order('published_at', { ascending: false })
    .limit(400);
  if (!rows?.length) return null;

  // Most-covered ticker wins; mover coverage counts double (attention proxy).
  const weight = new Map<string, number>();
  for (const r of rows) {
    const t = String(r.primary_ticker).toUpperCase();
    weight.set(t, (weight.get(t) ?? 0) + (r.macro_tier === 'mover' ? 2 : 1));
  }
  const ranked = [...weight.entries()].sort((a, b) => b[1] - a[1]);

  for (const [ticker] of ranked) {
    const thesis = getHouseThesis(ticker);
    if (!thesis) continue;
    // The cite is quoted in the post, so the headline must actually be ABOUT this
    // name — primary_ticker tagging is loose (e.g. a CoreWeave story tagged AMZN).
    const tickerRows = rows.filter((r) => String(r.primary_ticker).toUpperCase() === ticker && r.title);
    const nameBits = [ticker, ...thesis.company.split(/\s+/).filter((w) => w.length > 3)];
    const top = tickerRows.find((r) => nameBits.some((b) => String(r.title).toLowerCase().includes(b.toLowerCase())));
    if (!top) continue;
    return {
      id: '',
      ticker: thesis.ticker,
      company: thesis.company,
      pillarId: 'day-coverage',
      pillarClaim: thesis.pillars.map((p) => p.claim).join(' · '),
      verdict: 'neutral',
      verbatimCite: String(top.title).trim(),
      citeDate: (top.published_at as string) ?? runDate,
      sourceUrl: top.url as string,
      sourceType: top.macro_tier === 'mover' ? 'major_news' : 'minor_news',
      summary: `Heaviest house-universe coverage today (${weight.get(ticker)} weighted stories). None of the watched pillars were touched by it.`,
      date: runDate,
      newsworthiness: 0,
    };
  }
  return null;
}
