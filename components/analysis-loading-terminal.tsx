'use client';

import { useState, useEffect } from 'react';

const STEPS = [
  { tag: 'connect', text: 'market data pipeline' },
  { tag: 'fetch', text: 'real-time pricing' },
  { tag: 'load', text: 'financial metrics & ratios' },
  { tag: 'pull', text: 'analyst consensus estimates' },
  { tag: 'scan', text: 'news sentiment & events' },
  { tag: 'generate', text: 'ai-powered analysis' },
];

export function AnalysisLoadingTerminal() {
  const [ticker, setTicker] = useState('');
  const [typedLen, setTypedLen] = useState(0);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(0);

  // Extract ticker from URL
  useEffect(() => {
    // Match /analyze/AAPL, /dashboard/analyze/AAPL, or /compare/AAPL-vs-MSFT
    const analyzeMatch = window.location.pathname.match(/\/analyze\/([A-Za-z]{1,5})$/);
    const compareMatch = window.location.pathname.match(/\/compare\/([A-Za-z]{1,5})-vs-([A-Za-z]{1,5})$/);
    const match = analyzeMatch || (compareMatch ? [null, `${compareMatch[1]} vs ${compareMatch[2]}`] : null);
    if (match) setTicker(match[1].toUpperCase());
  }, []);

  // Orchestrate all animations via a single effect — fast, overlapping phases
  useEffect(() => {
    if (!ticker) return;

    const cmd = `helm analyze ${ticker}`;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    // Phase 1: Type command (25ms/char → ~450ms)
    for (let i = 0; i <= cmd.length; i++) {
      timeouts.push(setTimeout(() => setTypedLen(i), i * 25));
    }

    // Phase 2: Reveal steps (start right after typing, 180ms apart)
    const typeEndMs = cmd.length * 25 + 150;
    for (let i = 0; i < STEPS.length; i++) {
      timeouts.push(
        setTimeout(() => setVisibleSteps(i + 1), typeEndMs + i * 180),
      );
    }

    // Phase 3: Complete steps with varied delays (leave last 1 in-progress)
    const checkStartMs = typeEndMs + 500;
    const checkDelays = [0, 400, 900, 1800, 2800];
    for (let i = 0; i < STEPS.length - 1; i++) {
      timeouts.push(
        setTimeout(() => setCompletedSteps(i + 1), checkStartMs + checkDelays[i]),
      );
    }

    return () => timeouts.forEach(clearTimeout);
  }, [ticker]);

  const fullCommand = `helm analyze ${ticker || '···'}`;
  const commandText = fullCommand.slice(0, typedLen);
  const doneTyping = typedLen >= fullCommand.length;

  return (
    <div className="bg-[rgba(10,10,10,0.8)] border border-white/[0.06] rounded-lg px-6 py-5 font-mono text-sm max-w-lg w-full">
      {/* Command line */}
      <div className="flex items-center mb-4">
        <span className="text-[var(--color-gold)] mr-2">→</span>
        <span className="text-[var(--color-text-primary)]">{commandText}</span>
        {!doneTyping && (
          <span className="inline-block w-[2px] h-[1.1em] bg-[var(--color-gold)] ml-0.5 animate-pulse" />
        )}
      </div>

      {/* Steps */}
      {visibleSteps > 0 && (
        <div className="space-y-2 border-t border-white/[0.04] pt-3">
          {STEPS.slice(0, visibleSteps).map((step, i) => {
            const completed = i < completedSteps;
            const stepText =
              step.tag === 'fetch' && ticker
                ? `${step.text} (${ticker})`
                : step.text;

            return (
              <div
                key={i}
                className="flex items-center gap-3"
                style={{
                  animation: 'fadeSlideIn 0.3s ease-out both',
                  animationDelay: '0ms',
                }}
              >
                <span className="text-[var(--color-text-muted)] text-xs w-[76px] text-right shrink-0">
                  [{step.tag}]
                </span>
                <span
                  className={
                    completed
                      ? 'text-[var(--color-text-secondary)]'
                      : 'text-[var(--color-text-muted)]'
                  }
                >
                  {stepText}
                </span>
                <span className="ml-auto shrink-0">
                  {completed ? (
                    <span className="text-[var(--color-positive)]">✓</span>
                  ) : (
                    <span className="loading-dots text-[var(--color-text-muted)]">
                      ···
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .loading-dots {
          animation: dotPulse 1.4s ease-in-out infinite;
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
