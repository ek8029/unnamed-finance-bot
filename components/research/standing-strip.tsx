'use client';

// "Where you stand" — the plain-English top line the Outsider asked for: the one
// thing that matters, then a few are-you-okay checks. Deterministic, no LLM.

import type { Standing, CheckStatus } from '@/lib/research/standing';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

const STATUS_TONE: Record<CheckStatus, string> = {
  ok: '#4ADE80',
  watch: '#E6B94D',
  flag: '#F87171',
};

export function StandingStrip({ standing }: { standing: Standing }) {
  if (standing.checks.length === 0) return null;

  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#0A0A0A] p-4 sm:p-5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A]" style={MONO}>
        Where you stand
      </div>
      <p className="mt-2 text-[17px] leading-[1.4] font-semibold text-[#FAFAFA] m-0">{standing.headline}</p>

      <div className="mt-3 flex flex-col gap-1.5">
        {standing.checks.map((c) => {
          const tone = STATUS_TONE[c.status];
          return (
            <div key={c.label} className="flex items-baseline gap-2.5">
              <span className="mt-[3px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tone }} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] w-[92px] shrink-0" style={{ ...MONO, color: tone }}>
                {c.label}
              </span>
              <span className="text-[13px] leading-[1.5] text-[#B8B8B8]">{c.detail}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
