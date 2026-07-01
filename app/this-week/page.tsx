import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { getPublishedUpdates } from '@/lib/content/weekly-updates';

const SERIF = 'var(--font-newsreader), Georgia, serif';

export const metadata: Metadata = {
  title: 'This Week at Helm — weekly updates from the terminal',
  description:
    'What changed at Helm and what moved across the theses it watches, every week. Founder notes plus a broader market update.',
  alternates: { canonical: '/this-week' },
};

export const dynamic = 'force-dynamic';

const fmt = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export default async function ThisWeekPage() {
  const updates = await getPublishedUpdates(50);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'This Week at Helm',
    description: 'Weekly founder updates and market reads from Helm Terminal.',
    url: 'https://helmterminal.dev/this-week',
    publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
    blogPost: updates.map((u) => ({
      '@type': 'BlogPosting',
      headline: u.title,
      datePublished: u.published_at ?? u.week_of,
      url: `https://helmterminal.dev/this-week/${u.week_of}`,
      author: { '@type': 'Person', name: 'Evan Kim' },
    })),
  };

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <nav className="border-b border-[var(--color-border-base)]">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark className="h-5 w-5" />
            <span className="font-mono text-[12px] uppercase tracking-[0.16em]">Helm Terminal</span>
          </Link>
          <Link href="/masthead" className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] hover:text-[var(--color-gold)]">
            The Masthead
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-[720px] px-6 py-12">
        <header className="mb-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-gold)]">Weekly · from the terminal</p>
          <h1 className="mt-3 leading-[1.05]" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(38px,7vw,64px)' }}>
            This Week at Helm
          </h1>
          <p className="mt-4 max-w-[560px] text-[16px] leading-[1.6] text-[var(--color-text-secondary)]">
            What changed at Helm, and what moved across the theses it watches. A short founder note plus a broader
            market read, every week.
          </p>
        </header>

        {updates.length === 0 ? (
          <div className="border-t border-[var(--color-border-base)] py-12 text-center">
            <p className="text-[15px] text-[var(--color-text-muted)]">First issue is on the way. Check back Monday.</p>
          </div>
        ) : (
          <div>
            {updates.map((u) => (
              <Link
                key={u.id}
                href={`/this-week/${u.week_of}`}
                className="block border-t border-[var(--color-border-base)] py-6 transition-colors hover:bg-white/[0.015]"
              >
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{fmt(u.week_of)}</div>
                <h2 className="mt-2" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(24px,4vw,32px)' }}>{u.title}</h2>
                {u.intro && <p className="mt-2 text-[15px] leading-[1.6] text-[var(--color-text-secondary)]">{u.intro}</p>}
                <span className="mt-3 inline-block font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--color-gold)]">Read this week &rarr;</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <LegalFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
