import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';

export const metadata: Metadata = {
  title: 'What Is Thesis Monitoring? (And Thesis Drift) | Helm Terminal',
  description:
    'Thesis monitoring tracks the reasons you own each stock against live SEC filings, earnings, and news, and alerts you the moment your reasoning weakens or breaks. A plain guide to thesis monitoring, thesis drift, and how to track your investment thesis.',
  openGraph: {
    title: 'What Is Thesis Monitoring? (And Thesis Drift)',
    description:
      'Track the reasons you own each stock against primary sources. Get alerted the moment your thesis weakens or breaks, with verbatim, dated citations.',
    url: 'https://helmterminal.dev/thesis-monitoring',
    siteName: 'Helm Terminal',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'What Is Thesis Monitoring? (And Thesis Drift)',
    description:
      'Track the reasons you own each stock against primary sources. Get alerted when your thesis breaks.',
  },
  alternates: { canonical: 'https://helmterminal.dev/thesis-monitoring' },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is thesis monitoring?',
    a: 'Thesis monitoring is the practice of tracking the specific reasons you own a stock against live primary sources (SEC filings, earnings, news, and price), so you are alerted the moment your original reasoning weakens or breaks, rather than discovering it quarters later.',
  },
  {
    q: 'What is thesis drift?',
    a: 'Thesis drift is the slow erosion of the reasons you bought a stock. The position may still be in the portfolio, but the facts that justified it have quietly changed. Most investors only notice thesis drift at the next quarterly review, after the damage is done. Thesis monitoring catches it as it happens.',
  },
  {
    q: 'How do I know when to sell a stock I believe in?',
    a: 'Decide what would break your thesis before you buy, then watch for it. If the specific reason you own a stock is contradicted by a filing, an earnings result, or a material news event, the thesis is broken and the position deserves a fresh decision. Conviction is a reason to hold, not a reason to ignore evidence.',
  },
  {
    q: 'What is the difference between a broken thesis and a temporary setback?',
    a: 'A temporary setback is a price move that leaves your reasons intact. A broken thesis is a change to the reasons themselves, for example a lost contract on a position you owned for its government revenue, or margin compression on a position you owned for expanding margins. Price falling is not a broken thesis. A pillar being contradicted is.',
  },
  {
    q: 'Can I monitor SEC filings for only the stocks I own?',
    a: 'Yes. Helm reads SEC EDGAR filings, earnings, and news only for your holdings, and maps each item to the specific pillar of your thesis it affects. You get the filing that matters with the line that matters, not a firehose of every 8-K on the market.',
  },
  {
    q: 'Is there a free thesis tracker?',
    a: 'Helm Terminal is free to use for portfolio aggregation, AI stock analysis, and the actions inbox. The thesis-monitoring layer (pillar tracking, thesis-drift alerts, and shared-driver risk) is part of Helm Pro at $20/month.',
  },
  {
    q: 'What is shared-driver risk?',
    a: 'Shared-driver risk is hidden correlation: when several holdings you believe are diversified actually rest on the same underlying reason, so a single event breaks all of them at once. Helm detects when your positions share a thesis pillar and surfaces the concentration you would miss tracking each name on its own.',
  },
];

export default function ThesisMonitoringPage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'DefinedTermSet',
      name: 'Thesis Monitoring Glossary',
      url: 'https://helmterminal.dev/thesis-monitoring',
      hasDefinedTerm: [
        {
          '@type': 'DefinedTerm',
          name: 'Thesis Monitoring',
          description:
            'The practice of tracking the specific reasons you own a stock against live primary sources (SEC filings, earnings, news, and price), so you are alerted the moment your original reasoning weakens or breaks.',
          inDefinedTermSet: 'https://helmterminal.dev/thesis-monitoring',
        },
        {
          '@type': 'DefinedTerm',
          name: 'Thesis Drift',
          description:
            'The slow erosion of the reasons you bought a stock. The position remains, but the facts that justified it have quietly changed, often unnoticed until the next quarterly review.',
          inDefinedTermSet: 'https://helmterminal.dev/thesis-monitoring',
        },
        {
          '@type': 'DefinedTerm',
          name: 'Shared-Driver Risk',
          description:
            'Hidden correlation across a portfolio: when multiple holdings an investor believes are diversified actually depend on the same underlying thesis pillar, so one event can break all of them at once.',
          inDefinedTermSet: 'https://helmterminal.dev/thesis-monitoring',
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'What Is Thesis Monitoring? (And Thesis Drift)',
      description:
        'A plain guide to thesis monitoring, thesis drift, and how to track the reasons you own each stock against primary sources.',
      datePublished: '2026-06-17',
      dateModified: '2026-06-17',
      author: { '@type': 'Person', name: 'Evan Kim', url: 'https://helmterminal.dev/about', jobTitle: 'Founder' },
      publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      url: 'https://helmterminal.dev/thesis-monitoring',
      about: [
        { '@type': 'DefinedTerm', name: 'Thesis Monitoring' },
        { '@type': 'DefinedTerm', name: 'Thesis Drift' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
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
            <Link href="/analyze" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Analyze</Link>
            <Link href="/pricing" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Pricing</Link>
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Sign up</Link>
          </div>
        </div>
      </nav>

      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        {/* Hero */}
        <header className="mb-10">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Thesis Monitoring</div>
          <h1 className="font-sans font-bold text-[34px] md:text-[44px] tracking-tight leading-[1.08] mb-6">
            What is thesis monitoring?
          </h1>
          <p className="text-[19px] md:text-[21px] leading-[1.5] text-[var(--color-text-primary)] font-medium border-l-2 border-[var(--color-gold)] pl-5">
            Thesis monitoring is the practice of tracking the specific reasons you own a stock against live primary sources, SEC filings, earnings, news, and price, so you are alerted the moment your original reasoning weakens or breaks, rather than discovering it quarters later.
          </p>
        </header>

        <div className="space-y-12 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          {/* Thesis drift */}
          <section>
            <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-3">What is thesis drift?</h2>
            <p className="mb-3">
              <span className="text-[var(--color-text-primary)] font-semibold">Thesis drift is the slow erosion of the reasons you bought a stock.</span> The position is still in your portfolio, but the facts that justified it have quietly changed. The contract you owned it for got cancelled. The margin story reversed. The moat narrowed. Nothing in your account screams about it, so you keep holding a position whose original case no longer exists.
            </p>
            <p>
              Most investors discover thesis drift at the next quarterly review, after the damage is done. Thesis monitoring exists to catch it while it is happening.
            </p>
          </section>

          {/* How it works */}
          <section>
            <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-5">How thesis monitoring works</h2>
            <ol className="space-y-5">
              {[
                ['Write the pillars', 'Break each position into the reasons you actually own it: "government revenue stays sticky," "operating margin keeps expanding," "the AI capex cycle has years to run." Write your own, or let Helm draft them from its analysis.'],
                ['The system watches them', 'Every hour the market is open, Helm scores SEC filings, earnings, news, and price against each pillar.'],
                ['See what is breaking', 'Positions are ranked by how intact the thesis is: intact, weakening, or broken. Every status change is backed by a verbatim, dated citation from the source filing or article. No paraphrased signals. No made-up numbers.'],
                ['Cross-position check', 'Helm flags shared-driver risk: when several holdings you believe are diversified actually rest on the same pillar, so a single event breaks all of them at once.'],
              ].map(([title, body], i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] text-[var(--color-gold)] font-mono text-[14px] font-bold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <span className="text-[var(--color-text-primary)] font-semibold">{title}. </span>
                    <span>{body}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Comparison table */}
          <section>
            <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-3">Thesis monitoring vs portfolio tracking vs a trading journal</h2>
            <p className="mb-5">A tracker tells you what you own. A trading journal logs what you did. Thesis monitoring watches why you own it and tells you when that reason changes.</p>
            <div className="overflow-x-auto sovereign-card rounded">
              <table className="w-full text-[15px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border-base)]">
                    <th className="p-3 font-semibold text-[var(--color-text-primary)]">&nbsp;</th>
                    <th className="p-3 font-semibold text-[var(--color-text-muted)]">Portfolio tracker</th>
                    <th className="p-3 font-semibold text-[var(--color-text-muted)]">Trading journal</th>
                    <th className="p-3 font-semibold text-[var(--color-gold)]">Thesis monitoring</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Answers the question', 'What do I own?', 'What did I do?', 'Why do I own it, and is it still true?'],
                    ['Watches primary sources', 'No', 'No', 'Yes, SEC filings + earnings + news'],
                    ['Alerts when reasoning breaks', 'No', 'No', 'Yes, with dated citations'],
                    ['Cross-position risk', 'Sector weights only', 'No', 'Shared-driver detection'],
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-[var(--color-border-subtle)] last:border-0">
                      <td className="p-3 text-[var(--color-text-primary)] font-medium">{row[0]}</td>
                      <td className="p-3">{row[1]}</td>
                      <td className="p-3">{row[2]}</td>
                      <td className="p-3 text-[var(--color-text-primary)]">{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Worked example */}
          <section>
            <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-3">A worked example</h2>
            <p>
              You own Palantir on two pillars: government revenue stays sticky, and operating margin keeps expanding. France ends an intelligence contract and the UK opens a review of its NHS deal. Helm reads both items the day they appear, attributes them to the government-revenue pillar (not the margin pillar), marks that pillar as weakening, and shows you the dated source for each. You learn your thesis is eroding while it is happening, not at the next quarterly review.
            </p>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-5">Common questions</h2>
            <div className="space-y-6">
              {FAQS.map((f) => (
                <div key={f.q}>
                  <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)] mb-1.5">{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="sovereign-card rounded p-6 md:p-8 text-center">
            <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-2">Watch the reasoning, not just the price.</h2>
            <p className="mb-5 max-w-xl mx-auto">Helm Terminal monitors the thesis behind every position you hold and tells you, with dated citations, when it starts to break. Free to start. The thesis layer is part of Pro at $20/month.</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/signup" className="px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Take the helm</Link>
              <Link href="/best-thesis-trackers" className="px-5 py-2.5 border border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-colors">Compare tools</Link>
            </div>
          </section>

          <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border-subtle)] pt-6">
            This content is for educational purposes only and does not constitute financial, tax, or investment advice. Helm Terminal is not a registered investment advisor.
          </p>
        </div>
      </article>

      <LegalFooter />
    </main>
  );
}
