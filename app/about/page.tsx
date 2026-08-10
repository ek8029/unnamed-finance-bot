import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';

export const metadata: Metadata = {
  title: 'About | Helm Terminal',
  description:
    'Helm Terminal is portfolio intelligence for people who manage their own money. Built by Evan Kim, a Penn State economics student and former derivatives hedging intern.',
  alternates: {
    canonical: 'https://helmterminal.dev/about',
  },
  openGraph: {
    title: 'About Helm Terminal',
    description:
      'Who built Helm, what it actually does, and how it decides what to tell you.',
    url: 'https://helmterminal.dev/about',
  },
};

const PERSON_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Evan Kim',
  jobTitle: 'Founder',
  description: 'Economics student at Penn State and former derivatives hedging intern. Built Helm Terminal to bring institutional-grade portfolio intelligence to individual investors.',
  url: 'https://helmterminal.dev/about',
  worksFor: {
    '@type': 'Organization',
    name: 'Helm Terminal',
    url: 'https://helmterminal.dev',
  },
  knowsAbout: [
    'Portfolio Analysis',
    'Financial Technology',
    'Tax-Loss Harvesting',
    'Software Engineering',
  ],
  alumniOf: {
    '@type': 'CollegeOrUniversity',
    name: 'The Pennsylvania State University',
    department: 'Economics',
  },
  // Deliberately empty, and it costs something: assistants weight independent
  // corroboration when resolving a person, and this entity currently has none.
  // NOT to be filled with a personal LinkedIn, which is a standing no. A GitHub
  // or a personal X would both work and are Evan's call to make.
  sameAs: [],
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PERSON_SCHEMA) }}
      />

      <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
        {/* Nav */}
        <nav className="border-b border-[var(--color-border-subtle)]">
          <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <HelmMark size={24} />
              <span className="font-semibold text-[15px] tracking-[0.12em] group-hover:text-[var(--color-gold)] transition-colors">
                HELM
              </span>
            </Link>
            <Link
              href="/signup"
              className="h-9 px-5 rounded-full bg-[var(--color-gold)] text-[var(--color-text-inverse)] text-[14px] font-semibold flex items-center gap-1.5 hover:brightness-110 transition-all"
            >
              Open terminal
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </nav>

        <main id="main-content" className="max-w-3xl mx-auto px-6 py-20">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-px bg-[var(--color-gold)]" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-gold)] uppercase">
              About
            </span>
          </div>

          <h1 className="text-[clamp(32px,5vw,48px)] font-bold leading-[1.1] tracking-tight mb-8">
            Built for investors who want<br />
            to see everything.
          </h1>

          <div className="space-y-6 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
            <p>
              Helm Terminal is portfolio intelligence for people who manage their own
              money. It connects every brokerage account you hold, reads them as one
              book, and tells you what changed and why it matters to the positions you
              actually own.
            </p>

            <p>
              It is not a tracker. A tracker tells you what your portfolio is worth,
              which your brokerage already does. Helm is built for the harder question,
              which is what you should know about what you already hold.
            </p>

            <h2 className="text-[var(--color-text-primary)] text-xl font-semibold pt-4">
              What it does
            </h2>

            <ul className="space-y-3 list-none" role="list">
              <li className="flex gap-3">
                <span className="text-[var(--color-gold)] font-mono text-[15px] mt-0.5">01</span>
                <span>
                  <strong className="text-[var(--color-text-primary)]">Sees the whole book.</strong>{' '}
                  Every account in one place, so concentration and overlap that hide
                  between brokerages become visible. No single brokerage can do this,
                  because each one only sees its own share of your money.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-gold)] font-mono text-[15px] mt-0.5">02</span>
                <span>
                  <strong className="text-[var(--color-text-primary)]">Computes the tax number.</strong>{' '}
                  Harvestable losses lot by lot from your own cost basis, screened
                  against 30 day wash sale windows across every account at once. This is
                  the one figure in the product that is arithmetic rather than judgment.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-gold)] font-mono text-[15px] mt-0.5">03</span>
                <span>
                  <strong className="text-[var(--color-text-primary)]">Watches the reasons.</strong>{' '}
                  You record why you own something. Helm reads SEC filings and market
                  reporting against those reasons and flags it when the evidence turns,
                  quoting the source document word for word with its date and a link.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-gold)] font-mono text-[15px] mt-0.5">04</span>
                <span>
                  <strong className="text-[var(--color-text-primary)]">Flags what is coming.</strong>{' '}
                  Earnings exposure before the print, and a daily brief that connects
                  overnight moves to your specific holdings rather than to the market in
                  general.
                </span>
              </li>
            </ul>

            <p>
              There is also a free stock analysis page for any US listed ticker that
              needs no account at all, and{' '}
              <Link href="/masthead" className="text-[var(--color-gold)] hover:underline">
                the Masthead
              </Link>
              , a public running record of what Helm has surfaced, with every source
              shown.
            </p>

            <h2 className="text-[var(--color-text-primary)] text-xl font-semibold pt-4">
              How it works
            </h2>

            <p>
              Helm connects to your brokerage and bank accounts through{' '}
              <a
                href="https://plaid.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-gold)] hover:underline"
              >
                Plaid
              </a>{' '}
              on a read only basis. It can never move money or place a trade. It pulls
              positions, balances and transactions, then runs a rule engine over them
              for concentration risk, harvestable losses, earnings exposure and cash
              drag. Those rules are deterministic, which means the same inputs always
              produce the same output and you can audit any of it.
            </p>

            <p>
              Thesis monitoring works differently and it is worth being precise about
              the difference. Reading a filing to decide whether it contradicts a stated
              reason is a judgment, and a language model makes it. What keeps it honest
              is the constraint around it: every claim has to quote its source document
              word for word, and a claim that cannot be matched back to the source is
              discarded rather than shown to you. Helm never paraphrases a document and
              presents it as a finding.
            </p>

            <p>
              Market data comes from Finazon for quotes and historical prices, and from
              SEC EDGAR for fundamentals and filings. Coverage is US listed securities.
            </p>

            <p className="text-[var(--color-text-muted)] text-[14px]">
              Company logos provided by{' '}
              <a
                href="https://logo.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-gold)] hover:underline"
              >
                Logo.dev
              </a>
              .
            </p>

            <h2 className="text-[var(--color-text-primary)] text-xl font-semibold pt-4">
              Who built it
            </h2>

            <p>
              I am{' '}
              <strong className="text-[var(--color-text-primary)]">Evan Kim</strong>. I
              study economics at Penn State and I spent an internship on derivatives
              hedging, which is where I got used to the idea that a position is
              something you keep testing rather than something you buy and forget.
            </p>

            <p>
              I built Helm because my own money was spread across several brokerages and
              none of them could see the others. The reasons I had bought things lived in
              my head or in a spreadsheet I stopped updating, and nothing anywhere was
              checking those reasons against what the companies were actually reporting.
              I could not find a tool that did it, so I wrote one.
            </p>

            <p>
              Helm is run by one person, which I would rather say plainly than dress up.
              It means the roadmap is short and honest, and it means that when something
              is wrong you are talking to the person who can fix it.
            </p>

            <h2 className="text-[var(--color-text-primary)] text-xl font-semibold pt-4">
              The philosophy
            </h2>

            <ul className="space-y-3 list-none" role="list">
              <li className="flex gap-3">
                <span className="text-[var(--color-gold)] font-mono text-[15px] mt-0.5">01</span>
                <span><strong className="text-[var(--color-text-primary)]">Transparency over polish.</strong> Show the data, the source and the timestamp. Let people check the work.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-gold)] font-mono text-[15px] mt-0.5">02</span>
                <span><strong className="text-[var(--color-text-primary)]">Deterministic where it counts.</strong> Risk, tax and exposure are plain rules with no model in the loop. Where a model does read a document, its claim must quote the source or it is dropped.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-gold)] font-mono text-[15px] mt-0.5">03</span>
                <span><strong className="text-[var(--color-text-primary)]">Say less than you know.</strong> Helm does not predict prices and does not claim to beat anything. It reports what the evidence says and stops there.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-gold)] font-mono text-[15px] mt-0.5">04</span>
                <span><strong className="text-[var(--color-text-primary)]">Free by default.</strong> The terminal is free, including one tracked thesis and the history behind it. Pro is $20 a month and watches every position you own.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-gold)] font-mono text-[15px] mt-0.5">05</span>
                <span><strong className="text-[var(--color-text-primary)]">No financial advice.</strong> Helm is not a registered investment adviser and nothing it shows you is advice. It tells you what your data says. The decisions stay yours.</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="mt-16 pt-8 border-t border-[var(--color-border-subtle)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link
                href="/signup"
                className="h-11 px-6 rounded-full bg-[var(--color-gold)] text-[var(--color-text-inverse)] text-[15px] font-semibold flex items-center gap-2 hover:brightness-110 transition-all"
              >
                Open your terminal
                <ArrowRight className="w-4 h-4" />
              </Link>
              <span className="text-[15px] text-[var(--color-text-muted)]">
                The free tier needs no card.
              </span>
            </div>
          </div>
        </main>

        <LegalFooter />
      </div>
    </>
  );
}
