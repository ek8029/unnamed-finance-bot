import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { GLOSSARY } from '@/lib/glossary';

const BASE = 'https://helmterminal.dev';

export const metadata: Metadata = {
  title: 'The Helm Glossary: Thesis Monitoring, Thesis Drift, and Agentic Finance Terms',
  description:
    'Clear, sourced definitions for the language of thesis-driven investing: thesis drift, thesis monitoring, breaks-if conditions, conviction stops, agentic portfolio terminals, and more.',
  alternates: { canonical: `${BASE}/glossary` },
  openGraph: {
    title: 'The Helm Glossary',
    description: 'Definitions for thesis monitoring, thesis drift, agentic finance, and the vocabulary of thesis-driven investing.',
    url: `${BASE}/glossary`,
    type: 'website',
  },
};

export default function GlossaryIndexPage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'DefinedTermSet',
      name: 'The Helm Glossary',
      url: `${BASE}/glossary`,
      hasDefinedTerm: GLOSSARY.map((t) => ({
        '@type': 'DefinedTerm',
        name: t.term,
        description: t.oneLine,
        url: `${BASE}/glossary/${t.slug}`,
        inDefinedTermSet: `${BASE}/glossary`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
        { '@type': 'ListItem', position: 2, name: 'Glossary', item: `${BASE}/glossary` },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/analyze" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Analyze</Link>
            <Link href="/thesis-monitoring" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Thesis Monitoring</Link>
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Sign up</Link>
          </div>
        </div>
      </nav>

      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        <header className="mb-10">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Glossary</div>
          <h1 className="font-sans font-bold text-[34px] md:text-[44px] tracking-tight leading-[1.08] mb-6">
            The language of thesis-driven investing
          </h1>
          <p className="text-[19px] md:text-[21px] leading-[1.5] text-[var(--color-text-primary)] font-medium border-l-2 border-[var(--color-gold)] pl-5">
            Plain, sourced definitions for the vocabulary behind watching why you own a stock, not just what it is worth.
          </p>
        </header>

        <ul className="space-y-6">
          {GLOSSARY.map((t) => (
            <li key={t.slug}>
              <Link href={`/glossary/${t.slug}`} className="group block sovereign-card rounded p-5 transition-colors hover:border-[var(--color-gold-border)]">
                <h2 className="text-[20px] font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors mb-2">
                  {t.term}
                </h2>
                <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{t.oneLine}</p>
              </Link>
            </li>
          ))}
        </ul>
      </article>

      <LegalFooter />
    </main>
  );
}
