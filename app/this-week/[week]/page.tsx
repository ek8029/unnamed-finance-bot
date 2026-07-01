import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { MarkdownLite } from '@/components/markdown-lite';
import { getPublishedByWeek } from '@/lib/content/weekly-updates';

const SERIF = 'var(--font-newsreader), Georgia, serif';

export const dynamic = 'force-dynamic';

const fmt = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export async function generateMetadata({ params }: { params: Promise<{ week: string }> }): Promise<Metadata> {
  const { week } = await params;
  const u = await getPublishedByWeek(week);
  if (!u) return { title: 'This Week at Helm' };
  return {
    title: `${u.title} — This Week at Helm`,
    description: u.intro || `Helm's weekly update for ${fmt(u.week_of)}.`,
    alternates: { canonical: `/this-week/${week}` },
  };
}

export default async function ThisWeekEntry({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  const u = await getPublishedByWeek(week);
  if (!u) notFound();

  const url = `https://helmterminal.dev/this-week/${week}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: u.title,
    description: u.intro,
    datePublished: u.published_at ?? u.week_of,
    dateModified: u.updated_at,
    author: { '@type': 'Person', name: 'Evan Kim' },
    publisher: {
      '@type': 'Organization',
      name: 'Helm Terminal',
      url: 'https://helmterminal.dev',
      logo: { '@type': 'ImageObject', url: 'https://helmterminal.dev/icon.png' },
    },
    url,
    mainEntityOfPage: url,
  };

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <nav className="border-b border-[var(--color-border-base)]">
        <div className="mx-auto flex max-w-[680px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark className="h-5 w-5" />
            <span className="font-mono text-[12px] uppercase tracking-[0.16em]">Helm Terminal</span>
          </Link>
          <Link href="/this-week" className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] hover:text-[var(--color-gold)]">
            All issues
          </Link>
        </div>
      </nav>

      <article className="mx-auto max-w-[680px] px-6 py-12">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-gold)]">This Week at Helm · {fmt(u.week_of)}</div>
        <h1 className="mt-3 leading-[1.08]" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(32px,6vw,52px)' }}>{u.title}</h1>
        {u.intro && <p className="mt-4 text-[17px] leading-[1.6] text-[var(--color-text-secondary)]">{u.intro}</p>}

        <div className="mt-9 border-t border-[var(--color-border-base)] pt-8">
          <h2 className="mb-1 font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--color-gold)]">What changed at Helm</h2>
          <MarkdownLite text={u.body_helm} className="text-[16px] text-[var(--color-text-secondary)]" />
        </div>

        {u.body_market && u.body_market.trim() && (
          <div className="mt-9 border-t border-[var(--color-border-base)] pt-8">
            <h2 className="mb-1 font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--color-gold)]">Broader market update</h2>
            <MarkdownLite text={u.body_market} className="text-[16px] text-[var(--color-text-secondary)]" />
            <p className="mt-5 text-[13px] text-[var(--color-text-muted)]">
              Pulled from the theses Helm tracks in public. See the full board on{' '}
              <Link href="/masthead" className="text-[var(--color-gold)] hover:underline">The Masthead</Link>.
            </p>
          </div>
        )}

        <div className="mt-12 border-t border-[var(--color-border-base)] pt-6">
          <Link href="/this-week" className="font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] hover:text-[var(--color-gold)]">&larr; All issues</Link>
        </div>
      </article>

      <LegalFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
