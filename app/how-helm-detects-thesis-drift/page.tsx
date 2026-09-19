import { SiteNav } from '@/components/site-nav';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';

export const metadata: Metadata = {
  title: 'How Helm Detects Thesis Drift (Methodology) | Helm Terminal',
  description:
    'How Helm checks investment theses against filings, news and market data, derives status, and presents evidence you can review.',
  openGraph: {
    title: 'How Helm Detects Thesis Drift (Methodology)',
    description:
      'How Helm scores your thesis pillars against SEC filings and news, and how it decides a pillar is weakening or broken.',
    url: 'https://helmterminal.dev/how-helm-detects-thesis-drift',
    siteName: 'Helm Terminal',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How Helm Detects Thesis Drift (Methodology)',
    description: 'The methodology behind Helm thesis monitoring.',
  },
  alternates: { canonical: 'https://helmterminal.dev/how-helm-detects-thesis-drift' },
};

const FAQS = [
  {
    q: 'How does Helm decide a thesis is weakening?',
    a: 'For a monitored personal thesis, weakening requires a material contradiction from a primary source or two independently keyed material contradictions within the last 30 days. Broken generally requires two such contradictions with at least one primary source. A severe primary contradiction can trigger broken on its own; the current scorer applies that exception to a price move of at least 20% classified as a material contradiction. A saved status override takes precedence.',
  },
  {
    q: 'How can I check the evidence?',
    a: 'Text-source excerpts are checked against the retrieved source text before they enter the evidence record. Price and structured financial data use system-generated descriptions instead of quotations. AI-written explanations are interpretations and can be wrong. Review the source, its date, and the connection to your stated reason before acting.',
  },
  {
    q: 'What sources does Helm read?',
    a: 'Available sources include SEC filings, insider transaction filings, structured financial facts, news and price moves. Evidence records include the excerpt or data description and source details. Coverage depends on the ticker, available data and successful processing.',
  },
  {
    q: 'How often does Helm check?',
    a: 'The personal-thesis scoring job is scheduled hourly during a weekday window around the US trading session. Other source collection jobs run separately. Source availability, processing and notification settings affect when findings appear; an immediate alert is not guaranteed.',
  },
];

const STEPS = [
  ['Decompose the thesis into pillars', 'Each position is broken into its separable reasons, the pillars. A pillar is a specific, falsifiable claim, for example a claim about government revenue, operating margin, or a demand cycle. You write them, or Helm drafts them from its analysis for you to edit.'],
  ['Gather available sources', 'Helm gathers filings, structured financial facts, news and market data for monitored tickers. A missing source or a failed check does not prove that your reason still holds.'],
  ['Test the evidence against a reason', 'AI interprets whether a source supports, contradicts or is neutral to a confirmed pillar, and whether it is material. Validation checks reject unsupported excerpts and some weak connections. The interpretation still needs your review.'],
  ['Derive the monitored status', 'Deterministic rules use recent material contradictions and distinct source keys to derive weakening or broken status. Severe primary contradictions have an exception, described below. Backfilled evidence does not drive this live status; a saved override takes precedence.'],
  ['Review the evidence trail', 'Read the dated source excerpt or market-data description alongside the explanation. Findings appear in the app; push delivery depends on notification preferences and device setup.'],
];

export default function MethodologyPage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'How Helm Detects Thesis Drift (Methodology)',
      description: 'The methodology behind Helm thesis monitoring: scoring pillars against SEC filings and news.',
      datePublished: '2026-06-17',
      dateModified: '2026-09-19',
      author: { '@type': 'Person', name: 'Evan Kim', url: 'https://helmterminal.dev/about', jobTitle: 'Founder' },
      publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      url: 'https://helmterminal.dev/how-helm-detects-thesis-drift',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How Helm detects thesis drift',
      description: 'The process Helm uses to monitor an investment thesis against primary sources.',
      step: STEPS.map(([name, text]) => ({ '@type': 'HowToStep', name, text })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://helmterminal.dev' },
        { '@type': 'ListItem', position: 2, name: 'Thesis Monitoring', item: 'https://helmterminal.dev/thesis-monitoring' },
        { '@type': 'ListItem', position: 3, name: 'Methodology', item: 'https://helmterminal.dev/how-helm-detects-thesis-drift' },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <SiteNav />

      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        <header className="mb-8">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Methodology</div>
          <h1 className="font-sans mb-5">
            How Helm detects thesis drift
          </h1>
          <p className="text-[17px] leading-[1.55] text-[var(--color-text-secondary)]">
            Write down why you own a stock. Helm checks available evidence against that reason and gives you a record to review. Here is how personal monitoring works, what the statuses mean, and where the system has limits.
          </p>
        </header>

        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-5">The pipeline, step by step</h2>
            <ol className="space-y-5">
              {STEPS.map(([title, body], i) => (
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

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">Why conservative thresholds matter</h2>
            <p className="mb-3">The failure mode of any alerting system is crying wolf. If every dip or ambiguous headline flips a pillar, you learn to ignore the alerts, and the one that matters gets lost. So Helm errs toward silence.</p>
            <p>A monitored pillar weakens on one material primary-source contradiction or two independently keyed material contradictions in a 30-day window. It normally breaks when at least two converge and one is primary. There is a severe-evidence exception: the current scorer can mark it broken after a price move of at least 20% that it classified as a material contradiction. A price-based flag is a prompt to investigate, not proof that the business thesis failed or an instruction to sell.</p>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">Where the citations come from</h2>
            <p>For text sources, Helm checks that an excerpt occurs in the retrieved source text. Price moves and structured financial facts instead carry system-generated descriptions. The accompanying explanation is AI-written, not a quotation. These checks reduce errors; they do not guarantee correct interpretation, complete coverage or timely delivery. Open the source and compare it with your own reason.</p>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">Public research uses a different status model</h2>
            <p>The public ticker thesis pages use authored house theses and approved evidence. They weight filings and news by source type and age over a trailing year, producing Intact, Watch, Weakening, Broken or Unverified. Personal monitoring uses the 30-day contradiction rules above. Neither status is a recommendation, and an untested reason is not a confirmed reason.</p>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-5">Common questions</h2>
            <div className="space-y-6">
              {FAQS.map((f) => (
                <div key={f.q}>
                  <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)] mb-1.5">{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="sovereign-card rounded p-6 md:p-8 text-center">
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-2">See it on your own holdings.</h2>
            <p className="mb-5 max-w-xl mx-auto">Write your pillars, and Helm watches the filings against them. Free to start.</p>
            <Link href="/signup" className="inline-block px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Take the helm</Link>
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
