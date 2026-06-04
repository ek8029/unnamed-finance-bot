'use client';

import { useState, useEffect } from 'react';
import { HelmMark } from '@/components/helm-mark';
import { useDemo } from '@/contexts/demo-context';
import { ArrowRight, PenLine, Link2 } from 'lucide-react';
import { ManualPortfolioForm } from '@/components/manual-portfolio-form';

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
  const [phase, setPhase] = useState<'welcome' | 'tour' | 'launch' | 'manual' | 'done'>('welcome');
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
    setPhase('launch');
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

      <div className="fixed inset-0 z-[100] bg-[#050505] overflow-y-auto overscroll-contain">
        <div className="min-h-[100dvh] flex flex-col">
          {/* Dot grid */}
          <div className="pointer-events-none fixed inset-0 opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(230,185,77,0.4) 0.5px, transparent 0)',
            backgroundSize: '32px 32px',
          }} />

          {/* Top accent */}
          <div className="pointer-events-none fixed top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)]/20 to-transparent" />

          {/* ═══ WELCOME PHASE — centered ═══ */}
          {phase === 'welcome' && (
            <div className="flex-1 grid place-items-center px-6" style={{ animation: 'onb-fade-up 0.7s ease-out' }}>
              <div className="relative text-center space-y-10 max-w-2xl">
                <div className="flex justify-center">
                  <HelmMark size={80} />
                </div>
                <div>
                  <h1 className="text-[clamp(40px,8vw,72px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.05]">
                    Welcome to Helm
                  </h1>
                  <p className="text-[18px] sm:text-[20px] text-[var(--color-text-muted)] mt-4 leading-relaxed">
                    Your financial intelligence terminal
                  </p>
                </div>
                <div className="max-w-[280px] mx-auto">
                  <div className="h-[3px] bg-[var(--color-border-base)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--color-gold)] rounded-full"
                      style={{ transformOrigin: 'left', animation: 'onb-progress 2.2s ease-in-out forwards' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TOUR PHASE — scrollable body + sticky footer ═══ */}
          {phase === 'tour' && (
            <>
              <div className="flex-1 overflow-y-auto px-5 sm:px-8 pt-[max(48px,env(safe-area-inset-top))] pb-6" style={{ animation: 'onb-fade-up 0.5s ease-out' }}>
                <div className="max-w-3xl mx-auto">
                  {/* Header */}
                  <div className="text-center mb-6 sm:mb-10">
                    <div className="flex items-center justify-center gap-2.5 mb-4">
                      <div className="w-2 h-2 rounded-full bg-[var(--color-gold)]" />
                      <span className="font-mono text-[12px] tracking-[0.2em] text-[var(--color-gold)] uppercase">
                        Demo Mode
                      </span>
                    </div>
                    <h2 className="text-[clamp(28px,5vw,48px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.1]">
                      Here&apos;s what you&apos;ll explore
                    </h2>
                    <p className="text-[15px] sm:text-[17px] text-[var(--color-text-muted)] mt-3 max-w-lg mx-auto">
                      We&apos;ve loaded a sample portfolio. Everything you see is what your real dashboard will look like.
                    </p>
                  </div>

                  {/* Steps */}
                  <div className="space-y-3 max-w-xl mx-auto">
                    {TOUR_STEPS.map((step, i) => (
                      <div
                        key={step.num}
                        className={`flex gap-3 sm:gap-5 p-3.5 sm:p-5 rounded-lg border transition-all duration-300 ${
                          i === tourStep
                            ? 'border-[var(--color-gold)]/30 bg-[var(--color-gold-surface)]'
                            : i < tourStep
                              ? 'border-[var(--color-border-subtle)] opacity-40'
                              : 'border-[var(--color-border-subtle)] opacity-60'
                        }`}
                        style={i === tourStep ? { animation: 'onb-slide-in 0.4s ease-out' } : undefined}
                      >
                        <span className={`font-mono text-[16px] font-bold mt-0.5 shrink-0 ${
                          i === tourStep ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'
                        }`}>
                          {step.num}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[15px] sm:text-[17px] font-semibold text-[var(--color-text-primary)]">
                            {step.title}
                          </div>
                          {i === tourStep && (
                            <p className="text-[14px] sm:text-[15px] text-[var(--color-text-muted)] mt-1.5 leading-relaxed"
                              style={{ animation: 'onb-fade-in 0.3s ease-out' }}>
                              {step.desc}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sticky footer — always on screen */}
              <div className="shrink-0 sticky bottom-0 bg-[#050505]/92 backdrop-blur-md border-t border-[var(--color-border-base)] px-5 sm:px-8 py-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                <div className="flex items-center justify-between max-w-xl mx-auto">
                  <button
                    onClick={handleSkipTour}
                    className="font-mono text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors min-h-[44px]"
                  >
                    Skip tour
                  </button>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      {TOUR_STEPS.map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 rounded-full transition-all duration-300 ${
                            i === tourStep ? 'bg-[var(--color-gold)] w-6' : i < tourStep ? 'bg-[var(--color-gold)]/40 w-2' : 'bg-[var(--color-border-strong)] w-2'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={handleNextStep}
                      className="flex items-center gap-2 px-6 min-h-[44px] bg-[var(--color-gold)] text-black text-[15px] font-semibold rounded-md hover:brightness-110 transition-all"
                    >
                      {tourStep < TOUR_STEPS.length - 1 ? 'Next' : 'Enter Terminal'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ═══ LAUNCH PHASE — scrollable body + sticky footer ═══ */}
          {phase === 'launch' && (
            <>
              <div className="flex-1 overflow-y-auto px-5 sm:px-8 pt-[max(48px,env(safe-area-inset-top))] pb-6" style={{ animation: 'onb-fade-up 0.5s ease-out' }}>
                <div className="max-w-2xl mx-auto text-center">
                  <div className="flex justify-center mb-6">
                    <HelmMark size={72} />
                  </div>
                  <h2 className="text-[clamp(24px,5vw,40px)] font-bold tracking-tight text-[var(--color-text-primary)]">
                    How do you want to start?
                  </h2>
                  <p className="text-[15px] sm:text-[16px] text-[var(--color-text-muted)] mt-3 leading-relaxed max-w-md mx-auto">
                    Add your holdings manually in 15 seconds, or connect your brokerage for automatic sync.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 max-w-md mx-auto mt-6 sm:mt-8">
                    <button
                      onClick={handleLaunchDemo}
                      className="flex-1 flex flex-col items-center gap-3 px-4 sm:px-6 py-5 sm:py-6 rounded-md border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] hover:bg-[rgba(230,185,77,0.08)] transition-colors cursor-pointer"
                    >
                      <Link2 className="w-6 h-6 text-[var(--color-gold)]" />
                      <span className="text-[15px] font-semibold text-[var(--color-text-primary)]">Connect brokerage</span>
                      <span className="text-[12px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>Auto-sync via Plaid</span>
                    </button>

                    <button
                      onClick={() => setPhase('manual')}
                      className="flex-1 flex flex-col items-center gap-3 px-4 sm:px-6 py-5 sm:py-6 rounded-md border border-[var(--color-border-base)] hover:border-[var(--color-border-strong)] transition-colors cursor-pointer"
                    >
                      <PenLine className="w-6 h-6 text-[var(--color-text-muted)]" />
                      <span className="text-[15px] font-semibold text-[var(--color-text-primary)]">Add holdings</span>
                      <span className="text-[12px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>Type tickers + shares</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sticky footer */}
              <div className="shrink-0 sticky bottom-0 bg-[#050505]/92 backdrop-blur-md border-t border-[var(--color-border-base)] px-5 sm:px-8 py-4 text-center" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                <button
                  onClick={handleLaunchDemo}
                  className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer min-h-[44px]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Skip for now
                </button>
              </div>
            </>
          )}

          {/* ═══ MANUAL PHASE — scrollable body + sticky footer ═══ */}
          {phase === 'manual' && (
            <>
              <div className="flex-1 overflow-y-auto px-5 sm:px-8 pt-[max(48px,env(safe-area-inset-top))] pb-6" style={{ animation: 'onb-fade-up 0.5s ease-out' }}>
                <div className="max-w-lg mx-auto">
                  <div className="text-center mb-6">
                    <h2 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-[var(--color-text-primary)]">
                      Add your holdings
                    </h2>
                    <p className="text-[14px] text-[var(--color-text-muted)] mt-2">
                      Enter your positions below. Cost basis is optional but unlocks tax insights.
                    </p>
                  </div>
                  <ManualPortfolioForm
                    compact
                    onComplete={() => {
                      setPhase('done');
                      localStorage.setItem(ONBOARDING_KEY, '1');
                      setTimeout(() => setShow(false), 1200);
                    }}
                  />
                </div>
              </div>

              {/* Sticky footer */}
              <div className="shrink-0 sticky bottom-0 bg-[#050505]/92 backdrop-blur-md border-t border-[var(--color-border-base)] px-5 sm:px-8 py-4 text-center" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                <button
                  onClick={() => setPhase('launch')}
                  className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer min-h-[44px]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  ← Back
                </button>
              </div>
            </>
          )}

          {/* ═══ DONE PHASE — centered ═══ */}
          {phase === 'done' && (
            <div className="flex-1 grid place-items-center" style={{ animation: 'onb-fade-up 0.4s ease-out' }}>
              <div className="relative text-center">
                <svg className="w-16 h-16 text-[var(--color-positive)] mx-auto mb-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"
                    style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: 'onb-check 0.4s ease-out 0.1s forwards' }} />
                </svg>
                <h1 className="text-[36px] font-bold text-[var(--color-text-primary)]">You&apos;re in</h1>
              </div>
            </div>
          )}

          {/* Bottom watermark */}
          <div className="shrink-0 py-4 text-center">
            <span className="font-mono text-[9px] tracking-[0.15em] text-[var(--color-text-muted)]/15 uppercase">
              helmterminal.dev
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
