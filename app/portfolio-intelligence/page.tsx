import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';

export const metadata: Metadata = {
  title: 'Agentic Portfolio Intelligence: An AI Analyst for Your Portfolio | Helm Terminal',
  description:
    'Agentic portfolio intelligence is an AI analyst that watches your whole portfolio for you: risk, taxes, earnings, factor tilt, and whether the reasons you own each stock still hold. A plain guide to what it is and how it works.',
  openGraph: {
    title: 'Agentic Portfolio Intelligence: An AI Analyst for Your Portfolio',
    description:
      'An AI analyst that watches your whole book continuously. Risk, taxes, earnings, factors, and thesis monitoring, with the source behind every flag.',
    url: 'https://helmterminal.dev/portfolio-intelligence',
    siteName: 'Helm Terminal',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agentic Portfolio Intelligence: An AI Analyst for Your Portfolio',
    description:
      'An AI analyst that watches your whole book continuously, and shows its work.',
  },
  alternates: { canonical: 'https://helmterminal.dev/portfolio-intelligence' },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is agentic portfolio intelligence?',
    a: 'Agentic portfolio intelligence is an AI analyst that continuously watches your entire portfolio, instead of a dashboard that only shows balances when you log in. It connects to your accounts read-only, then re-prices your holdings, reads filings and news against the stocks you own, and runs risk, tax, and earnings scans in the background, surfacing what changed and why with the source behind every flag.',
  },
  {
    q: 'How is it different from a portfolio tracker?',
    a: 'A tracker shows you what you own and what it is worth. Agentic portfolio intelligence tells you what it means: that three of your names quietly became an outsized share of your equity, that a filing undercut a reason you bought a stock, that a loss is harvestable before year end. The tracker is a balance. The intelligence layer is the analysis on top of it.',
  },
  {
    q: 'How is it different from a robo-advisor?',
    a: 'A robo-advisor manages money for you: it picks the allocation and trades on your behalf. Agentic portfolio intelligence takes the opposite posture. It never trades or moves money. It watches the portfolio you already built and keeps you informed so you make the decisions. It is intelligence, not management.',
  },
  {
    q: 'What does the AI analyst actually monitor?',
    a: 'Concentration and hidden correlation, tax-loss harvesting opportunities in taxable accounts, upcoming earnings exposure across your holdings, your factor tilt (size, style, quality, sector), and your investment theses, meaning the specific reasons you hold each position checked against fresh SEC filings and news.',
  },
  {
    q: 'Is it safe to connect my accounts?',
    a: 'Helm connects through Plaid with read-only access, so it can see your balances and holdings but can never trade or move money. It is read-only by design.',
  },
  {
    q: 'Is there a free version?',
    a: 'Helm Terminal is free to use for portfolio aggregation, AI stock analysis, the daily brief, and the actions inbox. The deeper agentic layers, including thesis monitoring and the factor lens, are part of Helm Pro at $20/month.',
  },
];

const SURFACE: { title: string; body: string }[] = [
  {
    title: 'Works overnight',
    body: 'Re-prices your holdings, re-reads new filings and news against every position, runs the risk scans, and writes your morning brief while you sleep. You open a log of what it did, not a blank screen.',
  },
  {
    title: 'Runs a full sweep on demand',
    body: 'Point it at your whole book and watch it work step by step: concentration, sector tilt, tax-loss harvests, earnings exposure, and every thesis, in real time.',
  },
  {
    title: 'Watches concentration and hidden risk',
    body: 'Flags when a few names quietly become an outsized share of your equity, or when positions you believed were diversified actually rest on the same underlying driver.',
  },
  {
    title: 'Finds tax-loss harvests',
    body: 'Surfaces harvestable losses in taxable accounts with the estimated savings attached, and correctly skips retirement accounts where harvesting does not apply.',
  },
  {
    title: 'Maps earnings exposure',
    body: 'Tells you which of your holdings report next and what is at stake, so an earnings date never surprises you.',
  },
  {
    title: 'Reads your factor tilt',
    body: 'Shows what actually drove your portfolio today: size, style, quality, and which sector led, plus a per-holding breakdown.',
  },
  {
    title: 'Monitors your investment thesis',
    body: 'You write the reasons you hold each position, and it re-checks them against fresh filings. If one breaks, it flags the exact pillar and cites the source.',
  },
];

const COMPARE: string[][] = [
  ['Watches your whole book continuously', 'No', 'Manages', 'No', 'Yes'],
  ['Reasons about your specific holdings', 'No', 'No', 'No', 'Yes'],
  ['Risk, tax, earnings, factor scans', 'Limited', 'Its accounts', 'No', 'Automatic'],
  ['Monitors your investment thesis', 'No', 'No', 'No', 'Yes'],
  ['Cites the source behind every flag', 'No', 'No', 'Sometimes', 'Yes'],
  ['Trades or moves your money', 'No', 'Yes', 'No', 'Never'],
];

export default function PortfolioIntelligencePage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Agentic Portfolio Intelligence: An AI Analyst for Your Portfolio',
      description: metadata.description,
      author: { '@type': 'Organization', name: 'Helm Terminal' },
      publisher: { '@type': 'Organization', name: 'Helm Terminal' },
      mainEntityOfPage: 'https://helmterminal.dev/portfolio-intelligence',
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
  ];

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark className="w-6 h-6" />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/analyze" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Analyze</Link>
            <Link href="/pricing" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Pricing</Link>
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Sign up</Link>
          </div>
        </div>
      </nav>

      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-4xl">
        {/* Header */}
        <header className="mb-10">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Portfolio Intelligence</div>
          <h1 className="font-sans font-bold text-[34px] md:text-[44px] tracking-tight leading-[1.08] mb-6">
            Agentic portfolio intelligence: an AI analyst for your whole portfolio
          </h1>
          <p className="text-[19px] md:text-[21px] leading-[1.5] text-[var(--color-text-primary)] font-medium border-l-2 border-[var(--color-gold)] pl-5">
            Most tools show you balances. An AI analyst watches your whole book for you, across risk, taxes, earnings, and the reasons you own each stock, and tells you what changed before it costs you.
          </p>
        </header>

        <div className="space-y-12 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          {/* Definition */}
          <section>
            <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-3">What is agentic portfolio intelligence?</h2>
            <p className="mb-3">
              <span className="text-[var(--color-text-primary)] font-semibold">Agentic portfolio intelligence is an AI analyst that continuously watches your entire portfolio.</span> It connects to your accounts read-only, then works in the background: re-pricing your book, reading filings and news against the stocks you own, and running risk, tax, and earnings scans. Instead of a dashboard you have to interrogate, you get a standing read of what changed and why, with the source behind every flag.
            </p>
            <p>
              The word that matters is <span className="text-[var(--color-text-primary)] font-semibold">agentic</span>. A chatbot answers when you ask it. An agent works while you are away and hands you the result. And it is intelligence, not management: it never trades or moves your money. It keeps you informed and in control.
            </p>
          </section>

          {/* What the agent does */}
          <section>
            <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-5">What the AI analyst actually does</h2>
            <ol className="space-y-5">
              {SURFACE.map(({ title, body }, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] text-[var(--color-gold)] font-mono text-[14px] font-bold flex items-center justify-center">{i + 1}</span>
                  <p>
                    <span className="text-[var(--color-text-primary)] font-semibold">{title}. </span>
                    {body}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {/* Comparison */}
          <section>
            <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-3">Intelligence vs tracking vs management</h2>
            <p className="mb-5">A tracker shows you what you own. A robo-advisor takes the wheel. Agentic portfolio intelligence sits in the middle: it watches your book and keeps you informed, while you stay in control of every decision.</p>
            <div className="overflow-x-auto sovereign-card rounded">
              <table className="w-full text-[15px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border-base)]">
                    <th className="p-3 font-semibold text-[var(--color-text-primary)] text-left">&nbsp;</th>
                    <th className="p-3 font-semibold text-[var(--color-text-muted)] text-center whitespace-nowrap">Tracker</th>
                    <th className="p-3 font-semibold text-[var(--color-text-muted)] text-center whitespace-nowrap">Robo-advisor</th>
                    <th className="p-3 font-semibold text-[var(--color-text-muted)] text-center whitespace-nowrap">Research tool</th>
                    <th className="p-3 font-semibold text-[var(--color-gold)] text-center whitespace-nowrap">Helm</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row, i) => (
                    <tr key={i} className="border-b border-[var(--color-border-subtle)] last:border-0">
                      <td className="p-3 text-[var(--color-text-primary)] font-medium">{row[0]}</td>
                      <td className="p-3 text-center whitespace-nowrap">{row[1]}</td>
                      <td className="p-3 text-center whitespace-nowrap">{row[2]}</td>
                      <td className="p-3 text-center whitespace-nowrap">{row[3]}</td>
                      <td className="p-3 text-center whitespace-nowrap text-[var(--color-text-primary)] font-medium">{row[4]}</td>
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
              You hold NVDA, MSFT, and AMD, bought at different times for different reasons. In a single overnight run, Helm notices the three have quietly become an outsized share of your equity and that they all lean on the same AI-infrastructure driver, so a single event could hit all three at once. It flags that hidden concentration. Separately, it reads a new filing that undercuts one of your NVDA pillars, marks that reason as weakening, and cites the exact line. And it spots that one position is at a harvestable loss in a taxable account. Three different kinds of risk, surfaced together, before you had to go looking.
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
            <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-2">Have an AI analyst watch your book.</h2>
            <p className="mb-5 max-w-xl mx-auto">Helm Terminal monitors your whole portfolio for risk, taxes, earnings, and broken theses, and shows its work with dated citations. Free to start, read-only. The deeper agentic layers are part of Pro at $20/month.</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/signup" className="px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Take the helm</Link>
              <Link href="/analyze" className="px-5 py-2.5 border border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-colors">Try free analysis</Link>
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
