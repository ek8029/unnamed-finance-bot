import { Suspense } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Shield, LineChart,
  Target, Lock, Eye, PieChart, Activity, Wallet, Brain,
  Check, Minus,
} from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { AnimatedSection } from '@/components/ui/animated-section';
import { LegalFooter } from '@/components/legal-footer';
import { WaitlistForm, WaitlistFormFallback } from '@/components/waitlist-form';
import { createClient } from '@/lib/supabase/server';

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] bg-depth relative overflow-hidden">
      {/* Grid background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.015)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.015)_1px,_transparent_1px)] bg-[length:64px_64px] opacity-40" />
      </div>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,_rgba(230,185,77,0.06)_0%,_transparent_70%)] opacity-60" />
      </div>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Helm Terminal',
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web',
              description:
                'Institutional-grade financial intelligence terminal. AI-powered portfolio analysis, tax-loss harvesting, and wealth monitoring for investors managing $50K–$2M+ across multiple accounts.',
              url: 'https://helmterminal.dev',
              featureList: [
                'AI-powered stock analysis',
                'Portfolio concentration risk alerts',
                'Tax-loss harvesting intelligence',
                'Net worth tracking with historical snapshots',
                'Cash flow monitoring and savings rate',
                'Market event impact analysis',
                'Financial health score',
              ],
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
                description: 'Free tier with full dashboard access and 3 AI analyses per day',
              },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Helm Terminal',
              url: 'https://helmterminal.dev',
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: 'https://helmterminal.dev/analyze/{ticker}',
                },
                'query-input': 'required name=ticker',
              },
            },
          ]),
        }}
      />

      {/* ── Navigation ── */}
      <nav className="relative container mx-auto px-6 py-3 glass-nav">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <HelmMark size={32} />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">Helm</span>
          </div>
          <div className="flex items-center gap-5">
            <Link
              href="/analyze"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Analyze
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
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

      {/* ── HERO ── */}
      <section className="relative container mx-auto px-6 pt-12 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Copy */}
          <AnimatedSection delay={0}>
            <div className="space-y-5">
              <h1 className="type-display text-[var(--color-text-primary)] text-balance">
                Your financial life,{' '}
                <span className="text-[var(--color-gold)] glow-gold">decoded.</span>
              </h1>
              <p className="type-body text-[var(--color-text-secondary)] max-w-xl">
                Helm monitors your portfolio for concentration risk, tax-loss
                harvesting windows, and earnings events — then tells you exactly
                what to do about them. Built for investors managing $50K–$2M+
                across multiple accounts.
              </p>

              <Suspense fallback={<WaitlistFormFallback />}>
                <WaitlistForm id="hero-email" />
              </Suspense>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {[
                  { Icon: Lock, text: 'Bank-level encryption' },
                  { Icon: Eye, text: 'Read-only access' },
                  { Icon: Shield, text: 'Your data is never sold' },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-1.5">
                    <item.Icon className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                    <span className="type-eyebrow text-[var(--color-text-muted)]">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* Product Preview */}
          <AnimatedSection delay={200} direction="right">
            <div className="glass-card rounded gradient-border overflow-hidden animate-data-pulse">
              {/* Terminal Header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-[var(--color-border-base)]">
                <div className="flex items-center gap-2">
                  <HelmMark size={18} />
                  <div>
                    <div className="type-label text-[var(--color-text-primary)]">Command Center</div>
                    <div className="type-eyebrow text-[var(--color-text-muted)]">Last sync 2m ago</div>
                  </div>
                </div>
                <div className="bg-[var(--color-bg-overlay)] px-2.5 py-0.5 flex items-center gap-1.5 rounded">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-positive)] animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                  <span className="type-eyebrow text-[var(--color-positive)]">Live</span>
                </div>
              </div>

              <div className="px-4 py-3 space-y-2">
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-2.5 rounded">
                    <div className="type-eyebrow text-[var(--color-text-muted)] mb-1">Net Worth</div>
                    <div className="type-data text-xl mb-0.5">$393,830</div>
                    <div className="type-mono text-[var(--color-positive)]">+5.4% QoQ</div>
                  </div>
                  <div className="border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-2.5 rounded">
                    <div className="type-eyebrow text-[var(--color-text-muted)] mb-1">Portfolio</div>
                    <div className="type-data text-xl mb-0.5">$318,200</div>
                    <div className="type-mono text-[var(--color-positive)]">+18.3% YTD</div>
                  </div>
                </div>

                {/* Insight */}
                <div className="border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] p-2.5 flex items-center gap-3 rounded">
                  <div className="bg-[var(--color-bg-overlay)] p-1.5 rounded">
                    <LineChart className="h-4 w-4 text-[var(--color-gold)]" />
                  </div>
                  <div>
                    <div className="type-label text-[var(--color-text-primary)]">Tax Intelligence</div>
                    <div className="type-mono text-[var(--color-text-secondary)]">
                      Loss harvesting opportunity: <span className="text-[var(--color-positive)]">$2,400</span>
                    </div>
                  </div>
                </div>

                {/* Actions Inbox */}
                <div className="border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-2.5 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <div className="type-eyebrow text-[var(--color-text-muted)]">Actions Inbox</div>
                    <div className="type-eyebrow text-[var(--color-gold)]">3 new</div>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { color: 'var(--color-warning)', text: 'AAPL concentration above 25% threshold' },
                      { color: 'var(--color-gold)', text: 'Emergency fund below 3-month target' },
                      { color: 'var(--color-positive)', text: 'Recurring charge increase: +$147/mo' },
                    ].map((item) => (
                      <div key={item.text} className="flex items-center gap-2 text-[11px]">
                        <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-[var(--color-text-secondary)]">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Health', value: '78', color: 'text-[var(--color-positive)]' },
                    { label: 'Savings', value: '24%', color: '' },
                    { label: 'Risk', value: 'Med', color: 'text-[var(--color-warning)]' },
                  ].map((m) => (
                    <div key={m.label} className="border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-1.5 text-center rounded">
                      <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">{m.label}</div>
                      <div className={`type-data text-base ${m.color}`}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <section className="relative border-y border-[var(--color-border-base)] glass-panel">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center justify-center gap-y-3 divide-x divide-[var(--color-border-base)]">
            {[
              { value: '256-bit', label: 'encryption' },
              { value: 'Read-only', label: 'bank access' },
              { value: 'SOC 2', label: 'infrastructure' },
              { value: 'Plaid', label: 'secured' },
              { value: 'Zero', label: 'data sold' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 px-6">
                <span className="type-label text-[var(--color-text-primary)]">{item.value}</span>
                <span className="type-eyebrow text-[var(--color-text-muted)]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUE PROPOSITIONS ── */}
      <section className="relative container mx-auto px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-10 max-w-2xl mx-auto">
              <h2 className="type-h1 mb-3">
                Most finance apps show data.<br />
                Helm delivers intelligence.
              </h2>
              <p className="type-body text-[var(--color-text-secondary)]">
                Every insight is specific, data-backed, and actionable.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-3">
            {/* Featured card — spans 2 cols */}
            <AnimatedSection delay={0}>
              <div className="md:col-span-1 sovereign-card p-5 rounded hover-glow-card h-full flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded flex items-center justify-center">
                    <PieChart className="w-4 h-4 text-[var(--color-gold)]" />
                  </div>
                  <h3 className="type-h2">Portfolio Intelligence</h3>
                </div>
                <p className="type-body text-[var(--color-text-secondary)] text-sm mb-4 flex-1">
                  Concentration risk, sector exposure, and performance attribution.
                  Know exactly where your money sits and what&apos;s overweight.
                </p>
                <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-baseline gap-2">
                  <span className="type-data text-lg glow-gold-subtle">AAPL at 34%</span>
                  <span className="type-mono text-[var(--color-warning)]">above 25% threshold</span>
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection delay={80}>
              <div className="sovereign-card p-5 rounded hover-glow-card h-full flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded flex items-center justify-center">
                    <LineChart className="w-4 h-4 text-[var(--color-positive)]" />
                  </div>
                  <h3 className="type-h2">Tax Optimization</h3>
                </div>
                <p className="type-body text-[var(--color-text-secondary)] text-sm mb-4 flex-1">
                  Loss harvesting windows, estimated liability, and wash-sale-compliant swaps. Save thousands at year-end.
                </p>
                <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-baseline gap-2">
                  <span className="type-data text-lg text-[var(--color-positive)] glow-gold-subtle">$2,400</span>
                  <span className="type-mono text-[var(--color-text-muted)]">harvestable losses</span>
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection delay={160}>
              <div className="sovereign-card p-5 rounded hover-glow-card h-full flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded flex items-center justify-center">
                    <Activity className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  </div>
                  <h3 className="type-h2">Market Intelligence</h3>
                </div>
                <p className="type-body text-[var(--color-text-secondary)] text-sm mb-4 flex-1">
                  Earnings, dividends, rate decisions, and macro events mapped to your actual positions — not generic news.
                </p>
                <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-baseline gap-2">
                  <span className="type-data text-lg glow-gold-subtle">3 events</span>
                  <span className="type-mono text-[var(--color-text-muted)]">impacting holdings</span>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── PRODUCT SHOWCASE — Bento Grid ── */}
      <section className="relative container mx-auto px-6 pb-16">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-10 max-w-2xl mx-auto">
              <div className="type-eyebrow text-[var(--color-text-muted)] mb-3">The Platform</div>
              <h2 className="type-h1">Six modules. One financial picture.</h2>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-fr">
            {/* Net Worth — large tile */}
            <AnimatedSection delay={0}>
              <div className="col-span-2 row-span-2 sovereign-card gradient-border p-5 rounded h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-[var(--color-gold)]" />
                    <span className="type-label text-[var(--color-text-primary)]">Net Worth</span>
                  </div>
                  <p className="type-body text-[var(--color-text-secondary)] text-sm mb-4">
                    Assets, liabilities, and trends across all linked accounts.
                    Track month-over-month changes with historical snapshots.
                  </p>
                </div>
                <div>
                  <div className="type-data text-3xl mb-1 glow-white">$393,830</div>
                  <div className="type-mono text-[var(--color-positive)]">+5.4% QoQ</div>
                  {/* Mini sparkline placeholder */}
                  <div className="mt-3 h-12 flex items-end gap-px">
                    {[32, 35, 33, 40, 38, 42, 45, 43, 48, 52, 50, 56].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-[var(--color-gold)] opacity-30 rounded-t"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </AnimatedSection>

            {/* Portfolio */}
            <AnimatedSection delay={60}>
              <div className="sovereign-card p-4 rounded h-full">
                <div className="flex items-center gap-2 mb-2">
                  <PieChart className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="type-label text-[var(--color-text-primary)]">Portfolio</span>
                </div>
                <p className="type-body text-[var(--color-text-secondary)] text-xs mb-3">Position analysis, concentration risk, sector exposure.</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="type-data text-lg glow-gold-subtle">7 positions</span>
                  <span className="type-mono text-xs text-[var(--color-warning)]">2 alerts</span>
                </div>
              </div>
            </AnimatedSection>

            {/* Tax Engine */}
            <AnimatedSection delay={120}>
              <div className="sovereign-card p-4 rounded h-full">
                <div className="flex items-center gap-2 mb-2">
                  <LineChart className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="type-label text-[var(--color-text-primary)]">Tax Engine</span>
                </div>
                <p className="type-body text-[var(--color-text-secondary)] text-xs mb-3">Loss harvesting, estimated liability, efficient rebalancing.</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="type-data text-lg text-[var(--color-positive)] glow-gold-subtle">$2,400</span>
                  <span className="type-mono text-xs text-[var(--color-positive)]">harvestable</span>
                </div>
              </div>
            </AnimatedSection>

            {/* Cash Flow */}
            <AnimatedSection delay={180}>
              <div className="sovereign-card p-4 rounded h-full">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="type-label text-[var(--color-text-primary)]">Cash Flow</span>
                </div>
                <p className="type-body text-[var(--color-text-secondary)] text-xs mb-3">Income vs. expenses, recurring charges, savings rate.</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="type-data text-lg glow-gold-subtle">$3,060</span>
                  <span className="type-mono text-xs">net / month</span>
                </div>
              </div>
            </AnimatedSection>

            {/* Market Intel */}
            <AnimatedSection delay={240}>
              <div className="sovereign-card p-4 rounded h-full">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="type-label text-[var(--color-text-primary)]">Market Intel</span>
                </div>
                <p className="type-body text-[var(--color-text-secondary)] text-xs mb-3">Earnings, dividends, splits, and macro events.</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="type-data text-lg glow-gold-subtle">3 events</span>
                  <span className="type-mono text-xs text-[var(--color-text-secondary)]">this week</span>
                </div>
              </div>
            </AnimatedSection>

            {/* Health Score */}
            <AnimatedSection delay={300}>
              <div className="sovereign-card p-4 rounded h-full">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="type-label text-[var(--color-text-primary)]">Health Score</span>
                </div>
                <p className="type-body text-[var(--color-text-secondary)] text-xs mb-3">Composite: diversification, liquidity, savings, risk.</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="type-data text-lg text-[var(--color-positive)] glow-gold-subtle">78</span>
                  <span className="type-mono text-xs text-[var(--color-positive)]">/ 100</span>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section className="relative container mx-auto px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-8">
              <h2 className="type-h1">The right tool for your wealth.</h2>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <div className="sovereign-card rounded overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--color-border-base)]">
                    <th className="type-eyebrow text-[var(--color-text-muted)] p-3 w-[30%]">Feature</th>
                    <th className="type-eyebrow text-[var(--color-text-muted)] p-3 text-center">Bloomberg</th>
                    <th className="type-eyebrow text-[var(--color-text-muted)] p-3 text-center">Koyfin / Yahoo</th>
                    <th className="type-eyebrow text-[var(--color-gold)] glow-gold-subtle p-3 text-center bg-[var(--color-gold-surface)] border-l border-[var(--color-gold-border)]">Helm</th>
                  </tr>
                </thead>
                <tbody className="type-mono">
                  {[
                    { feature: 'Price', bloomberg: '$24K/yr', koyfin: '$0–468/yr', helm: 'Free to start' },
                    { feature: 'Personal portfolio context', bloomberg: false, koyfin: false, helm: true },
                    { feature: 'Tax-loss harvesting', bloomberg: false, koyfin: false, helm: true },
                    { feature: 'AI-powered analysis', bloomberg: false, koyfin: false, helm: true },
                    { feature: 'Actionable alerts', bloomberg: false, koyfin: false, helm: true },
                    { feature: 'Cash flow monitoring', bloomberg: false, koyfin: false, helm: true },
                  ].map((row) => (
                    <tr key={row.feature} className="border-b border-[var(--color-border-subtle)] last:border-0">
                      <td className="p-3 text-[var(--color-text-secondary)] text-sm">{row.feature}</td>
                      <td className="p-3 text-center">
                        {typeof row.bloomberg === 'string' ? (
                          <span className="text-[var(--color-text-muted)]">{row.bloomberg}</span>
                        ) : row.bloomberg ? (
                          <Check className="w-4 h-4 text-[var(--color-positive)] mx-auto" />
                        ) : (
                          <Minus className="w-4 h-4 text-[var(--color-text-muted)] mx-auto" />
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {typeof row.koyfin === 'string' ? (
                          <span className="text-[var(--color-text-muted)]">{row.koyfin}</span>
                        ) : row.koyfin ? (
                          <Check className="w-4 h-4 text-[var(--color-positive)] mx-auto" />
                        ) : (
                          <Minus className="w-4 h-4 text-[var(--color-text-muted)] mx-auto" />
                        )}
                      </td>
                      <td className="p-3 text-center bg-[var(--color-gold-surface)] border-l border-[var(--color-gold-border)]">
                        {typeof row.helm === 'string' ? (
                          <span className="text-[var(--color-gold)] font-medium">{row.helm}</span>
                        ) : row.helm ? (
                          <Check className="w-4 h-4 text-[var(--color-gold)] mx-auto" />
                        ) : (
                          <Minus className="w-4 h-4 text-[var(--color-text-muted)] mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── HOW IT WORKS — Horizontal Steps ── */}
      <section className="relative container mx-auto px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-10">
              <div className="type-eyebrow text-[var(--color-text-muted)] mb-3">How It Works</div>
              <h2 className="type-h1">Three steps to financial clarity</h2>
            </div>
          </AnimatedSection>

          {/* Desktop: horizontal */}
          <AnimatedSection delay={100}>
            <div className="hidden md:flex items-start">
              {[
                {
                  step: '01',
                  Icon: Brain,
                  title: 'Connect accounts',
                  description: 'Link banks, brokerages, and credit cards through Plaid. Read-only, under 2 minutes.',
                },
                {
                  step: '02',
                  Icon: Activity,
                  title: 'Helm analyzes daily',
                  description: 'Scans for risk, tax windows, cash flow anomalies, and market events impacting your positions.',
                },
                {
                  step: '03',
                  Icon: Target,
                  title: 'Act with confidence',
                  description: 'Prioritized, contextualized recommendations with supporting data — not guesswork.',
                },
              ].map((item, i) => (
                <div key={item.step} className="flex items-start flex-1">
                  <div className="flex-1">
                    <div className="type-data text-sm text-[var(--color-gold)] mb-2">{item.step}</div>
                    <div className="w-8 h-8 sovereign-card rounded flex items-center justify-center mb-2.5">
                      <item.Icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    </div>
                    <h3 className="type-h2 text-base mb-1.5">{item.title}</h3>
                    <p className="type-body text-[var(--color-text-secondary)] text-sm pr-6">{item.description}</p>
                  </div>
                  {i < 2 && (
                    <div className="w-12 flex items-center pt-5">
                      <div className="w-full h-px bg-[var(--color-border-base)]" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile: vertical */}
            <div className="md:hidden space-y-6">
              {[
                {
                  step: '01',
                  Icon: Brain,
                  title: 'Connect accounts',
                  description: 'Link banks, brokerages, and credit cards through Plaid. Read-only, under 2 minutes.',
                },
                {
                  step: '02',
                  Icon: Activity,
                  title: 'Helm analyzes daily',
                  description: 'Scans for risk, tax windows, cash flow anomalies, and market events impacting your positions.',
                },
                {
                  step: '03',
                  Icon: Target,
                  title: 'Act with confidence',
                  description: 'Prioritized, contextualized recommendations with supporting data — not guesswork.',
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="type-data text-sm text-[var(--color-gold)]">{item.step}</div>
                    <div className="flex-1 w-px bg-[var(--color-border-base)] mt-2" />
                  </div>
                  <div className="pb-2">
                    <h3 className="type-h2 text-base mb-1">{item.title}</h3>
                    <p className="type-body text-[var(--color-text-secondary)] text-sm">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── TRY IT CTA ── */}
      <section className="relative container mx-auto px-6 pb-16">
        <AnimatedSection>
          <div className="max-w-2xl mx-auto text-center sovereign-card rounded gradient-border p-6 space-y-3">
            <div className="type-eyebrow text-[var(--color-gold)]">Try It Now</div>
            <h2 className="type-h1 text-2xl">
              Free AI stock analysis for any ticker
            </h2>
            <p className="type-body text-[var(--color-text-secondary)] max-w-lg mx-auto">
              Institutional-grade analysis with real-time data, financial metrics, analyst consensus, and news sentiment — no account required.
            </p>
            <Link
              href="/analyze"
              className="inline-block px-8 py-2.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold rounded text-sm transition-all hover:shadow-glow-gold"
            >
              Analyze a stock free
            </Link>
          </div>
        </AnimatedSection>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative container mx-auto px-6 pb-16">
        <AnimatedSection>
          <div className="max-w-xl mx-auto text-center space-y-5">
            <h2 className="type-h1">
              Start monitoring your portfolio this week.
            </h2>
            <p className="type-body text-[var(--color-text-secondary)]">
              Free forever for basic monitoring. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/signup"
                className="px-8 py-2.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold rounded text-sm hover:shadow-glow-gold transition-shadow"
              >
                Get Started Free
              </Link>
              <Link
                href="/analyze"
                className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                or analyze a stock first
              </Link>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* Footer */}
      <div className="relative">
        <LegalFooter />
      </div>
    </main>
  );
}
