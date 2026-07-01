import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { createServiceClient } from '@/lib/supabase/server';
import { getLatestPublished } from '@/lib/content/weekly-updates';

// "The Masthead" — the public catch feed, presented as a dark financial broadsheet.
// The same approved content_events that drive the social posts, exposed as a dated,
// sourced, citable front page. House theses only, zero user data. Curation = a catch
// appears here only after it is Approved at /admin.

export const metadata: Metadata = {
  title: 'The Masthead — filing and news evidence against live theses',
  description:
    'Helm reads SEC filings and market news against public investment theses and surfaces what moves them, each with the verbatim source quote. A running, sourced record of thesis evidence.',
  alternates: { canonical: 'https://helmterminal.dev/masthead' },
  openGraph: {
    title: 'The Masthead',
    description:
      'A running, sourced record of filing and news evidence tested against live investment theses.',
    url: 'https://helmterminal.dev/masthead',
    type: 'website',
  },
};

// Revalidate every 30 min so newly approved catches surface for crawlers quickly.
export const revalidate = 1800;

// Editorial display serif (self-hosted via next/font, CSP-safe). Newsreader is the
// broadsheet face chosen in the /masthead-preview harness; Georgia is the fallback.
const SERIF = 'var(--font-newsreader), Georgia, serif';

type Verdict = 'supports' | 'contradicts' | 'neutral';

interface EventCols {
  id: string;
  pillar_id: string | null;
  ticker: string;
  company: string | null;
  pillar_claim: string;
  verdict: Verdict;
  verbatim_cite: string;
  cite_date: string | null;
  source_url: string | null;
  source_type: string;
  run_date: string | null;
}
interface QueueRow {
  decided_at: string | null;
  content_events: EventCols | null;
}

const VERDICT_META: Record<Verdict, { label: string; color: string; bg: string; border: string }> = {
  supports: { label: 'Thesis holds', color: 'var(--color-positive)', bg: 'var(--color-positive-muted)', border: 'var(--color-positive-border)' },
  contradicts: { label: 'Thesis broke', color: 'var(--color-negative-text)', bg: 'var(--color-negative-muted)', border: 'var(--color-negative-border)' },
  neutral: { label: 'Tested', color: 'var(--color-text-muted)', bg: 'var(--color-border-subtle)', border: 'var(--color-border-base)' },
};

function fmtDate(raw: string | null): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function sourceLabel(t: string): string {
  return t === 'filing' ? 'SEC filing' : 'News';
}

// Honest, verdict-driven headline derived only from the catch's own real fields. A
// contradiction "broke"; a confirmation "held"; anything else "was tested". No fabrication.
function leadHeadline(e: EventCols): string {
  const subject = e.company && e.company !== e.ticker ? e.company : e.ticker;
  if (e.verdict === 'contradicts') return `A reason to own ${subject} just broke.`;
  if (e.verdict === 'supports') return `A reason to own ${subject} held.`;
  return `A reason to own ${subject} was tested.`;
}

export default async function MastheadPage() {
  const db = await createServiceClient();
  const { data } = await db
    .from('content_queue')
    .select(
      'decided_at, content_events(id, pillar_id, ticker, company, pillar_claim, verdict, verbatim_cite, cite_date, source_url, source_type, run_date)',
    )
    .eq('status', 'approved')
    .order('decided_at', { ascending: false })
    .limit(50);

  const rows = ((data ?? []) as unknown as QueueRow[]).filter((r) => r.content_events);
  // Only surface catches from the last 30 days; older ones drop off automatically.
  const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const events = rows
    .map((r) => r.content_events as EventCols)
    .filter((e) => (e.cite_date ?? e.run_date ?? '').slice(0, 10) >= cutoff30);
  // Newest catch first by the event's own date (cite_date, falling back to run_date).
  // ISO date strings sort lexically, so localeCompare gives chronological order.
  events.sort((a, b) => (b.cite_date ?? b.run_date ?? '').localeCompare(a.cite_date ?? a.run_date ?? ''));

  const lead = events[0] ?? null;
  const rest = events.slice(1);

  // Edition dateline — today's date, computed server-side (refreshes with ISR).
  const editionDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const thisWeek = await getLatestPublished();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'The Masthead: what Helm caught',
    description: 'Filing and news evidence tested against public investment theses, with verbatim source quotes.',
    url: 'https://helmterminal.dev/masthead',
    isPartOf: { '@type': 'WebSite', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
    publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
    ...(events.length && (events[0].cite_date ?? events[0].run_date)
      ? { dateModified: events[0].cite_date ?? events[0].run_date }
      : {}),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: events.length,
      itemListElement: events.map((e, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://helmterminal.dev/thesis/${e.ticker.toLowerCase()}`,
        item: {
          '@type': 'CreativeWork',
          name: `${e.ticker}: ${e.verdict} evidence on a live thesis`,
          url: `https://helmterminal.dev/thesis/${e.ticker.toLowerCase()}`,
          ...(e.cite_date ?? e.run_date ? { datePublished: e.cite_date ?? e.run_date } : {}),
          about: { '@type': 'Corporation', name: e.company ?? e.ticker, tickerSymbol: e.ticker },
          text: e.verbatim_cite,
          ...(e.source_url ? { citation: { '@type': 'CreativeWork', url: e.source_url } } : {}),
        },
      })),
    },
  };

  return (
    <main
      className="min-h-screen bg-[var(--color-bg-inset)] text-[var(--color-text-primary)]"
      style={{ ['--font-serif' as string]: SERIF }}
    >
      {/* ── Sticky utility bar ── */}
      <div className="sticky top-0 z-20 border-b border-[var(--color-border-strong)] bg-[var(--color-bg-inset)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-6 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark className="h-5 w-5" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Helm Terminal
            </span>
          </Link>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            <span
              className="inline-block h-[6px] w-[6px] rounded-full bg-[var(--color-positive)]"
              style={{ boxShadow: '0 0 7px var(--color-positive)' }}
              aria-hidden
            />
            The agent is filing
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1100px] px-6 pb-24">
        {/* ── Folio line ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-7 pb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          <span>The agent on lookout</span>
          <span className="hidden sm:inline">Portfolio intelligence, not tracking</span>
          <span>{editionDate}</span>
        </div>

        {/* ── Nameplate ── */}
        <header className="border-t border-[var(--color-border-strong)] py-6 text-center" style={{ borderBottom: '3px double var(--color-border-strong)' }}>
          <div className="flex items-center justify-center gap-4">
            <HelmMark className="h-9 w-9" />
            <h1
              className="m-0 leading-[0.9]"
              style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(46px,9vw,92px)', letterSpacing: '0.01em' }}
            >
              The Masthead
            </h1>
          </div>
          <div className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-gold)]">
            Published by Helm Terminal &middot; for self-directed investors
          </div>
        </header>

        {/* ── Dateline rule ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-strong)] py-2.5 font-mono text-[10px] uppercase tracking-[0.13em] text-[var(--color-text-muted)]">
          <span>Filing &amp; news evidence &middot; updated continuously</span>
          <span className="hidden sm:inline">{events.length === 1 ? '1 entry on file' : `${events.length} entries on file`}</span>
          <span>For the conviction investor</span>
        </div>

        {/* ── Standing intro ── */}
        <p className="mx-auto mt-6 mb-2 max-w-[640px] text-center text-[15px] leading-[1.6] text-[var(--color-text-secondary)]">
          Helm reads SEC filings and market news against a set of public investment theses and surfaces the evidence
          that moves them. Every entry carries the verbatim source quote, dated and linked. This is what the same agent
          does for your own holdings inside the terminal.
        </p>

        {thisWeek && (
          <Link
            href="/this-week"
            className="mx-auto mt-6 block max-w-[640px] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-5 py-4 transition-colors hover:border-[var(--color-gold)]/40"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-gold)]">This Week at Helm</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                {new Date(thisWeek.week_of + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="mt-1.5 text-[17px] text-[var(--color-text-primary)]" style={{ fontFamily: SERIF }}>{thisWeek.title}</div>
            {thisWeek.intro && <p className="mt-1 text-[13px] leading-[1.5] text-[var(--color-text-secondary)]">{thisWeek.intro}</p>}
            <span className="mt-2 inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-gold)]">Read this week &rarr;</span>
          </Link>
        )}

        {lead === null ? (
          <div className="mt-10 border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-10 text-center">
            <p className="m-0 text-[15px] text-[var(--color-text-secondary)]">
              No catches published yet. The agent runs every market day; entries appear here as they clear review.
            </p>
          </div>
        ) : (
          <>
            {/* ── Lead story ── */}
            <article className="border-b border-[var(--color-border-strong)] pt-7 pb-9">
              {(() => {
                const v = VERDICT_META[lead.verdict] ?? VERDICT_META.neutral;
                const broke = lead.verdict === 'contradicts';
                return (
                  <>
                    <div
                      className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]"
                      style={{ color: v.color }}
                    >
                      <span
                        className="inline-block h-[6px] w-[6px] rounded-full"
                        style={{ background: v.color, boxShadow: `0 0 8px ${v.color}` }}
                        aria-hidden
                      />
                      Today&apos;s catch &middot; {v.label}
                    </div>

                    <h2
                      className="m-0 text-balance"
                      style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(34px,5vw,60px)', lineHeight: 1.0, letterSpacing: '-0.01em' }}
                    >
                      {leadHeadline(lead)}
                    </h2>

                    <div className="my-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-[var(--color-border-base)] py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                      <span>
                        Filed by the <span className="text-[var(--color-gold)]">Helm agent</span>
                      </span>
                      <span aria-hidden>&middot;</span>
                      <span className="tabular-nums">{fmtDate(lead.cite_date ?? lead.run_date)}</span>
                      <span aria-hidden>&middot;</span>
                      <Link
                        href={`/thesis/${lead.ticker.toLowerCase()}#c-${lead.id}`}
                        className="inline-flex items-center min-h-[44px] -my-[11px] pr-1 text-[var(--color-gold)] hover:underline"
                      >
                        {lead.ticker}
                      </Link>
                      {lead.company && lead.company !== lead.ticker && (
                        <span className="normal-case tracking-normal text-[var(--color-text-muted)]">{lead.company}</span>
                      )}
                    </div>

                    <p className="m-0 mb-5 max-w-[680px] text-[15px] leading-[1.7] text-[var(--color-text-secondary)]">
                      <span className="text-[var(--color-text-muted)]">The reason on file: </span>
                      <span
                        className="pl-2"
                        style={{ borderLeft: `2px solid ${v.color}` }}
                      >
                        {lead.pillar_claim}{/[.!?]$/.test(lead.pillar_claim) ? '' : '.'}
                      </span>{' '}
                      {broke
                        ? 'For months the agent confirmed that pillar against the record. This entry is where it broke.'
                        : lead.verdict === 'supports'
                          ? 'The agent tested that pillar against the record, and here it held.'
                          : 'The agent tested that pillar against the record. Here is the evidence.'}
                    </p>

                    <figure className="m-0 border-y border-[var(--color-border-strong)] py-6">
                      <blockquote
                        className="m-0 italic"
                        style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(21px,2.9vw,33px)', lineHeight: 1.3 }}
                      >
                        &ldquo;{lead.verbatim_cite}&rdquo;
                      </blockquote>
                      <figcaption className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-gold)]">
                        <span>Cited &middot; {sourceLabel(lead.source_type)}</span>
                        {lead.source_url && (
                          <>
                            <span aria-hidden>&middot;</span>
                            <a
                              href={lead.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center min-h-[44px] -my-[11px] px-1 hover:underline"
                            >
                              source &rarr;<span className="sr-only"> (opens in new tab)</span>
                            </a>
                          </>
                        )}
                        <span aria-hidden>&middot;</span>
                        <span className="text-[var(--color-text-muted)]">the line that {broke ? 'broke' : 'held'} the thesis</span>
                      </figcaption>
                    </figure>
                  </>
                );
              })()}
            </article>

            {/* ── The record (remaining catches) ── */}
            {rest.length > 0 && (
              <section>
                <div
                  className="pt-7 pb-3 italic"
                  style={{ fontFamily: SERIF, fontSize: '22px', borderBottom: '2px solid var(--color-border-strong)' }}
                >
                  More from the record
                </div>
                <ol className="m-0 list-none p-0">
                  {rest.map((e, i) => {
                    const v = VERDICT_META[e.verdict] ?? VERDICT_META.neutral;
                    return (
                      <li
                        key={e.source_url ?? `${e.ticker}-${e.cite_date ?? i}`}
                        className="border-b border-[var(--color-border-base)] py-6"
                      >
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <h3 className="m-0 font-mono text-[15px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-primary)]">
                            <Link
                              href={`/thesis/${e.ticker.toLowerCase()}#c-${e.id}`}
                              className="inline-flex items-center min-h-[44px] -my-[11px] pr-1 hover:text-[var(--color-gold)] transition-colors"
                            >
                              {e.ticker}
                            </Link>
                          </h3>
                          {e.company && e.company !== e.ticker && (
                            <span className="text-[13px] text-[var(--color-text-muted)]">{e.company}</span>
                          )}
                          <span
                            className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-[3px] rounded"
                            style={{ color: v.color, background: v.bg, border: `1px solid ${v.border}` }}
                          >
                            {v.label}
                          </span>
                          <span className="ml-auto font-mono text-[12px] tabular-nums text-[var(--color-text-muted)]">
                            {fmtDate(e.cite_date ?? e.run_date)}
                          </span>
                        </div>

                        <p className="m-0 mb-3 text-[14px] leading-[1.5] text-[var(--color-text-secondary)]">
                          <span className="text-[var(--color-text-muted)]">Tests the thesis: </span>
                          {e.pillar_claim}
                        </p>

                        <blockquote
                          className="m-0 italic text-[var(--color-text-primary)]"
                          style={{ fontFamily: SERIF, fontSize: '18px', lineHeight: 1.45 }}
                        >
                          &ldquo;{e.verbatim_cite}&rdquo;
                        </blockquote>

                        <div className="mt-3 flex items-center gap-2 font-mono text-[12px] text-[var(--color-text-muted)]">
                          <span>{sourceLabel(e.source_type)}</span>
                          {e.source_url && (
                            <>
                              <span aria-hidden>&middot;</span>
                              <a
                                href={e.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center min-h-[44px] -my-[11px] px-2 -mx-2 text-[var(--color-gold)] hover:underline"
                              >
                                source &rarr;<span className="sr-only"> (opens in new tab)</span>
                              </a>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </>
        )}

        {/* ── Colophon ── */}
        <div className="mt-10 border-t border-[var(--color-border-strong)] pt-6 text-center">
          <p
            className="m-0 mb-1 italic text-[var(--color-text-primary)]"
            style={{ fontFamily: SERIF, fontSize: '20px', lineHeight: 1.25 }}
          >
            Helm watches these theses in public. It watches yours in private.
          </p>
          <p className="mx-auto mt-3 max-w-[560px] text-[12px] leading-[1.6] text-[var(--color-text-muted)]">
            Every entry links to a primary source. This is research and monitoring, not investment advice, and not a buy
            or sell recommendation.
          </p>
          <Link
            href="/signup"
            className="mt-5 inline-flex items-center min-h-[44px] px-5 py-3 bg-[var(--color-gold)] text-[var(--color-bg-inset)] font-bold text-[12px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
          >
            Take the Helm
          </Link>
        </div>
      </div>

      <LegalFooter />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
