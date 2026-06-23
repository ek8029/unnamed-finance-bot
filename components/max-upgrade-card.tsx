'use client';

// Upgrade nudge shown ONLY to Pro (not Max) users — free users get the
// pricing/gate CTAs, Max users get nothing. Opens the in-place Pro->Max
// upgrade (prorated, no second subscription) via the checkout modal.

import { useState } from 'react';
import { usePreview } from '@/lib/preview-context';
import { CheckoutModal } from '@/components/checkout-modal';
import { Sparkles, ArrowRight } from 'lucide-react';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

export function MaxUpgradeCard({ className = '' }: { className?: string }) {
  const { tier } = usePreview();
  const [open, setOpen] = useState(false);

  if (tier !== 'pro') return null;

  return (
    <>
      <div
        className={`rounded-lg px-[22px] py-[18px] ${className}`}
        style={{
          border: '1px solid rgba(255,214,122,0.28)',
          background: 'rgba(255,214,122,0.04)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <Sparkles size={13} style={{ color: '#FFD67A' }} />
              <span className="text-[10px] uppercase tracking-[0.16em]" style={{ ...MONO, color: '#FFD67A' }}>
                Max · $50/mo
              </span>
            </div>
            <div className="text-[15px] font-semibold text-[var(--color-text-primary)]">
              You&apos;re on Pro. Unlock the analyst.
            </div>
            <p className="m-0 mt-1 text-[13.5px] leading-[1.55] text-[var(--color-text-secondary)]">
              Max adds the autonomous agent, factor lens, thesis builder, and agentic reassessments on top of everything in Pro.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-5 py-2.5 text-[14px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: '#FFD67A', color: 'var(--color-bg-base)' }}
          >
            Upgrade to Max
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
      {open && <CheckoutModal billingPeriod="max" onClose={() => setOpen(false)} />}
    </>
  );
}
