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
    <div className="min-h-screen bg-[var(--color-bg-inset,#060606)] flex flex-col relative overflow-hidden">
      <CinematicBg />

      <header className="relative z-10 border-b border-white/[0.07] bg-[rgba(6,6,6,0.78)] backdrop-blur-[20px] backdrop-saturate-[1.4]">
        <div className="max-w-3xl mx-auto px-6 h-[58px] flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <HelmMark size={24} />
            <span className="font-mono text-[14px] font-bold tracking-[0.16em] uppercase text-[var(--color-gold)]" style={{ fontFamily: 'var(--font-mono)' }}>Helm</span>
          </a>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A]" style={{ fontFamily: 'var(--font-mono)' }}>
            The Current
          </span>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6">
        <div className="rounded-xl border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] px-6 py-5 font-mono text-sm max-w-lg w-full" style={{ borderTop: '2px solid rgba(230,185,77,0.30)' }}>
          <div className="flex items-center mb-4">
            <span className="text-[var(--color-gold)] mr-2">&rarr;</span>
            <span className="text-[#FAFAFA]">{commandText}</span>
            {!doneTyping && (
              <span className="inline-block w-[2px] h-[1.1em] bg-[var(--color-gold)] ml-0.5 animate-pulse" />
            )}
          </div>

          {visibleSteps > 0 && (
            <div className="space-y-2.5 border-t border-white/[0.06] pt-3.5">
              {STEPS.slice(0, visibleSteps).map((step, i) => {
                const completed = i < completedSteps;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3"
                    style={{ animation: 'fadeSlideIn 0.3s ease-out both' }}
                  >
                    <span className="text-[#6A6A6A] text-[11px] font-semibold uppercase tracking-[0.12em] w-[76px] text-right shrink-0">
                      [{step.tag}]
                    </span>
                    <span style={{ color: completed ? '#4ADE80' : '#9A9A9A' }}>
                      {step.text}
                    </span>
                    {completed && <span className="text-[11px] ml-auto" style={{ color: '#4ADE80' }}>&#10003;</span>}
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
