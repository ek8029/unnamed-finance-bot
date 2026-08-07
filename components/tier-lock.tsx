'use client';
// Tier lock: blurred faux-preview behind a centered lock card. Pro lock = gold
// #E6B94D. Reads the
// current tier from the preview context; renders children when entitled.

import { tierAtLeast, TIER_META } from '@/lib/tier-shared';
import { usePreview } from '@/lib/preview-context';
import { Lock } from 'lucide-react';
import Link from 'next/link';

export function TierLock({
  required,
  label,
  blurb,
  children,
}: {
  required: 'pro';
  label?: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  const { tier } = usePreview();
  if (tierAtLeast(tier, required)) return <>{children}</>;

  const meta = TIER_META[required];
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[6px] opacity-40 max-h-[78vh] overflow-hidden" aria-hidden>
        {children}
      </div>
      <div
        className="absolute inset-0 flex items-start justify-center pt-[13vh] px-6"
        style={{ background: 'linear-gradient(180deg, rgba(6,6,6,0.40), rgba(6,6,6,0.72))' }}
      >
        <div
          className="max-w-sm w-full text-center rounded-lg bg-[var(--color-bg-surface)] px-6 py-7"
          style={{ border: `1px solid ${meta.color}`, boxShadow: `0 0 24px ${meta.color}22` }}
        >
          <div
            className="inline-flex items-center justify-center w-9 h-9 rounded-full mb-3"
            style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}` }}
          >
            <Lock size={15} style={{ color: meta.color }} />
          </div>
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] mb-2"
            style={{ color: meta.color, fontFamily: 'var(--font-mono)' }}
          >
            {meta.label} feature
          </div>
          <div className="text-[15px] font-semibold text-[#FAFAFA] mb-1.5">
            {label ?? `Unlock with ${meta.label}`}
          </div>
          {blurb && <p className="text-[14px] leading-[1.55] text-[#8A8A8A] m-0 mb-4">{blurb}</p>}
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-md px-4 py-2 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] mt-1"
            style={{ background: meta.color, color: '#0A0A0A', fontFamily: 'var(--font-mono)' }}
          >
            Unlock with {meta.label} · {meta.price}
          </Link>
        </div>
      </div>
    </div>
  );
}
