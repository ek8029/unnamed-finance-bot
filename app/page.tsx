'use client';

import Link from 'next/link';
import { ArrowRight, TrendingUp, Shield, Brain, LineChart, Zap, BarChart3, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelmMark } from '@/components/helm-mark';
import { AnimatedSection } from '@/components/ui/animated-section';

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

      {/* Hero Section */}
      <section className="relative container mx-auto px-6 pt-20 pb-28">
        <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
          {/* Copy */}
          <AnimatedSection delay={0}>
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] px-4 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] animate-pulse-glow" />
                <span className="type-eyebrow text-[var(--color-gold)]">Financial Intelligence Platform</span>
              </div>
              <div className="space-y-5">
                <h1 className="type-display text-5xl md:text-[56px] text-[var(--color-text-primary)] text-balance leading-[1.06]">
                  Your finances,{' '}
                  <span className="text-[var(--color-gold)]">decoded.</span>
                </h1>
                <p className="type-body text-lg text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
                  Helm transforms scattered financial data into a unified intelligence system.
                  Net worth, portfolio risk, tax exposure, and cash flow — analyzed and surfaced
                  like an institutional-grade terminal built for you.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/dashboard">
                  <Button
                    size="lg"
                    className="bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] px-8 font-semibold"
                  >
                    Launch Helm
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-overlay)]"
                  >
                    <Zap className="mr-2 h-4 w-4 text-[var(--color-gold)]" />
                    Explore the prototype
                  </Button>
                </Link>
              </div>
            </div>
          </AnimatedSection>

          {/* Hero Preview Card */}
          <AnimatedSection delay={200} direction="right">
            <div className="relative">
              <div className="absolute -inset-8 rounded-2xl bg-[var(--color-gold-surface)] blur-3xl opacity-50" />
              <div className="relative rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] shadow-2xl overflow-hidden">
                {/* Preview Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--color-border-base)]">
                  <div className="flex items-center gap-2.5">
                    <HelmMark size={20} />
                    <div>
                      <div className="type-label text-[var(--color-text-primary)]">Command Center</div>
                      <div className="type-eyebrow text-[var(--color-text-muted)]">Net worth · Portfolio · Taxes</div>
                    </div>
                  </div>
                  <div className="rounded-full bg-[var(--color-bg-overlay)] px-3 py-1 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-positive)]" />
                    <span className="type-eyebrow text-[var(--color-positive)]">Live</span>
                  </div>
                </div>
                {/* Preview Content */}
                <div className="px-5 py-4 space-y-3">
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
                  <div className="rounded-md border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
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
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-2 text-center">
                      <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Health</div>
                      <div className="type-data text-lg text-[var(--color-positive)]">78</div>
                    </div>
                    <div className="rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-2 text-center">
                      <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Savings</div>
                      <div className="type-data text-lg">24%</div>
                    </div>
                    <div className="rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-2 text-center">
                      <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Risk</div>
                      <div className="type-data text-lg text-[var(--color-warning)]">Med</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="relative container mx-auto px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <div className="type-eyebrow text-[var(--color-gold)] mb-4">Why Helm</div>
              <h2 className="type-h1 text-3xl mb-4">
                Most finance apps show data.<br />
                Helm provides intelligence.
              </h2>
              <p className="type-body text-[var(--color-text-secondary)] text-lg">
                Instead of juggling spreadsheets and dashboards, Helm connects your accounts,
                analyzes your financial system, and surfaces the actions that actually matter.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Brain,
                title: 'Continuous Intelligence',
                description: 'Helm reads market moves, your portfolio structure, and tax context to surface the few insights that actually matter — automatically.',
              },
              {
                icon: TrendingUp,
                title: 'Portfolio & Risk Clarity',
                description: 'See concentration, factor exposure, and scenario impact in one view. No spreadsheets, no ad-hoc dashboards.',
              },
              {
                icon: Shield,
                title: 'Tax-Aware Decisions',
                description: 'Understand tax drag, harvesting opportunities, and estimated liability before you make a move.',
              },
            ].map((feature, i) => (
              <AnimatedSection key={feature.title} delay={i * 100}>
                <div className="group bg-[var(--color-bg-surface)] p-6 border border-[var(--color-border-base)] rounded-lg hover:border-[var(--color-gold-border)] transition-all duration-300 hover-elevate h-full">
                  <div className="w-10 h-10 bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] rounded-md flex items-center justify-center mb-5 group-hover:bg-[rgba(200,169,91,0.12)] transition-colors">
                    <feature.icon className="w-5 h-5 text-[var(--color-gold)]" />
                  </div>
                  <h3 className="type-h2 mb-2">{feature.title}</h3>
                  <p className="type-body text-[var(--color-text-secondary)]">{feature.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative container mx-auto px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-14">
              <div className="type-eyebrow text-[var(--color-gold)] mb-4">How It Works</div>
              <h2 className="type-h1 text-3xl">From scattered data to financial clarity</h2>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: BarChart3,
                title: 'Connect & Aggregate',
                description: 'Link your accounts, portfolios, and tax documents into a single financial graph.',
              },
              {
                step: '02',
                icon: Brain,
                title: 'Analyze & Understand',
                description: 'Helm maps your income, assets, liabilities, risk exposure, and optimization opportunities.',
              },
              {
                step: '03',
                icon: Target,
                title: 'Act with Confidence',
                description: 'Receive prioritized, actionable intelligence — not just charts. Know exactly what to do next.',
              },
            ].map((item, i) => (
              <AnimatedSection key={item.step} delay={i * 120}>
                <div className="relative">
                  <div className="type-data text-5xl text-[var(--color-bg-overlay)] font-bold mb-4">{item.step}</div>
                  <div className="w-9 h-9 bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] rounded-md flex items-center justify-center mb-4">
                    <item.icon className="w-4 h-4 text-[var(--color-gold)]" />
                  </div>
                  <h3 className="type-h2 mb-2">{item.title}</h3>
                  <p className="type-body text-[var(--color-text-secondary)]">{item.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="relative container mx-auto px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-6 hover-elevate transition-all duration-300">
                <p className="type-body text-[var(--color-text-secondary)] mb-4 italic">
                  &ldquo;Helm is the first tool that makes my personal finances feel like a real portfolio, not a budgeting app.&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center">
                    <span className="type-eyebrow text-[var(--color-gold)]">AK</span>
                  </div>
                  <div>
                    <div className="type-label text-[var(--color-text-primary)]">Alex K.</div>
                    <div className="type-eyebrow text-[var(--color-text-muted)]">Founder · Seed-stage SaaS</div>
                  </div>
                </div>
              </div>
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-6 hover-elevate transition-all duration-300">
                <p className="type-body text-[var(--color-text-secondary)] mb-4 italic">
                  &ldquo;It feels like having my private banker and tax advisor in one dashboard. Finally, something built for people who take their finances seriously.&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center">
                    <span className="type-eyebrow text-[var(--color-gold)]">MR</span>
                  </div>
                  <div>
                    <div className="type-label text-[var(--color-text-primary)]">Maria R.</div>
                    <div className="type-eyebrow text-[var(--color-text-muted)]">Staff Engineer · Public company</div>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative container mx-auto px-6 pb-24">
        <AnimatedSection>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="type-h1 text-3xl mb-4">Ready to take the helm?</h2>
            <p className="type-body text-[var(--color-text-secondary)] text-lg mb-8 max-w-xl mx-auto">
              Stop guessing. Start understanding your financial system with institutional-grade intelligence.
            </p>
            <Link href="/dashboard">
              <Button
                size="lg"
                className="bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] px-10 font-semibold"
              >
                Launch Helm
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </AnimatedSection>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-[var(--color-border-base)]">
        <div className="container mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HelmMark size={16} />
            <p className="type-eyebrow text-[var(--color-text-muted)]">
              &copy; 2026 Helm. Financial intelligence for individuals.
            </p>
          </div>
          <div className="flex gap-6 type-eyebrow text-[var(--color-text-muted)]">
            <span className="hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer">Privacy</span>
            <span className="hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer">Security</span>
            <span className="hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer">Terms</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
