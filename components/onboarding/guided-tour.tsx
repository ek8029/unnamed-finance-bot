'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, X } from 'lucide-react';

const TOUR_SEEN_KEY = 'helm_tour_completed';

interface TourStep {
  target: string; // CSS selector
  title: string;
  desc: string;
  position: 'bottom' | 'right' | 'left' | 'top';
}

const STEPS: TourStep[] = [
  {
    target: '[data-tour="overview"]',
    title: 'Dashboard Overview',
    desc: 'Your command center. Net worth, cash flow, portfolio health — everything at a glance.',
    position: 'right',
  },
  {
    target: '[data-tour="portfolio"]',
    title: 'Portfolio',
    desc: 'Every holding across every account. Concentration risk, sector breakdown, and scenario analysis in the sidebar.',
    position: 'right',
  },
  {
    target: '[data-tour="brief"]',
    title: 'The Current — Daily Brief',
    desc: 'An AI-written morning brief connecting market news to your holdings. Updated daily at 9:15 AM.',
    position: 'right',
  },
  {
    target: '[data-tour="actions"]',
    title: 'Actions Inbox',
    desc: 'Tax-loss harvesting opportunities, earnings warnings, and concentration alerts — surfaced automatically.',
    position: 'right',
  },
  {
    target: '[data-tour="transactions"]',
    title: 'Transactions',
    desc: 'Every transaction across all linked accounts. Search, filter by category, and track spending patterns.',
    position: 'right',
  },
  {
    target: '[data-tour="accounts"]',
    title: 'Accounts',
    desc: 'Connect your brokerage and bank accounts here when you\'re ready. Read-only access via Plaid.',
    position: 'right',
  },
];

export function GuidedTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    // Skip on mobile — tour anchors to sidebar which is off-canvas
    if (window.matchMedia('(max-width: 767px)').matches) return;

    // Only show tour once, only in demo mode
    const isDemo = sessionStorage.getItem('helm_demo_mode') === '1';
    const seen = localStorage.getItem(TOUR_SEEN_KEY) === '1';
    if (!isDemo || seen) return;

    // Delay to let dashboard render
    const t = setTimeout(() => setActive(true), 800);
    return () => clearTimeout(t);
  }, []);

  const updateRect = useCallback(() => {
    if (!active) return;
    const el = document.querySelector(STEPS[step].target);
    if (el) {
      setRect(el.getBoundingClientRect());
    }
  }, [active, step]);

  // Poll for element until found, then listen for resize
  useEffect(() => {
    if (!active) return;
    // Try immediately
    updateRect();
    // Poll every 200ms in case element isn't ready
    const poll = setInterval(updateRect, 200);
    const stopPoll = setTimeout(() => clearInterval(poll), 3000);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      clearInterval(poll);
      clearTimeout(stopPoll);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [active, step, updateRect]);

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      finish();
    }
  }

  function finish() {
    localStorage.setItem(TOUR_SEEN_KEY, '1');
    setActive(false);
  }

  if (!active || !rect) return null;

  const s = STEPS[step];
  const pad = 6;

  // Tooltip positioning
  let tooltipStyle: React.CSSProperties = {};
  if (s.position === 'right') {
    tooltipStyle = {
      top: rect.top + rect.height / 2,
      left: rect.right + 16,
      transform: 'translateY(-50%)',
    };
  } else if (s.position === 'bottom') {
    tooltipStyle = {
      top: rect.bottom + 12,
      left: rect.left + rect.width / 2,
      transform: 'translateX(-50%)',
    };
  } else if (s.position === 'left') {
    tooltipStyle = {
      top: rect.top + rect.height / 2,
      right: window.innerWidth - rect.left + 16,
      transform: 'translateY(-50%)',
    };
  } else {
    tooltipStyle = {
      bottom: window.innerHeight - rect.top + 12,
      left: rect.left + rect.width / 2,
      transform: 'translateX(-50%)',
    };
  }

  return (
    <>
      <style jsx global>{`
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(230, 185, 77, 0.3); }
          50% { box-shadow: 0 0 0 6px rgba(230, 185, 77, 0.15); }
        }
      `}</style>

      {/* Overlay */}
      <div className="fixed inset-0 z-[200] pointer-events-none">
        {/* Dark backdrop with cutout */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'auto' }}>
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={rect.left - pad}
                y={rect.top - pad}
                width={rect.width + pad * 2}
                height={rect.height + pad * 2}
                rx={6}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.6)"
            mask="url(#tour-mask)"
            onClick={next}
          />
        </svg>

        {/* Highlight border around target */}
        <div
          className="absolute border-2 border-[var(--color-gold)] rounded-md"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            animation: 'tour-pulse 2s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Tooltip */}
        <div
          className="absolute z-[201] w-[320px] bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg shadow-elevated p-5"
          style={{ ...tooltipStyle, pointerEvents: 'auto' }}
        >
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] tracking-[0.15em] text-[var(--color-gold)] uppercase">
              Step {step + 1} of {STEPS.length}
            </span>
            <button
              onClick={finish}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Close tour"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <h3 className="text-[16px] font-bold text-[var(--color-text-primary)] mb-1.5">
            {s.title}
          </h3>
          <p className="text-[14px] text-[var(--color-text-muted)] leading-relaxed mb-4">
            {s.desc}
          </p>

          <div className="flex items-center justify-between">
            {/* Progress dots */}
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? 'bg-[var(--color-gold)] w-4' : i < step ? 'bg-[var(--color-gold)]/40 w-1.5' : 'bg-[var(--color-border-strong)] w-1.5'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={next}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-gold)] text-black text-[13px] font-semibold rounded-md hover:brightness-110 transition-all"
            >
              {step < STEPS.length - 1 ? 'Next' : 'Start Exploring'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
