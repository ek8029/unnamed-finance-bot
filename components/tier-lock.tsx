'use client';
// Tier lock: blurred faux-preview behind a centered lock card. Pro lock = gold
// #E6B94D. Reads the
// current tier from the preview context; renders children when entitled.

import { useEffect } from 'react';
import { tierAtLeast, TIER_META } from '@/lib/tier-shared';
import { usePreview } from '@/lib/preview-context';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import posthog from 'posthog-js';

export function TierLock({
  required,
  label,
  blurb,
  surface,
  children,
}: {
  required: 'pro';
  label?: string;
  blurb?: string;
  /** Which gated screen this is. Defaults to the pathname. */
  surface?: string;
  children: React.ReactNode;
}) {
  const { tier, resolved } = usePreview();
  const pathname = usePathname();
  const entitled = tierAtLeast(tier, required);
  const where = surface ?? pathname ?? 'unknown';

  // The paywall shipped with no instrumentation at all, so "did anyone even see
  // it" was unanswerable. Fire on mount rather than on render: React runs the
  // render body twice in strict mode and that would double every count.
  // Never before the tier is known: in prod the context starts at 'free' for
  // everyone, so an unresolved lock is a Pro user's first paint, not a paywall.
  useEffect(() => {
    if (entitled || !resolved) return;
    posthog.capture('paywall_hit', { surface: where, required, tier });
  }, [entitled, resolved, where, required, tier]);

  if (entitled) return <>{children}</>;

  // Tier still loading: hold the blurred shape, no lock card yet. A Pro user
  // goes blur -> content without ever seeing "Unlock"; a free user goes
  // blur -> lock. Nothing paid is legible through the blur either way.
  if (!resolved) {
    return (
      <div className="pointer-events-none select-none blur-[6px] opacity-40 max-h-[78vh] overflow-hidden" aria-hidden>
        {children}
      </div>
    );
  }

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
            onClick={() => posthog.capture('paywall_cta_clicked', { surface: where, required, tier })}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] mt-1"
            style={{ background: meta.color, color: '#0A0A0A', fontFamily: 'var(--font-mono)' }}
          >
            Start 14 day free trial
          </Link>
          <p className="text-[11px] text-[#6E6E6E] mt-2.5 mb-0">
            Then {meta.price}. Cancel any time before the trial ends.
          </p>
        </div>
      </div>
    </div>
  );
}
