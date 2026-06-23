import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';
import { LegalFooter } from '@/components/legal-footer';
import { Search, Wallet, LineChart, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Portfolio Intelligence for Self-Directed Investors | Helm Terminal',
  description:
    'AI-powered stock analysis on 500+ tickers, portfolio tracking, tax-loss harvesting, and a daily brief that tells you what matters. Free.',
  openGraph: {
    title: 'Portfolio Intelligence for Self-Directed Investors | Helm Terminal',
    description: 'What moved. What matters. What\'s next.',
    url: 'https://helmterminal.dev/for/investors',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  alternates: { canonical: 'https://helmterminal.dev/for/investors' },
};

const PAIN_POINTS = [
  'Paying for 5 different tools -- screener, charting, news, portfolio tracker, tax software -- and none of them talk to each other',
  'Missing opportunities because there is no system watching your portfolio between the times you check it',
  'Tax drag eating into returns because harvesting losses requires manual monitoring across multiple accounts',
  'Analyst consensus and earnings data locked behind $200/month terminal subscriptions',
];

const FEATURES = [
  {
    icon: Search,
    title: 'AI Analysis for 500+ Tickers',
    description:
      'Deep fundamental analysis with bull/bear cases, valuation metrics, analyst consensus, and AI summaries. Updated during market hours. No subscription required.',
  },
  {
    icon: Wallet,
    title: 'Portfolio Tracking',
    description:
      'Connect all your accounts via Plaid. See your entire financial picture in one place -- brokerages, retirement accounts, banks, and crypto.',
  },
  {
    icon: LineChart,
    title: 'Real-Time Intelligence',
    description:
      'Live market data, earnings surprises, dividend announcements, and analyst rating changes. Helm surfaces the signal from the noise.',
  },
  {
    icon: FileText,
    title: 'Tax Intelligence',
    description:
      'Automated tax-loss harvesting detection, wash sale tracking, and estimated tax impact. Maximize after-tax returns without the spreadsheet gymnastics.',
  },
];

export default function InvestorsPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg />

      {/* Nav */}
      <nav className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/for"
              className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Solutions
            </Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        {/* Hero */}
        <header className="mb-14 text-center">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">For Self-Directed Investors</div>
          <h1 className="font-sans font-bold text-[30px] md:text-[42px] tracking-tight leading-[1.08] mb-5">
            Portfolio intelligence, not just tracking.
          </h1>
          <p className="text-[18px] md:text-[20px] leading-[1.55] text-[var(--color-text-secondary)] max-w-xl mx-auto">
            Stop paying for 5 different tools. Helm combines AI-powered stock analysis, portfolio tracking,
            tax intelligence, and daily briefings into one terminal. No subscription required to start.
          </p>
        </header>

        {/* Pain Points */}
        <section className="mb-14">
          <h2 className="type-eyebrow text-[var(--color-gold)] mb-5">The Self-Directed Problem</h2>
          <div className="space-y-3">
            {PAIN_POINTS.map((point, i) => (
              <div
                key={i}
                className="flex items-start gap-3 sovereign-card rounded px-5 py-3.5"
              >
                <span className="text-[#F87171] text-[15px] mt-0.5 shrink-0 font-mono">!!</span>
                <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mb-14">
          <h2 className="type-eyebrow text-[var(--color-gold)] mb-6">One Terminal. Everything You Need.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.title} className="sovereign-card rounded p-5">
                  <div className="w-9 h-9 rounded bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center mb-3">
                    <Icon className="w-4.5 h-4.5 text-[var(--color-gold)]" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)] mb-1.5">
                    {feat.title}
                  </h3>
                  <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Social Proof */}
        <section className="mb-14 text-center py-8 border-y border-[var(--color-border-subtle)]">
          <div className="grid grid-cols-3 gap-6 max-w-md mx-auto mb-6">
            <div>
              <p className="text-[28px] font-bold text-[var(--color-gold)] font-tabular" style={{ fontFamily: 'var(--font-mono)' }}>500+</p>
              <p className="type-eyebrow text-[var(--color-text-muted)] mt-1">Tickers Analyzed</p>
            </div>
            <div>
              <p className="text-[28px] font-bold text-[var(--color-gold)] font-tabular" style={{ fontFamily: 'var(--font-mono)' }}>$0</p>
              <p className="type-eyebrow text-[var(--color-text-muted)] mt-1">To Get Started</p>
            </div>
            <div>
              <p className="text-[28px] font-bold text-[var(--color-gold)] font-tabular" style={{ fontFamily: 'var(--font-mono)' }}>24/7</p>
              <p className="type-eyebrow text-[var(--color-text-muted)] mt-1">Portfolio Monitoring</p>
            </div>
          </div>
          <p className="text-[15px] text-[var(--color-text-secondary)]">
            Institutional-grade intelligence. Retail-friendly pricing.
          </p>
        </section>

        {/* CTA */}
        <section className="sovereign-card rounded p-6 md:p-8 text-center">
          <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-2">
            Your edge starts here
          </h2>
          <p className="text-[15px] text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
            Free AI stock analysis. Free portfolio sync. Free daily briefs.
            Pro features available when you need them.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
            >
              Sign Up Free
            </Link>
            <Link
              href="/analyze"
              className="px-5 py-2.5 border border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-colors"
            >
              Try AI Analysis
            </Link>
          </div>
        </section>
      </article>

      <LegalFooter />
    </main>
  );
}
