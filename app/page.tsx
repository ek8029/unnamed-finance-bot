'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, TrendingUp, Shield, LineChart,
  Target, Lock, Eye, PieChart, Activity, Wallet, Brain,
} from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { AnimatedSection } from '@/components/ui/animated-section';
import { LegalFooter } from '@/components/legal-footer';

/* ─────────────────────────────────────────
   Waitlist email capture — reused in hero + footer
   ───────────────────────────────────────── */
function WaitlistForm({ id }: { id: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{ position?: number; referral_code?: string; error?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.error && res.status >= 400) {
        setStatus('error');
        setResult({ error: data.error });
        return;
      }
      setStatus('success');
      setResult(data);
    } catch {
      setStatus('error');
      setResult({ error: 'Something went wrong. Try again.' });
    }
  };

  if (status === 'success') {
    return (
      <div className="space-y-3 text-left">
        <div className="flex items-center gap-2 text-[var(--color-positive)]">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-positive)]" />
          <span className="type-label">You&apos;re on the list</span>
        </div>
        <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded p-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="type-eyebrow text-[var(--color-text-muted)]">Position</span>
            <span className="type-data text-lg">#{result.position}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="type-eyebrow text-[var(--color-text-muted)]">Referral Code</span>
            <span className="type-mono text-[var(--color-gold)]">{result.referral_code}</span>
          </div>
        </div>
        <p className="type-mono text-[var(--color-text-muted)] text-xs">
          Share your referral code to move up the list.
        </p>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          id={id}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className="flex-1 px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors text-sm"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold rounded transition-colors text-sm whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {status === 'loading' ? 'Joining...' : 'Join the waitlist'}
          {status !== 'loading' && <ArrowRight className="w-4 h-4" />}
        </button>
      </form>
      {status === 'error' && (
        <p className="text-red-400 text-xs mt-2">{result.error}</p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   Landing Page
   ───────────────────────────────────────── */
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] relative overflow-hidden">
      {/* Grid background — no gradients, no glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.02)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.02)_1px,_transparent_1px)] bg-[length:64px_64px] opacity-40" />
      </div>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Helm Terminal',
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
            description:
              'Institutional-grade financial intelligence terminal. AI-powered portfolio analysis, tax optimization, and wealth monitoring for individuals.',
            url: 'https://helmterminal.dev',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
          }),
        }}
      />

      {/* ── Navigation ── */}
      <nav className="relative container mx-auto px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <HelmMark size={44} />
            <div>
              <div className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">Helm</div>
              <div className="type-eyebrow text-[var(--color-text-muted)]">Financial Intelligence</div>
            </div>
          </div>
          <Link
            href="/login"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative container mx-auto px-6 pt-16 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
          {/* Copy */}
          <AnimatedSection delay={0}>
            <div className="space-y-6">
              <h1 className="type-display text-5xl md:text-[56px] text-[var(--color-text-primary)] text-balance leading-[1.06]">
                Your financial life,{' '}
                <span className="text-[var(--color-gold)]">decoded.</span>
              </h1>
              <p className="type-body text-lg text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
                Helm monitors your net worth, portfolio risk, tax exposure, and cash
                flow — then tells you exactly what needs attention, with context
                and a clear next step.
              </p>

              <WaitlistForm id="hero-email" />

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

          {/* Product Preview */}
          <AnimatedSection delay={200} direction="right">
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded overflow-hidden">
              {/* Terminal Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--color-border-base)]">
                <div className="flex items-center gap-2.5">
                  <HelmMark size={20} />
                  <div>
                    <div className="type-label text-[var(--color-text-primary)]">Command Center</div>
                    <div className="type-eyebrow text-[var(--color-text-muted)]">Last sync 2m ago</div>
                  </div>
                </div>
                <div className="bg-[var(--color-bg-overlay)] px-3 py-1 flex items-center gap-1.5 rounded">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-positive)]" />
                  <span className="type-eyebrow text-[var(--color-positive)]">Live</span>
                </div>
              </div>

              <div className="px-5 py-4 space-y-3">
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-3 rounded">
                    <div className="type-eyebrow text-[var(--color-text-muted)] mb-1">Net Worth</div>
                    <div className="type-data text-2xl mb-1">$393,830</div>
                    <div className="type-mono text-[var(--color-positive)]">+5.4% QoQ</div>
                  </div>
                  <div className="border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-3 rounded">
                    <div className="type-eyebrow text-[var(--color-text-muted)] mb-1">Portfolio</div>
                    <div className="type-data text-2xl mb-1">$318,200</div>
                    <div className="type-mono text-[var(--color-positive)]">+18.3% YTD</div>
                  </div>
                </div>

                {/* Insight */}
                <div className="border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] p-3 flex items-center gap-3 rounded">
                  <div className="bg-[var(--color-bg-overlay)] p-2 rounded">
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
                <div className="border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-3 rounded">
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
                    <div key={m.label} className="border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-2 text-center rounded">
                      <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">{m.label}</div>
                      <div className={`type-data text-lg ${m.color}`}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <section className="relative border-y border-[var(--color-border-base)]">
        <div className="container mx-auto px-6 py-5">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {[
              'Plaid-secured connections',
              'Read-only access',
              '256-bit encryption',
              'SOC 2 infrastructure',
              'No data selling — ever',
            ].map((item) => (
              <span key={item} className="type-eyebrow text-[var(--color-text-muted)]">{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUE PROPOSITIONS ── */}
      <section className="relative container mx-auto px-6 py-24">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-14 max-w-2xl mx-auto">
              <h2 className="type-h1 text-3xl mb-4">
                Most finance apps show data.<br />
                Helm delivers intelligence.
              </h2>
              <p className="type-body text-[var(--color-text-secondary)] text-lg">
                Every insight is specific, data-backed, and actionable.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                Icon: PieChart,
                title: 'Portfolio Intelligence',
                description:
                  'Concentration risk, sector exposure, and performance attribution. Know exactly where your money sits and what&apos;s overweight.',
                metric: 'AAPL at 34%',
                metricLabel: 'above 25% threshold',
              },
              {
                Icon: LineChart,
                title: 'Tax Optimization',
                description:
                  'Loss harvesting windows, estimated liability, and wash-sale-compliant swaps. Save thousands at year-end.',
                metric: '$2,400',
                metricLabel: 'harvestable losses',
              },
              {
                Icon: Activity,
                title: 'Market Intelligence',
                description:
                  'Earnings, dividends, rate decisions, and macro events mapped to your actual positions — not generic news.',
                metric: '3 events',
                metricLabel: 'impacting holdings',
              },
            ].map((item, i) => (
              <AnimatedSection key={item.title} delay={i * 80}>
                <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] p-5 rounded h-full flex flex-col">
                  <div className="w-10 h-10 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded flex items-center justify-center mb-4">
                    <item.Icon className="w-5 h-5 text-[var(--color-text-secondary)]" />
                  </div>
                  <h3 className="type-h2 mb-1.5">{item.title}</h3>
                  <p className="type-body text-[var(--color-text-secondary)] text-sm mb-4 flex-1">{item.description}</p>
                  <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-baseline gap-1.5">
                    <span className="type-data text-lg">{item.metric}</span>
                    <span className="type-mono text-[var(--color-text-muted)]">{item.metricLabel}</span>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT SHOWCASE — Six Modules ── */}
      <section className="relative container mx-auto px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-14 max-w-2xl mx-auto">
              <div className="type-eyebrow text-[var(--color-text-muted)] mb-4">The Platform</div>
              <h2 className="type-h1 text-3xl">Six modules. One financial picture.</h2>
            </div>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {
                Icon: TrendingUp,
                title: 'Net Worth',
                desc: 'Assets, liabilities, and trends across all linked accounts.',
                value: '$393,830',
                change: '+5.4% QoQ',
                changeColor: 'text-[var(--color-positive)]',
              },
              {
                Icon: PieChart,
                title: 'Portfolio',
                desc: 'Position analysis, concentration risk, sector exposure.',
                value: '7 positions',
                change: '2 alerts',
                changeColor: 'text-[var(--color-warning)]',
              },
              {
                Icon: LineChart,
                title: 'Tax Engine',
                desc: 'Loss harvesting, estimated liability, efficient rebalancing.',
                value: '$2,400',
                change: 'harvestable',
                changeColor: 'text-[var(--color-positive)]',
              },
              {
                Icon: Wallet,
                title: 'Cash Flow',
                desc: 'Income vs. expenses, recurring charges, savings rate.',
                value: '$3,060',
                change: 'net / month',
                changeColor: '',
              },
              {
                Icon: Activity,
                title: 'Market Intel',
                desc: 'Earnings, dividends, splits, and macro events.',
                value: '3 events',
                change: 'this week',
                changeColor: 'text-[var(--color-text-secondary)]',
              },
              {
                Icon: Target,
                title: 'Health Score',
                desc: 'Composite: diversification, liquidity, savings, risk.',
                value: '78',
                change: '/ 100',
                changeColor: 'text-[var(--color-positive)]',
              },
            ].map((mod, i) => (
              <AnimatedSection key={mod.title} delay={i * 60}>
                <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] p-4 rounded h-full">
                  <div className="flex items-center gap-2.5 mb-2">
                    <mod.Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
                    <span className="type-label text-[var(--color-text-primary)]">{mod.title}</span>
                  </div>
                  <p className="type-body text-[var(--color-text-secondary)] text-xs mb-3">{mod.desc}</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="type-data text-lg">{mod.value}</span>
                    <span className={`type-mono text-xs ${mod.changeColor}`}>{mod.change}</span>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <section className="relative container mx-auto px-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-10">
              <h2 className="type-h1 text-3xl">The right tool for your wealth.</h2>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  name: 'Bloomberg Terminal',
                  price: '$24,000/yr',
                  description: 'Built for institutional desks. Not individuals.',
                  verdict: 'Overkill',
                  highlight: false,
                },
                {
                  name: 'Koyfin / Yahoo',
                  price: '$0–468/yr',
                  description: 'Dashboards and charts. No personal portfolio context.',
                  verdict: 'Data, not intelligence',
                  highlight: false,
                },
                {
                  name: 'Helm Terminal',
                  price: 'Free to start',
                  description: 'AI-powered intelligence mapped to your actual positions, taxes, and cash flow.',
                  verdict: 'Built for you',
                  highlight: true,
                },
              ].map((item) => (
                <div
                  key={item.name}
                  className={`p-5 rounded border ${
                    item.highlight
                      ? 'bg-[var(--color-bg-surface)] border-[var(--color-gold-border)]'
                      : 'bg-[var(--color-bg-surface)] border-[var(--color-border-base)]'
                  }`}
                >
                  <div className="type-label text-[var(--color-text-primary)] mb-1">{item.name}</div>
                  <div className={`type-data text-xl mb-3 ${item.highlight ? 'text-[var(--color-gold)]' : ''}`}>
                    {item.price}
                  </div>
                  <p className="type-body text-[var(--color-text-secondary)] text-sm mb-4">{item.description}</p>
                  <div
                    className={`type-eyebrow ${item.highlight ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'}`}
                  >
                    {item.verdict}
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="relative container mx-auto px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-14">
              <div className="type-eyebrow text-[var(--color-text-muted)] mb-4">How It Works</div>
              <h2 className="type-h1 text-3xl">Three steps to financial clarity</h2>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                Icon: Brain,
                title: 'Connect accounts',
                description:
                  'Link banks, brokerages, and credit cards through Plaid. Under 2 minutes.',
              },
              {
                step: '02',
                Icon: Activity,
                title: 'Helm analyzes daily',
                description:
                  'Scans for risk, tax windows, cash flow anomalies, and market events impacting your positions.',
              },
              {
                step: '03',
                Icon: Target,
                title: 'Act with confidence',
                description:
                  'Prioritized, contextualized recommendations with supporting data — not guesswork.',
              },
            ].map((item, i) => (
              <AnimatedSection key={item.step} delay={i * 120}>
                <div>
                  <div className="type-data text-4xl text-[var(--color-bg-overlay)] font-bold mb-3">{item.step}</div>
                  <div className="w-9 h-9 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded flex items-center justify-center mb-3">
                    <item.Icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  </div>
                  <h3 className="type-h2 mb-2">{item.title}</h3>
                  <p className="type-body text-[var(--color-text-secondary)] text-sm">{item.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY ── */}
      <section className="relative container mx-auto px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-10">
              <h2 className="type-h1 text-3xl">Built for trust.</h2>
            </div>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                Icon: Lock,
                title: 'Bank-Level Encryption',
                description: '256-bit AES encryption in transit and at rest.',
              },
              {
                Icon: Eye,
                title: 'Read-Only Access',
                description: 'Plaid read-only permissions. We never move your money.',
              },
              {
                Icon: Shield,
                title: 'Privacy First',
                description: 'Your data is never shared, sold, or used for advertising.',
              },
              {
                Icon: Brain,
                title: 'Trusted Infrastructure',
                description: 'Built on Plaid — used by thousands of financial apps.',
              },
            ].map((item, i) => (
              <AnimatedSection key={item.title} delay={i * 80}>
                <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] p-4 rounded h-full">
                  <item.Icon className="w-4 h-4 text-[var(--color-text-muted)] mb-2.5" />
                  <h3 className="type-label text-[var(--color-text-primary)] mb-1">{item.title}</h3>
                  <p className="type-body text-[var(--color-text-secondary)] text-xs">{item.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative container mx-auto px-6 pb-24">
        <AnimatedSection>
          <div className="max-w-xl mx-auto text-center space-y-6">
            <h2 className="type-h1 text-3xl">
              Your financial system deserves better than spreadsheets.
            </h2>
            <p className="type-body text-[var(--color-text-secondary)] text-lg">
              Institutional-grade analysis. Built for individuals.
            </p>
            <WaitlistForm id="footer-email" />
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
