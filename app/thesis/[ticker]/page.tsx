import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { getHouseThesis } from '@/lib/content/house-theses';
import { getTickerThesisData, type PublicCatch } from '@/lib/content/public-thesis';
import type { PillarStatus, Verdict } from '@/lib/content/thesis-status';

// Per-ticker living thesis page. The authored house thesis + its approved, dated, cited
// catches, with a computed current status per pillar and an overall thesis health. Every
// value is real (authored text + DB evidence + pure math); nothing is hand-set per ticker.
// ISR keeps it fresh for crawlers; redirects to the /analyze snapshot when no house thesis.

export const revalidate = 1800;

const BASE = 'https://helmterminal.dev';

function sanitize(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, '');
}

// Status chip palette (token-driven). Severity scale from positive -> negative.
const STATUS_STYLE: Record<PillarStatus, { color: string; bg: string; border: string }> = {
  intact: { color: 'var(--color-positive)', bg: 'var(--color-positive-muted)', border: 'var(--color-positive-border)' },
  watch: { color: 'var(--color-gold)', bg: 'var(--color-gold-surface)', border: 'var(--color-gold-border)' },
  weakening: { color: 'var(--color-warning-text)', bg: 'var(--color-warning-muted)', border: 'var(--color-warning-border)' },
  broken: { color: 'var(--color-negative-text)', bg: 'var(--color-negative-muted)', border: 'var(--color-negative-border)' },
  unverified: { color: 'var(--color-text-muted)', bg: 'var(--color-border-subtle)', border: 'var(--color-border-base)' },
};

const VERDICT_STYLE: Record<Verdict, { label: string; color: string; bg: string; border: string }> = {
  supports: { label: 'Supports', color: 'var(--color-positive)', bg: 'var(--color-positive-muted)', border: 'var(--color-positive-border)' },
  contradicts: { label: 'Contradicts', color: 'var(--color-negative-text)', bg: 'var(--color-negative-muted)', border: 'var(--color-negative-border)' },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker } = await params;
  const symbol = sanitize(ticker);
  const ht = getHouseThesis(symbol);
  if (!ht) {
    return { title: `${symbol} thesis | Helm`, robots: 'noindex' };
  }
  const title = `Should you still hold ${symbol}? The thesis and what would break it | Helm`;
  const description = `Helm's living thesis on ${ht.company} (${symbol}): the reasons to own it, what would break each one, and the dated SEC-filing and news evidence tested against them. Research, not investment advice.`;
  // Index only once the thesis has real evidence. Empty, all-Unverified pages are thin
  // content; they flip indexable automatically as catches accrue (the long-run GEO play).
  // A house thesis is already a curated, deliberate ticker, so evidence alone gates
  // indexing (the high-search meme names like AMC/GME are exactly what we want indexed).
  const data = await getTickerThesisData(symbol);
  const indexable = !!data && data.health !== 'unverified';
  return {
    title,
    description,
    alternates: { canonical: `${BASE}/thesis/${symbol.toLowerCase()}` },
    robots: indexable ? undefined : 'noindex',
    openGraph: {
      title: `Should you still hold ${symbol}? The bull case, the breaks, the evidence`,
      description,
      url: `${BASE}/thesis/${symbol.toLowerCase()}`,
      type: 'article',
    },
  };
}

export default async function ThesisPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const symbol = sanitize(ticker);
  const data = await getTickerThesisData(symbol);
  if (!data) redirect(`/analyze/${symbol.toLowerCase()}`);

  const health = STATUS_STYLE[data.health];

  // FAQPage: answers the natural-language queries AI engines actually receive
  // ("should I still hold X", "what would break the X thesis"), built ONLY from real
  // authored pillars + computed status. No fabricated numbers, no buy/sell advice.
  const evidenceCount = data.pillars.reduce((n, p) => n + p.catches.length, 0);
  const healthPhrase =
    data.health === 'intact' ? 'intact'
    : data.health === 'watch' ? 'intact but worth watching'
    : data.health === 'weakening' ? 'weakening'
    : data.health === 'broken' ? 'broken'
    : 'not yet verified against new evidence';
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Should you still hold ${data.company} (${data.ticker})?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Helm tracks ${data.pillars.length} reason${data.pillars.length === 1 ? '' : 's'} to own ${data.ticker}: ${data.pillars.map((p) => p.claim).join('; ')}. As of ${data.asOfDate ?? 'the latest evidence'}, the thesis reads ${healthPhrase}, based on dated SEC-filing and news evidence tested against each reason. This is research, not investment advice.`,
        },
      },
      {
        '@type': 'Question',
        name: `What would break the ${data.ticker} bull case?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Each reason to own ${data.ticker} has a defined breaking point. The bull case weakens if: ${data.pillars.map((p) => p.breaks_if).join('; ')}. Helm watches these against new filings and news and flags the moment one is contradicted.`,
        },
      },
      {
        '@type': 'Question',
        name: `Is the ${data.ticker} thesis still intact?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Helm's computed status for the ${data.ticker} thesis is ${healthPhrase}${data.asOfDate ? ` as of ${data.asOfDate}` : ''}, derived from ${evidenceCount} dated piece${evidenceCount === 1 ? '' : 's'} of evidence scored against its pillars. Each pillar is rated intact, watch, weakening, or broken.`,
        },
      },
    ],
  };

  // JSON-LD: an Article describing the thesis + a Claim per pillar carrying the latest
  // cited evidence. No fabricated counts — only real quotes/urls that exist in the DB.
  const firstCatchDate = data.pillars
    .flatMap((p) => p.catches.map((c) => c.dateISO))
    .filter(Boolean)
    .sort()[0];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${data.ticker} thesis: is the case still intact?`,
    description: `Living investment thesis on ${data.company} (${data.ticker}), tested against dated filing and news evidence.`,
    ...(firstCatchDate ? { datePublished: firstCatchDate } : {}),
    ...(data.asOfDate ? { dateModified: data.asOfDate } : {}),
    author: { '@type': 'Organization', name: 'Helm Terminal', url: BASE },
    publisher: {
      '@type': 'Organization',
      name: 'Helm Terminal',
      url: BASE,
      logo: { '@type': 'ImageObject', url: `${BASE}/icon` },
    },
    about: { '@type': 'Corporation', name: data.company, tickerSymbol: data.ticker },
    mainEntityOfPage: `${BASE}/thesis/${data.ticker.toLowerCase()}`,
    hasPart: data.pillars.map((p) => {
      const latest = p.catches[0];
      return {
        '@type': 'Claim',
        name: p.claim,
        disambiguatingDescription: p.statusLabel,
        about: { '@type': 'Corporation', name: data.company, tickerSymbol: data.ticker },
        ...(latest
          ? {
              ...(latest.dateISO ? { datePublished: latest.dateISO } : {}),
              citation: {
                '@type': 'CreativeWork',
                text: latest.verbatimCite,
                ...(latest.sourceUrl ? { url: latest.sourceUrl } : {}),
              },
            }
          : {}),
      };
    }),
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
            <Link href="/masthead" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">The Masthead</Link>
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Sign up</Link>
          </div>
        </div>
      </nav>

      <section className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        <header className="mb-10">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Living thesis · tracked against the evidence</div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h1 className="m-0 font-sans font-bold text-[30px] md:text-[42px] tracking-tight leading-[1.1]">
              {data.company} <span className="font-mono text-[var(--color-text-muted)]">{data.ticker}</span>
            </h1>
            <span
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] px-2.5 py-1 rounded"
              style={{ color: health.color, background: health.bg, border: `1px solid ${health.border}` }}
            >
              {data.healthLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-[var(--color-text-muted)] tabular-nums">
            {data.asOfDate && <span>As of {fmtDate(data.asOfDate)}</span>}
            {data.lastChecked && <span>Last checked {fmtDate(data.lastChecked)}</span>}
          </div>
          <p className="mt-5 text-[16px] leading-[1.55] text-[var(--color-text-secondary)]">
            The reasons to own {data.ticker}, the single fact that would break each one, and the dated filing and news
            evidence Helm has tested against them. Status is computed from that evidence, not hand-set.
          </p>
        </header>

        <ol className="m-0 list-none space-y-8 p-0">
          {data.pillars.map((p) => {
            const s = STATUS_STYLE[p.status];
            return (
              <li key={p.id} className="rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-6">
                <div className="mb-3 flex flex-wrap items-start gap-3">
                  <h2 className="m-0 flex-1 min-w-[60%] font-sans font-semibold text-[18px] leading-[1.35] text-[var(--color-text-primary)]">
                    {p.claim}
                  </h2>
                  <span
                    className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-[3px] rounded"
                    style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
                  >
                    {p.statusLabel}
                  </span>
                </div>
                <p className="m-0 mb-5 text-[13px] leading-[1.5] text-[var(--color-text-muted)]">
                  <span className="uppercase tracking-[0.08em] font-mono text-[11px]">Breaks if: </span>
                  {p.breaks_if}
                </p>

                {p.catches.length === 0 ? (
                  <p className="m-0 rounded-md border border-dashed border-[var(--color-border-base)] bg-black/20 p-3.5 text-[13px] leading-[1.5] text-[var(--color-text-muted)]">
                    No filing or news has tested this thesis since monitoring began.
                  </p>
                ) : (
                  <ul className="m-0 list-none space-y-4 p-0">
                    {p.catches.map((c: PublicCatch) => {
                      const v = VERDICT_STYLE[c.verdict];
                      return (
                        <li key={c.id} id={`c-${c.id}`} className="rounded-md border-l-2 border-[var(--color-border-base)] pl-4 scroll-mt-20">
                          <div className="mb-2 flex flex-wrap items-center gap-3">
                            <span
                              className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-[3px] rounded"
                              style={{ color: v.color, background: v.bg, border: `1px solid ${v.border}` }}
                            >
                              {v.label}
                            </span>
                            <span className="ml-auto font-mono text-[12px] text-[var(--color-text-muted)] tabular-nums">{fmtDate(c.dateISO)}</span>
                          </div>
                          <blockquote className="m-0 rounded-md border-l-2 border-[var(--color-gold)]/60 bg-black/30 p-3.5 text-[15px] leading-[1.6] text-[var(--color-text-primary)]">
                            &ldquo;{c.verbatimCite}&rdquo;
                          </blockquote>
                          {c.summary && (
                            <p className="m-0 mt-2 text-[13px] leading-[1.5] text-[var(--color-text-secondary)]">{c.summary}</p>
                          )}
                          <div className="mt-2 flex items-center gap-2 font-mono text-[12px] text-[var(--color-text-muted)]">
                            <span>{c.sourceLabel}</span>
                            {c.sourceUrl && (
                              <>
                                <span>&middot;</span>
                                <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-[44px] px-2 -mx-2 text-[var(--color-gold)] hover:underline">
                                  source &rarr;<span className="sr-only"> (opens in new tab)</span>
                                </a>
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>

        <p className="mt-10 text-[13px] leading-[1.55] text-[var(--color-text-muted)]">
          Research, not investment advice. Helm surfaces the evidence; you decide. This page tracks what to watch on the
          thesis, not whether to buy or sell.
        </p>

        <div className="mt-10 rounded-xl border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] p-6 text-center">
          <p className="m-0 mb-4 text-[16px] text-[var(--color-text-primary)]">
            Helm watches this thesis in public. It watches yours in private.
          </p>
          <Link href="/signup" className="inline-flex items-center min-h-[44px] px-5 py-3 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">
            Watch your own {data.ticker}{' '}thesis &rarr;
          </Link>
          <div className="mt-2 flex items-center justify-center gap-2 font-mono text-[12px] text-[var(--color-text-muted)]">
            <Link href="/masthead" className="inline-flex items-center min-h-[44px] px-2 hover:text-[var(--color-text-primary)] transition-colors">The feed</Link>
            <span aria-hidden="true">&middot;</span>
            <Link href={`/analyze/${data.ticker.toLowerCase()}`} className="inline-flex items-center min-h-[44px] px-2 hover:text-[var(--color-text-primary)] transition-colors">{data.ticker} snapshot</Link>
          </div>
        </div>
      </section>

      <div className="relative z-10">
        <LegalFooter />
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    </main>
  );
}
