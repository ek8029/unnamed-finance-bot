'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Shield, ChevronRight } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { supabase } from '@/lib/supabase/client';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { useWrapped, type WrappedData } from '@/hooks/use-financial-data';

/* ═══════════════════════════════════════════════════════════
   WRAPPED FUNNEL — single page, 3 states:
   1. Not logged in → marketing landing + CTA to signup
   2. Logged in, no Plaid → inline Plaid connect
   3. Logged in, has Plaid → redirect to /dashboard/wrapped
   ═══════════════════════════════════════════════════════════ */

type FlowState = 'loading' | 'landing' | 'connect' | 'generating' | 'ready';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

/* ── Preview cards for landing ── */
const PREVIEWS = [
  { label: 'YOUR RETURN', value: '+28.4%', color: 'text-[var(--color-positive)]', sub: 'vs S&P +19.8%' },
  { label: 'INVESTOR TYPE', value: 'Growth Hunter', color: 'text-[var(--color-text-primary)]', sub: 'Based on your trading patterns' },
  { label: 'YOUR MVP', value: 'NVDA +187%', color: 'text-[var(--color-gold)]', sub: 'Best position of the year' },
] as const;

/* ══════════════════════════════════════════
   Main component
   ══════════════════════════════════════════ */

export function WrappedLanding() {
  const router = useRouter();
  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [plaidError, setPlaidError] = useState<string | null>(null);

  // Check auth + Plaid on mount
  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setFlowState('landing');
        return;
      }
      // Authenticated — check Plaid
      try {
        const res = await fetch('/api/financial-summary');
        if (res.ok) {
          const d = await res.json();
          if (d?.hasPlaidConnection) {
            // Has Plaid — go straight to Wrapped
            router.replace('/dashboard/wrapped');
            return;
          }
        }
      } catch {}
      // No Plaid — show connect
      setFlowState('connect');
    }
    check();
  }, [router]);

  const handlePlaidSuccess = useCallback(() => {
    setFlowState('generating');
    // Brief delay for sync, then redirect
    setTimeout(() => {
      router.push('/dashboard/wrapped');
    }, 1500);
  }, [router]);

  // ── Loading state ──
  if (flowState === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center">
        <div className="animate-pulse"><HelmMark size={32} /></div>
      </div>
    );
  }

  // ── Generating state (post-Plaid, pre-redirect) ──
  if (flowState === 'generating') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col items-center justify-center gap-5">
        <div className="w-8 h-8 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[14px] text-[var(--color-text-muted)]" style={MONO}>
          Generating your Wrapped...
        </p>
      </div>
    );
  }

  // ── Connect state (logged in, no Plaid) ──
  if (flowState === 'connect') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
        {/* Nav */}
        <nav className="sticky top-0 z-50 h-14 px-5 flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]">
          <div className="flex items-center gap-2">
            <HelmMark size={20} />
            <span className="text-[13px] font-bold uppercase tracking-tight">Helm</span>
          </div>
        </nav>

        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-5">
          <div className="w-full max-w-md text-center">
            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2 mb-10">
              <div className="w-8 h-1 rounded-full bg-[var(--color-gold)]" />
              <div className="w-8 h-1 rounded-full bg-[var(--color-gold)]" />
              <div className="w-8 h-1 rounded-full bg-white/10" />
            </div>

            <HelmMark size={36} />

            <p className="text-[11px] tracking-[0.25em] text-[var(--color-gold)] uppercase mt-6 mb-3" style={MONO}>
              Helm Wrapped
            </p>

            <h1 className="text-[28px] md:text-[36px] font-bold tracking-tight leading-[1.1] mb-4">
              Connect your brokerage
            </h1>

            <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed mb-8 max-w-sm mx-auto">
              Helm reads your portfolio history to build your personalized year in review. Read-only — we can never trade or move money.
            </p>

            {/* Plaid button */}
            <div className="max-w-xs mx-auto">
              <PlaidLinkButton
                onSuccess={handlePlaidSuccess}
                onError={(msg) => setPlaidError(msg)}
                className="w-full"
              >
                Connect with Plaid
              </PlaidLinkButton>
            </div>

            {plaidError && (
              <p className="text-[13px] text-[var(--color-negative)] mt-3">{plaidError}</p>
            )}

            {/* Trust signals */}
            <div className="flex flex-col items-center gap-3 mt-8 text-[12px] text-[var(--color-text-muted)]">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-[var(--color-positive)]" />
                <span>Read-only access &middot; Bank-level encryption</span>
              </div>
              <span>12,000+ institutions &middot; Takes 30 seconds</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Landing state (not logged in) ──
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 h-14 px-5 md:px-6 flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/80 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <HelmMark size={20} />
          <span className="text-[13px] font-bold uppercase tracking-tight">Helm</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login?redirect=/wrapped"
            className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            style={MONO}
          >
            Log in
          </Link>
          <Link
            href="/signup?flow=wrapped"
            className="inline-flex items-center px-4 py-2 bg-[var(--color-gold)] text-black text-[11px] font-bold tracking-wider rounded-md hover:brightness-110 transition-all"
            style={MONO}
          >
            Get Wrapped&nbsp;&rarr;
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-16 md:pt-28 pb-16 md:pb-24 overflow-hidden">
        {/* Glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] opacity-[0.06] blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(230,185,77,1) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-5 md:px-6">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-8">
            <span className="block w-6 h-px bg-[var(--color-gold)]" />
            <span className="text-[10px] tracking-[0.25em] text-[var(--color-gold)] uppercase" style={MONO}>
              Helm Wrapped &middot; 2025
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-[clamp(44px,9vw,80px)] font-bold leading-[0.95] tracking-[-0.045em] mb-6">
            See your year.<br />
            <span
              className="italic font-normal text-[var(--color-gold)]"
              style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}
            >
              Share your story.
            </span>
          </h1>

          {/* Subtext */}
          <p className="text-[16px] text-[var(--color-text-muted)] leading-relaxed max-w-md mb-8">
            Your portfolio return, best trade, investor personality, and more — in 30 seconds. Free.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-start gap-3">
            <Link
              href="/signup?flow=wrapped"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--color-gold)] text-black text-[14px] font-bold tracking-wide rounded-lg hover:brightness-110 transition-all"
              style={{ boxShadow: '0 8px 24px rgba(230,185,77,0.3)' }}
            >
              Get my Wrapped
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login?redirect=/wrapped"
              className="inline-flex items-center gap-1 px-4 py-4 text-[14px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              I have an account
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Preview cards */}
      <section className="py-16 border-t border-[var(--color-border-subtle)]">
        <div className="max-w-4xl mx-auto px-5 md:px-6">
          <p className="text-[11px] tracking-[0.2em] text-[var(--color-gold)] uppercase mb-8" style={MONO}>
            What you&apos;ll see
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PREVIEWS.map((card) => (
              <div
                key={card.label}
                className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl p-7 text-center"
              >
                <p className="text-[10px] tracking-[0.2em] text-[var(--color-gold)] uppercase mb-4" style={MONO}>
                  {card.label}
                </p>
                <p className={`text-[36px] font-bold tabular-nums tracking-tight ${card.color}`}>
                  {card.value}
                </p>
                <p className="text-[12px] text-[var(--color-text-muted)] mt-3" style={MONO}>
                  {card.sub}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 border-t border-[var(--color-border-subtle)]">
        <div className="max-w-4xl mx-auto px-5 md:px-6">
          <p className="text-[11px] tracking-[0.2em] text-[var(--color-gold)] uppercase mb-8" style={MONO}>
            Three steps
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { n: '01', title: 'Create account', desc: 'Free. No card. 10 seconds.' },
              { n: '02', title: 'Connect brokerage', desc: 'Read-only via Plaid. We never trade.' },
              { n: '03', title: 'See your Wrapped', desc: 'Personalized. Shareable. Yours.' },
            ].map((step) => (
              <div key={step.n}>
                <p className="text-[var(--color-gold)] text-[20px] font-bold mb-2" style={MONO}>{step.n}</p>
                <h3 className="text-[18px] font-bold mb-1">{step.title}</h3>
                <p className="text-[14px] text-[var(--color-text-muted)] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 border-t border-[var(--color-border-subtle)] text-center">
        <h2 className="text-[clamp(32px,6vw,48px)] font-bold tracking-tight mb-6">Ready?</h2>
        <Link
          href="/signup?flow=wrapped"
          className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--color-gold)] text-black text-[14px] font-bold tracking-wide rounded-lg hover:brightness-110 transition-all"
          style={{ boxShadow: '0 8px 24px rgba(230,185,77,0.3)' }}
        >
          Get my Wrapped
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-[13px] text-[var(--color-text-muted)] mt-4">Free for everyone.</p>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-[var(--color-border-subtle)]">
        <div className="max-w-4xl mx-auto px-5 flex items-center justify-between text-[9px] tracking-widest uppercase" style={{ ...MONO, color: '#5a5a5a' }}>
          <span>&copy; 2026 Helm</span>
          <span>helmterminal.dev</span>
        </div>
      </footer>
    </div>
  );
}
