import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { GLOSSARY, getGlossaryTerm } from '@/lib/glossary';

const BASE = 'https://helmterminal.dev';

export function generateStaticParams() {
  return GLOSSARY.map((t) => ({ term: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ term: string }>;
}): Promise<Metadata> {
  const { term } = await params;
  const entry = getGlossaryTerm(term);
  if (!entry) return { title: 'Glossary | Helm Terminal', robots: 'noindex' };
  const title = `What is ${entry.term}? | Helm Terminal`;
  const description = entry.oneLine.length > 158 ? `${entry.oneLine.slice(0, 155)}...` : entry.oneLine;
  return {
    title,
    description,
    alternates: { canonical: `${BASE}/glossary/${entry.slug}` },
    openGraph: { title: `What is ${entry.term}?`, description, url: `${BASE}/glossary/${entry.slug}`, type: 'article' },
    twitter: { card: 'summary', title: `What is ${entry.term}?`, description },
  };
}

export default async function GlossaryTermPage({ params }: { params: Promise<{ term: string }> }) {
  const { term } = await params;
  const entry = getGlossaryTerm(term);
  if (!entry) notFound();

  const url = `${BASE}/glossary/${entry.slug}`;
  const seeAlso = entry.seeAlso.map(getGlossaryTerm).filter(Boolean) as NonNullable<ReturnType<typeof getGlossaryTerm>>[];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'DefinedTerm',
      name: entry.term,
      description: entry.oneLine,
      url,
      termCode: entry.slug,
      inDefinedTermSet: `${BASE}/glossary`,
      ...(entry.aka.length ? { alternateName: entry.aka } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `What is ${entry.term}?`,
      description: entry.oneLine,
      mainEntityOfPage: url,
      author: { '@type': 'Person', name: 'Evan Kim', url: `${BASE}/about`, jobTitle: 'Founder' },
      publisher: {
        '@type': 'Organization',
        name: 'Helm Terminal',
        url: BASE,
        logo: { '@type': 'ImageObject', url: `${BASE}/icon` },
      },
      about: { '@type': 'DefinedTerm', name: entry.term },
      ...(entry.sources.length
        ? { citation: entry.sources.map((s) => ({ '@type': 'CreativeWork', name: s.label, url: s.url })) }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: entry.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
        { '@type': 'ListItem', position: 2, name: 'Glossary', item: `${BASE}/glossary` },
        { '@type': 'ListItem', position: 3, name: entry.term, item: url },
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
            <Link href="/glossary" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Glossary</Link>
            <Link href="/analyze" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Analyze</Link>
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Sign up</Link>
          </div>
        </div>
      </nav>

      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        <header className="mb-10">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">
            <Link href="/glossary" className="hover:text-[var(--color-text-primary)] transition-colors">Glossary</Link>
          </div>
          <h1 className="font-sans font-bold text-[34px] md:text-[44px] tracking-tight leading-[1.08] mb-6">
            What is {entry.term.toLowerCase()}?
          </h1>
          <p className="text-[19px] md:text-[21px] leading-[1.5] text-[var(--color-text-primary)] font-medium border-l-2 border-[var(--color-gold)] pl-5">
            {entry.oneLine}
          </p>
          {entry.aka.length > 0 && (
            <p className="mt-4 text-[13px] text-[var(--color-text-muted)]">
              Also called: {entry.aka.join(', ')}
            </p>
          )}
        </header>

        <div className="space-y-12 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          {entry.sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-3">{s.h}</h2>
              {s.p.map((para, j) => (
                <p key={j} className={j < s.p.length - 1 ? 'mb-3' : ''}>{para}</p>
              ))}
            </section>
          ))}

          {/* FAQ */}
          {entry.faqs.length > 0 && (
            <section>
              <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-5">Common questions</h2>
              <div className="space-y-5">
                {entry.faqs.map((f, i) => (
                  <div key={i}>
                    <p className="text-[var(--color-text-primary)] font-semibold mb-1">{f.q}</p>
                    <p>{f.a}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related Helm feature */}
          {entry.related && (
            <section className="sovereign-card rounded p-5 border-l-2 border-[var(--color-gold)]">
              <p className="text-[var(--color-text-primary)]">
                {entry.related.label}:{' '}
                <Link href={entry.related.href} className="text-[var(--color-gold)] hover:underline">
                  open it
                </Link>
              </p>
            </section>
          )}

          {/* See also */}
          {seeAlso.length > 0 && (
            <section>
              <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-3">Related terms</h2>
              <ul className="flex flex-wrap gap-2">
                {seeAlso.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/glossary/${t.slug}`}
                      className="inline-flex items-center min-h-[40px] px-3 rounded border border-[var(--color-border-base)] text-[var(--color-text-primary)] hover:border-[var(--color-gold-border)] transition-colors"
                    >
                      {t.term}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Sources */}
          {entry.sources.length > 0 && (
            <section>
              <h2 className="text-[15px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.1em] mb-3">Sources</h2>
              <ul className="space-y-1.5 text-[14px]">
                {entry.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] hover:underline">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </article>

      <LegalFooter />
    </main>
  );
}
