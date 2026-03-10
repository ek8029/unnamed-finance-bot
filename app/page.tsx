'use client';

import Link from 'next/link';
import {
  ArrowRight, TrendingUp, Shield, Brain, LineChart, BarChart3,
  Target, Lock, Eye, PieChart, Activity, Wallet, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelmMark } from '@/components/helm-mark';
import { AnimatedSection } from '@/components/ui/animated-section';
import { LegalFooter } from '@/components/legal-footer';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] relative overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,_rgba(200,169,91,0.08),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.02)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.02)_1px,_transparent_1px)] bg-[length:64px_64px] opacity-40" />
      </div>

      {/* Navigation */}
      <nav className="relative container mx-auto px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <HelmMark size={44} />
            <div>
              <div className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">Helm</div>
              <div className="type-eyebrow text-[var(--color-text-muted)]">Financial Intelligence</div>
            </div>
          </div>
          <Link href="/dashboard">
            <Button className="bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold px-6">
              Open Dashboard
            </Button>
          </Link>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════
          HERO
          ═══════════════════════════════════════════ */}
      <section className="relative container mx-auto px-6 pt-16 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
          {/* Copy */}
          <AnimatedSection delay={0}>
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] px-4 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] animate-pulse-glow" />
                <span className="type-eyebrow text-[var(--color-gold)]">Financial Intelligence Terminal</span>
              </div>

              <div className="space-y-5">
                <h1 className="type-display text-5xl md:text-[56px] text-[var(--color-text-primary)] text-balance leading-[1.06]">
                  Your financial life,{' '}
                  <span className="text-[var(--color-gold)]">decoded.</span>
                </h1>
                <p className="type-body text-lg text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
                  Helm monitors your net worth, portfolio risk, tax exposure, and cash
                  flow — then tells you exactly what needs your attention, with context
                  and a clear next step.
                </p>
              </div>

              <p className="text-sm text-[var(--color-text-muted)]">
                An institutional-grade terminal built for founders, operators, and serious investors.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] px-8 font-semibold"
                  >
                    Start for Free
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-overlay)]"
                  >
                    See How It Works
                  </Button>
                </a>
              </div>

              {/* Trust bar */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
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

          {/* Hero Terminal Preview */}
          <AnimatedSection delay={200} direction="right">
            <div className="relative">
              <div className="absolute -inset-8 rounded-2xl bg-[var(--color-gold-surface)] blur-3xl opacity-50" />
              <div className="relative rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] shadow-2xl overflow-hidden">
                {/* Terminal Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--color-border-base)]">
                  <div className="flex items-center gap-2.5">
                    <HelmMark size={20} />
                    <div>
                      <div className="type-label text-[var(--color-text-primary)]">Command Center</div>
                      <div className="type-eyebrow text-[var(--color-text-muted)]">Last sync 2m ago</div>
                    </div>
                  </div>
                  <div className="rounded-full bg-[var(--color-bg-overlay)] px-3 py-1 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-positive)]" />
                    <span className="type-eyebrow text-[var(--color-positive)]">Live</span>
                  </div>
                </div>

                <div className="px-5 py-4 space-y-3">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-3">
                      <div className="type-eyebrow text-[var(--color-text-muted)] mb-1">Net Worth</div>
                      <div className="type-data text-2xl mb-1">$393,830</div>
                      <div className="type-mono text-[var(--color-positive)]">+5.4% QoQ</div>
                    </div>
                    <div className="rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-3">
                      <div className="type-eyebrow text-[var(--color-text-muted)] mb-1">Portfolio</div>
                      <div className="type-data text-2xl mb-1">$318,200</div>
                      <div className="type-mono text-[var(--color-positive)]">+18.3% YTD</div>
                    </div>
                  </div>

                  {/* Insight Alert */}
                  <div className="rounded-md border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] p-3 flex items-center gap-3">
                    <div className="rounded-md bg-[var(--color-bg-overlay)] p-2">
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
                  <div className="rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-3">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="type-eyebrow text-[var(--color-text-muted)]">Actions Inbox</div>
                      <div className="type-eyebrow text-[var(--color-gold)]">3 new</div>
                    </div>
                    <div className="space-y-2">
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
                      <div key={m.label} className="rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-2 text-center">
                        <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">{m.label}</div>
                        <div className={`type-data text-lg ${m.color}`}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          INTELLIGENCE FEED — Product Proof
          ═══════════════════════════════════════════ */}
      <section className="relative container mx-auto px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-14 max-w-2xl mx-auto">
              <div className="type-eyebrow text-[var(--color-gold)] mb-4">Why Helm</div>
              <h2 className="type-h1 text-3xl mb-4">
                Most finance apps show data.<br />
                Helm delivers intelligence.
              </h2>
              <p className="type-body text-[var(--color-text-secondary)] text-lg">
                Every insight is specific, data-backed, and actionable. Here&apos;s what
                your Actions Inbox actually looks like.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                category: 'Portfolio Risk',
                priority: 'High',
                dotColor: 'var(--color-warning)',
                headline: 'AAPL concentration at 34% of portfolio',
                context: 'Single-position exposure exceeds your 25% threshold. 72% of gains are concentrated in technology.',
                action: 'Review rebalancing options',
              },
              {
                category: 'Tax Optimization',
                priority: 'Before Dec 31',
                dotColor: 'var(--color-positive)',
                headline: '$2,400 in harvestable losses on VTI',
                context: 'Tax-loss harvesting window open. Similar-exposure ETF available for wash-sale-compliant swap.',
                action: 'View harvesting details',
              },
              {
                category: 'Cash Flow',
                priority: 'This month',
                dotColor: 'var(--color-gold)',
                headline: 'Recurring expenses up 12% ($147/mo)',
                context: '3 new subscriptions detected since October. Annualized impact: $1,764 in additional spend.',
                action: 'Review subscriptions',
              },
              {
                category: 'Market Intelligence',
                priority: 'Dec 18',
                dotColor: 'var(--color-gold)',
                headline: 'Fed rate decision may impact 3 positions',
                context: 'Bond allocation (12%) and REIT holdings historically sensitive to rate changes.',
                action: 'View exposed positions',
              },
            ].map((insight, i) => (
              <AnimatedSection key={insight.headline} delay={i * 80}>
                <div className="group bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-5 hover:border-[var(--color-border-strong)] transition-all duration-300 h-full flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: insight.dotColor }} />
                      <span className="type-eyebrow text-[var(--color-text-muted)]">{insight.category}</span>
                    </div>
                    <span className="type-eyebrow text-[var(--color-text-muted)]">{insight.priority}</span>
                  </div>
                  {/* Content */}
                  <h3 className="type-h2 mb-2">{insight.headline}</h3>
                  <p className="type-body text-[var(--color-text-secondary)] text-sm mb-4 flex-1">{insight.context}</p>
                  {/* Action */}
                  <div className="flex items-center gap-1 text-sm text-[var(--color-gold)] group-hover:text-[var(--color-gold-hi)] transition-colors">
                    <span className="font-medium">{insight.action}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          PLATFORM MODULES
          ═══════════════════════════════════════════ */}
      <section className="relative container mx-auto px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-14 max-w-2xl mx-auto">
              <div className="type-eyebrow text-[var(--color-gold)] mb-4">The Platform</div>
              <h2 className="type-h1 text-3xl mb-4">
                Six modules. One financial picture.
              </h2>
              <p className="type-body text-[var(--color-text-secondary)] text-lg">
                Helm continuously monitors every dimension of your financial
                life — so you never miss what matters.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                Icon: TrendingUp,
                title: 'Net Worth Tracking',
                description: 'Aggregated assets, liabilities, and trends across all linked accounts.',
                metric: '$393,830',
                metricLabel: '+5.4% QoQ',
                metricColor: 'text-[var(--color-positive)]',
              },
              {
                Icon: PieChart,
                title: 'Portfolio Intelligence',
                description: 'Position analysis, concentration risk, sector exposure, and performance attribution.',
                metric: '7 positions',
                metricLabel: '2 alerts',
                metricColor: 'text-[var(--color-warning)]',
              },
              {
                Icon: LineChart,
                title: 'Tax Optimization',
                description: 'Loss harvesting windows, estimated liability, and tax-efficient rebalancing.',
                metric: '$2,400',
                metricLabel: 'harvestable',
                metricColor: 'text-[var(--color-positive)]',
              },
              {
                Icon: Wallet,
                title: 'Cash Flow Analysis',
                description: 'Income vs. expenses, recurring charges, savings rate, and spending anomalies.',
                metric: '$3,060',
                metricLabel: 'net / month',
                metricColor: '',
              },
              {
                Icon: Activity,
                title: 'Market Intelligence',
                description: 'Earnings, dividends, splits, and macro events that impact your positions.',
                metric: '3 events',
                metricLabel: 'this week',
                metricColor: 'text-[var(--color-gold)]',
              },
              {
                Icon: Target,
                title: 'Financial Health Score',
                description: 'Composite score across diversification, liquidity, savings rate, and risk exposure.',
                metric: '78',
                metricLabel: '/ 100',
                metricColor: 'text-[var(--color-positive)]',
              },
            ].map((mod, i) => (
              <AnimatedSection key={mod.title} delay={i * 60}>
                <div className="group bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-5 hover:border-[var(--color-gold-border)] transition-all duration-300 h-full flex flex-col">
                  <div className="w-10 h-10 bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] rounded-md flex items-center justify-center mb-4 group-hover:bg-[rgba(200,169,91,0.12)] transition-colors">
                    <mod.Icon className="w-5 h-5 text-[var(--color-gold)]" />
                  </div>
                  <h3 className="type-h2 mb-1.5">{mod.title}</h3>
                  <p className="type-body text-[var(--color-text-secondary)] text-sm mb-4 flex-1">{mod.description}</p>
                  <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-baseline gap-1.5">
                    <span className={`type-data text-lg ${mod.metricColor}`}>{mod.metric}</span>
                    <span className="type-mono text-[var(--color-text-muted)]">{mod.metricLabel}</span>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          HOW IT WORKS
          ═══════════════════════════════════════════ */}
      <section id="how-it-works" className="relative container mx-auto px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-14">
              <div className="type-eyebrow text-[var(--color-gold)] mb-4">How It Works</div>
              <h2 className="type-h1 text-3xl">From scattered accounts to complete clarity</h2>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                Icon: BarChart3,
                title: 'Connect Your Accounts',
                youDo: 'Link bank accounts, brokerages, and credit cards through Plaid — takes under 2 minutes.',
                helmDoes: 'Aggregates all positions, transactions, and balances into a unified financial graph.',
                youGet: 'A complete picture of your financial system in one view.',
              },
              {
                step: '02',
                Icon: Brain,
                title: 'Helm Analyzes Continuously',
                youDo: 'Nothing — Helm runs in the background, every day.',
                helmDoes: 'Scans for portfolio risk, tax opportunities, cash flow anomalies, and market events affecting your positions.',
                youGet: 'Prioritized intelligence delivered to your Actions Inbox.',
              },
              {
                step: '03',
                Icon: Target,
                title: 'Act with Confidence',
                youDo: 'Review your personalized insights and decide what to act on.',
                helmDoes: 'Provides specific, contextualized recommendations with supporting data.',
                youGet: 'Clear, data-backed decisions — not guesswork.',
              },
            ].map((item, i) => (
              <AnimatedSection key={item.step} delay={i * 120}>
                <div className="relative">
                  <div className="type-data text-5xl text-[var(--color-bg-overlay)] font-bold mb-4">{item.step}</div>
                  <div className="w-9 h-9 bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] rounded-md flex items-center justify-center mb-4">
                    <item.Icon className="w-4 h-4 text-[var(--color-gold)]" />
                  </div>
                  <h3 className="type-h2 mb-4">{item.title}</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="type-eyebrow text-[var(--color-text-muted)] mb-1">You do</div>
                      <p className="type-body text-[var(--color-text-secondary)] text-sm">{item.youDo}</p>
                    </div>
                    <div>
                      <div className="type-eyebrow text-[var(--color-gold)] mb-1">Helm does</div>
                      <p className="type-body text-[var(--color-text-secondary)] text-sm">{item.helmDoes}</p>
                    </div>
                    <div>
                      <div className="type-eyebrow text-[var(--color-positive)] mb-1">You get</div>
                      <p className="type-body text-[var(--color-text-secondary)] text-sm">{item.youGet}</p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          TRUST & SECURITY
          ═══════════════════════════════════════════ */}
      <section className="relative container mx-auto px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-10">
              <div className="type-eyebrow text-[var(--color-gold)] mb-4">Security &amp; Privacy</div>
              <h2 className="type-h1 text-3xl">Built for trust.</h2>
            </div>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                Icon: Lock,
                title: 'Bank-Level Encryption',
                description: '256-bit AES encryption in transit and at rest. Your credentials never touch our servers.',
              },
              {
                Icon: Eye,
                title: 'Read-Only Access',
                description: 'Helm connects through Plaid with read-only permissions. We can never move your money.',
              },
              {
                Icon: Shield,
                title: 'Privacy First',
                description: 'Your financial data is never shared, sold, or used for advertising. Full stop.',
              },
              {
                Icon: Zap,
                title: 'Trusted Infrastructure',
                description: 'Built on Plaid — the same data infrastructure used by thousands of financial apps and institutions.',
              },
            ].map((item, i) => (
              <AnimatedSection key={item.title} delay={i * 80}>
                <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-5 h-full">
                  <item.Icon className="w-5 h-5 text-[var(--color-gold)] mb-3" />
                  <h3 className="type-h2 text-sm mb-1.5">{item.title}</h3>
                  <p className="type-body text-[var(--color-text-secondary)] text-sm">{item.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          TESTIMONIALS
          ═══════════════════════════════════════════ */}
      <section className="relative container mx-auto px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-10">
              <div className="type-eyebrow text-[var(--color-gold)] mb-4">From Our Users</div>
              <h2 className="type-h1 text-3xl">Built for people who take their finances seriously.</h2>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <div className="grid sm:grid-cols-3 gap-5">
              {[
                {
                  quote: 'Helm is the first tool that makes my personal finances feel like a real portfolio, not a budgeting app.',
                  initials: 'AK',
                  name: 'Alex K.',
                  role: 'Founder \u00b7 Seed-stage SaaS',
                },
                {
                  quote: 'It feels like having my private banker and tax advisor in one dashboard. Finally, something built for people who take their finances seriously.',
                  initials: 'MR',
                  name: 'Maria R.',
                  role: 'Staff Engineer \u00b7 Public company',
                },
                {
                  quote: 'I used to spend Sunday mornings in spreadsheets. Now Helm catches things I would have missed \u2014 like a $3,200 harvesting window I didn\u2019t know about.',
                  initials: 'DL',
                  name: 'David L.',
                  role: 'Independent Investor',
                },
              ].map((t) => (
                <div key={t.initials} className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-6 hover-elevate transition-all duration-300">
                  <p className="type-body text-[var(--color-text-secondary)] mb-4 italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center">
                      <span className="type-eyebrow text-[var(--color-gold)]">{t.initials}</span>
                    </div>
                    <div>
                      <div className="type-label text-[var(--color-text-primary)]">{t.name}</div>
                      <div className="type-eyebrow text-[var(--color-text-muted)]">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════ */}
      <section className="relative container mx-auto px-6 pb-24">
        <AnimatedSection>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="type-h1 text-3xl mb-4">Your financial system deserves better than spreadsheets.</h2>
            <p className="type-body text-[var(--color-text-secondary)] text-lg mb-8 max-w-xl mx-auto">
              Join the individuals who monitor their wealth with institutional-grade intelligence.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] px-10 font-semibold"
                >
                  Start for Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="secondary"
                  size="lg"
                  className="border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-overlay)]"
                >
                  Sign In
                </Button>
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
