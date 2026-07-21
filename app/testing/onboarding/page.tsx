'use client';

// /testing/onboarding — review the value-first onboarding on YOUR OWN account,
// with a brokerage already connected, without creating a throwaway signup.
//
// Real reads (live scan engine, your accounts/holdings, your theses), zero writes.
// Jump straight to any screen instead of walking the whole flow each time.

import { useState } from 'react';
import Link from 'next/link';
import { DemoProvider } from '@/contexts/demo-context';
import { OnboardingFlowV2 } from '@/components/onboarding/onboarding-flow-v2';

const PHASES = [
  ['welcome', 'Welcome'],
  ['input', 'Ticker input'],
  ['scan', 'Scan'],
  ['card', 'Intelligence card'],
  ['howItWorks', 'How Helm works'],
  ['connect', 'Connect'],
  ['manual', 'Manual entry'],
  ['synced', 'Synced'],
  ['ratify', 'Confirm theses'],
  ['done', 'Done'],
] as const;

type Phase = (typeof PHASES)[number][0];

export default function OnboardingHarness() {
  const [phase, setPhase] = useState<Phase>('welcome');
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
        <OnboardingFlowV2 key={key} harness jumpTo={phase} />
      </div>
    </DemoProvider>
  );
}
