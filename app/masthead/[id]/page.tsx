import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import {
  getCatchById,
  catchDate,
  catchUrl,
  catchJsonLd,
  sourceLabel,
  type Catch,
} from '@/lib/content/masthead';

// One catch, one URL.
//
// Every entry on /masthead linked to /thesis/{ticker}#c-{id}. A fragment is not
// a citable unit: an assistant quoting one line would send a reader to a page
// carrying forty others, with no way to tell which sentence was meant. The
// corpus is the one thing about Helm a competitor cannot fabricate, and until
// now not one entry in it had an address.

export const revalidate = 1800;

const SERIF = 'var(--font-newsreader), Georgia, serif';

const VERDICT_META: Record<Catch['verdict'], { label: string; color: string; bg: string; border: string }> = {
  supports: { label: 'Thesis holds', color: 'var(--color-positive)', bg: 'var(--color-positive-muted)', border: 'var(--color-positive-border)' },
  contradicts: { label: 'Thesis broke', color: 'var(--color-negative-text)', bg: 'var(--color-negative-muted)', border: 'var(--color-negative-border)' },
  neutral: { label: 'Tested', color: 'var(--color-text-muted)', bg: 'var(--color-border-subtle)', border: 'var(--color-border-base)' },
};

function fmtDate(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function headline(e: Catch): string {
  const subject = e.company && e.company !== e.ticker ? e.company : e.ticker;
  if (e.verdict === 'contradicts') return `A reason to own ${subject} just broke.`;
  if (e.verdict === 'supports') return `A reason to own ${subject} held.`;
  return `A reason to own ${subject} was tested.`;
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const e = await getCatchById(id);
  if (!e) return { title: 'Catch not found | Helm Terminal', robots: { index: false, follow: true } };

  const date = catchDate(e);
  const title = `${e.ticker}: ${headline(e)} | The Masthead`;
  // The quote is the description. It is the part worth citing, and truncating
  // it mid-sentence would misrepresent a verbatim source, so cut on a word.
  const quote = e.verbatim_cite.replace(/\s+/g, ' ').trim();
  const description =
    quote.length > 180 ? `${quote.slice(0, quote.lastIndexOf(' ', 180))}...` : quote;

  return {
    title,
    description,
    alternates: { canonical: catchUrl(e) },
    openGraph: { title, description, url: catchUrl(e), type: 'article', publishedTime: date || undefined },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function CatchPage({ params }: Props) {
  const { id } = await params;
  const e = await getCatchById(id);
  if (!e) notFound();

  const meta = VERDICT_META[e.verdict] ?? VERDICT_META.neutral;
  const date = catchDate(e);
  const subject = e.company && e.company !== e.ticker ? e.company : e.ticker;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(catchJsonLd(e)) }}
      />

      {/* ── Sticky utility bar ── */}
      <div className="sticky top-0 z-20 border-b border-[var(--color-border-strong)] bg-[var(--color-bg-inset)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-3 px-6 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark className="h-5 w-5" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Helm Terminal
            </span>
          </Link>
          <Link
            href="/masthead"
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold)]"
          >
            The Masthead
          </Link>
        </div>
      </div>

      <article className="mx-auto max-w-[760px] px-6 pb-24">
        {/* ── Folio ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-strong)] pt-7 pb-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          <span>{e.ticker}</span>
          <span>{date ? fmtDate(date) : 'Undated'}</span>
        </div>

        {/* ── Verdict + headline ── */}
        <header className="pt-8">
          <span
            className="inline-block px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
          >
            {meta.label}
          </span>
          <h1
            className="mt-4 mb-0 leading-[1.05]"
            style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(32px,5.5vw,52px)' }}
          >
            {headline(e)}
          </h1>
          <p className="mt-4 mb-0 text-[15px] leading-[1.6] text-[var(--color-text-secondary)]">
            Helm tested one of the reasons to own {subject} against a primary source and recorded what
            it found. The sentence below is quoted exactly as it was published.
          </p>
        </header>

        {/* ── The claim under test ── */}
        <section className="mt-9">
          <h2 className="m-0 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            The claim under test
          </h2>
          <p className="mt-2.5 mb-0 text-[18px] leading-[1.55] text-[var(--color-text-primary)]" style={{ fontFamily: SERIF }}>
            {e.pillar_claim}
          </p>
        </section>

        {/* ── The verbatim quote ── */}
        <section className="mt-9">
          <h2 className="m-0 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[var(--color-gold)]">
            What the source actually says
          </h2>
          <blockquote
            className="mt-3 mb-0 border-l-2 pl-5 text-[19px] leading-[1.6] text-[var(--color-text-primary)]"
            style={{ fontFamily: SERIF, borderColor: 'var(--color-gold)' }}
            cite={e.source_url ?? undefined}
          >
            {e.verbatim_cite}
          </blockquote>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.13em] text-[var(--color-text-muted)]">
            <span>{sourceLabel(e.source_type)}</span>
            {date && (
              <>
                <span aria-hidden>&middot;</span>
                <span>{fmtDate(date)}</span>
              </>
            )}
            {e.source_url && (
              <>
                <span aria-hidden>&middot;</span>
                <a
                  href={e.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center text-[var(--color-gold)] underline underline-offset-4 hover:no-underline"
                >
                  Read the source
                </a>
              </>
            )}
          </div>
        </section>

        {e.summary && (
          <section className="mt-9 border-t border-[var(--color-border-base)] pt-6">
            <h2 className="m-0 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Why it matters
            </h2>
            <p className="mt-2.5 mb-0 text-[16px] leading-[1.65] text-[var(--color-text-secondary)]">{e.summary}</p>
          </section>
        )}

        {/* ── Onward ── */}
        <nav aria-label="Continue reading" className="mt-11 flex flex-wrap gap-3 border-t border-[var(--color-border-strong)] pt-7">
          <Link
            href={`/thesis/${e.ticker.toLowerCase()}`}
            className="inline-flex min-h-[44px] items-center border border-[var(--color-gold)] px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-gold)] transition-colors hover:bg-[var(--color-gold)] hover:text-[var(--color-bg-base)]"
          >
            {`The full ${e.ticker} thesis`} &rarr;
          </Link>
          <Link
            href="/masthead"
            className="inline-flex min-h-[44px] items-center border border-[var(--color-border-strong)] px-5 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-gold)]/40"
          >
            Everything the agent caught
          </Link>
        </nav>

        <p className="mt-8 mb-0 text-[13px] leading-[1.6] text-[var(--color-text-muted)]">
          Helm runs this against house theses in public and against your own holdings inside the
          terminal.{' '}
          <Link href="/analyze" className="text-[var(--color-gold)] underline underline-offset-4 hover:no-underline">
            Scan a ticker
          </Link>
          .
        </p>
      </article>

      <LegalFooter />
    </main>
  );
}
