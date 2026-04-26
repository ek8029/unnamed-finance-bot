'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePlaidLink } from 'react-plaid-link';
import { HelmMark } from '@/components/helm-mark';
import { Loader2 } from 'lucide-react';

const ONBOARDING_KEY = 'helm_onboarding_dismissed';

/* ═══════════════════════════════════════════
   DIRECTION B: CINEMATIC MINIMAL
   Big type. Smooth transitions. Zero noise.
   ═══════════════════════════════════════════ */

/* ── Step transition ── */
function StepTransition({ children, active }: { children: React.ReactNode; active: boolean }) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (active) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)));
    } else {
      setShow(false);
      const timer = setTimeout(() => setMounted(false), 500);
      return () => clearTimeout(timer);
    }
  }, [active]);

  if (!mounted) return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center transition-all duration-700"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(20px)',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {children}
    </div>
  );
}

/* ── Counter ── */
function CountUp({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [target, duration]);

  return <>{value.toLocaleString()}</>;
}

/* ── Connect Step ── */
function ConnectStep({ onSuccess, onSkip }: { onSuccess: () => void; onSkip: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const [error, setError] = useState('');
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    fetch('/api/plaid/create-link-token', { method: 'POST' })
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(d => setLinkToken(d.link_token))
      .catch(() => setError('Failed to initialize. Refresh to retry.'));
  }, []);

  const handlePlaidSuccess = useCallback(async (publicToken: string, metadata: unknown) => {
    setExchanging(true);
    try {
      const res = await fetch('/api/plaid/exchange-public-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken, metadata }),
      });
      if (!res.ok) throw new Error('Failed to link');
      sessionStorage.removeItem('helm_last_auto_sync');
      sessionStorage.removeItem('helm_last_price_refresh');
      await fetch('/api/plaid/sync', { method: 'POST' }).catch(() => {});
      await fetch('/api/market/prices/refresh', { method: 'POST' }).catch(() => {});
      onSuccess();
    } catch {
      setError('Connection failed. Try again.');
      setExchanging(false);
    }
  }, [onSuccess]);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: handlePlaidSuccess,
    onExit: () => {},
  });

  const buttonDisabled = !ready || !linkToken || exchanging;

  return (
    <div className="w-full max-w-4xl mx-auto px-8">
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1px_1fr] gap-0 lg:gap-16">
        {/* Left: message */}
        <div className="space-y-8 py-4">
          <div className="space-y-5">
            <h1 className="text-[clamp(32px,5vw,52px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.06]">
              One connection<br />unlocks everything.
            </h1>
            <p className="text-[17px] text-[var(--color-text-muted)] leading-relaxed max-w-[380px]">
              Link a brokerage or bank. Helm does the rest. Portfolio tracking, tax optimization, daily intelligence.
            </p>
          </div>

          {/* Stats */}
          <div className="flex gap-12 pt-4">
            <div>
              <div className="text-[36px] font-bold tabular-nums text-[var(--color-text-primary)] font-mono leading-none">
                <CountUp target={12000} />+
              </div>
              <div className="text-[12px] font-mono tracking-wider text-[var(--color-text-muted)]/50 uppercase mt-2">Institutions</div>
            </div>
            <div>
              <div className="text-[36px] font-bold tabular-nums text-[var(--color-text-primary)] font-mono leading-none">
                30s
              </div>
              <div className="text-[12px] font-mono tracking-wider text-[var(--color-text-muted)]/50 uppercase mt-2">Setup time</div>
            </div>
          </div>

          {/* What unlocks */}
          <div className="pt-4 space-y-0 border-t border-[var(--color-border-subtle)]">
            <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--color-text-muted)]/35 pb-2">What you unlock</div>
            {[
              ['Portfolio Intelligence', 'Every holding, every account'],
              ['Daily Brief', 'What moved overnight, what to do'],
              ['Tax Engine', 'Automated loss harvesting detection'],
              ['Net Worth', 'Real-time across all linked accounts'],
            ].map(([label, detail], i) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)]"
                style={{ opacity: 0, animation: `onb-line-in 0.4s ease-out ${0.3 + i * 0.08}s forwards` }}>
                <span className="text-[14px] text-[var(--color-text-primary)]/80">{label}</span>
                <span className="text-[12px] font-mono text-[var(--color-text-muted)]/30 text-right ml-4 hidden sm:block">{detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden lg:block bg-[var(--color-border-base)]" />

        {/* Right: action */}
        <div className="space-y-6 py-4">
          {error && (
            <div role="alert" className="border-l-2 border-[var(--color-negative)] px-4 py-3 text-[12px] text-[var(--color-negative-text)] font-mono">
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={() => open()}
            disabled={buttonDisabled}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            className="w-full group disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="border-2 border-[var(--color-gold)] p-7 transition-all duration-300"
              style={{
                backgroundColor: hovering && !buttonDisabled ? 'var(--color-gold)' : 'transparent',
              }}>
              <div className="flex items-center justify-between">
                <span className={`text-[18px] font-bold tracking-tight transition-colors duration-300 ${hovering && !buttonDisabled ? 'text-black' : 'text-[var(--color-gold)]'}`}>
                  {exchanging ? 'Linking...' : !linkToken ? 'Preparing...' : 'Connect Account'}
                </span>
                {(exchanging || !linkToken) ? (
                  <Loader2 className={`w-5 h-5 animate-spin transition-colors duration-300 ${hovering && !buttonDisabled ? 'text-black' : 'text-[var(--color-gold)]'}`} />
                ) : (
                  <span className={`text-[20px] transition-all duration-300 ${hovering ? 'text-black translate-x-1' : 'text-[var(--color-gold)]'}`}>→</span>
                )}
              </div>
            </div>
          </button>

          {/* Security */}
          <div className="space-y-3">
            {['Read-only access — can never move money', 'AES-256 encryption in transit and at rest', 'Same infrastructure as Venmo & Robinhood'].map((line, i) => (
              <div key={i} className="flex items-start gap-3"
                style={{ opacity: 0, animation: `onb-line-in 0.4s ease-out ${0.6 + i * 0.1}s forwards` }}>
                <span className="w-1 h-1 rounded-full bg-[var(--color-positive)] mt-2 shrink-0" />
                <span className="text-[12px] text-[var(--color-text-muted)]/60 leading-relaxed">{line}</span>
              </div>
            ))}
          </div>

          {/* Skip */}
          <button onClick={onSkip}
            className="text-[11px] text-[var(--color-text-muted)]/30 hover:text-[var(--color-text-muted)]/60 transition-colors font-mono">
            explore without data →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main Export
   ═══════════════════════════════════════════ */

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<'welcome' | 'connect' | 'syncing' | 'done'>('welcome');
  const [dismissed, setDismissed] = useState(true);
  const [hasPlaid, setHasPlaid] = useState<boolean | null>(null);

  useEffect(() => {
    // Permanent dismiss (connected Plaid) OR session dismiss (skipped this session)
    const wasDismissed = localStorage.getItem(ONBOARDING_KEY) === '1' || sessionStorage.getItem(ONBOARDING_KEY) === '1';
    if (wasDismissed) { setDismissed(true); return; }

    fetch('/api/financial-summary')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.hasPlaidConnection) {
          localStorage.setItem(ONBOARDING_KEY, '1');
          setDismissed(true);
        } else {
          setHasPlaid(false);
          setDismissed(false);
        }
      })
      .catch(() => setDismissed(true));
  }, []);

  // Welcome auto-advance
  useEffect(() => {
    if (step === 'welcome') {
      const timer = setTimeout(() => setStep('connect'), 2800);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleSkip = () => {
    // Session-only dismiss — shows again next visit until they connect Plaid
    sessionStorage.setItem(ONBOARDING_KEY, '1');
    setDismissed(true);
  };

  const handleSuccess = () => {
    setStep('syncing');
    setTimeout(() => {
      setStep('done');
      setTimeout(() => {
        localStorage.setItem(ONBOARDING_KEY, '1');
        setDismissed(true);
        router.refresh();
      }, 1800);
    }, 3500);
  };

  if (dismissed || hasPlaid !== false) return null;

  return (
    <>
      <style jsx global>{`
        @keyframes onb-line-in {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes onb-pulse-ring {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(3); opacity: 0; }
        }
        @keyframes onb-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes onb-line-in { from, to { opacity: 1; transform: none; } }
          @keyframes onb-pulse-ring { from, to { opacity: 0; } }
        }
      `}</style>

      <div className="fixed inset-0 z-[100] bg-[#050505] overflow-hidden">
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.035]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(230,185,77,0.4) 0.5px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />

        {/* Top edge */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)]/15 to-transparent" />

        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <HelmMark size={20} />
            <div className="w-px h-3 bg-[var(--color-border-base)]" />
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--color-text-muted)]/40">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-positive)] opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-positive)]" />
            </span>
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--color-text-muted)]/40">
              Secure Session
            </span>
          </div>
        </div>

        {/* ── WELCOME ── */}
        <StepTransition active={step === 'welcome'}>
          <div className="w-full max-w-3xl mx-auto px-8 text-center space-y-8">
            {/* Logo with pulse */}
            <div className="flex justify-center">
              <div className="relative">
                <HelmMark size={80} />
                <div className="absolute inset-0 border border-[var(--color-gold)]/20 rounded-full"
                  style={{ animation: 'onb-pulse-ring 2s ease-out infinite' }} />
                <div className="absolute inset-0 border border-[var(--color-gold)]/10 rounded-full"
                  style={{ animation: 'onb-pulse-ring 2s ease-out 0.6s infinite' }} />
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-[clamp(44px,8vw,80px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.02]">
                Welcome to Helm
              </h1>
              <p className="text-[clamp(16px,2.5vw,22px)] text-[var(--color-text-muted)]/60 font-light">
                Your financial command center
              </p>
            </div>

            {/* Progress bar */}
            <div className="max-w-[320px] mx-auto">
              <div className="h-[3px] bg-[var(--color-border-base)] overflow-hidden">
                <div className="h-full bg-[var(--color-gold)]" style={{ transformOrigin: 'left', animation: 'onb-progress 2.5s ease-in-out forwards' }} />
              </div>
            </div>

            {/* Feature keywords */}
            <div className="flex items-center justify-center gap-8 pt-6">
              {['Portfolio', 'Net Worth', 'Tax Engine', 'Daily Brief', 'Insights'].map((word, i) => (
                <span key={word} className="font-mono text-[11px] tracking-[0.15em] uppercase text-[var(--color-text-muted)]/25"
                  style={{ opacity: 0, animation: `onb-line-in 0.4s ease-out ${1.2 + i * 0.15}s forwards` }}>
                  {word}
                </span>
              ))}
            </div>
          </div>
        </StepTransition>

        {/* ── CONNECT ── */}
        <StepTransition active={step === 'connect'}>
          <ConnectStep onSuccess={handleSuccess} onSkip={handleSkip} />
        </StepTransition>

        {/* ── SYNCING ── */}
        <StepTransition active={step === 'syncing'}>
          <div className="w-full max-w-lg mx-auto px-8 text-center space-y-10">
            <div className="flex justify-center">
              <HelmMark size={52} />
            </div>
            <div className="space-y-3">
              <h1 className="text-[36px] font-bold tracking-tight text-[var(--color-text-primary)]">
                Building your dashboard
              </h1>
              <p className="text-[16px] text-[var(--color-text-muted)]/50">
                Importing accounts, transactions, and holdings
              </p>
            </div>

            {/* Animated items */}
            <div className="space-y-2 text-left max-w-[340px] mx-auto">
              {['Accounts', 'Transactions', 'Holdings', 'Net worth', 'Insights'].map((item, i) => (
                <div key={item} className="flex items-center justify-between py-2.5 border-b border-[var(--color-border-subtle)]"
                  style={{ opacity: 0, animation: `onb-line-in 0.3s ease-out ${i * 0.5}s forwards` }}>
                  <span className="text-[15px] text-[var(--color-text-muted)]">{item}</span>
                  <span className="text-[12px] font-mono text-[var(--color-positive)]"
                    style={{ opacity: 0, animation: `onb-line-in 0.2s ease-out ${i * 0.5 + 0.3}s forwards` }}>
                    done
                  </span>
                </div>
              ))}
            </div>
          </div>
        </StepTransition>

        {/* ── DONE ── */}
        <StepTransition active={step === 'done'}>
          <div className="w-full max-w-md mx-auto px-8 text-center space-y-8">
            <div className="flex justify-center">
              <div className="w-20 h-20 flex items-center justify-center">
                <svg className="w-12 h-12 text-[var(--color-positive)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"
                    style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: 'onb-line-in 0.4s ease-out 0.2s forwards' }} />
                </svg>
              </div>
            </div>
            <h1 className="text-[42px] font-bold tracking-tight text-[var(--color-text-primary)]">
              You're in.
            </h1>
          </div>
        </StepTransition>

        {/* Bottom */}
        <div className="absolute bottom-5 left-0 right-0 flex justify-center">
          <span className="font-mono text-[9px] tracking-[0.15em] text-[var(--color-text-muted)]/15 uppercase">
            helmterminal.dev
          </span>
        </div>
      </div>
    </>
  );
}
