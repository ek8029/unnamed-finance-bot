'use client';

import { useState, useEffect } from 'react';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';

const STEPS = [
  { tag: 'connect', text: 'market data pipeline' },
  { tag: 'fetch', text: 'index benchmarks (SPY, QQQ)' },
  { tag: 'scan', text: 'mega-cap price action' },
  { tag: 'map', text: 'sector heat & breadth' },
  { tag: 'rank', text: 'top movers by magnitude' },
  { tag: 'compile', text: 'today\'s market brief' },
];

export default function BriefLoading() {
  const [typedLen, setTypedLen] = useState(0);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(0);

  useEffect(() => {
    const cmd = 'helm brief --market';
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i <= cmd.length; i++) {
      timeouts.push(setTimeout(() => setTypedLen(i), i * 12));
    }

    const typeEndMs = cmd.length * 12 + 60;
    for (let i = 0; i < STEPS.length; i++) {
      timeouts.push(setTimeout(() => setVisibleSteps(i + 1), typeEndMs + i * 80));
    }

    const checkStartMs = typeEndMs + 150;
    const checkDelays = [0, 120, 250, 400, 580];
    for (let i = 0; i < STEPS.length - 1; i++) {
      timeouts.push(setTimeout(() => setCompletedSteps(i + 1), checkStartMs + checkDelays[i]));
    }

    return () => timeouts.forEach(clearTimeout);
  }, []);

  const fullCommand = 'helm brief --market';
  const commandText = fullCommand.slice(0, typedLen);
  const doneTyping = typedLen >= fullCommand.length;

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col relative overflow-hidden">
      <CinematicBg />

      <header className="relative z-10 glass-nav">
        <div className="max-w-3xl mx-auto px-6 h-12 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <HelmMark size={24} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </a>
          <span className="text-[12px] text-[var(--color-text-secondary)]" style={{ fontFamily: 'var(--font-mono)' }}>
            The Current
          </span>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6">
        <div className="bg-[rgba(10,10,10,0.8)] border border-white/[0.06] rounded-lg px-6 py-5 font-mono text-sm max-w-lg w-full">
          <div className="flex items-center mb-4">
            <span className="text-[var(--color-gold)] mr-2">&rarr;</span>
            <span className="text-[var(--color-text-primary)]">{commandText}</span>
            {!doneTyping && (
              <span className="inline-block w-[2px] h-[1.1em] bg-[var(--color-gold)] ml-0.5 animate-pulse" />
            )}
          </div>

          {visibleSteps > 0 && (
            <div className="space-y-2 border-t border-white/[0.04] pt-3">
              {STEPS.slice(0, visibleSteps).map((step, i) => {
                const completed = i < completedSteps;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3"
                    style={{ animation: 'fadeSlideIn 0.3s ease-out both' }}
                  >
                    <span className="text-[var(--color-text-muted)] text-xs w-[76px] text-right shrink-0">
                      [{step.tag}]
                    </span>
                    <span className={completed ? 'text-[var(--color-positive)]' : 'text-[var(--color-text-secondary)]'}>
                      {step.text}
                    </span>
                    {completed && <span className="text-[var(--color-positive)] text-xs ml-auto">&#10003;</span>}
                    {!completed && i < visibleSteps && (
                      <span className="ml-auto">
                        <span className="inline-block w-3 h-3 border-2 border-[var(--color-gold)]/40 border-t-[var(--color-gold)] rounded-full animate-spin" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
