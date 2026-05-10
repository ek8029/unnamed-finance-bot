'use client';

import { useState, useEffect } from 'react';
import { HelmMark } from '@/components/helm-mark';
import { useDemo } from '@/contexts/demo-context';

const ONBOARDING_KEY = 'helm_onboarding_dismissed';

/* ═══════════════════════════════════════════
   WELCOME → AUTO DEMO FLOW
   Show value first, ask for trust second.
   ═══════════════════════════════════════════ */

export function OnboardingFlow() {
  const { enableDemo } = useDemo();
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'done'>('loading');
  const [hasPlaid, setHasPlaid] = useState<boolean | null>(null);

  useEffect(() => {
    // Already dismissed or returning user
    const wasDismissed = localStorage.getItem(ONBOARDING_KEY) === '1' || sessionStorage.getItem(ONBOARDING_KEY) === '1';
    if (wasDismissed) return;

    fetch('/api/financial-summary')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.hasPlaidConnection) {
          localStorage.setItem(ONBOARDING_KEY, '1');
        } else {
          setHasPlaid(false);
          setShow(true);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-advance: loading → enable demo → dismiss
  useEffect(() => {
    if (!show) return;

    const timer1 = setTimeout(() => setPhase('done'), 2400);
    const timer2 = setTimeout(() => {
      enableDemo();
      sessionStorage.setItem(ONBOARDING_KEY, '1');
      setShow(false);
    }, 3200);

    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, [show, enableDemo]);

  if (!show || hasPlaid !== false) return null;

  return (
    <>
      <style jsx global>{`
        @keyframes onb-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes onb-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes onb-check {
          from { stroke-dashoffset: 30; }
          to { stroke-dashoffset: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes onb-fade-up { from, to { opacity: 1; transform: none; } }
          @keyframes onb-progress { from, to { transform: scaleX(1); } }
        }
      `}</style>

      <div className="fixed inset-0 z-[100] bg-[#050505] flex items-center justify-center">
        {/* Subtle dot grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(230,185,77,0.4) 0.5px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />

        {/* Top edge accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)]/20 to-transparent" />

        <div className="relative text-center space-y-8 px-8 max-w-md">
          {/* Logo */}
          <div
            className="flex justify-center"
            style={{ animation: 'onb-fade-up 0.6s ease-out' }}
          >
            <HelmMark size={56} />
          </div>

          {phase === 'loading' && (
            <>
              <div style={{ animation: 'onb-fade-up 0.6s ease-out 0.2s backwards' }}>
                <h1 className="text-[clamp(28px,5vw,40px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.1]">
                  Setting up your terminal
                </h1>
                <p className="text-[15px] text-[var(--color-text-muted)] mt-3">
                  Loading a sample portfolio so you can see everything Helm does.
                </p>
              </div>

              {/* Progress bar */}
              <div
                className="max-w-[240px] mx-auto"
                style={{ animation: 'onb-fade-up 0.5s ease-out 0.5s backwards' }}
              >
                <div className="h-[2px] bg-[var(--color-border-base)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-gold)] rounded-full"
                    style={{ transformOrigin: 'left', animation: 'onb-progress 2.2s ease-in-out forwards' }}
                  />
                </div>
              </div>

              {/* Feature preview words */}
              <div
                className="flex items-center justify-center gap-6 flex-wrap"
                style={{ animation: 'onb-fade-up 0.4s ease-out 0.8s backwards' }}
              >
                {['Portfolio', 'Risk', 'Tax Engine', 'Daily Brief'].map((word) => (
                  <span
                    key={word}
                    className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--color-text-muted)]/30"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </>
          )}

          {phase === 'done' && (
            <div style={{ animation: 'onb-fade-up 0.4s ease-out' }}>
              <svg className="w-10 h-10 text-[var(--color-positive)] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"
                  style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: 'onb-check 0.4s ease-out 0.1s forwards' }} />
              </svg>
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Ready</h1>
            </div>
          )}
        </div>

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

