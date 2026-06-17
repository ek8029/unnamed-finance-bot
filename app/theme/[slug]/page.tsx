import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { THEMES, getTheme } from '@/lib/themes';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return THEMES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const theme = getTheme(slug);
  if (!theme) return { title: 'Theme Not Found | Helm Terminal' };

  const title = `${theme.name} Thesis: What Has to Be True | Helm Terminal`;
  const description = `${theme.tagline} The ${theme.name.toLowerCase()} thesis, the chain of beneficiaries, and what would invalidate it.`.slice(0, 158);

  return {
    title,
    description,
    openGraph: {
      title: `${theme.name} Thesis: What Has to Be True`,
      description,
      url: `https://helmterminal.dev/theme/${slug}`,
      siteName: 'Helm Terminal',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${theme.name} Thesis`,
      description,
    },
    alternates: { canonical: `https://helmterminal.dev/theme/${slug}` },
  };
}

export default async function ThemePage({ params }: PageProps) {
  const { slug } = await params;
  const theme = getTheme(slug);
  if (!theme) notFound();

  const faqs = [
    { q: `What is the ${theme.name.toLowerCase()} thesis?`, a: theme.thesis },
    {
      q: `What would invalidate the ${theme.name.toLowerCase()} thesis?`,
      a: theme.invalidations.join(' '),
    },
    {
      q: `Which stocks are exposed to the ${theme.name.toLowerCase()} theme?`,
      a: `The theme runs through a chain: ${theme.chain.map((c) => `${c.layer} (${c.tickers.join(', ')})`).join('; ')}.`,
    },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `${theme.name} Thesis: What Has to Be True`,
      description: theme.thesis,
      datePublished: theme.updated,
      dateModified: theme.updated,
      author: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      url: `https://helmterminal.dev/theme/${slug}`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://helmterminal.dev' },
        { '@type': 'ListItem', position: 2, name: 'Thesis Monitoring', item: 'https://helmterminal.dev/thesis-monitoring' },
        { '@type': 'ListItem', position: 3, name: theme.name, item: `https://helmterminal.dev/theme/${slug}` },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/thesis-monitoring" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Thesis Monitoring</Link>
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Sign up</Link>
          </div>
        </div>
      </nav>

      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        <header className="mb-8">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Theme Thesis</div>
          <h1 className="font-sans font-bold text-[30px] md:text-[42px] tracking-tight leading-[1.1] mb-4">
            {theme.name}: what has to be true
          </h1>
          <p className="text-[17px] leading-[1.55] text-[var(--color-text-secondary)]">{theme.tagline}</p>
        </header>

        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">The thesis</h2>
            <p>{theme.thesis}</p>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">What has to be true</h2>
            <ul className="space-y-2.5">
              {theme.pillars.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-[var(--color-gold)] mt-0.5">&bull;</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-4">The chain of beneficiaries</h2>
            <div className="space-y-3">
              {theme.chain.map((link, i) => (
                <div key={i} className="sovereign-card rounded p-4">
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <span className="text-[var(--color-text-primary)] font-semibold text-[15px]">{link.layer}</span>
                    <span className="text-[var(--color-text-muted)] text-[12px]">{link.detail}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {link.tickers.map((t) => (
                      <Link
                        key={t}
                        href={`/thesis-risks/${t}`}
                        className="font-mono text-[12px] text-[var(--color-gold)] bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] px-2 py-0.5 rounded hover:brightness-110 transition-all"
                      >
                        {t}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">What would invalidate it</h2>
            <div className="sovereign-card rounded p-5 border-l-2 border-[var(--color-gold)]">
              <ul className="space-y-2.5">
                {theme.invalidations.map((inv, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-[var(--color-gold)] mt-0.5">&bull;</span>
                    <span className="text-[var(--color-text-primary)]">{inv}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">If you are playing this theme</h2>
            <p>
              A theme thesis is only useful if you watch the things that would break it. The invalidation triggers above are the events to monitor, and they show up in filings and earnings before they show up in the price. Helm tracks the pillars behind each name you hold and tells you, with a dated citation, when one weakens. It also flags when several of your holdings rest on the same theme, which is the concentration a position-by-position view hides. See <Link href="/thesis-monitoring" className="text-[var(--color-gold)] hover:underline">how thesis monitoring works</Link>.
            </p>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-5">Common questions</h2>
            <div className="space-y-6">
              {faqs.map((f) => (
                <div key={f.q}>
                  <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)] mb-1.5">{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="sovereign-card rounded p-6 md:p-8 text-center">
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-2">Watch what would break the thesis.</h2>
            <p className="mb-5 max-w-xl mx-auto">Helm monitors the reasons behind every position you hold and tells you when one starts to break. Free to start.</p>
            <Link href="/signup" className="inline-block px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Take the helm</Link>
          </section>

          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border-subtle)] pt-6">
            This content is for educational purposes only and does not constitute financial, tax, or investment advice. Tickers are listed to illustrate a theme, not as recommendations. Helm Terminal is not a registered investment advisor.
          </p>
        </div>
      </article>

      <LegalFooter />
    </main>
  );
}
