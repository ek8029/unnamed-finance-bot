import { createServiceClient, createStaticServiceClient } from '@/lib/supabase/server';

/**
 * The approved-catch corpus, shared by /masthead, /masthead/[id], the RSS feed
 * and the sitemap.
 *
 * Each of those four surfaces used to run its own query with its own limit and
 * its own filters, which is how the page ended up showing 32 entries while the
 * feed showed 50 and the sitemap showed none. They now agree by construction.
 *
 * The corpus is the one asset a competitor cannot fabricate: a dated verbatim
 * quote from a primary source, with the verdict it produced against a public
 * thesis. It is worth more the older it gets, so nothing here throws entries
 * away on age.
 */

export type Verdict = 'supports' | 'contradicts' | 'neutral';

export interface Catch {
  id: string;
  pillar_id: string | null;
  ticker: string;
  company: string | null;
  pillar_claim: string;
  verdict: Verdict;
  verbatim_cite: string;
  summary: string | null;
  cite_date: string | null;
  source_url: string | null;
  source_type: string;
  run_date: string | null;
}

interface QueueRow {
  decided_at?: string | null;
  content_events: Catch | null;
}

const COLS =
  'id, pillar_id, ticker, company, pillar_claim, verdict, verbatim_cite, summary, cite_date, source_url, source_type, run_date';

/** The event's own date, which is what everything sorts and dates by. */
export function catchDate(e: Catch): string {
  return e.cite_date ?? e.run_date ?? '';
}

/** Canonical permalink. Every catch has an address. */
export function catchUrl(e: Pick<Catch, 'id'>): string {
  return `https://helmterminal.dev/masthead/${e.id}`;
}

function sortNewestFirst(events: Catch[]): Catch[] {
  // ISO date strings sort lexically, so this is chronological.
  return events.sort((a, b) => catchDate(b).localeCompare(catchDate(a)));
}

/**
 * Every approved catch, newest first.
 *
 * `useStaticClient` is for build-time and route-handler callers (sitemap, RSS)
 * that must not touch cookies. Supabase caps a select at 1000 rows, so this
 * paginates rather than silently truncating.
 */
export async function getApprovedCatches(useStaticClient = false): Promise<Catch[]> {
  const db = useStaticClient ? createStaticServiceClient() : await createServiceClient();
  const all: Catch[] = [];
  const PAGE = 1000;

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('content_queue')
      .select(`decided_at, content_events(${COLS})`)
      .eq('status', 'approved')
      .order('decided_at', { ascending: false })
      .range(from, from + PAGE - 1);

    if (error || !data || data.length === 0) break;
    all.push(
      ...(data as unknown as QueueRow[])
        .map((r) => r.content_events)
        .filter((e): e is Catch => !!e),
    );
    if (data.length < PAGE) break;
  }

  return sortNewestFirst(all);
}

/** One catch by id, or null. Only approved catches are reachable. */
export async function getCatchById(id: string): Promise<Catch | null> {
  const db = createStaticServiceClient();
  const { data } = await db
    .from('content_queue')
    .select(`content_events(${COLS})`)
    .eq('status', 'approved')
    .eq('event_id', id)
    .maybeSingle();

  const row = (data as unknown as QueueRow | null)?.content_events ?? null;
  return row && row.id === id ? row : null;
}

/** Split into the front page (last N days) and everything older. */
export function partitionByAge(events: Catch[], days = 30): { recent: Catch[]; archive: Catch[] } {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const recent: Catch[] = [];
  const archive: Catch[] = [];
  for (const e of events) {
    (catchDate(e).slice(0, 10) >= cutoff ? recent : archive).push(e);
  }
  return { recent, archive };
}

export function sourceLabel(t: string): string {
  return t === 'filing' ? 'SEC filing' : 'News';
}

/**
 * Schema.org for a single catch.
 *
 * The quote is typed as a Quotation inside a Claim, not as CreativeWork.text.
 * The whole point of the page is that the sentence is someone else's, said on a
 * date, in a document you can open, so the markup should say that too.
 */
export function catchJsonLd(e: Catch) {
  const date = catchDate(e);
  return {
    '@context': 'https://schema.org',
    '@type': 'Claim',
    '@id': catchUrl(e),
    url: catchUrl(e),
    text: e.pillar_claim,
    ...(date ? { datePublished: date } : {}),
    about: { '@type': 'Corporation', name: e.company ?? e.ticker, tickerSymbol: e.ticker },
    appearance: {
      '@type': 'Quotation',
      text: e.verbatim_cite,
      ...(date ? { datePublished: date } : {}),
      ...(e.source_url
        ? {
            isBasedOn: {
              '@type': 'CreativeWork',
              url: e.source_url,
              name: sourceLabel(e.source_type),
              ...(date ? { datePublished: date } : {}),
            },
          }
        : {}),
    },
    publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
  };
}
