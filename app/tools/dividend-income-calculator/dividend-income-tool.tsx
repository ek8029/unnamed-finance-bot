'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Shield } from 'lucide-react';
import {
  computeDividendIncome,
  parseAmount,
  PAYMENT_FREQUENCIES,
  MAX_YEARS,
  type PaymentFrequency,
} from '@/lib/dividend-income';

type Sign = 'positive' | 'negative';

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
const BAD_PERCENT = 'Enter a percent, like 3 or 3.5.';

const LABEL =
  'block font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2';
const INPUT =
  'w-full min-h-[44px] rounded-lg border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] px-3 py-2.5 font-mono text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-gold)] focus:outline-none transition-colors';
const TH =
  'px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]';
const TD = 'px-4 py-3 font-mono';

/** Blank reads as zero: no entry is no contribution. */
const unsignedOrZero = (raw: string): number | null => {
  if (raw.trim() === '') return 0;
  return num(raw);
};

/** A rate field with a growing/declining sign, blank reads as zero. */
const signedPercent = (raw: string, sign: Sign): number | null => {
  if (raw.trim() === '') return 0;
  const n = num(raw);
  if (n === null) return null;
  return sign === 'negative' ? -n : n;
};

export function DividendIncomeTool() {
  const [startingInvestment, setStartingInvestment] = useState('50000');
  const [dividendYield, setDividendYield] = useState('3.5');
  const [dividendGrowth, setDividendGrowth] = useState('5');
  const [dividendGrowthSign, setDividendGrowthSign] = useState<Sign>('positive');
  const [priceGrowth, setPriceGrowth] = useState('6');
  const [priceGrowthSign, setPriceGrowthSign] = useState<Sign>('positive');
  const [years, setYears] = useState('20');
  const [reinvest, setReinvest] = useState(true);
  const [annualContribution, setAnnualContribution] = useState('0');
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>('quarterly');

  const enteredDividendGrowth = signedPercent(dividendGrowth, dividendGrowthSign);
  const enteredPriceGrowth = signedPercent(priceGrowth, priceGrowthSign);
  const enteredContribution = unsignedOrZero(annualContribution);
  const parsedYears = years.trim() === '' ? null : Number(years);
  const yearsInvalid =
    years.trim() !== '' && (!Number.isFinite(parsedYears) || !Number.isInteger(parsedYears) || (parsedYears as number) < 1);

  const result = useMemo(() => {
    const start = num(startingInvestment);
    const yieldPct = num(dividendYield);
    if (
      start === null ||
      yieldPct === null ||
      enteredDividendGrowth === null ||
      enteredPriceGrowth === null ||
      enteredContribution === null ||
      yearsInvalid ||
      parsedYears === null
    ) {
      return null;
    }
    return computeDividendIncome({
      startingInvestment: start,
      dividendYieldPercent: yieldPct,
      dividendGrowthRatePercent: enteredDividendGrowth,
      priceGrowthRatePercent: enteredPriceGrowth,
      years: parsedYears,
      reinvestDividends: reinvest,
      annualContribution: enteredContribution,
      paymentFrequency,
    });
  }, [
    startingInvestment,
    dividendYield,
    enteredDividendGrowth,
    enteredPriceGrowth,
    enteredContribution,
    parsedYears,
    yearsInvalid,
    reinvest,
    paymentFrequency,
  ]);

  const blocker = (() => {
    if (result) return null;
    for (const [raw, name] of [
      [startingInvestment, 'starting investment'],
      [dividendYield, 'dividend yield'],
      [annualContribution, 'annual contribution'],
    ] as const) {
      if (unreadable(raw)) return `The ${name} is not a number this page can read.`;
    }
    if (unreadable(dividendGrowth) || unreadable(priceGrowth)) {
      return 'One of the growth rate fields is not a number this page can read.';
    }
    if (yearsInvalid) return 'Enter a whole number of years, 1 or more.';
    return 'Enter a starting investment and a dividend yield to see a projection.';
  })();

  const rows = result?.rows ?? [];
  const periodLabel =
    paymentFrequency === 'monthly' ? 'month' : paymentFrequency === 'quarterly' ? 'quarter' : 'year';

  return (
    <section className="relative z-10 container mx-auto px-6 pt-14 pb-10 max-w-3xl">
      <h1 className="type-h1 mb-3">Dividend Income Calculator</h1>
      <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)] mb-8">
        Enter a starting investment, a dividend yield, and how you expect the dividend and the share price to grow.
        This projects the dividend income and portfolio value for every year, with or without reinvestment, up to{' '}
        {MAX_YEARS} years out. Free, no signup.
      </p>

      {/* The limit, stated before any number is shown. */}
      <div className="mb-8 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-gold)] mb-1.5">
          What this assumes
        </p>
        <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
          <strong className="text-[var(--color-text-primary)]">Illustrative only, not a forecast.</strong> The
          dividend yield, the dividend growth rate, the price growth rate, and the contribution are held constant
          for every year, which no real holding does. No taxes are modeled: qualified dividend tax is a separate
          step, covered in the{' '}
          <Link href="/blog/qualified-vs-ordinary-dividends" className="text-[var(--color-gold)] hover:underline">
            qualified vs ordinary dividends post
          </Link>
          . Not investment or tax advice.
        </p>
      </div>

      {/* ── Inputs ── */}
      <h2 className="type-h2 mb-3">Your projection</h2>
      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <label className="block">
          <span className={LABEL}>Starting investment ($)</span>
          <input
            type="text"
            inputMode="decimal"
            value={startingInvestment}
            onChange={(e) => setStartingInvestment(e.target.value)}
            placeholder="50000"
            className={INPUT}
            aria-label="Starting investment, in dollars"
            aria-invalid={unreadable(startingInvestment)}
          />
          {unreadable(startingInvestment) && <span className={FIELD_ERROR}>{BAD_NUMBER}</span>}
        </label>
        <label className="block">
          <span className={LABEL}>Dividend yield (%)</span>
          <input
            type="text"
            inputMode="decimal"
            value={dividendYield}
            onChange={(e) => setDividendYield(e.target.value)}
            placeholder="3.5"
            className={INPUT}
            aria-label="Dividend yield, in percent"
            aria-invalid={unreadable(dividendYield)}
          />
          {unreadable(dividendYield) ? (
            <span className={FIELD_ERROR}>{BAD_PERCENT}</span>
          ) : (
            <span className="mt-1.5 block text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
              Current yield: the trailing dividend divided by today&rsquo;s value.
            </span>
          )}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        {(
          [
            ['Annual dividend growth rate (%)', dividendGrowth, setDividendGrowth, dividendGrowthSign, setDividendGrowthSign, 'div-growth'],
            ['Expected annual share price growth (%)', priceGrowth, setPriceGrowth, priceGrowthSign, setPriceGrowthSign, 'price-growth'],
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
                aria-label={`${label} amount`}
                aria-invalid={unreadable(raw)}
              />
              <select
                value={sign}
                onChange={(e) => setSign(e.target.value as Sign)}
                className={`${INPUT} w-auto`}
                aria-label={`${label}: increasing or decreasing`}
              >
                <option value="positive">Increasing</option>
                <option value="negative">Decreasing</option>
              </select>
            </div>
            {unreadable(raw) && <span className={FIELD_ERROR}>{BAD_PERCENT}</span>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <label className="block">
          <span className={LABEL}>Years to project (1 to {MAX_YEARS})</span>
          <input
            type="text"
            inputMode="numeric"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            placeholder="20"
            className={INPUT}
            aria-label="Years to project"
            aria-invalid={yearsInvalid}
          />
          {yearsInvalid && <span className={FIELD_ERROR}>Enter a whole number of years, 1 or more.</span>}
        </label>
        <label className="block">
          <span className={LABEL}>Annual contribution ($)</span>
          <input
            type="text"
            inputMode="decimal"
            value={annualContribution}
            onChange={(e) => setAnnualContribution(e.target.value)}
            placeholder="0"
            className={INPUT}
            aria-label="Annual contribution, in dollars"
            aria-invalid={unreadable(annualContribution)}
          />
          {unreadable(annualContribution) && <span className={FIELD_ERROR}>{BAD_NUMBER}</span>}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-10">
        <label className="block">
          <span className={LABEL}>Reinvest dividends</span>
          <select
            value={reinvest ? 'yes' : 'no'}
            onChange={(e) => setReinvest(e.target.value === 'yes')}
            className={INPUT}
            aria-label="Reinvest dividends"
          >
            <option value="yes">Yes, reinvest</option>
            <option value="no">No, pay out</option>
          </select>
        </label>
        <label className="block">
          <span className={LABEL}>Payment frequency</span>
          <select
            value={paymentFrequency}
            onChange={(e) => setPaymentFrequency(e.target.value as PaymentFrequency)}
            className={INPUT}
            aria-label="Payment frequency"
          >
            {PAYMENT_FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ── Result ── */}
      {!result ? (
        <p className="mb-10 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{blocker}</p>
      ) : (
        <>
          <h2 className="type-h2 mb-3">
            Projected income after {result.rows.length} year{result.rows.length === 1 ? '' : 's'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>Year 1 dividend income</p>
              <p className="font-mono text-2xl text-[var(--color-text-primary)]">{money(result.year1Income)}</p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>Final-year dividend income</p>
              <p className="font-mono text-2xl text-[var(--color-gold)]">{money(result.finalYearIncome)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                {money(result.perPeriodIncomeAtEnd)} per {periodLabel} by year {result.rows.length}.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>Ending portfolio value</p>
              <p className="font-mono text-2xl text-[var(--color-text-primary)]">{money(result.finalPortfolioValue)}</p>
            </div>
          </div>

          {result.cappedYears && (
            <p className="mb-4 text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
              This projects {MAX_YEARS} years, the most this page will run, rather than the number entered.
            </p>
          )}

          {/* Where the ending value came from. */}
          <h2 className="type-h2 mb-1.5">Where the ending value came from</h2>
          <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
            {reinvest
              ? 'Split between what was put in, what price growth added on top of that, and what reinvested dividends and their own growth contributed.'
              : 'With dividends paid out rather than reinvested, the ending value is only contributions plus price growth. Dividends paid out are shown separately.'}
          </p>
          <div className="mb-10 overflow-x-auto rounded-xl border border-[var(--color-border-base)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-base)] bg-[var(--color-surface-tint)]">
                  <th className={TH}>Source</th>
                  <th className={`${TH} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--color-border-base)]">
                  <td className={`${TD} text-[var(--color-text-primary)]`}>Contributed</td>
                  <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{money(result.totalContributed)}</td>
                </tr>
                <tr className="border-b border-[var(--color-border-base)]">
                  <td className={`${TD} text-[var(--color-text-primary)]`}>From price growth</td>
                  <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{money(result.totalFromGrowth)}</td>
                </tr>
                <tr className="border-b border-[var(--color-border-base)]">
                  <td className={`${TD} text-[var(--color-text-primary)]`}>
                    {reinvest ? 'From reinvested dividends' : 'Dividends paid out (not in the value above)'}
                  </td>
                  <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{money(result.totalFromDividends)}</td>
                </tr>
                <tr className="bg-[var(--color-surface-tint)]">
                  <td className={`${TD} text-[var(--color-text-primary)]`}>Ending portfolio value</td>
                  <td className={`${TD} text-right text-[var(--color-gold)]`}>{money(result.finalPortfolioValue)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Year by year. */}
          <h2 className="type-h2 mb-1.5">Year by year</h2>
          <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
            Cumulative dividends are every dollar of dividend income earned to date, whether or not it was
            reinvested. The last column is the share of that year&rsquo;s ending value that would not exist without
            reinvestment.
          </p>
          <div className="mb-10 max-h-[480px] overflow-y-auto overflow-x-auto rounded-xl border border-[var(--color-border-base)]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0">
                <tr className="border-b border-[var(--color-border-base)] bg-[var(--color-surface-tint)]">
                  <th className={TH}>Year</th>
                  <th className={`${TH} text-right`}>Portfolio value</th>
                  <th className={`${TH} text-right`}>Dividend income</th>
                  <th className={`${TH} text-right`}>Cumulative dividends</th>
                  <th className={`${TH} text-right`}>From reinvestment</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.year} className="border-b border-[var(--color-border-base)] last:border-0">
                    <td className={`${TD} text-[var(--color-text-primary)]`}>{row.year}</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{whole(row.portfolioValue)}</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{money(row.annualDividendIncome)}</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{money(row.cumulativeDividends)}</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>
                      {pct(row.shareOfValueFromReinvestedDividends)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Disclaimer, matching the register used elsewhere in the tax and planning surfaces. */}
      <div className="mb-12 flex items-start gap-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
        <Shield className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Illustrative only, not a forecast, and not investment or tax advice. The dividend yield, dividend growth
          rate, price growth rate, and contribution are held constant for every year, which no real holding does.
          Fees, taxes, dividend cuts, and market volatility are not modeled. Qualified dividend tax is a separate
          calculation from what this page projects. Past performance of any real security is not a guarantee of
          the yields or growth rates entered here.
        </span>
      </div>

      {/* One CTA */}
      <div className="rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-6">
        <h2 className="type-h2 mb-2">The part a projection cannot do</h2>
        <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
          This page projects one hypothetical holding from assumptions typed in. The harder question is what your
          actual dividend income looks like today, across every account, and which of your positions are
          concentrated in the yield they pay. Helm reads the holdings in the accounts you connect, read-only, and
          shows the real income your book produces. It cannot see accounts you have not connected.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 font-mono text-[13px] text-[var(--color-gold)] hover:underline"
        >
          See your own dividend income <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
