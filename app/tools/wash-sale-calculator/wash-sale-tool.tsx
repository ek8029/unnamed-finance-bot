'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, Shield, X } from 'lucide-react';
import { computeWashSale, parseAmount, type ReplacementBuy } from '@/lib/wash-sale';

interface BuyRow {
  id: number;
  date: string;
  shares: string;
  cost: string;
  retirement: boolean;
}

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const shareCount = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 6 });

// The reader-facing parser lives in lib/wash-sale.ts so it can be tested.
const num = parseAmount;

/** Typed something, and it is not a number this page will price. */
const unreadable = (raw: string) => raw.trim() !== '' && num(raw) === null;

const FIELD_ERROR = 'mt-1.5 block text-[12.5px] text-[var(--color-negative)]';
const BAD_NUMBER = 'Enter a number, like 4200 or 4,200.50.';

const LABEL =
  'block font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2';
const INPUT =
  'w-full min-h-[44px] rounded-lg border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] px-3 py-2.5 font-mono text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-gold)] focus:outline-none transition-colors';

export function WashSaleTool() {
  const [saleDate, setSaleDate] = useState('2026-06-15');
  const [sharesSold, setSharesSold] = useState('100');
  const [proceeds, setProceeds] = useState('4000');
  const [costBasis, setCostBasis] = useState('5000');
  const [acquiredDate, setAcquiredDate] = useState('');
  const [rows, setRows] = useState<BuyRow[]>([
    { id: 1, date: '2026-06-20', shares: '100', cost: '4200', retirement: false },
  ]);
  const [nextId, setNextId] = useState(2);

  const complete = rows.filter((r) => r.date !== '' && num(r.shares) !== null && num(r.cost) !== null);
  const skipped = rows.length - complete.length;

  const result = useMemo(() => {
    const shares = num(sharesSold);
    const gross = num(proceeds);
    const basis = num(costBasis);
    if (!saleDate || shares === null || gross === null || basis === null) return null;

    const buys: ReplacementBuy[] = complete.map((r) => ({
      date: r.date,
      shares: num(r.shares) as number,
      cost: num(r.cost) as number,
      retirement: r.retirement,
    }));

    return computeWashSale({
      saleDate,
      sharesSold: shares,
      proceeds: gross,
      costBasis: basis,
      acquiredDate: acquiredDate || undefined,
      buys,
    });
    // complete is derived from rows on every render, so rows is the real input.
  }, [saleDate, sharesSold, proceeds, costBasis, acquiredDate, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Saying "fill in the four sale fields" when the refused value is the
  // optional acquisition date, or a purchase row with zero shares, points the
  // reader at the wrong part of the page.
  const blocker = (() => {
    if (result) return null;
    for (const [raw, name] of [
      [sharesSold, 'shares sold'],
      [proceeds, 'proceeds'],
      [costBasis, 'cost basis'],
    ] as const) {
      if (unreadable(raw)) return `The ${name} is not a number this page can read.`;
    }
    if (num(sharesSold) === 0) return 'Shares sold cannot be zero.';
    if (rows.some((r) => num(r.shares) === 0)) {
      return 'One of the purchases is for zero shares. Clear that field to leave the row out.';
    }
    if (acquiredDate && saleDate && acquiredDate > saleDate) {
      return 'The shares were bought after the date they were sold. Check those two dates.';
    }
    if (rows.some((r) => unreadable(r.shares) || unreadable(r.cost))) {
      return 'One of the purchases has a value this page cannot read.';
    }
    return 'Fill in the sale date, the shares sold, the proceeds and the cost basis to see a figure.';
  })();

  const addRow = () => {
    setRows([...rows, { id: nextId, date: '', shares: '', cost: '', retirement: false }]);
    setNextId(nextId + 1);
  };
  const patch = (id: number, next: Partial<BuyRow>) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, ...next } : r)));

  return (
    <section className="relative z-10 container mx-auto px-6 pt-14 pb-10 max-w-3xl">
      <h1 className="type-h1 mb-3">Wash Sale Calculator</h1>
      <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)] mb-8">
        Enter a sale at a loss and the purchases around it. This works out how much of the loss the wash sale rule
        would disallow on the figures you enter, how much survives, and what the replacement shares&rsquo;
        basis becomes. Free, no signup.
      </p>

      {/* The limit, stated before any number is shown. */}
      <div className="mb-8 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-gold)] mb-1.5">
          What this assumes
        </p>
        <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
          One sale, of{' '}
          <strong className="text-[var(--color-text-primary)]">one tax lot</strong>. The split below is proportional,
          which is only the right answer when every share sold was bought at the same price, so do not enter a sale
          that drew on two lots at different prices. Every purchase entered is treated as the same or a{' '}
          <strong className="text-[var(--color-text-primary)]">substantially identical</strong> security, still held.
          The IRS has never defined that term for funds, and nothing here tests it. The figures
          are arithmetic on what you type, not a reading of your brokerage records. Estimates only, not tax advice.
        </p>
      </div>

      {/* ── The sale ── */}
      <h2 className="type-h2 mb-3">The sale at a loss</h2>
      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <label className="block">
          <span className={LABEL}>Sale date</span>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className={INPUT}
            aria-label="Sale date"
          />
        </label>
        <label className="block">
          <span className={LABEL}>Shares sold</span>
          <input
            type="text"
            inputMode="decimal"
            value={sharesSold}
            onChange={(e) => setSharesSold(e.target.value)}
            placeholder="100"
            className={INPUT}
            aria-label="Shares sold"
            aria-invalid={unreadable(sharesSold)}
          />
          {unreadable(sharesSold) && <span className={FIELD_ERROR}>{BAD_NUMBER}</span>}
        </label>
        <label className="block">
          <span className={LABEL}>Total proceeds ($)</span>
          <input
            type="text"
            inputMode="decimal"
            value={proceeds}
            onChange={(e) => setProceeds(e.target.value)}
            placeholder="4000"
            className={INPUT}
            aria-label="Total proceeds in dollars"
            aria-invalid={unreadable(proceeds)}
          />
          {unreadable(proceeds) && <span className={FIELD_ERROR}>{BAD_NUMBER}</span>}
        </label>
        <label className="block">
          <span className={LABEL}>Total cost basis ($)</span>
          <input
            type="text"
            inputMode="decimal"
            value={costBasis}
            onChange={(e) => setCostBasis(e.target.value)}
            placeholder="5000"
            className={INPUT}
            aria-label="Total cost basis in dollars"
            aria-invalid={unreadable(costBasis)}
          />
          {unreadable(costBasis) && <span className={FIELD_ERROR}>{BAD_NUMBER}</span>}
        </label>
      </div>
      <label className="block mb-10">
        <span className={LABEL}>Date those shares were bought (optional)</span>
        <input
          type="date"
          value={acquiredDate}
          onChange={(e) => setAcquiredDate(e.target.value)}
          className={`${INPUT} sm:max-w-[50%]`}
          aria-label="Date the shares sold were acquired, optional"
        />
        <span className="mt-1.5 block text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
          Supplying it adds the holding-period figures. The days you held the shares sold carry onto the
          replacement shares under IRC §1223(3), which can turn a short-term lot long-term earlier than its
          purchase date suggests.
        </span>
      </label>

      {/* ── Replacement purchases ── */}
      <h2 className="type-h2 mb-1.5">Purchases of the same security</h2>
      <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
        Anything bought in the 30 days before the sale, on the sale date, or in the 30 days after. Include dividend
        reinvestments and purchases in other accounts, including a spouse&rsquo;s: the rule is tested across
        everything one taxpayer owns, not per account.
      </p>

      <div className="space-y-3 mb-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-[var(--color-border-base)] p-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          >
            <label className="block">
              <span className={LABEL}>Purchase date</span>
              <input
                type="date"
                value={r.date}
                onChange={(e) => patch(r.id, { date: e.target.value })}
                className={INPUT}
                aria-label="Purchase date"
              />
            </label>
            <label className="block">
              <span className={LABEL}>Shares</span>
              <input
                type="text"
                inputMode="decimal"
                value={r.shares}
                onChange={(e) => patch(r.id, { shares: e.target.value })}
                placeholder="100"
                className={INPUT}
                aria-label="Shares bought"
                aria-invalid={unreadable(r.shares)}
              />
              {unreadable(r.shares) && <span className={FIELD_ERROR}>{BAD_NUMBER}</span>}
              {num(r.shares) === 0 && (
                <span className={FIELD_ERROR}>A purchase of zero shares is not a purchase. Leave it blank.</span>
              )}
            </label>
            <label className="block">
              <span className={LABEL}>Total cost ($)</span>
              <input
                type="text"
                inputMode="decimal"
                value={r.cost}
                onChange={(e) => patch(r.id, { cost: e.target.value })}
                placeholder="4200"
                className={INPUT}
                aria-label="Total cost in dollars"
                aria-invalid={unreadable(r.cost)}
              />
              {unreadable(r.cost) && <span className={FIELD_ERROR}>{BAD_NUMBER}</span>}
            </label>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows(rows.filter((x) => x.id !== r.id))}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-border-base)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                aria-label="Remove this purchase"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <label className="sm:col-span-4 flex min-h-[44px] items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={r.retirement}
                onChange={(e) => patch(r.id, { retirement: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-gold)] cursor-pointer"
              />
              <span className="text-[13px] text-[var(--color-text-secondary)]">
                Bought in an IRA or Roth IRA
              </span>
            </label>
          </div>
        ))}
      </div>

      <div className="mb-10 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--color-border-base)] px-4 text-[14px] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Add another purchase
        </button>
        {skipped > 0 && (
          <span className="text-[12.5px] text-[var(--color-text-muted)]">
            {skipped} row{skipped === 1 ? '' : 's'} with a blank field {skipped === 1 ? 'is' : 'are'} not counted.
          </span>
        )}
      </div>

      {/* ── Result ── */}
      {!result ? (
        <p className="mb-10 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          {blocker}
        </p>
      ) : result.verdict === 'gain' ? (
        <div className="mb-10 rounded-xl border border-[var(--color-border-base)] p-6">
          <h2 className="type-h2 mb-2">
            {result.realizedGain > 0
              ? `That sale was a gain of ${money(result.realizedGain)}`
              : 'That sale broke even'}
          </h2>
          <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
            The wash sale rule applies to losses, so it does not reach this sale and the 61-day window does not
            change anything.{' '}
            {result.realizedGain > 0
              ? 'A gain is taxable whatever you buy afterwards. Buying the position back does not defer it.'
              : 'There is no loss to disallow and no basis adjustment to make. Check the proceeds and the cost basis if you expected a loss.'}
          </p>
        </div>
      ) : (
        <>
          <h2 className="type-h2 mb-3">
            {result.verdict === 'no-match'
              ? 'No entered purchase falls inside the window'
              : result.verdict === 'full'
                ? 'The whole loss is disallowed'
                : 'Part of the loss is disallowed'}
          </h2>

          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Loss realized
              </p>
              <p className="font-mono text-2xl text-[var(--color-text-primary)]">{money(result.realizedLoss)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                {shareCount(result.sharesSold)} shares sold.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Disallowed
              </p>
              <p className="font-mono text-2xl text-[var(--color-negative)]">{money(result.disallowedLoss)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                {shareCount(result.sharesMatched)} of {shareCount(result.sharesSold)} shares replaced inside the
                window.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Still deductible
              </p>
              <p className="font-mono text-2xl text-[var(--color-gold)]">{money(result.deductibleLoss)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                Before the annual cap on losses that exceed your gains: $3,000, or $1,500 if married filing separately, under IRC §1211(b).
              </p>
            </div>
          </div>

          {result.permanentlyLost > 0 && (
            <div className="mb-4 rounded-xl border border-[var(--color-negative-border)] bg-[var(--color-negative-muted)] p-5">
              {/* The uppercase mono register is for short labels. A sentence
                  this long belongs in the same face as the rest of the prose. */}
              <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-negative)] mb-2">
                Permanently lost
              </p>
              <p className="text-[15px] text-[var(--color-text-primary)] mb-2">
                <span className="font-mono">{money(result.permanentlyLost)}</span> of that disallowed loss is gone
                for good, not deferred.
              </p>
              <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
                An ordinary wash sale defers a loss: the disallowed dollars move into the replacement shares&rsquo;
                basis and come back when those shares are sold. A purchase inside an IRA or Roth is different. Under
                Rev. Rul. 2008-5 the loss is disallowed and no basis is restored anywhere, so the deduction is lost
                rather than delayed.
              </p>
            </div>
          )}

          {result.sameDateOrdering && result.lots.length > 0 && (
            <p className="mb-4 text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
              Two or more of those purchases share a date. Order of acquisition does not settle which of them is the
              replacement property, so the order you entered them in decided it here. That choice is yours to make
              and it can move the figures above, most of all when one of the same-day purchases sits in a retirement
              account.
            </p>
          )}

          {/* The window. Never described as a clearance. */}
          <div className="mb-8 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
              The 61-day window for this sale
            </p>
            <p className="font-mono text-[15px] text-[var(--color-text-primary)]">
              {result.windowStart} through {result.windowEnd}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              A purchase dated {result.dayAfterWindow} or later sits outside this sale&rsquo;s window. That is not a
              clearance. A different sale carries its own window, a substantially identical security counts as the
              same one, and purchases in accounts you have not accounted for count too.
            </p>
          </div>

          {result.lots.length > 0 && (
            <>
              <h2 className="type-h2 mb-3">What the replacement shares cost you now</h2>
              <div className="mb-4 overflow-x-auto rounded-xl border border-[var(--color-border-base)]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border-base)] bg-[var(--color-surface-tint)]">
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                        Bought
                      </th>
                      <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                        Replacement shares
                      </th>
                      <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                        Paid
                      </th>
                      <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                        Loss added
                      </th>
                      <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                        New basis
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lots.map((l, i) => (
                      <tr
                        key={`${l.date}-${i}`}
                        className="border-b border-[var(--color-border-base)] last:border-0"
                      >
                        <td className="px-4 py-3 font-mono text-[var(--color-text-primary)]">
                          {l.date}
                          {l.retirement && (
                            <span className="ml-2 text-[11px] text-[var(--color-negative)]">retirement</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[var(--color-text-secondary)]">
                          {shareCount(l.replacementShares)}
                          {l.replacementShares !== l.purchasedShares && (
                            <span className="text-[var(--color-text-muted)]"> of {shareCount(l.purchasedShares)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[var(--color-text-secondary)]">
                          {money(l.cost)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[var(--color-text-secondary)]">
                          {l.retirement ? 'none' : money(l.basisAdded)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[var(--color-text-primary)]">
                          {money(l.adjustedBasis)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {result.lots.some((l) => l.holdingPeriodStart) && (
                <div className="mb-4 rounded-xl border border-[var(--color-border-subtle)] p-5">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                    Holding period carried over
                  </p>
                  <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
                    {result.lots
                      .filter((l) => l.holdingPeriodStart)
                      .map((l, i) => (
                        <li key={`${l.date}-hp-${i}`}>
                          The {shareCount(l.replacementShares)} replacement shares bought {l.date}
                          {l.replacementShares !== l.purchasedShares
                            ? ` (of the ${shareCount(l.purchasedShares)} in that purchase, since only the replacement shares take the adjustment)`
                            : ''}{' '}
                          inherit {l.daysTacked} days from the shares you sold, so their holding period reads from{' '}
                          {l.holdingPeriodStart}
                          {l.alreadyLongTerm
                            ? ', which makes them long term already on the day they were bought.'
                            : ` and a sale on or after ${l.longTermFrom} would be long term.`}
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {result.excessShares > 0 && (
                <p className="mb-4 text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
                  You bought {shareCount(result.excessShares)} shares more than you sold. Only the first{' '}
                  {shareCount(result.sharesSold)} count as replacement property, matched earliest purchase first
                  under Reg. §1.1091-1(b). The rest carry their own basis with no adjustment.
                </p>
              )}
            </>
          )}

          {result.outsideWindow.length > 0 && (
            <p className="mb-4 text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
              {result.outsideWindow.length} purchase{result.outsideWindow.length === 1 ? '' : 's'} you entered
              {result.outsideWindow.length === 1 ? ' falls' : ' fall'} outside the window, so the rule does not
              reach {result.outsideWindow.length === 1 ? 'it' : 'them'}. Holding shares bought before the window is
              not itself a wash sale. §1091 turns on an acquisition inside the 61 days, not on owning the security.
            </p>
          )}

          {result.verdict === 'no-match' && (
            <p className="mb-4 text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
              Nothing you entered lands in the window, so the whole loss reads as deductible here. It stops being
              deductible if a purchase turns up that is not in this calculation: a dividend reinvestment, a
              standing order, a purchase in an account you have not checked, or one by a spouse.
            </p>
          )}
        </>
      )}

      {/* Disclaimer, matching the register used elsewhere in the tax surfaces. */}
      <div className="mb-12 flex items-start gap-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
        <Shield className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Estimates only, not tax advice. Helm Terminal is not a registered tax advisor, CPA, or tax return
          preparer. This page does not decide what counts as substantially identical, does not handle short sales,
          options, or contracts to acquire, and models one sale of one tax lot at a time. A sale
          drawn from lots bought at different prices needs share-by-share matching that this page does not do.
          It assumes the replacement shares are still held, and it treats a purchase in a 401(k), HSA or 529 the
          way Rev. Rul. 2008-5 treats one in an IRA, which is the common reading rather than the
          ruling&rsquo;s holding. Consult a qualified tax professional before filing.
        </span>
      </div>

      {/* One CTA */}
      <div className="rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-6">
        <h2 className="type-h2 mb-2">The part a calculator cannot do</h2>
        <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
          This page prices a sale you already know about. The harder question is which purchases exist across every
          account you hold, because the rule is tested on all of them at once and no single statement shows them
          together. Helm reads the transactions in the accounts you connect and screens harvestable losses against
          purchases in the 30 days before, retirement accounts included. It cannot see the 30 days after, which
          have not happened yet, and it cannot see accounts you have not connected.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 font-mono text-[13px] text-[var(--color-gold)] hover:underline"
        >
          Screen your own accounts <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
