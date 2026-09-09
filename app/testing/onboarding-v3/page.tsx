'use client';

// /testing/onboarding-v3: review the book-first onboarding on YOUR OWN account
// without a throwaway signup. Real reads (your accounts and holdings, the live
// receipt), zero writes: the forms render with readOnly. Jump to any screen.

import { useState } from 'react';
import Link from 'next/link';
import { DemoProvider } from '@/contexts/demo-context';
import { OnboardingFlowV3 } from '@/components/onboarding/v3/onboarding-flow-v3';

const PHASES = [
  ['ask', 'Ask'],
  ['loop', 'Loop'],
  ['reveal', 'Reveal'],
] as const;

type Phase = (typeof PHASES)[number][0];

export default function OnboardingV3Harness() {
  const [phase, setPhase] = useState<Phase>('ask');
  const [key, setKey] = useState(0); // remount to replay a screen from scratch

  return (
    <DemoProvider>
      {/* toolbar sits above the overlay */}
      <div className="fixed top-0 inset-x-0 z-[300] bg-[#0B0B0B] border-b border-white/[0.1] px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/testing" className="text-[11px] text-[#6A6A6A] hover:text-[#FAFAFA] mr-1" style={{ fontFamily: 'var(--font-mono)' }}>
            ← Testing
          </Link>
          {PHASES.map(([p, label]) => (
            <button
              key={p}
              onClick={() => { setPhase(p); setKey((k) => k + 1); }}
              className={`px-2.5 h-[26px] rounded text-[11px] transition-colors ${
                phase === p ? 'bg-[#E6B94D] text-black font-semibold' : 'border border-white/[0.12] text-[#9A9A9A] hover:text-[#FAFAFA]'
              }`}
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-[#6A6A6A]" style={{ fontFamily: 'var(--font-mono)' }}>
            real data · no writes
          </span>
        </div>
      </div>

      {/* push the overlay below the toolbar so both are usable */}
      <div className="pt-[42px]">
        <OnboardingFlowV3 key={`${phase}-${key}`} harness jumpTo={phase} readOnly />
      </div>
    </DemoProvider>
  );
}
