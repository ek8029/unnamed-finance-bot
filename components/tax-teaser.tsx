'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';
import { useFormat } from '@/hooks/use-format';

/**
 * The harvestable figure, shown to free accounts.
 *
 * Tax-loss harvesting is the only deterministic dollar amount in the product:
 * it computes from lots the user already owns and waits on nothing, unlike
 * thesis findings which arrive about once every two months per thesis. It was
 * also, until now, entirely behind the paywall, so the single most concrete
 * thing Helm can say was invisible to everyone who had not already paid.
 *
 * Three states, and the difference matters. A number, a real zero, and "we do
 * not know yet" are not the same claim, and rendering a confident $0 while the
 * request is still in flight would be the print-a-claim-the-data-does-not-
 * support bug in its most expensive form: on the screen that asks for money.
 */

interface Teaser {
  totalHarvestableLoss: number;
  totalEstimatedSavings: number;
  opportunityCount: number;
  disclaimer?: string;
}

/**
 * Read the teaser payload into a display decision.
 *
 * Exported so the sign convention is pinned by a test rather than by memory.
 * `totalHarvestableLoss` is SIGNED and a loss is NEGATIVE: live accounts return
 * -1,116.57, -20,702.97 and -137,028.20. Checking `> 0` reports "nothing to
 * harvest" to every user who has something to harvest.
 */
export function readTeaser(d: Pick<Teaser, 'totalHarvestableLoss' | 'opportunityCount'>): {
  harvestable: number;
  hasLosses: boolean;
} {
  const harvestable = Math.abs(d.totalHarvestableLoss ?? 0);
  return { harvestable, hasLosses: (d.opportunityCount ?? 0) > 0 && harvestable > 0 };
}

export function TaxTeaser() {
  const { formatCurrency } = useFormat();
  const [data, setData] = useState<Teaser | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/tax-opportunities');
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json();
        if (!alive) return;
        setData(d);
        setState('ready');
        posthog.capture('tax_teaser_shown', {
          has_harvestable: (d?.opportunityCount ?? 0) > 0,
          opportunity_count: d?.opportunityCount ?? 0,
        });
      } catch {
        if (alive) setState('failed');
      }
    })();
    return () => { alive = false; };
  }, []);

  // Unreachable is not the same as nothing. Say neither until we know.
  if (state === 'loading') {
    return (
      <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-6 py-7">
        <div className="h-3 w-40 rounded bg-[var(--color-border-base)]" />
        <div className="mt-4 h-9 w-56 rounded bg-[var(--color-border-base)]" />
        <div className="mt-3 h-3 w-72 rounded bg-[var(--color-border-base)]" />
        <span className="sr-only">Checking your accounts for harvestable losses</span>
      </div>
    );
  }

  if (state === 'failed' || !data) {
    return (
      <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-6 py-7">
        <p className="m-0 text-[15px] text-[var(--color-text-secondary)]">
          Could not reach your accounts just now, so there is no figure to show yet. This is a
          connection problem, not a finding that you have nothing to harvest.
        </p>
      </div>
    );
  }

  const { harvestable, hasLosses } = readTeaser(data);

  return (
    <div
      className="rounded-lg px-6 py-7"
      style={{
        border: `1px solid ${hasLosses ? 'var(--color-gold-border)' : 'var(--color-border-base)'}`,
        background: hasLosses
          ? 'linear-gradient(180deg, rgba(230,185,77,0.055), rgba(230,185,77,0.012))'
          : 'var(--color-bg-surface)',
      }}
    >
      <div
        className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        Tax Center
      </div>

      {hasLosses ? (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className="text-[40px] font-bold tabular-nums leading-none text-[var(--color-text-primary)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {formatCurrency(harvestable)}
            </span>
            <span className="text-[15px] text-[var(--color-text-secondary)]">
              in harvestable losses across your accounts
            </span>
          </div>
          <p className="mt-3.5 mb-0 max-w-[62ch] text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">
            Computed from your own lots and cost basis, not an estimate, across{' '}
            {data.opportunityCount === 1 ? '1 position' : `${data.opportunityCount} positions`}. It
            rechecks every trading day. Helm shows you the figure. It does not tell you whether to
            act on it, and it is not tax advice.
          </p>
          <p className="mt-3 mb-0 max-w-[62ch] text-[14px] leading-[1.6] text-[var(--color-text-primary)]">
            Pro opens the lot-level breakdown, screens it against 30-day wash-sale windows across
            every account at once, and keeps it current all year instead of on December 28.
          </p>
        </>
      ) : (
        <>
          <div className="mt-3 text-[22px] font-semibold leading-[1.25] text-[var(--color-text-primary)]">
            Nothing to harvest today. That is the good version of this screen.
          </div>
          <p className="mt-3 mb-0 max-w-[62ch] text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">
            Helm checked every lot you hold against its cost basis and found no losses available
            right now. That changes when the market does, and Helm rechecks every trading day.
          </p>
          <p className="mt-3 mb-0 max-w-[62ch] text-[14px] leading-[1.6] text-[var(--color-text-primary)]">
            What Pro does the rest of the year: watches the thesis behind every position you own and
            tells you when the evidence turns against it, flags earnings exposure before the print,
            and has the tax math ready in October rather than December. Most weeks it will be quiet.
            That is the design, not a fault.
          </p>
        </>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/pricing"
          onClick={() =>
            posthog.capture('tax_teaser_cta_clicked', { has_harvestable: hasLosses })
          }
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] bg-[var(--color-gold)] px-5 font-semibold text-[14px] text-[var(--color-bg-base)] transition-colors hover:bg-[var(--color-gold-hi)]"
        >
          Start the 14 day free trial
        </Link>
        <span className="text-[12.5px] text-[var(--color-text-muted)]">
          $20/mo after. Card required, nothing charged until day 14.
        </span>
      </div>
    </div>
  );
}
