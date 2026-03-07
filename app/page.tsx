'use client';

import Link from 'next/link';
import { ArrowRight, TrendingUp, Shield, Brain, LineChart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelmMark } from '@/components/helm-mark';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-helm-base relative overflow-hidden">
      {/* Animated background grid */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(184,145,74,0.12),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_rgba(255,255,255,0.04),_transparent_35%,_transparent_70%,_rgba(0,0,0,0.5))]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[length:80px_80px] opacity-30 animate-[shimmer_18s_linear_infinite]" />
      </div>
      {/* Navigation */}
      <nav className="relative container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <HelmMark size={36} />
            <div>
              <div className="type-h2 tracking-tight text-helm-platinum">Helm</div>
              <div className="type-caption text-helm-muted">Financial Intelligence</div>
            </div>
          </div>
          <Link href="/dashboard">
            <Button className="bg-helm-gold hover:bg-helm-gold-hi text-helm-base font-semibold">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative container mx-auto px-6 pt-16 pb-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Copy */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-helm-gold-border bg-helm-gold-surface/20 px-4 py-1">
              <span className="type-caption text-helm-gold">AI-Powered Financial Intelligence</span>
            </div>
            <div className="space-y-4">
              <h1 className="type-display text-5xl md:text-6xl text-helm-platinum text-balance">
                Understand your finances{' '}
                <span className="text-helm-gold">like the pros.</span>
              </h1>
              <p className="type-body text-lg text-helm-secondary max-w-xl">
                Helm gives you an institutional-grade view of your net worth, portfolio, and tax posture—
                distilled into a personal Bloomberg-style terminal.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/dashboard">
                <Button
                  size="lg"
                  className="bg-helm-gold hover:bg-helm-gold-hi text-helm-base px-8"
                >
                  Launch Helm
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="lg"
                className="border-helm-border-base bg-helm-elevated/70"
              >
                <Sparkles className="mr-2 h-4 w-4 text-helm-gold" />
                Watch how it works
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-helm-muted">
              <span className="type-caption text-helm-secondary">No plaid connection required · Mock data only</span>
            </div>
          </div>

          {/* Hero Preview */}
          <div className="relative">
            <div className="absolute -inset-6 rounded-2xl bg-helm-gold-surface/40 blur-3xl opacity-70" />
            <div className="relative rounded-2xl border border-helm-border-strong bg-helm-surface/90 shadow-xl backdrop-blur-sm overflow-hidden animate-slide-in-bottom">
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-helm-border-base">
                <div className="flex items-center gap-2">
                  <HelmMark size={24} />
                  <div>
                    <div className="type-label text-helm-platinum">Overview</div>
                    <div className="type-caption text-helm-secondary">Net worth · Portfolio · Taxes</div>
                  </div>
                </div>
                <div className="rounded-full bg-helm-overlay px-3 py-1 flex items-center gap-1">
                  <span className="type-caption text-helm-muted">AI Insight</span>
                  <span className="type-caption text-helm-gold">+ $18.3k opportunity</span>
                </div>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-helm-border-base bg-helm-elevated p-3">
                    <div className="type-caption text-helm-secondary mb-1">Net Worth</div>
                    <div className="type-data text-2xl mb-1">$393,830</div>
                    <div className="type-caption text-helm-positive">+5.4% vs last quarter</div>
                  </div>
                  <div className="rounded-md border border-helm-border-base bg-helm-elevated p-3">
                    <div className="type-caption text-helm-secondary mb-1">Portfolio Value</div>
                    <div className="type-data text-2xl mb-1">$318,200</div>
                    <div className="type-caption text-helm-positive">+18.3% YTD</div>
                  </div>
                </div>
                <div className="mt-2 rounded-md border border-helm-border-base bg-helm-elevated p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-helm-overlay p-2">
                      <LineChart className="h-4 w-4 text-helm-gold" />
                    </div>
                    <div>
                      <div className="type-label text-helm-platinum">Tax Intelligence</div>
                      <div className="type-caption text-helm-secondary">
                        Harvesting losses could save you <span className="text-helm-positive">$2,400</span>.
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="type-caption">
                    View ideas
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Explainer Section */}
      <section className="relative container mx-auto px-6 pb-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.3fr,1fr] gap-10 items-start">
          <div className="space-y-4">
            <h2 className="type-h1">One place for your financial intelligence</h2>
            <p className="type-body text-helm-secondary max-w-2xl">
              Helm connects accounts, market data, and tax context into a single, coherent view.
              See how decisions ripple across your net worth instead of juggling multiple apps and spreadsheets.
            </p>
            <ul className="space-y-2 text-sm text-helm-secondary">
              <li>• Institutional-style dashboard for individuals</li>
              <li>• AI surface area tuned for portfolio, taxes, and risk</li>
              <li>• Designed for operators, founders, and serious investors</li>
            </ul>
            <Link href="/dashboard">
              <Button variant="outline" className="mt-4">
                Explore the live prototype
              </Button>
            </Link>
          </div>

          <div className="rounded-xl border border-helm-border-base bg-helm-surface/90 p-5 shadow-lg">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-helm-border-base bg-helm-elevated p-3">
                <div className="type-caption text-helm-secondary mb-1">Net Worth</div>
                <div className="type-data text-xl mb-1">$393,830</div>
                <div className="type-caption text-helm-positive">+ $18,520 this year</div>
              </div>
              <div className="rounded-lg border border-helm-border-base bg-helm-elevated p-3">
                <div className="type-caption text-helm-secondary mb-1">Financial Health</div>
                <div className="type-data text-xl mb-1">78</div>
                <div className="type-caption text-helm-secondary">Good · improving</div>
              </div>
              <div className="rounded-lg border border-helm-border-base bg-helm-elevated p-3 col-span-2">
                <div className="type-caption text-helm-secondary mb-1">Latest AI insight</div>
                <p className="text-xs text-helm-secondary">
                  Your tech allocation is 58% of total exposure. Rebalancing into healthcare and value could
                  reduce drawdown risk without sacrificing return.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="relative container mx-auto px-6 pb-24">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="type-caption text-helm-secondary">
              Built with the polish you&apos;d expect from modern tools like Stripe, Linear, and Palantir.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-helm-muted">
              <span className="type-caption">Trusted by operators from</span>
              <span className="type-caption text-helm-platinum">FAANG</span>
              <span className="type-caption text-helm-platinum">Top-tier funds</span>
              <span className="type-caption text-helm-platinum">High-growth startups</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-helm-surface/90 p-6 border border-helm-border-base hover:border-helm-gold-border transition-colors">
              <div className="w-10 h-10 bg-helm-gold-surface border border-helm-gold-border rounded-sm flex items-center justify-center mb-4">
                <Brain className="w-5 h-5 text-helm-gold" />
              </div>
              <h3 className="type-h2 mb-2">Continuous AI intelligence</h3>
              <p className="type-body text-helm-secondary">
                Helm reads market moves, filings, and your portfolio structure to surface the few insights that
                actually matter.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-helm-surface/90 p-6 border border-helm-border-base hover:border-helm-gold-border transition-colors">
              <div className="w-10 h-10 bg-helm-gold-surface border border-helm-gold-border rounded-sm flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 text-helm-gold" />
              </div>
              <h3 className="type-h2 mb-2">Portfolio & risk clarity</h3>
              <p className="type-body text-helm-secondary">
                See concentration, factor exposure, and scenario impact in one view—no spreadsheets or ad‑hoc dashboards required.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-helm-surface/90 p-6 border border-helm-border-base hover:border-helm-gold-border transition-colors">
              <div className="w-10 h-10 bg-helm-gold-surface border border-helm-gold-border rounded-sm flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-helm-gold" />
              </div>
              <h3 className="type-h2 mb-2">Tax-aware decisions</h3>
              <p className="type-body text-helm-secondary">
                Understand tax drag, harvesting opportunities, and estimated liability before you click &quot;trade&quot;.
              </p>
            </div>
          </div>

          {/* Testimonials / Featured In */}
          <div className="grid md:grid-cols-[2fr,1.2fr] gap-6">
            <div className="space-y-4">
              <h3 className="type-h2">What early users say</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-helm-surface/90 border border-helm-border-subtle rounded-lg p-4">
                  <p className="text-sm text-helm-secondary mb-3">
                    “Helm is the first tool that makes my personal finances feel like a real portfolio, not a budgeting app.”
                  </p>
                  <p className="type-caption text-helm-muted">Founder · Seed-stage SaaS</p>
                </div>
                <div className="bg-helm-surface/90 border border-helm-border-subtle rounded-lg p-4">
                  <p className="text-sm text-helm-secondary mb-3">
                    “It feels like having my private banker and tax advisor in one dashboard.”
                  </p>
                  <p className="type-caption text-helm-muted">Staff Engineer · Public company</p>
                </div>
              </div>
            </div>
            <div className="bg-helm-surface/90 border border-helm-border-base rounded-lg p-4">
              <p className="type-caption text-helm-secondary mb-3">Featured in (concept)</p>
              <div className="flex flex-wrap gap-3">
                <span className="type-caption text-helm-platinum">“Fintech Builders Weekly”</span>
                <span className="type-caption text-helm-platinum">“Indie Hackers Showcase”</span>
                <span className="type-caption text-helm-platinum">“Quant Finance Digest”</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-helm-border-subtle">
        <div className="container mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="type-caption text-helm-muted">
            © 2026 Helm. Institutional-grade financial intelligence for individuals.
          </p>
          <div className="flex gap-4 text-[10px] text-helm-muted">
            <span>Privacy</span>
            <span>Security</span>
            <span>Terms</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
