'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Shield } from 'lucide-react';
import {
  computeCapitalGainsTax,
  parseAmount,
  FILING_STATUSES,
  LATEST_TAX_YEAR,
  type FilingStatus,
} from '@/lib/capital-gains';

type Sign = 'gain' | 'loss';

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const whole = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const pct = (rate: number) => `${(rate * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;

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
const TH =
  'px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]';
const TD = 'px-4 py-3 font-mono';

const YEAR = LATEST_TAX_YEAR;

/** Blank reads as zero for the two gain fields: no entry is no gain. */
const signed = (raw: string, sign: Sign): number | null => {
  if (raw.trim() === '') return 0;
  const n = num(raw);
  if (n === null) return null;
  return sign === 'loss' ? -n : n;
};

export function CapitalGainsTool() {
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');
  const [ordinaryIncome, setOrdinaryIncome] = useState('85000');
  const [shortTerm, setShortTerm] = useState('');
  const [shortSign, setShortSign] = useState<Sign>('gain');
  const [longTerm, setLongTerm] = useState('25000');
  const [longSign, setLongSign] = useState<Sign>('gain');

  const enteredShort = signed(shortTerm, shortSign);
  const enteredLong = signed(longTerm, longSign);

  const result = useMemo(() => {
    const income = num(ordinaryIncome);
    if (income === null || enteredShort === null || enteredLong === null) return null;
    return computeCapitalGainsTax({
      year: YEAR,
      filingStatus,
      ordinaryIncome: income,
      shortTerm: enteredShort,
      longTerm: enteredLong,
    });
  }, [filingStatus, ordinaryIncome, enteredShort, enteredLong]);

  // True when a loss on one side ate into the gain on the other.
  const netted =
    result !== null &&
    (result.netShortTermGain !== Math.max(0, enteredShort ?? 0) ||
      result.netLongTermGain !== Math.max(0, enteredLong ?? 0));

  const blocker = (() => {
    if (result) return null;
    for (const [raw, name] of [
      [ordinaryIncome, 'taxable income'],
      [shortTerm, 'short-term amount'],
      [longTerm, 'long-term amount'],
    ] as const) {
      if (unreadable(raw)) return `The ${name} is not a number this page can read.`;
    }
    return 'Enter your taxable income before the gain to see a figure.';
  })();

  const nothingEntered = result !== null && result.netGain === 0 && result.netCapitalLoss === 0;
  const statusLabel = FILING_STATUSES.find((s) => s.value === filingStatus)?.label ?? '';
  const pieces = result ? [...result.shortTermPieces, ...result.longTermPieces] : [];

  return (
    <section className="relative z-10 container mx-auto px-6 pt-14 pb-10 max-w-3xl">
      <h1 className="type-h1 mb-3">Capital Gains Tax Calculator</h1>
      <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)] mb-8">
        Enter your taxable income and this year&rsquo;s capital gains or losses. This works out the federal tax on
        the gain using the {YEAR} brackets from Rev. Proc. 2025-32: the long-term gain across the 0, 15 and 20
        percent bands, the short-term gain at ordinary rates, and the 3.8 percent net investment income tax.
        Free, no signup.
      </p>

      {/* The limit, stated before any number is shown. */}
      <div className="mb-8 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-gold)] mb-1.5">
          What this assumes
        </p>
        <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
          <strong className="text-[var(--color-text-primary)]">Federal tax only.</strong> State and local tax is
          not included. The income you enter is treated as taxable income after the standard or itemized
          deduction, and the same figure plus the net gain stands in for modified adjusted gross income when
          the net investment income tax is tested, because this page has no AGI figure. Qualified dividends,
          collectibles, unrecaptured section 1250 gain, section 1202 stock, the alternative minimum tax, and
          prior-year loss carryovers are not modeled. Estimates only, not tax advice.
        </p>
      </div>

      {/* ── Inputs ── */}
      <h2 className="type-h2 mb-3">Your {YEAR} return</h2>
      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <label className="block">
          <span className={LABEL}>Filing status</span>
          <select
            value={filingStatus}
            onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
            className={INPUT}
            aria-label="Filing status"
          >
            {FILING_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={LABEL}>Taxable income before the gain ($)</span>
          <input
            type="text"
            inputMode="decimal"
            value={ordinaryIncome}
            onChange={(e) => setOrdinaryIncome(e.target.value)}
            placeholder="85000"
            className={INPUT}
            aria-label="Taxable ordinary income before the gain, in dollars"
            aria-invalid={unreadable(ordinaryIncome)}
          />
          {unreadable(ordinaryIncome) ? (
            <span className={FIELD_ERROR}>{BAD_NUMBER}</span>
          ) : (
            <span className="mt-1.5 block text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
              Wages and other ordinary income after deductions, with no capital gain in it.
            </span>
          )}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-10">
        {(
          [
            ['Short-term (held one year or less)', shortTerm, setShortTerm, shortSign, setShortSign, 'short-term'],
            ['Long-term (held more than one year)', longTerm, setLongTerm, longSign, setLongSign, 'long-term'],
          ] as const
        ).map(([label, raw, setRaw, sign, setSign, key]) => (
          <div key={key} className="rounded-xl border border-[var(--color-border-base)] p-4">
            <span className={LABEL}>{label}</span>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="0"
                className={INPUT}
                aria-label={`${label} amount in dollars`}
                aria-invalid={unreadable(raw)}
              />
              <select
                value={sign}
                onChange={(e) => setSign(e.target.value as Sign)}
                className={`${INPUT} w-auto`}
                aria-label={`${label}: gain or loss`}
              >
                <option value="gain">Gain</option>
                <option value="loss">Loss</option>
              </select>
            </div>
            {unreadable(raw) && <span className={FIELD_ERROR}>{BAD_NUMBER}</span>}
          </div>
        ))}
      </div>

      {/* ── Result ── */}
      {!result ? (
        <p className="mb-10 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{blocker}</p>
      ) : nothingEntered ? (
        <p className="mb-10 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Enter a short-term or long-term amount to see where it lands. Your {whole(result.ordinaryIncome)} of
          taxable income alone carries {money(result.taxOnOrdinaryIncome)} of federal tax on the {YEAR} brackets.
        </p>
      ) : result.netCapitalLoss > 0 ? (
        <>
          <h2 className="type-h2 mb-3">The year nets to a capital loss</h2>
          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>Net capital loss</p>
              <p className="font-mono text-2xl text-[var(--color-text-primary)]">{money(result.netCapitalLoss)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                After netting short-term against long-term under IRC section 1222.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>Deducted this year</p>
              <p className="font-mono text-2xl text-[var(--color-gold)]">{money(result.lossDeduction)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                Against ordinary income, capped at {whole(result.lossCap)} for {statusLabel.toLowerCase()} under IRC
                section 1211(b).
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>Carried to {YEAR + 1}</p>
              <p className="font-mono text-2xl text-[var(--color-text-primary)]">{money(result.carryover)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                {result.carryover === 0
                  ? 'The whole loss fits under the cap.'
                  : `${money(result.carryoverShortTerm)} short-term, ${money(result.carryoverLongTerm)} long-term. The deduction absorbs short-term loss first under section 1212(b).`}
              </p>
            </div>
          </div>
          <p className="mb-10 text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
            No capital gains tax and no net investment income tax is owed on a net loss. Taking{' '}
            {money(result.lossDeduction)} off {whole(result.ordinaryIncome)} of taxable income removes{' '}
            {money(result.ordinaryTaxReduction)} of ordinary tax on the {YEAR} brackets
            {result.ordinaryTaxReduction === 0 ? ', which is nothing here because there is no ordinary tax to reduce' : ''}.
            The carryover keeps its character and offsets gains of the same kind first next year.
          </p>
        </>
      ) : (
        <>
          <h2 className="type-h2 mb-3">Federal tax on a {money(result.netGain)} net gain</h2>

          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>Total federal tax</p>
              <p className="font-mono text-2xl text-[var(--color-gold)]">{money(result.totalTax)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                {money(result.shortTermTax)} short-term, {money(result.longTermTax)} long-term, {money(result.niit)}{' '}
                net investment income tax.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>Effective rate on the gain</p>
              <p className="font-mono text-2xl text-[var(--color-text-primary)]">{pct(result.effectiveRate)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                Total tax divided by the net gain, on top of {money(result.taxOnOrdinaryIncome)} already owed on
                the income alone.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>Net investment income tax</p>
              <p className="font-mono text-2xl text-[var(--color-text-primary)]">{money(result.niit)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                {result.niitBase > 0
                  ? `3.8 percent of ${money(result.niitBase)}, the lesser of the gain and the ${money(result.magi)} of income over the ${whole(result.niitThreshold)} threshold.`
                  : `Income plus gain of ${money(result.magi)} does not exceed the ${whole(result.niitThreshold)} threshold for ${statusLabel.toLowerCase()}.`}
              </p>
            </div>
          </div>

          {/* Where each dollar lands. */}
          <h2 className="type-h2 mb-1.5">Where the gain lands</h2>
          <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
            Your {whole(result.ordinaryIncome)} of taxable income fills the brackets first. The short-term gain stacks
            on top of it at ordinary rates, and the long-term gain stacks on top of both, so the 0, 15 and 20 percent
            bands are measured against total taxable income, not against the gain on its own.
          </p>
          <div className="mb-4 overflow-x-auto rounded-xl border border-[var(--color-border-base)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-base)] bg-[var(--color-surface-tint)]">
                  <th className={TH}>Slice</th>
                  <th className={`${TH} text-right`}>Taxable income</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={`${TH} text-right`}>Rate</th>
                  <th className={`${TH} text-right`}>Tax</th>
                </tr>
              </thead>
              <tbody>
                {pieces.map((p, i) => (
                  <tr key={`${p.kind}-${i}`} className="border-b border-[var(--color-border-base)]">
                    <td className={`${TD} text-[var(--color-text-primary)]`}>
                      {p.kind === 'short-term' ? 'Short-term' : 'Long-term'}
                    </td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>
                      {whole(p.from)} to {whole(p.to)}
                    </td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{money(p.amount)}</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{pct(p.rate)}</td>
                    <td className={`${TD} text-right text-[var(--color-text-primary)]`}>{money(p.tax)}</td>
                  </tr>
                ))}
                {result.niit > 0 && (
                  <tr className="border-b border-[var(--color-border-base)]">
                    <td className={`${TD} text-[var(--color-text-primary)]`}>NIIT</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>
                      over {whole(result.niitThreshold)}
                    </td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{money(result.niitBase)}</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>3.8%</td>
                    <td className={`${TD} text-right text-[var(--color-text-primary)]`}>{money(result.niit)}</td>
                  </tr>
                )}
                <tr className="bg-[var(--color-surface-tint)]">
                  <td className={`${TD} text-[var(--color-text-primary)]`}>Total</td>
                  <td className={TD} />
                  <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{money(result.netGain)}</td>
                  <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{pct(result.effectiveRate)}</td>
                  <td className={`${TD} text-right text-[var(--color-gold)]`}>{money(result.totalTax)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {netted && (
            <p className="mb-4 text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
              The loss on one side offset the gain on the other before any rate applied, under IRC section 1222.
              What is left is {money(result.netShortTermGain)} short-term and {money(result.netLongTermGain)}{' '}
              long-term.
            </p>
          )}
        </>
      )}

      {/* Disclaimer, matching the register used elsewhere in the tax surfaces. */}
      <div className="mb-12 flex items-start gap-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
        <Shield className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Estimates only, not tax advice. Federal tax only; state and local tax is not included. Helm Terminal is
          not a registered tax advisor, CPA, or tax return preparer. Figures are the {YEAR} amounts published in
          Rev. Proc. 2025-32 and IRS Topics 409 and 559, applied to the numbers you type. The page does not read
          your return, does not model qualified dividends, collectibles, section 1250 gain, section 1202 stock,
          the alternative minimum tax, prior-year carryovers, or the section 1211(b) limit to taxable income, and
          it approximates modified adjusted gross income as taxable income plus the gain. Consult a qualified tax
          professional before filing.
        </span>
      </div>

      {/* One CTA */}
      <div className="rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-6">
        <h2 className="type-h2 mb-2">The part a calculator cannot do</h2>
        <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
          This page prices a gain you already know the size of. The harder question is which positions across every
          account carry a gain or a loss right now, at what holding period, and what realizing one would change on
          the figures above. Helm reads the holdings in the accounts you connect, read-only, and shows each
          position&rsquo;s unrealized gain, its holding period, and the harvestable losses screened against the
          wash sale window. It cannot see accounts you have not connected.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 font-mono text-[13px] text-[var(--color-gold)] hover:underline"
        >
          See your own positions <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
