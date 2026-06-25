import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { createServiceClient } from '@/lib/supabase/server';

// Public "What Helm caught" feed. The same approved content_events that drive the
// social posts, exposed as a dated, sourced, citable page. House theses only, zero
// user data. Curation = a catch appears here only after it is Approved at /admin.

export const metadata: Metadata = {
  title: 'What Helm caught — filing and news evidence against live theses',
  description:
    'Helm reads SEC filings and market news against public investment theses and surfaces what moves them, each with the verbatim source quote. A running, sourced record of thesis evidence.',
  alternates: { canonical: 'https://helmterminal.dev/caught' },
  openGraph: {
    title: 'What Helm caught',
    description:
      'A running, sourced record of filing and news evidence tested against live investment theses.',
    url: 'https://helmterminal.dev/caught',
    type: 'website',
  },
};

// Revalidate every 30 min so newly approved catches surface for crawlers quickly.
export const revalidate = 1800;

type Verdict = 'supports' | 'contradicts' | 'neutral';

interface EventCols {
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
  supports: { label: 'Supports', color: '#4ADE80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.30)' },
  contradicts: { label: 'Contradicts', color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.30)' },
  neutral: { label: 'Context', color: '#9A9A9A', bg: 'rgba(154,154,154,0.08)', border: 'rgba(154,154,154,0.25)' },
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

export default async function CaughtPage() {
  const db = await createServiceClient();
  const { data } = await db
    .from('content_queue')
    .select(
      'decided_at, content_events(ticker, company, pillar_claim, verdict, verbatim_cite, cite_date, source_url, source_type, run_date)',
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'What Helm caught',
    description: 'Filing and news evidence tested against public investment theses, with verbatim source quotes.',
    itemListElement: events.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'CreativeWork',
        name: `${e.ticker}: ${e.verdict} evidence on a live thesis`,
        datePublished: e.cite_date ?? e.run_date ?? undefined,
        about: e.company ?? e.ticker,
        text: e.verbatim_cite,
        ...(e.source_url ? { citation: e.source_url } : {}),
      },
    })),
  };

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg gridAmbient={false} />

      <nav className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark className="w-6 h-6" />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/thesis-monitoring" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Thesis Monitoring</Link>
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Sign up</Link>
          </div>
        </div>
      </nav>

      <section className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        <header className="mb-9">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">The Masthead · the agent on lookout</div>
          <h1 className="font-sans font-bold text-[30px] md:text-[42px] tracking-tight leading-[1.1] mb-5">What Helm caught</h1>
          <p className="text-[17px] leading-[1.55] text-[var(--color-text-secondary)]">
            Helm reads SEC filings and market news against a set of public investment theses and surfaces the evidence
            that moves them. Every entry carries the verbatim source quote, dated and linked. This is what the same
            agent does for your own holdings inside the terminal.
          </p>
        </header>

        {events.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border-base)] bg-[#131313] p-8 text-center">
            <p className="text-[15px] text-[var(--color-text-secondary)] m-0">
              No catches published yet. The agent runs every market day; entries appear here as they clear review.
            </p>
          </div>
        ) : (
          <ol className="m-0 list-none space-y-4 p-0">
            {events.map((e, i) => {
              const v = VERDICT_META[e.verdict] ?? VERDICT_META.neutral;
              return (
                <li key={i} className="rounded-xl border border-[var(--color-border-base)] bg-[#131313] p-6">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <span className="font-mono text-[15px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-primary)]">{e.ticker}</span>
                    {e.company && e.company !== e.ticker && (
                      <span className="text-[13px] text-[var(--color-text-muted)]">{e.company}</span>
                    )}
                    <span
                      className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-[3px] rounded"
                      style={{ color: v.color, background: v.bg, border: `1px solid ${v.border}` }}
                    >
                      {v.label}
                    </span>
                    <span className="ml-auto font-mono text-[12px] text-[var(--color-text-muted)] tabular-nums">{fmtDate(e.cite_date ?? e.run_date)}</span>
                  </div>

                  <p className="m-0 mb-3 text-[14px] leading-[1.5] text-[var(--color-text-secondary)]">
                    <span className="text-[var(--color-text-muted)]">Tests the thesis: </span>
                    {e.pillar_claim}
                  </p>

                  <blockquote className="m-0 rounded-md border-l-2 border-[var(--color-gold)]/60 bg-black/30 p-3.5 text-[15px] leading-[1.6] text-[var(--color-text-primary)]">
                    &ldquo;{e.verbatim_cite}&rdquo;
                  </blockquote>

                  <div className="mt-3 flex items-center gap-2 font-mono text-[12px] text-[var(--color-text-muted)]">
                    <span>{sourceLabel(e.source_type)}</span>
                    {e.source_url && (
                      <>
                        <span>&middot;</span>
                        <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-gold)] hover:underline">
                          source &rarr;
                        </a>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-12 rounded-xl border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] p-6 text-center">
          <p className="m-0 mb-4 text-[16px] text-[var(--color-text-primary)]">
            Helm watches these theses in public. It watches yours in private.
          </p>
          <Link href="/signup" className="inline-flex px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">
            Take the Helm
          </Link>
        </div>
      </section>

      <div className="relative z-10">
        <LegalFooter />
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
