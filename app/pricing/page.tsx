import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Brain,
  LayoutDashboard,
  Wallet,
  Activity,
  Bell,
  Infinity,
  TrendingDown,
  BarChart3,
  Rss,
  Sparkles,
  Zap,
  ChevronDown,
} from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { AnimatedSection } from '@/components/ui/animated-section';
import { LegalFooter } from '@/components/legal-footer';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Pricing - Helm Terminal',
  description:
    'Simple, transparent pricing for institutional-grade financial intelligence. Start free, upgrade when you need more.',
  openGraph: {
    title: 'Pricing — Helm Terminal',
    description:
      'Free portfolio dashboard with AI analysis. Pro tier coming soon at $24.99/month for unlimited intelligence.',
    url: 'https://helmterminal.dev/pricing',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing — Helm Terminal',
    description:
      'Free portfolio dashboard with AI analysis. Pro tier coming soon at $24.99/month for unlimited intelligence.',
  },
  alternates: {
    canonical: 'https://helmterminal.dev/pricing',
  },
};

const freeTierFeatures = [
  { icon: Brain, label: 'AI stock analysis', detail: '3 per day' },
  { icon: LayoutDashboard, label: 'Portfolio dashboard' },
  { icon: Wallet, label: 'Net worth tracking' },
  { icon: Activity, label: 'Cash flow overview' },
  { icon: Bell, label: 'Basic alerts' },
];

const proTierFeatures = [
  { icon: Infinity, label: 'Unlimited AI analysis' },
  { icon: TrendingDown, label: 'Tax-loss harvesting intelligence' },
  { icon: BarChart3, label: 'Earnings impact analysis' },
  { icon: Rss, label: 'Full intelligence feed' },
  { icon: Sparkles, label: 'Portfolio Wrapped' },
  { icon: Zap, label: 'Priority data sync' },
];

const faqItems = [
  {
    question: "What's included in the Free plan?",
    answer:
      'The Free plan gives you full access to the Helm dashboard — portfolio tracking, net worth monitoring, cash flow overview, basic alerts, and up to 3 AI-powered stock analyses per day. No credit card required.',
  },
  {
    question: 'When does Pro launch?',
    answer:
      "Pro is currently in development and will launch soon. Join the waitlist to be among the first to access unlimited AI analysis, tax-loss harvesting intelligence, earnings impact analysis, and more. We'll notify you as soon as it's available.",
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. When Pro launches, you can cancel your subscription at any time with no questions asked. You will retain access through the end of your billing period.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Absolutely. Helm uses bank-level encryption, read-only access to your accounts via Plaid, and row-level security on all user data. We never store your banking credentials and never sell your data.',
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group glass-card rounded overflow-hidden">
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

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] bg-depth relative overflow-hidden">
      {/* FAQPage + BreadcrumbList JSON-LD */}
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
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: item.answer,
                },
              })),
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Home',
                  item: 'https://helmterminal.dev',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Pricing',
                  item: 'https://helmterminal.dev/pricing',
                },
              ],
            },
          ]),
        }}
      />

      {/* Grid background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.01)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.01)_1px,_transparent_1px)] bg-[length:64px_64px] opacity-40" />
      </div>

      {/* ── Navigation ── */}
      <nav className="relative container mx-auto px-6 py-3 glass-nav">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5">
            <HelmMark size={32} />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/analyze"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Analyze
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-[var(--color-text-primary)] transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/blog"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Blog
            </Link>
            {user ? (
              <Link
                href="/dashboard"
                className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── Header ── */}
      <section className="relative container mx-auto px-6 pt-12 pb-8 text-center">
        <AnimatedSection delay={0}>
          <p className="type-eyebrow text-[var(--color-gold)] mb-3">
            Pricing
          </p>
          <h1 className="type-h1 text-[var(--color-text-primary)] mb-3">
            Simple, transparent pricing
          </h1>
          <p className="type-body text-[var(--color-text-secondary)] max-w-lg mx-auto">
            Start with full access to the Helm dashboard for free. Upgrade to
            Pro when you need institutional-grade intelligence.
          </p>
        </AnimatedSection>
      </section>

      {/* ── Pricing Cards — Pro dominant ── */}
      <section className="relative container mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-5 gap-4 max-w-3xl mx-auto pt-4">
          {/* Free Tier — understated */}
          <AnimatedSection delay={100} className="md:col-span-2">
            <div className="h-full flex flex-col glass-card rounded-lg shadow-card p-5">
              <div className="mb-5">
                <p className="type-label text-[var(--color-text-muted)] mb-2">
                  Free
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="type-data text-[var(--color-text-primary)]">
                    $0
                  </span>
                  <span className="text-sm text-[var(--color-text-muted)]">
                    / month
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                  Everything you need to monitor your finances.
                </p>
              </div>

              <div className="border-t border-[var(--color-border-subtle)] pt-4 mb-5 flex-1">
                <ul className="space-y-2.5">
                  {freeTierFeatures.map((f) => (
                    <li key={f.label} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] flex items-center justify-center shrink-0">
                        <f.icon className="w-3 h-3 text-[var(--color-text-secondary)]" />
                      </div>
                      <span className="text-sm text-[var(--color-text-primary)]">
                        {f.label}
                      </span>
                      {f.detail && (
                        <span className="type-mono text-[var(--color-text-muted)] ml-auto">
                          {f.detail}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/signup"
                className="block w-full text-center text-sm font-medium py-2.5 rounded border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
              >
                Get Started Free
              </Link>
            </div>
          </AnimatedSection>

          {/* Pro Tier — dominant */}
          <AnimatedSection delay={200} className="md:col-span-3">
            <div className="relative">
              <div className="h-full flex flex-col glass-card animate-border-glow rounded-lg shadow-elevated p-6 relative overflow-hidden">
                {/* Brass top-rule */}
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #B8914A, rgba(184,145,74,0.3), transparent)' }} />
                {/* Coming Soon badge */}
                <div className="absolute -top-3 right-6 z-10">
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[var(--color-gold)] text-[var(--color-bg-base)] text-[11px] font-medium uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>
                    Coming Soon
                  </span>
                </div>

                <div className="mb-5 mt-1">
                  <p className="type-label text-[var(--color-gold)] mb-2">
                    Pro
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="type-data text-[var(--color-gold)] glow-gold">
                      $24.99
                    </span>
                    <span className="text-sm text-[var(--color-text-muted)]">
                      / month
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                    Full intelligence suite for serious investors.
                  </p>
                </div>

                <div className="border-t border-[var(--color-gold-border)] pt-4 mb-5 flex-1">
                  <p className="text-xs text-[var(--color-text-muted)] mb-3 font-medium">
                    Everything in Free, plus:
                  </p>
                  <ul className="space-y-2.5">
                    {proTierFeatures.map((f) => (
                      <li key={f.label} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center shrink-0">
                          <f.icon className="w-3 h-3 text-[var(--color-gold)]" />
                        </div>
                        <span className="text-sm text-[var(--color-text-primary)]">
                          {f.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href="/signup"
                  className="block w-full text-center text-sm font-medium py-2.5 rounded bg-[var(--color-gold)] text-[var(--color-bg-base)] hover:bg-[var(--color-gold-hi)] transition-colors hover:shadow-glow-gold transition-shadow"
                >
                  Join Waitlist for Pro
                </Link>
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
                <FAQItem
                  key={item.question}
                  question={item.question}
                  answer={item.answer}
                />
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Footer ── */}
      <LegalFooter />
    </main>
  );
}
