'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, Check } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { CheckoutModal } from '@/components/checkout-modal';
import { AnimatedSection } from '@/components/ui/animated-section';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';

type BillingPeriod = 'monthly' | 'annual' | 'lifetime';

const PLANS: {
  period: BillingPeriod;
  label: string;
  price: string;
  unit: string;
  note: string | null;
  save: string | null;
}[] = [
  { period: 'monthly',  label: 'Monthly',  price: '$14.99', unit: '/mo',   note: null,                save: null },
  { period: 'annual',   label: 'Annual',   price: '$9.99',  unit: '/mo',   note: 'Billed $119/year',  save: 'Save 33%' },
  { period: 'lifetime', label: 'Lifetime', price: '$249',   unit: '',      note: 'One-time payment',  save: null },
];

const freeFeatures = [
  'AI stock analysis on any US ticker',
  'Full portfolio dashboard',
  'Brokerage sync via Plaid',
  'Net worth & cash flow tracking',
  'Concentration risk & sector allocation',
  'Actions inbox',
];

const proFeatures = [
  'Tax-loss harvesting with wash-sale detection',
  'Earnings exposure tracking',
  'Portfolio Wrapped (annual summary)',
];

const faqItems = [
  {
    question: "What's included in the Free plan?",
    answer:
      'Most of Helm is free. You get AI-powered stock analysis on any US ticker, a full portfolio dashboard with brokerage sync via Plaid, net worth tracking, cash flow overview, concentration risk analysis, sector allocation, watchlist, and the actions inbox. No credit card required.',
  },
  {
    question: 'What does Pro add?',
    answer:
      'Pro unlocks three advanced features: tax-loss harvesting with wash-sale rule detection (typical savings: $500\u2013$3,000/year), earnings exposure tracking so you know when your holdings report, and Portfolio Wrapped \u2014 your annual investment summary.',
  },
  {
    question: 'What are the pricing options for Pro?',
    answer:
      'Monthly at $14.99/mo, Annual at $119/yr (save 33% \u2014 works out to $9.99/mo), or Lifetime at $249 one-time. All options include the same Pro features.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. Cancel monthly or annual subscriptions at any time. You keep access through the end of your billing period. No questions asked.',
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
      <summary className="flex items-center justify-between cursor-pointer px-5 py-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors list-none [&::-webkit-details-marker]:hidden">
        {question}
        <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 group-open:rotate-180 shrink-0 ml-4" />
      </summary>
      <div className="px-5 pb-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">
        {answer}
      </div>
    </details>
  );
}

export default function PricingPage() {
  const [selected, setSelected] = useState<BillingPeriod>('annual');
  const [showCheckout, setShowCheckout] = useState(false);

  const plan = PLANS.find(p => p.period === selected)!;

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
            <Link href="/analyze" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">Analyze</Link>
            <Link href="/pricing" className="text-sm text-[var(--color-text-primary)] transition-colors">Pricing</Link>
            <Link href="/blog" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">Blog</Link>
            <Link href="/login" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">Sign in</Link>
          </div>
        </div>
      </nav>

      {/* ── Header ── */}
      <section className="relative container mx-auto px-6 pt-12 pb-8 text-center">
        <AnimatedSection delay={0}>
          <p className="type-eyebrow text-[var(--color-gold)] mb-3">Pricing</p>
          <h1 className="type-h1 text-[var(--color-text-primary)] mb-3">
            Most of Helm is free.
          </h1>
          <p className="type-body text-[var(--color-text-secondary)] max-w-lg mx-auto">
            The full terminal — AI analysis, portfolio dashboard, brokerage sync, actions inbox — is free forever. Pro adds three advanced tools.
          </p>
        </AnimatedSection>
      </section>

      {/* ── Pricing — ProGate-style layout ── */}
      <section className="relative container mx-auto px-6 pb-16">
        <div className="max-w-lg mx-auto">

          {/* Free tier summary */}
          <AnimatedSection delay={100}>
            <div className="sovereign-card rounded p-5 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[14px] font-bold text-[var(--color-text-primary)]">Free</span>
                <div className="h-px flex-1 bg-[var(--color-border-base)]" />
                <span className="text-[18px] font-bold tabular-nums text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-mono)' }}>$0</span>
                <span className="text-[13px] text-[var(--color-text-muted)]">forever</span>
              </div>
              <ul className="space-y-2">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[var(--color-positive)] shrink-0 mt-0.5" />
                    <span className="text-sm text-[var(--color-text-secondary)]">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full text-center text-sm font-medium py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors mt-5"
              >
                Get Started Free
              </Link>
            </div>
          </AnimatedSection>

          {/* Pro — matches ProGate exactly */}
          <AnimatedSection delay={200}>
            <div className="mb-8">
              {/* Eyebrow */}
              <div className="flex items-center gap-3 mb-8">
                <HelmMark size={24} />
                <div className="h-px flex-1 bg-[var(--color-border-base)]" />
                <span className="text-[12px] uppercase tracking-[0.2em] text-[var(--color-gold)] font-medium" style={{ fontFamily: 'var(--font-mono)' }}>
                  Pro
                </span>
              </div>

              {/* Headline */}
              <h2 className="text-[28px] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight mb-3">
                Unlock advanced intelligence
              </h2>
              <p className="text-[16px] text-[var(--color-text-secondary)] leading-relaxed mb-4">
                Everything in Free, plus three features built for serious investors.
              </p>

              {/* Pro feature list */}
              <ul className="space-y-2 mb-10">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[var(--color-gold)] shrink-0 mt-0.5" />
                    <span className="text-sm text-[var(--color-text-primary)]">{f}</span>
                  </li>
                ))}
              </ul>

              {/* Plan options — radio cards identical to ProGate */}
              <div className="space-y-3 mb-8">
                {PLANS.map((p) => {
                  const active = selected === p.period;
                  return (
                    <button
                      key={p.period}
                      onClick={() => setSelected(p.period)}
                      className={`w-full flex items-center justify-between px-5 py-4 rounded-[var(--radius-md)] border cursor-pointer transition-colors duration-150 text-left ${
                        active
                          ? 'border-[var(--color-gold-border)] bg-[var(--color-gold-surface)]'
                          : 'border-[var(--color-border-base)] bg-transparent hover:border-[var(--color-border-strong)]'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-150 ${
                          active ? 'border-[var(--color-gold)]' : 'border-[var(--color-border-strong)]'
                        }`}>
                          {active && <div className="w-[8px] h-[8px] rounded-full bg-[var(--color-gold)]" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className={`text-[16px] font-medium ${active ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                              {p.label}
                            </span>
                            {p.save && (
                              <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-positive)] px-2 py-0.5 rounded-sm bg-[rgba(74,222,128,0.08)]" style={{ fontFamily: 'var(--font-mono)' }}>
                                {p.save}
                              </span>
                            )}
                          </div>
                          {p.note && (
                            <span className="text-[13px] text-[var(--color-text-muted)] mt-0.5 block" style={{ fontFamily: 'var(--font-mono)' }}>
                              {p.note}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-[18px] font-bold tabular-nums ${active ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                          {p.price}
                        </span>
                        <span className={`text-[13px] ${active ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'}`}>
                          {p.unit}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* CTA */}
              <button
                onClick={() => setShowCheckout(true)}
                className="group w-full flex items-center justify-center gap-2.5 px-8 py-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[15px] rounded-[var(--radius-md)] cursor-pointer transition-colors duration-200 mb-6"
              >
                Continue with {plan.label}
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>

              {/* Fine print */}
              <div className="text-center text-[12px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                Cancel anytime &middot; Secure via Stripe
              </div>
            </div>
          </AnimatedSection>
        </div>
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

      {showCheckout && (
        <CheckoutModal
          billingPeriod={selected}
          onClose={() => setShowCheckout(false)}
        />
      )}
    </main>
  );
}
