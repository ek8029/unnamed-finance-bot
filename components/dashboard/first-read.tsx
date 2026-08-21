'use client';

// THE FIRST READ — what Helm found, shown at the moment the brokerage connects.
//
// Connecting is the biggest ask in the product and it used to pay out in a page
// refresh. The tax-loss figure is the only number Helm computes that is
// arithmetic rather than judgment, and it sat two navigations away behind a menu
// most people never opened. This puts it in front of the person while they are
// still looking at the screen they just trusted.
//
// It never draws a number it does not have. The first sync takes anywhere from a
// few seconds to a couple of minutes, and during it `holdings` is empty, which
// reads identically to a portfolio with nothing in it. So the waiting state is
// its own state and it counts accounts rather than dollars. A shell that says
// LOADING is honest; a shell that says $0 is a claim about somebody's book.
//
// A real zero gets said out loud too, with the number of positions attached.
// "Nothing harvestable across 24 positions" is a finding and it is the answer
// for roughly a third of people who connect. Hiding it and showing the dashboard
// instead would be the same evasion in a nicer outfit.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { FirstRead as FirstReadData } from '@/app/api/tax/first-read/route';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

/** Plaid's first investments pull is usually seconds and occasionally much
 *  longer. Past this the screen stops pretending it is imminent and hands over
 *  to the dashboard, which will pick the holdings up whenever they land. */
const GIVE_UP_MS = 90_000;
const POLL_MS = 2_500;

const money = (n: number) =>
  `$${Math.round(n).toLocaleString('en-US')}`;

export function FirstRead({ itemId, onDone }: { itemId?: string | null; onDone: () => void }) {
  const [data, setData] = useState<FirstReadData | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [failed, setFailed] = useState(false);
  const started = useRef(Date.now());
  const syncKicked = useRef(false);

  const poll = useCallback(async () => {
    try {
      const r = await fetch('/api/tax/first-read', { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as FirstReadData;
      setData(d);
      setFailed(false);

      // PlaidLinkButton already awaits a sync before it reports success, so in
      // the common case holdings are in and this never fires. It exists for the
      // case where that sync failed — it is caught and swallowed there, so
      // without this the screen would poll a book nobody asked for until it
      // timed out. Once only: /api/plaid/sync allows 5 calls per 300s and a
      // retry loop would spend that budget on a request already in flight.
      if (d.state === 'syncing' && !syncKicked.current) {
        syncKicked.current = true;
        void fetch('/api/plaid/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemId ? { item_id: itemId } : {}),
        }).catch(() => {
          // The webhook is still the durable path. This screen is a courtesy.
        });
      }

      return d.state === 'ready';
    } catch {
      // One bad poll during a sync is noise. Only a run that never succeeds
      // before the deadline is worth telling anyone about.
      setFailed(true);
      return false;
    }
  }, [itemId]);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const done = await poll();
      if (!live || done) return;
      if (Date.now() - started.current > GIVE_UP_MS) { setTimedOut(true); return; }
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => { live = false; clearTimeout(timer); };
  }, [poll]);

  const ready = data?.state === 'ready';
  const found = ready && data.harvestable > 0;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] items-center justify-center px-6">
      <div className="w-full max-w-[560px]">
        <p
          className="mb-6 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
          style={MONO}
        >
          {ready ? 'Connected · first read' : 'Connected · reading'}
        </p>

        {!ready ? (
          // WAITING. Counts accounts, never dollars.
          <>
            <h1 className="text-[28px] font-bold leading-[1.15] tracking-[-0.025em] text-[var(--color-text-primary)]">
              {timedOut
                ? 'Your positions are still coming in.'
                : 'Reading your positions.'}
            </h1>
            <p className="mt-3 text-[15px] leading-[1.65] text-[var(--color-text-muted)]">
              {timedOut
                ? 'Your brokerage is taking longer than usual to hand over holdings. Nothing is lost: they will appear on their own, and the tax figure with them.'
                : data && data.accounts > 0
                  ? `${data.accounts} account${data.accounts === 1 ? '' : 's'} linked. Helm is pulling every lot and its cost basis, which is what the tax figure is computed from.`
                  : 'Helm is pulling every lot and its cost basis, which is what the tax figure is computed from.'}
            </p>
            {!timedOut && (
              // A shell, not a placeholder number. Nothing here can be mistaken
              // for a figure about this person's book.
              <div className="mt-8 space-y-3" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-3 rounded-[3px]"
                    style={{
                      width: `${[62, 44, 51][i]}%`,
                      background: 'rgba(255,255,255,0.05)',
                      animation: `firstReadPulse 1.6s ease-in-out ${i * 0.18}s infinite`,
                    }}
                  />
                ))}
              </div>
            )}
            {failed && !timedOut && (
              <p className="mt-5 text-[13px] text-[var(--color-text-muted)]">
                Still trying to reach Helm.
              </p>
            )}
          </>
        ) : found ? (
          // THE NUMBER.
          <>
            <p
              className="text-[54px] font-bold leading-none tracking-[-0.03em] text-[var(--color-gold)]"
              style={{ ...MONO, fontVariantNumeric: 'tabular-nums' }}
            >
              {money(data.harvestable)}
            </p>
            <h1 className="mt-4 text-[22px] font-bold leading-[1.25] tracking-[-0.02em] text-[var(--color-text-primary)]">
              of harvestable losses, across {data.opportunityCount} position
              {data.opportunityCount === 1 ? '' : 's'}.
            </h1>
            <p className="mt-3 text-[15px] leading-[1.65] text-[var(--color-text-muted)]">
              Read from {data.positions} position{data.positions === 1 ? '' : 's'} and their cost
              basis. {data.savings > 0 ? (
                <>Worth about {money(data.savings)} against this year&rsquo;s taxes at your rates,
                after the annual deduction cap.</>
              ) : (
                // cappedSavings reaches zero through more than one route (the
                // §1211(b) cap, the realized-gains waterfall, rate settings),
                // and this screen does not know which. Naming a cause here
                // would be a guess printed next to a dollar figure.
                <>None of it reduces this year&rsquo;s bill at your current settings. The
                breakdown is on the tax page.</>
              )}
            </p>
          </>
        ) : (
          // A REAL ZERO. Said plainly, with the denominator attached.
          <>
            <h1 className="text-[28px] font-bold leading-[1.15] tracking-[-0.025em] text-[var(--color-text-primary)]">
              Nothing harvestable today.
            </h1>
            <p className="mt-3 text-[15px] leading-[1.65] text-[var(--color-text-muted)]">
              Helm read {data.positions} position{data.positions === 1 ? '' : 's'} across{' '}
              {data.accounts} account{data.accounts === 1 ? '' : 's'} and none is carrying a loss
              worth taking. That is a finding, not a gap: it gets rechecked as prices move.
            </p>
          </>
        )}

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={onDone}
            className="cursor-pointer rounded-[5px] bg-[var(--color-gold)] px-8 py-3 text-[15px] font-bold text-[var(--color-bg-base)] transition-all hover:brightness-110"
          >
            Open the terminal
          </button>
          {found && (
            <Link
              href="/dashboard/taxes"
              className="rounded-[5px] border border-[var(--color-border-strong)] px-8 py-3 text-center text-[14px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              See the positions
            </Link>
          )}
        </div>

        {/* Required wherever the figures appear. Helm is not an RIA. */}
        {ready && data.disclaimer && (
          <p className="mt-7 text-[11px] leading-[1.6] text-[#5a5a5a]">{data.disclaimer}</p>
        )}
      </div>

      <style jsx global>{`
        @keyframes firstReadPulse {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.75; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*='firstReadPulse'] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
