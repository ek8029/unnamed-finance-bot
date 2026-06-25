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

  // 1. Recent SEC filings on/after runDate
  try {
    const filings = await getRecentFilings(ticker, runDate);
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

  // 2. Today's news for the ticker. market_news has no major/minor field, so
  //    macro_tier='mover' rows are treated as major_news, the rest as minor_news.
  try {
    const { data: newsRows } = await db
      .from('market_news')
      .select('title, summary, url, published_at, macro_tier')
      .eq('primary_ticker', ticker)
      .gte('published_at', runDate)
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
