'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { CheckoutModal } from '@/components/checkout-modal';
import { AnimatedSection } from '@/components/ui/animated-section';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { useTier } from '@/hooks/use-tier';

// Display tiers for the new model. The `period` maps onto the existing
// Stripe billing-period keys so checkout keeps working unchanged.
// Pro is the only paid tier. Max was retired Aug 2026.
type PaidPeriod = 'pro';

// The page was built for three tiers and read as thin once it was two: two
// equal boxes side by side make neither look like the answer. So there are no
// tier cards any more. There is one offer, stated once, and a ledger of what
// each side actually gets, which is closer to how a terminal presents anything
// and scales if a tier is ever added back.

const proFeatures = [
  'Every position watched, not just one',
  'Thesis monitoring with cited evidence',
  'The agent: reassessment, investigation, shared exposure',
  'Tax center with tax-loss harvesting',
  'Earnings exposure tracking',
  'Conviction-led tailored brief',
  'Thesis Builder, before you buy',
  'Factor lens',
];

const freeSummary = 'Full terminal, brokerage sync, AI analysis on any US ticker, the daily brief, actions inbox, and one thesis with the twelve months of evidence behind it.';

// Where they genuinely differ, say how, rather than printing a tick in both
// columns. A row that reads "General" against "Conviction-led" tells you more
// than two identical marks.
const LEDGER: { feature: string; free: string; pro: string }[] = [
  { feature: 'Portfolio dashboard, all accounts', free: 'Included', pro: 'Included' },
  { feature: 'Brokerage sync via Plaid, read only', free: 'Included', pro: 'Included' },
  { feature: 'AI analysis, any US ticker', free: 'Included', pro: 'Included' },
  { feature: 'Actions inbox', free: 'Included', pro: 'Included' },
  { feature: 'Portfolio Wrapped', free: 'Included', pro: 'Included' },
  { feature: 'Daily brief', free: 'General', pro: 'Conviction-led, your book' },
  { feature: 'Investment theses', free: 'One', pro: 'Every position you own' },
  { feature: 'Twelve months of history behind a thesis', free: 'Included', pro: 'Included' },
  { feature: 'Ongoing monitoring, cited evidence', free: '—', pro: 'Watched every trading day' },
  { feature: 'Harvestable loss figure', free: 'Included', pro: 'Included' },
  { feature: 'Which lots, and wash-sale screening', free: '—', pro: 'Across every account' },
  { feature: 'Earnings exposure', free: '—', pro: 'Across held positions' },
  { feature: 'The agent', free: '—', pro: 'Reassessment and shared exposure' },
  { feature: 'Thesis Builder, pre-buy', free: '—', pro: 'Included' },
  { feature: 'Factor lens', free: '—', pro: 'Included' },
];

const faqItems = [
  {
    question: 'How does the free trial work?',
    answer:
      'Pro starts with a 14 day free trial. A card is required to begin it, nothing is charged until the trial ends, and you can cancel at any point before then and pay nothing. Fourteen days rather than seven because the evidence Helm surfaces arrives when companies file and report, not on a schedule that suits a trial.',
  },
  {
    question: "What's included in the Free plan?",
    answer:
      'The full terminal: portfolio dashboard with brokerage sync via Plaid, AI stock analysis on any US ticker, the general daily brief, the actions inbox, and Portfolio Wrapped. You also get one investment thesis and can read the twelve months of dated evidence behind it. Free forever, and no card is required.',
  },
  {
    question: 'What does Pro add?',
    answer:
      'Pro is $20/mo. Free gives you one thesis and the history behind it; Pro watches every position you own, every trading day, and adds the agent, the Thesis Builder, the factor lens, earnings exposure tracking, the tax center with tax-loss harvesting, and a conviction-led tailored brief.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. Cancel your subscription at any time. You keep access through the end of your billing period. No questions asked.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Bank-level encryption, read-only access via Plaid, and row-level security on all user data. We never store your banking credentials and never sell your data. Ever.',
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group sovereign-card rounded overflow-hidden">
      <summary className="flex items-center justify-between cursor-pointer px-5 py-3 text-base font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors list-none [&::-webkit-details-marker]:hidden">
        {question}
        <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 group-open:rotate-180 shrink-0 ml-4" />
      </summary>
      <div className="px-5 pb-3 text-base text-[var(--color-text-secondary)] leading-relaxed">
        {answer}
      </div>
    </details>
  );
}

export default function PricingPage() {
  // Which paid tier the checkout modal will open with.
  const [checkoutPeriod, setCheckoutPeriod] = useState<PaidPeriod | null>(null);
  // Purchase logic runs on the REAL subscription tier — during the open-access
  // window everyone's features read as Pro, but nobody has bought anything,
  // and "Current plan" on an unpurchased tier reads as billing that
  // doesn't exist (and kills the buy buttons for a week).
  const { realTier: tier } = useTier();

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-bg-base)] bg-depth relative overflow-hidden">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqItems.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: { '@type': 'Answer', text: item.answer },
              })),
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://helmterminal.dev' },
                { '@type': 'ListItem', position: 2, name: 'Pricing', item: 'https://helmterminal.dev/pricing' },
              ],
            },
          ]),
        }}
      />

      <CinematicBg />

      {/* ── Navigation ── */}
      <nav className="relative z-10 glass-nav">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5">
            <HelmMark size={32} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          {/* Wraps rather than clipping: <main> carries overflow-hidden, so at
              320px the un-wrapped row silently cut "Sign in" off the edge with
              no way to reach it. */}
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[13px] sm:text-[15px]">
            <Link href="/analyze" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">Analyze</Link>
            <Link href="/pricing" className="text-[var(--color-text-primary)] transition-colors">Pricing</Link>
            <Link href="/blog" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">Blog</Link>
            <Link href="/login" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">Sign in</Link>
          </div>
        </div>
      </nav>

      {/* ── Header ── */}
      <section className="relative container mx-auto px-6 pt-14 pb-9 max-w-4xl">
        <AnimatedSection delay={0}>
          <p className="type-eyebrow text-[var(--color-gold)] mb-3">Pricing</p>
          <h1 className="type-h1 text-[var(--color-text-primary)] mb-3 max-w-2xl">
            One product. Zero percent of AUM.
          </h1>
          <p className="type-body text-[var(--color-text-secondary)] max-w-xl">
            The terminal is free and stays free. Pro is the agent: it reads filings and
            reporting against the reasons you own each position, and quotes the line that
            moved them.
          </p>
        </AnimatedSection>
      </section>

      {/* ── The offer ── */}
      <section className="relative container mx-auto px-6 pb-14 max-w-4xl">
        <AnimatedSection delay={100}>
          <div
            className="rounded-lg overflow-hidden"
            style={{
              border: '1px solid var(--color-gold-border)',
              background: 'linear-gradient(180deg, rgba(230,185,77,0.055), rgba(230,185,77,0.012))',
            }}
          >
            <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              {/* Price + CTA */}
              <div className="p-7 md:p-8 md:border-r border-b md:border-b-0 border-[var(--color-border-base)]">
                <div
                  className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[var(--color-gold)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Helm Pro
                </div>
                <div className="flex items-baseline gap-2 mt-4">
                  <span
                    className="text-[52px] font-bold tabular-nums leading-none text-[var(--color-text-primary)]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    $20
                  </span>
                  <span className="text-[16px] text-[var(--color-text-muted)]">/mo</span>
                </div>
                {/* The AUM comparison was doing its work in the section heading,
                    which is a screen away from the figure a buyer is actually
                    weighing. The arithmetic is on a stated advisory fee, not on
                    a competitor's advertised price, so it cannot go stale. */}
                <p className="mt-3 mb-0 text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">
                  A 1% advisory fee on a $1M book is $10,000 a year. This is $240.
                </p>
                <p className="mt-3 mb-0 text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">
                  Free for 14 days. A card is required to start, nothing is charged until the
                  trial ends, and you can cancel any time before then.
                </p>

                {tier === 'free' ? (
                  <button
                    onClick={() => setCheckoutPeriod('pro')}
                    className="group mt-6 w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[15px] rounded-[var(--radius-md)] cursor-pointer transition-colors duration-200 min-h-[44px]"
                  >
                    Start 14 day free trial
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </button>
                ) : (
                  <div className="mt-6 w-full flex items-center justify-center px-6 py-3.5 border border-[var(--color-border-base)] text-[var(--color-text-muted)] font-semibold text-[15px] rounded-[var(--radius-md)] min-h-[44px]">
                    Current plan
                  </div>
                )}

                <div
                  className="mt-3 text-center text-[12px] text-[var(--color-text-muted)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Cancel anytime &middot; Secure via Stripe
                </div>
                {/* The stability objection a one-person product gets, answered
                    at the point of payment rather than only on /about. */}
                <p className="mt-4 mb-0 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  Run by one person, on purpose. Your data is exportable and{' '}
                  <Link href="/data-deletion" className="underline underline-offset-2 hover:text-[var(--color-text-primary)] transition-colors">
                    deletable in one click
                  </Link>
                  , whatever happens to Helm.
                </p>
              </div>

              {/* What it is */}
              <div className="p-7 md:p-8">
                <div
                  className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-4"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  What Pro does
                </div>
                <ul className="m-0 list-none p-0 space-y-2.5">
                  {proFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[15px] leading-[1.5] text-[var(--color-text-primary)]">
                      <span aria-hidden className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--color-gold)]" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Free, stated once, without competing for the eye */}
        <AnimatedSection delay={200}>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-6 py-5">
            <div className="flex items-baseline gap-2">
              <span
                className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[var(--color-text-muted)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Free
              </span>
              <span className="text-[20px] font-bold tabular-nums text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-mono)' }}>
                $0
              </span>
              <span className="text-[13px] text-[var(--color-text-muted)]">forever, no card</span>
            </div>
            <p className="m-0 min-w-[220px] flex-1 text-[14px] leading-[1.55] text-[var(--color-text-secondary)]">
              {freeSummary}
            </p>
            <Link
              href="/signup"
              className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-5 text-[14px] font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-overlay)]"
            >
              Open the terminal
            </Link>
          </div>
        </AnimatedSection>
      </section>

      {/* ── The ledger ── */}
      <section className="relative container mx-auto px-6 pb-16 max-w-4xl">
        <AnimatedSection delay={0}>
          <h2 className="type-h2 text-[var(--color-text-primary)] mb-5">What each one gets</h2>
        </AnimatedSection>
        <AnimatedSection delay={100}>
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border-base)]">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <caption className="sr-only">Feature comparison, Free versus Pro</caption>
              <thead>
                <tr className="border-b border-[var(--color-border-strong)] bg-[var(--color-bg-surface)]">
                  <th
                    scope="col"
                    className="px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Feature
                  </th>
                  <th
                    scope="col"
                    className="w-[26%] px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Free
                  </th>
                  <th
                    scope="col"
                    className="w-[30%] px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-gold)]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {LEDGER.map((row) => (
                  <tr key={row.feature} className="border-b border-[var(--color-border-base)] last:border-b-0">
                    <th
                      scope="row"
                      className="px-5 py-3 text-[14px] font-normal text-[var(--color-text-primary)]"
                    >
                      {row.feature}
                    </th>
                    {/* NVDA at its default punctuation level does not speak an
                        em dash, so a cell containing only "—" reads as empty,
                        which on a pricing table is indistinguishable from
                        missing data. Keep the mark, add the word. */}
                    <td className={`px-5 py-3 text-[13.5px] ${row.free === '—' ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-secondary)]'}`}>
                      {row.free === '—' ? (
                        <>
                          <span aria-hidden="true">&mdash;</span>
                          <span className="sr-only">Not included</span>
                        </>
                      ) : (
                        row.free
                      )}
                    </td>
                    <td className="px-5 py-3 text-[13.5px] text-[var(--color-text-primary)]">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnimatedSection>
        <AnimatedSection delay={200}>
          <p className="mt-4 mb-0 text-[13px] leading-[1.6] text-[var(--color-text-muted)]">
            Helm is not a registered investment adviser and does not give investment advice.
            Every finding links to the primary source it came from.
          </p>
        </AnimatedSection>
      </section>

      {/* ── FAQ ── */}
      <section className="relative container mx-auto px-6 pb-16">
        <div className="max-w-2xl mx-auto">
          <AnimatedSection delay={0}>
            <h2 className="type-h2 text-[var(--color-text-primary)] text-center mb-6">
              Frequently asked questions
            </h2>
          </AnimatedSection>
          <AnimatedSection delay={100}>
            <div className="space-y-2">
              {faqItems.map((item) => (
                <FAQItem key={item.question} question={item.question} answer={item.answer} />
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      <LegalFooter />

      {checkoutPeriod && (
        <CheckoutModal
          billingPeriod={checkoutPeriod}
          onClose={() => setCheckoutPeriod(null)}
        />
      )}
    </main>
  );
}
