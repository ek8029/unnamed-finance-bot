'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Shield } from 'lucide-react';
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
      <nav className="sticky top-0 z-50 h-14 px-5 md:px-6 flex items-center justify-between border-b border-white/[0.06] bg-[var(--color-bg-base)]/60 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--color-bg-base)]/40">
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
            className="inline-flex items-center px-5 py-2 bg-[var(--color-gold)] text-black text-[11px] font-bold tracking-wider rounded-md hover:brightness-110 transition-all"
            style={MONO}
          >
            Get Wrapped&nbsp;&rarr;
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 md:pt-36 pb-20 md:pb-32 overflow-hidden">
        {/* Glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] opacity-[0.07] blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(230,185,77,1) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-5 md:px-6">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-10">
            <span className="block w-8 h-px bg-[var(--color-gold)]" />
            <span className="text-[12px] tracking-[0.25em] text-[var(--color-gold)] uppercase" style={MONO}>
              Helm Wrapped &middot; 2025
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-[clamp(52px,12vw,96px)] font-bold leading-[0.88] tracking-[-0.05em] mb-8">
            See your<br />
            <span
              className="italic font-normal text-[var(--color-gold)]"
              style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}
            >
              investment year.
            </span>
          </h1>

          {/* Subtext */}
          <p className="text-[18px] text-[var(--color-text-muted)] leading-relaxed max-w-lg mb-10">
            Your return. Your best trade. Your investor personality. All in 30 seconds.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <Link
              href="/signup?flow=wrapped"
              className="inline-flex items-center gap-2 px-10 py-4 bg-[var(--color-gold)] text-black text-[15px] font-bold tracking-wide rounded-lg hover:brightness-110 transition-all"
              style={{ boxShadow: '0 8px 32px rgba(230,185,77,0.35)' }}
            >
              Get my Wrapped
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login?redirect=/wrapped"
              className="inline-flex items-center gap-1 px-4 py-4 text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              I have an account
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Preview cards */}
      <section className="py-20 md:py-24 border-t border-[var(--color-border-subtle)]">
        <div className="max-w-5xl mx-auto px-5 md:px-6">
          <div className="flex items-center gap-3 mb-12">
            <span className="block w-8 h-px bg-[var(--color-gold)]" />
            <span className="text-[12px] tracking-[0.25em] text-[var(--color-gold)] uppercase" style={MONO}>
              What you&apos;ll see
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Card 1: Return */}
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl p-10 text-center">
              <p className="text-[11px] tracking-[0.2em] text-[var(--color-gold)] uppercase mb-5" style={MONO}>
                Your Return
              </p>
              <p className="text-[64px] font-bold tabular-nums tracking-tight leading-none text-[var(--color-positive)]">
                +28.4%
              </p>
              <p className="text-[13px] text-[var(--color-text-muted)] mt-4" style={MONO}>
                vs S&amp;P 500 +19.8%
              </p>
            </div>
            {/* Card 2: Investor Type */}
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl p-10 text-center">
              <p className="text-[11px] tracking-[0.2em] text-[var(--color-gold)] uppercase mb-5" style={MONO}>
                Your Type
              </p>
              <p
                className="text-[36px] font-bold tracking-tight leading-tight text-[var(--color-gold)] italic"
                style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}
              >
                The Growth<br />Hunter
              </p>
              <p className="text-[13px] text-[var(--color-text-muted)] mt-4" style={MONO}>
                Based on trading patterns
              </p>
            </div>
            {/* Card 3: MVP */}
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl p-10 text-center">
              <p className="text-[11px] tracking-[0.2em] text-[var(--color-gold)] uppercase mb-5" style={MONO}>
                Your MVP
              </p>
              <p className="text-[48px] font-bold tabular-nums tracking-tight leading-none text-[var(--color-gold)]" style={MONO}>
                NVDA
              </p>
              <p className="text-[13px] text-[var(--color-text-muted)] mt-4" style={MONO}>
                +187% best position
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 md:py-24 border-t border-[var(--color-border-subtle)]">
        <div className="max-w-5xl mx-auto px-5 md:px-6">
          <div className="flex items-center gap-3 mb-12">
            <span className="block w-8 h-px bg-[var(--color-gold)]" />
            <span className="text-[12px] tracking-[0.25em] text-[var(--color-gold)] uppercase" style={MONO}>
              Three steps
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { n: '01', title: 'Create account', desc: 'Free. No credit card. Takes 10 seconds.' },
              { n: '02', title: 'Connect brokerage', desc: 'Read-only via Plaid. We can never trade or move money.' },
              { n: '03', title: 'See your Wrapped', desc: 'Personalized slides. Shareable. Yours forever.' },
            ].map((step) => (
              <div key={step.n}>
                <p className="text-[32px] text-[var(--color-gold)] font-bold mb-3" style={MONO}>{step.n}</p>
                <h3 className="text-[22px] font-bold mb-2">{step.title}</h3>
                <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-20 md:py-24 border-t border-[var(--color-border-subtle)]">
        <div className="max-w-5xl mx-auto px-5 md:px-6">
          <h2 className="text-[clamp(24px,5vw,36px)] font-bold tracking-tight text-center mb-12">
            Join investors who know their numbers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { stat: '14,000+', label: 'Users' },
              { stat: '4.2M+', label: 'Trades analyzed' },
              { stat: 'Free', label: 'Forever' },
            ].map((item) => (
              <div
                key={item.label}
                className="border border-[var(--color-gold)]/20 rounded-xl p-8 text-center"
              >
                <p className="text-[36px] font-bold text-[var(--color-gold)] tabular-nums tracking-tight" style={MONO}>
                  {item.stat}
                </p>
                <p className="text-[14px] text-[var(--color-text-muted)] mt-2 uppercase tracking-wider" style={MONO}>
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 md:py-32 border-t border-[var(--color-border-subtle)] text-center">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="text-[clamp(36px,7vw,56px)] font-bold tracking-tight mb-8">
            Ready to see<br />your year?
          </h2>
          <Link
            href="/signup?flow=wrapped"
            className="inline-flex items-center gap-2 px-10 py-4 bg-[var(--color-gold)] text-black text-[15px] font-bold tracking-wide rounded-lg hover:brightness-110 transition-all"
            style={{ boxShadow: '0 8px 32px rgba(230,185,77,0.35)' }}
          >
            Get my Wrapped
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-[14px] text-[var(--color-text-muted)] mt-5">
            Free for everyone. No credit card required.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-[var(--color-border-subtle)]">
        <div className="max-w-5xl mx-auto px-5 flex items-center justify-between text-[9px] tracking-widest uppercase" style={{ ...MONO, color: '#5a5a5a' }}>
          <span>&copy; 2026 Helm</span>
          <span>helmterminal.dev</span>
        </div>
      </footer>
    </div>
  );
}
