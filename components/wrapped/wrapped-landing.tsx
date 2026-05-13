'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';

/* ─────────────────────────────────────────────
   Helm Wrapped — Viral Acquisition Landing Page
   ───────────────────────────────────────────── */

const PREVIEW_CARDS = [
  {
    label: 'YOUR RETURN',
    value: '+28.4%',
    valueClass: 'text-5xl font-bold text-[var(--color-positive)] tabular-nums',
    sub: 'vs S&P +19.8%',
  },
  {
    label: 'INVESTOR TYPE',
    value: 'Growth Hunter',
    valueClass: 'text-3xl font-bold text-[var(--color-text-primary)]',
    sub: 'Based on your trading patterns',
  },
  {
    label: 'YOUR MVP',
    value: 'NVDA +187%',
    valueClass: 'text-3xl font-bold text-[var(--color-gold)] font-mono',
    sub: 'Best position of the year',
  },
] as const;

const STEPS = [
  {
    n: '01',
    title: 'Create account',
    desc: 'Free. No card required. 10 seconds.',
  },
  {
    n: '02',
    title: 'Connect brokerage',
    desc: 'Read-only via Plaid. We never trade or transfer.',
  },
  {
    n: '03',
    title: 'Get your Wrapped',
    desc: 'Personalized year-in-review. Share anywhere.',
  },
] as const;

const TRUST = [
  'Read-only access',
  'Bank-level encryption',
  '12,000+ institutions',
  'Delete anytime',
] as const;

export function WrappedLanding() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 h-16 px-6 flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/80 backdrop-blur-[16px]">
        <Link href="/" className="flex items-center gap-2">
          <HelmMark size={22} />
          <span className="text-[13px] font-bold uppercase tracking-tight">
            HELM
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/login?redirect=/dashboard/wrapped"
            className="font-mono text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup?flow=wrapped"
            className="inline-flex items-center px-4 py-2 bg-[var(--color-gold)] text-black font-mono text-xs font-bold tracking-wider rounded-md hover:brightness-110 transition-all"
          >
            Get Wrapped&nbsp;&rarr;
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-32 md:pt-40 pb-20 overflow-hidden">
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-[0.06] blur-[100px]"
          style={{
            background:
              'radial-gradient(circle, rgba(230,185,77,1) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-5 md:px-6">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-10">
            <span className="block w-8 h-px bg-[var(--color-gold)]" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-gold)] uppercase">
              Helm Wrapped &middot; 2025
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-[clamp(40px,7vw,72px)] font-bold leading-[1.05] tracking-[-0.04em]">
            See your year.
            <br />
            <span
              className="italic text-[var(--color-gold)]"
              style={{
                fontFamily: '"Source Serif Pro", Georgia, serif',
              }}
            >
              Share your story.
            </span>
          </h1>

          {/* Subtext */}
          <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed max-w-lg mt-8">
            Connect any brokerage. Get your personalized investment Wrapped in
            30&nbsp;seconds. Completely free.
          </p>

          {/* CTA row */}
          <div className="flex items-center gap-3 mt-10">
            <Link
              href="/signup?flow=wrapped"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-[var(--color-gold)] text-black font-mono text-sm font-bold tracking-wider rounded-md hover:brightness-110 transition-all"
              style={{
                boxShadow: '0 6px 18px rgba(230,185,77,0.25)',
              }}
            >
              Get my Wrapped
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login?redirect=/dashboard/wrapped"
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              I have an account
            </Link>
          </div>
        </div>
      </section>

      {/* ── Preview ── */}
      <section className="py-20 border-t border-[var(--color-border-subtle)]">
        <div className="max-w-5xl mx-auto px-5 md:px-6">
          <p className="font-mono text-xs mb-4">
            <span className="text-[var(--color-gold)]">&sect; 01</span>
            <span className="text-[var(--color-text-muted)]">
              {' '}
              &mdash; Preview
            </span>
          </p>
          <h2 className="text-[clamp(28px,4vw,44px)] font-bold mb-12">
            Six moments. One portfolio.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PREVIEW_CARDS.map((card) => (
              <div
                key={card.label}
                className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-8 text-center"
              >
                <p className="font-mono text-[9px] text-[var(--color-gold)] tracking-widest uppercase mb-4">
                  {card.label}
                </p>
                <p className={card.valueClass}>{card.value}</p>
                <p className="font-mono text-xs text-[var(--color-text-muted)] mt-3">
                  {card.sub}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 border-t border-[var(--color-border-subtle)]">
        <div className="max-w-5xl mx-auto px-5 md:px-6">
          <p className="font-mono text-xs mb-4">
            <span className="text-[var(--color-gold)]">&sect; 02</span>
            <span className="text-[var(--color-text-muted)]">
              {' '}
              &mdash; How it works
            </span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-10">
            {STEPS.map((step) => (
              <div key={step.n}>
                <p className="font-mono text-[var(--color-gold)] text-lg font-bold mb-2">
                  {step.n}
                </p>
                <h3 className="text-lg font-bold mb-1">{step.title}</h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="py-12 border-t border-[var(--color-border-subtle)]">
        <div className="max-w-5xl mx-auto px-5 md:px-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {TRUST.map((label, i) => (
            <span key={label} className="flex items-center gap-4">
              <span className="font-mono text-xs text-[var(--color-text-muted)] tracking-wider">
                {label}
              </span>
              {i < TRUST.length - 1 && (
                <span className="w-1 h-1 rounded-full bg-[var(--color-gold)]" />
              )}
            </span>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 border-t border-[var(--color-border-subtle)] text-center">
        <h2 className="text-4xl font-bold mb-8">Ready?</h2>
        <Link
          href="/signup?flow=wrapped"
          className="inline-flex items-center gap-2 px-7 py-3.5 bg-[var(--color-gold)] text-black font-mono text-sm font-bold tracking-wider rounded-md hover:brightness-110 transition-all"
          style={{
            boxShadow: '0 6px 18px rgba(230,185,77,0.25)',
          }}
        >
          Get my Wrapped
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-xs text-[var(--color-text-muted)] mt-4">
          Free for everyone. No Pro plan required.
        </p>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 border-t border-[var(--color-border-subtle)]">
        <div className="max-w-5xl mx-auto px-5 md:px-6 flex items-center justify-between font-mono text-[9px] text-[#5a5a5a] tracking-widest uppercase">
          <span>&copy; 2026 Helm</span>
          <span>helmterminal.dev</span>
        </div>
      </footer>
    </div>
  );
}
