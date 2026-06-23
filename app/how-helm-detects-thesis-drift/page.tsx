import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';

export const metadata: Metadata = {
  title: 'How Helm Detects Thesis Drift (Methodology) | Helm Terminal',
  description:
    'The methodology behind Helm thesis monitoring: how pillars are scored against SEC EDGAR filings and news, how a pillar is judged weakening or broken, and why every alert carries a verbatim, dated citation.',
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
    a: 'A pillar is marked weakening when at least one recent, material item from a primary source contradicts it. It is marked broken when independent items contradict it and at least one is a primary source such as an SEC filing. A single ambiguous headline does not flip a pillar.',
  },
  {
    q: 'Does Helm make up numbers or paraphrase?',
    a: 'No. Every status change is backed by a verbatim excerpt from the source, with its date. If Helm cannot tie a change to a real, quotable source, it does not raise the alert.',
  },
  {
    q: 'What sources does Helm read?',
    a: 'SEC EDGAR filings (10-K, 10-Q, 8-K), earnings, news, and price. Filings are anchored to the relevant section so the citation points to the exact passage that bears on a pillar.',
  },
  {
    q: 'How often does Helm check?',
    a: 'Every hour the US market is open. The pipeline only does work when there is new information for a holding, so it does not re-score everything constantly.',
  },
];

const STEPS = [
  ['Decompose the thesis into pillars', 'Each position is broken into its separable reasons, the pillars. A pillar is a specific, falsifiable claim, for example a claim about government revenue, operating margin, or a demand cycle. You write them, or Helm drafts them from its analysis for you to edit.'],
  ['Gather primary sources per holding', 'For each holding, Helm pulls SEC EDGAR filings, earnings, news, and price. Filings are anchored to the relevant section, so a risk-factor change or a segment-revenue line can be matched to the pillar it actually affects.'],
  ['Score each source against each pillar', 'Every source is assigned to the pillar it most directly affects, then scored for whether it confirms, contradicts, or is neutral to that pillar. A contract loss is matched to a revenue pillar, not a downstream margin pillar.'],
  ['Derive a status, conservatively', 'A pillar is weakening when at least one recent material item contradicts it, and broken when independent items contradict it with at least one primary source. The position takes the worst status across its confirmed pillars. Status changes are timestamped only when a real flip occurs, so the dates mean something.'],
  ['Attach a verbatim, dated citation', 'Every status change carries the exact excerpt that drove it, with the source and date. Nothing is paraphrased into an alert, and nothing is invented.'],
];

export default function MethodologyPage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'How Helm Detects Thesis Drift (Methodology)',
      description: 'The methodology behind Helm thesis monitoring: scoring pillars against SEC filings and news.',
      datePublished: '2026-06-17',
      dateModified: '2026-06-17',
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

      <nav className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/thesis-monitoring" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Thesis Monitoring</Link>
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Sign up</Link>
          </div>
        </div>
      </nav>

      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        <header className="mb-8">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Methodology</div>
          <h1 className="font-sans font-bold text-[30px] md:text-[42px] tracking-tight leading-[1.1] mb-5">
            How Helm detects thesis drift
          </h1>
          <p className="text-[17px] leading-[1.55] text-[var(--color-text-secondary)]">
            An alert is only as good as the reasoning behind it. Here is exactly how Helm decides that the thesis on a position is weakening or broken, and why every alert points to a real, dated source.
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
            <p>A pillar weakens on a real, material contradiction, and breaks only when independent sources agree and at least one is a primary document. Price alone never flips a pillar, because price is not a reason. The result is fewer, higher-signal alerts that are each backed by something you can read yourself.</p>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">Where the citations come from</h2>
            <p>Helm reads SEC EDGAR filings (10-K, 10-Q, 8-K), earnings, and news. For filings, the relevant section is anchored so the citation points to the exact passage, a changed risk factor or a segment-revenue line, rather than a whole document. Every alert carries that excerpt verbatim, with its date. If a change cannot be tied to a quotable source, Helm does not raise it.</p>
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
