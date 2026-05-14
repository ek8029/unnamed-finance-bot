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
    <div className="min-h-screen bg-[#060606] text-[var(--color-text-primary)] overflow-hidden">
      {/* Nav — minimal, transparent */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 md:px-10 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 opacity-60 hover:opacity-100 transition-opacity">
          <HelmMark size={18} />
          <span className="text-[12px] font-bold uppercase tracking-[0.08em]">Helm</span>
        </Link>
        <div className="flex items-center gap-5">
          <Link
            href="/login?redirect=/wrapped"
            className="text-[12px] text-white/40 hover:text-white/80 transition-colors"
            style={MONO}
          >
            Log in
          </Link>
          <Link
            href="/signup?flow=wrapped"
            className="text-[12px] text-[#E6B94D] hover:text-[#FFD67A] transition-colors font-semibold"
            style={MONO}
          >
            Get yours &rarr;
          </Link>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════
          HERO — full viewport, two-column on desktop
          Left: editorial text. Right: physical card artifact.
          ═══════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center">
        {/* Ambient glow — visible, warm */}
        <div
          className="pointer-events-none absolute top-[15%] right-[5%] w-[800px] h-[800px] opacity-[0.08] blur-[140px]"
          style={{ background: 'radial-gradient(circle, #E6B94D, transparent 65%)' }}
        />
        <div
          className="pointer-events-none absolute bottom-[10%] left-[10%] w-[400px] h-[400px] opacity-[0.04] blur-[100px]"
          style={{ background: 'radial-gradient(circle, #4ADE80, transparent 70%)' }}
        />

        <div className="w-full max-w-6xl mx-auto px-6 md:px-10 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-12 lg:gap-20 items-center pt-28 pb-20 lg:pt-0 lg:pb-0">
          {/* LEFT — text */}
          <div>
            <p className="text-[12px] tracking-[0.3em] text-[#E6B94D] uppercase mb-8" style={MONO}>
              Helm Wrapped &middot; 2025
            </p>

            <h1 className="text-[clamp(44px,9vw,80px)] font-bold leading-[0.92] tracking-[-0.04em] mb-8">
              You had a year.<br />
              <span
                className="text-[#E6B94D] italic font-normal"
                style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}
              >
                Do you know<br />how it went?
              </span>
            </h1>

            <p className="text-[17px] text-white/60 leading-[1.7] max-w-[440px] mb-12">
              Your portfolio return, best trade, worst trade, investor personality — everything you need to brag or learn from. Connect any brokerage. 30 seconds. Free.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link
                href="/signup?flow=wrapped"
                className="inline-flex items-center gap-2.5 px-10 py-4 bg-[#E6B94D] text-black text-[14px] font-bold tracking-[0.02em] rounded-sm transition-all hover:bg-[#FFD67A]"
                style={{ boxShadow: '0 0 0 1px rgba(230,185,77,0.4), 0 16px 48px rgba(230,185,77,0.25)' }}
              >
                See my Wrapped
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login?redirect=/wrapped"
                className="text-[14px] text-white/50 hover:text-white/80 transition-colors"
              >
                Already have an account?
              </Link>
            </div>
          </div>

          {/* RIGHT — the card */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="w-full max-w-[360px] relative">
              {/* Gold glow behind card */}
              <div className="absolute -inset-4 rounded-2xl opacity-[0.12] blur-[40px] pointer-events-none" style={{ background: '#E6B94D' }} />
              <div
                className="relative rounded-xl overflow-hidden p-8 pb-10"
                style={{
                  background: 'linear-gradient(160deg, #141414 0%, #0A0A0A 100%)',
                  border: '1px solid rgba(230,185,77,0.2)',
                  boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03)',
                  aspectRatio: '3/4',
                }}
              >
                {/* Card top */}
                <div className="flex items-center justify-between">
                  <HelmMark size={20} />
                  <span className="text-[10px] tracking-[0.2em] text-[#E6B94D] uppercase font-semibold" style={MONO}>Wrapped 2025</span>
                </div>

                {/* Card hero number */}
                <div className="mt-10">
                  <p className="text-[10px] tracking-[0.2em] text-white/40 uppercase mb-3" style={MONO}>Your return</p>
                  <p
                    className="text-[80px] font-bold leading-none tabular-nums tracking-[-0.04em] text-[#4ADE80]"
                    style={{ textShadow: '0 0 80px rgba(74,222,128,0.25)' }}
                  >
                    +28.4%
                  </p>
                  <p className="text-[12px] text-white/40 mt-3 font-medium" style={MONO}>Beat S&amp;P 500 by 8.6%</p>
                </div>

                {/* Card divider */}
                <div className="h-px my-6" style={{ background: 'linear-gradient(to right, transparent, rgba(230,185,77,0.3), transparent)' }} />

                {/* Card stats */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  {[
                    ['MVP', 'NVDA'],
                    ['TYPE', 'Growth Hunter'],
                    ['TRADES', '287'],
                    ['ALPHA', '+8.6%'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[9px] tracking-[0.18em] text-white/35 uppercase" style={MONO}>{label}</p>
                      <p className="text-[16px] font-bold text-[#E6B94D] mt-1" style={MONO}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Card footer */}
                <div className="absolute bottom-5 left-8 right-8 flex justify-between">
                  <span className="text-[9px] tracking-[0.15em] text-white/25 uppercase" style={MONO}>helmterminal.dev</span>
                  <span className="text-[9px] tracking-[0.15em] text-white/25 uppercase" style={MONO}>#HelmWrapped</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          WHAT'S INSIDE — numbered list with presence
          ═══════════════════════════════════════════ */}
      <section className="py-24 md:py-32 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <p className="text-[12px] tracking-[0.3em] text-[#E6B94D] uppercase mb-14" style={MONO}>
            Seven slides. One portfolio.
          </p>

          <div className="space-y-0">
            {[
              { n: '01', label: 'Total return vs S&P 500', accent: true },
              { n: '02', label: 'Your best and worst trade' },
              { n: '03', label: 'How you traded — habits, volume, timing' },
              { n: '04', label: 'Sector conviction and allocation' },
              { n: '05', label: 'Your investor personality type', accent: true },
              { n: '06', label: 'Shareable card with your stats' },
            ].map((item) => (
              <div
                key={item.n}
                className="flex items-baseline gap-6 md:gap-8 py-6 border-b border-white/[0.06] group cursor-default"
              >
                <span className="text-[14px] text-[#E6B94D] tabular-nums shrink-0 font-semibold" style={MONO}>{item.n}</span>
                <span className={`text-[clamp(20px,4vw,32px)] font-semibold tracking-[-0.02em] transition-colors duration-300 ${item.accent ? 'text-white' : 'text-white/60'} group-hover:text-white`}>
                  {item.label}
                </span>
                <ArrowRight className="w-4 h-4 text-[#E6B94D] opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0 hidden md:block" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          HOW IT WORKS
          ═══════════════════════════════════════════ */}
      <section className="py-24 md:py-32 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <p className="text-[12px] tracking-[0.3em] text-[#E6B94D] uppercase mb-14" style={MONO}>
            Three steps. Thirty seconds.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
            {[
              { n: '01', title: 'Create account', desc: 'Free. No credit card. Takes 10 seconds.' },
              { n: '02', title: 'Connect brokerage', desc: 'Read-only via Plaid. We can never trade or move money.' },
              { n: '03', title: 'See your Wrapped', desc: 'Personalized slides you can share anywhere.' },
            ].map((step) => (
              <div key={step.n} className="border-t border-white/[0.08] pt-8">
                <p className="text-[24px] text-[#E6B94D] font-bold mb-4 tabular-nums" style={MONO}>{step.n}</p>
                <h3 className="text-[20px] font-semibold tracking-[-0.01em] mb-3">{step.title}</h3>
                <p className="text-[15px] text-white/50 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════ */}
      <section className="py-32 md:py-40 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <h2
            className="text-[clamp(36px,8vw,72px)] font-bold tracking-[-0.04em] leading-[0.92] mb-12"
          >
            Your year happened.<br />
            <span
              className="text-[#E6B94D] italic font-normal"
              style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}
            >
              See how it went.
            </span>
          </h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <Link
              href="/signup?flow=wrapped"
              className="inline-flex items-center gap-2.5 px-10 py-4 bg-[#E6B94D] text-black text-[14px] font-bold tracking-[0.02em] rounded-sm transition-all hover:bg-[#FFD67A]"
              style={{ boxShadow: '0 0 0 1px rgba(230,185,77,0.4), 0 16px 48px rgba(230,185,77,0.25)' }}
            >
              Get my Wrapped
              <ArrowRight className="w-4 h-4" />
            </Link>
            <span className="text-[13px] text-white/40" style={MONO}>Free &middot; 30 seconds &middot; No card required</span>
          </div>
        </div>
      </section>

      {/* Footer — barely there */}
      <footer className="py-6 px-6 md:px-10 flex items-center justify-between">
        <span className="text-[9px] tracking-[0.15em] text-white/15 uppercase" style={MONO}>&copy; 2026 Helm</span>
        <span className="text-[9px] tracking-[0.15em] text-white/15 uppercase" style={MONO}>helmterminal.dev</span>
      </footer>
    </div>
  );
}
