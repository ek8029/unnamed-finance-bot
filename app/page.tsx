import { unstable_cache } from 'next/cache';
import { getDemoAnalyses } from '@/lib/demo-tickers';
import { getTickerTapeData } from '@/lib/ticker-tape';
import { createStaticServiceClient } from '@/lib/supabase/server';
import HomeContent from '@/components/homepage/home-content';

/** ISR — regenerate every 5 minutes */
export const revalidate = 300;

const getCachedDemoAnalyses = unstable_cache(
  () => getDemoAnalyses(),
  ['homepage-demo-analyses'],
  { revalidate: 300 }
);

const getCachedTickerTape = unstable_cache(
  () => getTickerTapeData(),
  ['homepage-ticker-tape'],
  { revalidate: 300 }
);

interface CatchEvent {
  ticker: string;
  company: string | null;
  pillar_id: string | null;
  pillar_claim: string | null;
  verdict: string;
  verbatim_cite: string;
  cite_date: string | null;
  source_url: string | null;
  source_type: string;
  run_date: string | null;
}

export interface LatestCatch {
  ticker: string;
  company: string;
  verdict: string;
  /** the thesis pillar this filing was tested against */
  pillarClaim: string | null;
  verbatimCite: string;
  sourceLabel: string;
  dateISO: string;
  dateLabel: string;
}

/**
 * Fetch the single newest approved catch for the homepage catch strip.
 * Real DB data only — returns null on any error / empty so the page always renders.
 */
async function getLatestCatch(): Promise<LatestCatch | null> {
  try {
    const db = createStaticServiceClient();
    const { data, error } = await db
      .from('content_queue')
      .select(
        'decided_at, content_events!inner(ticker, company, pillar_id, pillar_claim, verdict, verbatim_cite, cite_date, source_url, source_type, run_date)',
      )
      .eq('status', 'approved')
      .order('decided_at', { ascending: false })
      .limit(50);

    if (error || !data) return null;

    const events = (data as unknown as { content_events: CatchEvent | null }[])
      .map((r) => r.content_events)
      .filter((e): e is CatchEvent => e != null);
    if (events.length === 0) return null;

    // A contradiction outranks a confirmation, then newest first.
    //
    // Newest-first alone kept surfacing whichever catch happened to land last,
    // and 51 of the 60 approved catches are `supports` — so the homepage was
    // usually showing a filing that agrees with a thesis nobody has read yet.
    // The page claims the agent keeps what CHANGED, and a contradiction is the
    // only one of the two that demonstrates it. Both are real either way; this
    // only decides which real one leads.
    // Then: a primary source beats a news take, and a company a stranger
    // recognises beats one they have to look up. A visitor who has never heard
    // of the ticker cannot tell whether the contradiction matters, so the
    // finding lands as trivia. This only orders real catches; it never invents
    // or edits one.
    const KNOWN = new Set([
      'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'GOOG', 'META', 'TSLA', 'NFLX',
      'AMD', 'AVGO', 'PLTR', 'COST', 'JPM', 'DIS', 'UBER', 'SBUX', 'NKE', 'PYPL',
    ]);
    const rank = (e: CatchEvent) => [
      e.verdict === 'contradicts' ? 0 : 1,
      e.source_type === 'filing' ? 0 : 1,
      KNOWN.has(e.ticker) ? 0 : 1,
    ];
    events.sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
      return (b.cite_date ?? b.run_date ?? '').localeCompare(a.cite_date ?? a.run_date ?? '');
    });
    const e = events[0];

    const raw = e.cite_date ?? e.run_date;
    if (!e.verbatim_cite || !raw) return null;

    const d = new Date(raw);
    const dateLabel = Number.isNaN(d.getTime())
      ? raw
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

    return {
      ticker: e.ticker,
      company: e.company ?? e.ticker,
      verdict: e.verdict,
      pillarClaim: e.pillar_claim,
      verbatimCite: e.verbatim_cite,
      sourceLabel: e.source_type === 'filing' ? 'SEC filing' : 'News',
      dateISO: raw.slice(0, 10),
      dateLabel,
    };
  } catch {
    return null;
  }
}

/**
 * Homepage — Server Component wrapper.
 * Data fetches wrapped in unstable_cache to enable ISR
 * (underlying fetches use no-store which would otherwise force dynamic).
 */
export default async function HomePage() {
  const timeout = <T,>(p: Promise<T>, ms: number, fallback: T) =>
    Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

  const [demoAnalyses, tickerTape, latestCatch] = await Promise.all([
    timeout(getCachedDemoAnalyses(), 3000, []),
    timeout(getCachedTickerTape(), 3000, []),
    timeout(getLatestCatch(), 3000, null),
  ]);

  return <HomeContent demoAnalyses={demoAnalyses} tickerTape={tickerTape} latestCatch={latestCatch} />;
}
