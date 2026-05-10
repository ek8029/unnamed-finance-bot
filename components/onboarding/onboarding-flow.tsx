'use client';

import { useState, useEffect } from 'react';
import { HelmMark } from '@/components/helm-mark';
import { useDemo } from '@/contexts/demo-context';
import { ArrowRight } from 'lucide-react';

const ONBOARDING_KEY = 'helm_onboarding_dismissed';

/* ── Tour steps shown during onboarding ── */
const TOUR_STEPS = [
  {
    num: '01',
    title: 'Portfolio Intelligence',
    desc: 'See every holding across every account — concentration risk, sector exposure, and performance in one view.',
    page: 'Portfolio',
  },
  {
    num: '02',
    title: 'The Current — Your Daily Brief',
    desc: 'An AI-written morning brief that connects overnight news to your actual holdings. What moved, what matters, what to watch.',
    page: 'Daily Brief',
  },
  {
    num: '03',
    title: 'Actions Inbox',
    desc: 'Tax-loss harvesting opportunities, earnings exposure warnings, and concentration alerts — surfaced automatically.',
    page: 'Actions',
  },
  {
    num: '04',
    title: 'Scenario Analysis',
    desc: '"What if NVDA drops 20%?" See the exact dollar impact on your portfolio before it happens.',
    page: 'Portfolio → Sidebar',
  },
];

export function OnboardingFlow() {
  const { enableDemo } = useDemo();
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<'welcome' | 'tour' | 'launch' | 'done'>('welcome');
  const [tourStep, setTourStep] = useState(0);
  const [hasPlaid, setHasPlaid] = useState<boolean | null>(null);

  useEffect(() => {
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

  // Welcome auto-advance to tour after 2.5s
  useEffect(() => {
    if (!show || phase !== 'welcome') return;
    const t = setTimeout(() => setPhase('tour'), 2500);
    return () => clearTimeout(t);
  }, [show, phase]);

  function handleLaunchDemo() {
    setPhase('done');
    setTimeout(() => {
      enableDemo();
      sessionStorage.setItem(ONBOARDING_KEY, '1');
      setShow(false);
    }, 1200);
  }

  function handleSkipTour() {
    handleLaunchDemo();
  }

  function handleNextStep() {
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(s => s + 1);
    } else {
      setPhase('launch');
    }
  }

  if (!show || hasPlaid !== false) return null;

  return (
    <>
      <style jsx global>{`
        @keyframes onb-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes onb-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes onb-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes onb-check {
          from { stroke-dashoffset: 30; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes onb-slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes onb-fade-up { from, to { opacity: 1; transform: none; } }
          @keyframes onb-fade-in { from, to { opacity: 1; } }
          @keyframes onb-slide-in { from, to { opacity: 1; transform: none; } }
          @keyframes onb-progress { from, to { transform: scaleX(1); } }
        }
      `}</style>

      <div className="fixed inset-0 z-[100] bg-[#050505] flex items-center justify-center overflow-hidden">
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(230,185,77,0.4) 0.5px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />

        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)]/20 to-transparent" />

        {/* ═══ WELCOME PHASE ═══ */}
        {phase === 'welcome' && (
          <div className="relative text-center space-y-8 px-8 max-w-lg" style={{ animation: 'onb-fade-up 0.7s ease-out' }}>
            <HelmMark size={56} />
            <div>
              <h1 className="text-[clamp(32px,6vw,48px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.08]">
                Welcome to Helm
              </h1>
              <p className="text-[16px] text-[var(--color-text-muted)] mt-3 leading-relaxed">
                Your financial intelligence terminal
              </p>
            </div>

            {/* Progress bar */}
            <div className="max-w-[200px] mx-auto">
              <div className="h-[2px] bg-[var(--color-border-base)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--color-gold)] rounded-full"
                  style={{ transformOrigin: 'left', animation: 'onb-progress 2.2s ease-in-out forwards' }} />
              </div>
            </div>
          </div>
        )}

        {/* ═══ TOUR PHASE ═══ */}
        {phase === 'tour' && (
          <div className="relative w-full max-w-2xl mx-auto px-8" style={{ animation: 'onb-fade-up 0.5s ease-out' }}>
            {/* Header */}
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)]" />
                <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-gold)] uppercase">
                  Demo Mode
                </span>
              </div>
              <h2 className="text-[clamp(24px,4vw,36px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.1]">
                Here&apos;s what you&apos;ll explore
              </h2>
              <p className="text-[14px] text-[var(--color-text-muted)] mt-2">
                We&apos;ve loaded a sample portfolio. Everything you see is what your real dashboard will look like.
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-3 max-w-md mx-auto">
              {TOUR_STEPS.map((step, i) => (
                <div
                  key={step.num}
                  className={`flex gap-4 p-4 rounded-md border transition-all duration-300 ${
                    i === tourStep
                      ? 'border-[var(--color-gold)]/30 bg-[var(--color-gold-surface)]'
                      : i < tourStep
                        ? 'border-[var(--color-border-subtle)] opacity-40'
                        : 'border-[var(--color-border-subtle)] opacity-60'
                  }`}
                  style={i === tourStep ? { animation: 'onb-slide-in 0.4s ease-out' } : undefined}
                >
                  <span className={`font-mono text-[13px] font-bold mt-0.5 shrink-0 ${
                    i === tourStep ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'
                  }`}>
                    {step.num}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                      {step.title}
                    </div>
                    {i === tourStep && (
                      <p className="text-[13px] text-[var(--color-text-muted)] mt-1 leading-relaxed"
                        style={{ animation: 'onb-fade-in 0.3s ease-out' }}>
                        {step.desc}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Tour navigation */}
            <div className="flex items-center justify-between mt-8 max-w-md mx-auto">
              <button
                onClick={handleSkipTour}
                className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors font-mono"
              >
                Skip tour
              </button>

              <div className="flex items-center gap-4">
                {/* Step dots */}
                <div className="flex gap-1.5">
                  {TOUR_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        i === tourStep ? 'bg-[var(--color-gold)] w-4' : i < tourStep ? 'bg-[var(--color-gold)]/40' : 'bg-[var(--color-border-strong)]'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={handleNextStep}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-gold)] text-black text-[13px] font-semibold rounded-md hover:brightness-110 transition-all"
                >
                  {tourStep < TOUR_STEPS.length - 1 ? 'Next' : 'Enter Terminal'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ LAUNCH PHASE ═══ */}
        {phase === 'launch' && (
          <div className="relative text-center space-y-8 px-8 max-w-lg" style={{ animation: 'onb-fade-up 0.5s ease-out' }}>
            <HelmMark size={48} />
            <div>
              <h2 className="text-[28px] font-bold tracking-tight text-[var(--color-text-primary)]">
                Ready to explore
              </h2>
              <p className="text-[14px] text-[var(--color-text-muted)] mt-2 leading-relaxed max-w-sm mx-auto">
                You&apos;ll see a sample portfolio with real market data. When you&apos;re ready for your own data, connect an account from the sidebar.
              </p>
            </div>

            <button
              onClick={handleLaunchDemo}
              className="inline-flex items-center gap-2 px-8 py-3 bg-[var(--color-gold)] text-black text-[14px] font-bold rounded-md hover:brightness-110 transition-all"
            >
              Open Terminal
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-center gap-6 pt-2">
              {['Read-only', 'No card required', 'Delete anytime'].map((line) => (
                <span key={line} className="font-mono text-[9px] tracking-[0.1em] text-[var(--color-text-muted)]/40 uppercase">
                  {line}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ═══ DONE PHASE ═══ */}
        {phase === 'done' && (
          <div className="relative text-center" style={{ animation: 'onb-fade-up 0.4s ease-out' }}>
            <svg className="w-12 h-12 text-[var(--color-positive)] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"
                style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: 'onb-check 0.4s ease-out 0.1s forwards' }} />
            </svg>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">You&apos;re in</h1>
          </div>
        )}

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
