'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, Check } from 'lucide-react';
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

const freeFeatures = [
  'Full terminal and portfolio dashboard',
  'AI stock analysis',
  'Connected brokerages via Plaid',
  'Daily brief (general)',
  'Actions inbox',
  'Portfolio Wrapped',
];

const proFeatures = [
  'Thesis monitoring (theses, detail, cited evidence)',
  'Earnings exposure tracking',
  'Tax center with tax-loss harvesting',
  'Conviction-led tailored brief',
  'The agent (reassessment, investigation, shared exposure)',
  'Thesis Builder (pre-buy)',
  'Factor lens',
  'Everything in Free',
];


const faqItems = [
  {
    question: "What's included in the Free plan?",
    answer:
      'The full terminal: portfolio dashboard with brokerage sync via Plaid, AI stock analysis, the general daily brief, the actions inbox, and Portfolio Wrapped. No credit card required.',
  },
  {
    question: 'What does Pro add?',
    answer:
      'Pro is $20/mo. It adds thesis monitoring (your theses, detailed views, and cited evidence), the agent, the Thesis Builder, the factor lens, earnings exposure tracking, the tax center with tax-loss harvesting, and a conviction-led tailored brief.',
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
    <main className="min-h-screen bg-[var(--color-bg-base)] bg-depth relative overflow-hidden">
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
          <div className="flex items-center gap-5">
            <Link href="/analyze" className="text-[15px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">Analyze</Link>
            <Link href="/pricing" className="text-[15px] text-[var(--color-text-primary)] transition-colors">Pricing</Link>
            <Link href="/blog" className="text-[15px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">Blog</Link>
            <Link href="/login" className="text-[15px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">Sign in</Link>
          </div>
        </div>
      </nav>

      {/* ── Header ── */}
      <section className="relative container mx-auto px-6 pt-12 pb-8 text-center">
        <AnimatedSection delay={0}>
          <p className="type-eyebrow text-[var(--color-gold)] mb-3">Pricing</p>
          <h1 className="type-h1 text-[var(--color-text-primary)] mb-3">
            Two tiers. Zero percent of AUM.
          </h1>
          <p className="type-body text-[var(--color-text-secondary)] max-w-lg mx-auto">
            The full terminal is free. Pro adds thesis monitoring, the agent, and tax intelligence,
            and starts with a 14 day free trial.
          </p>
        </AnimatedSection>
      </section>

      {/* ── Tier cards: Free / Pro ── */}
      <section className="relative container mx-auto px-6 pb-16">
        <div className="grid gap-6 lg:grid-cols-2 max-w-3xl mx-auto items-start">

          {/* Free */}
          <AnimatedSection delay={100}>
            <div className="sovereign-card rounded p-6 flex flex-col h-full">
              <div className="mb-5">
                <span className="text-[14px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] font-medium" style={{ fontFamily: 'var(--font-mono)' }}>
                  Free
                </span>
                <div className="flex items-baseline gap-1.5 mt-3">
                  <span className="text-[40px] font-bold tabular-nums text-[var(--color-text-primary)] leading-none" style={{ fontFamily: 'var(--font-mono)' }}>$0</span>
                  <span className="text-[15px] text-[var(--color-text-muted)]">forever</span>
                </div>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[var(--color-positive)] shrink-0 mt-0.5" />
                    <span className="text-[15px] text-[var(--color-text-secondary)]">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full text-center text-base font-medium py-3 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
              >
                Get started free
              </Link>
            </div>
          </AnimatedSection>

          {/* Pro $20 — featured */}
          <AnimatedSection delay={200}>
            <div className="sovereign-card rounded p-6 flex flex-col h-full border-[var(--color-gold-border)] bg-[var(--color-gold-surface)]">
              <div className="mb-5">
                <div className="flex items-center gap-2.5">
                  <span className="text-[14px] uppercase tracking-[0.2em] text-[var(--color-gold)] font-medium" style={{ fontFamily: 'var(--font-mono)' }}>
                    Pro
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-gold)] px-2 py-0.5 rounded-sm bg-[rgba(230,185,77,0.12)]" style={{ fontFamily: 'var(--font-mono)' }}>
                    Most popular
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-3">
                  <span className="text-[40px] font-bold tabular-nums text-[var(--color-text-primary)] leading-none" style={{ fontFamily: 'var(--font-mono)' }}>$20</span>
                  <span className="text-[15px] text-[var(--color-text-muted)]">/mo</span>
                </div>
                <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
                  Free for 14 days. Card required, nothing charged until the trial ends, cancel any time before then.
                </p>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[var(--color-gold)] shrink-0 mt-0.5" />
                    <span className="text-[15px] text-[var(--color-text-primary)]">{f}</span>
                  </li>
                ))}
              </ul>
              {tier === 'free' ? (
                <button
                  onClick={() => setCheckoutPeriod('pro')}
                  className="group w-full flex items-center justify-center gap-2.5 px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[15px] rounded-[var(--radius-md)] cursor-pointer transition-colors duration-200"
                >
                  Start 14 day free trial
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              ) : (
                <div className="w-full flex items-center justify-center px-6 py-3 border border-[var(--color-border-base)] text-[var(--color-text-muted)] font-semibold text-[15px] rounded-[var(--radius-md)]">
                  Current plan
                </div>
              )}
            </div>
          </AnimatedSection>


        </div>

        {/* Fine print */}
        <AnimatedSection delay={400}>
          <div className="text-center text-[14px] text-[var(--color-text-muted)] mt-8" style={{ fontFamily: 'var(--font-mono)' }}>
            Cancel anytime &middot; Secure via Stripe
          </div>
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
