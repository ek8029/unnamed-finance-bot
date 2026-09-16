'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Shield } from 'lucide-react';
import {
  simulateRetirement,
  parseAmount,
  DEFAULT_NOMINAL_RETURN,
  DEFAULT_VOLATILITY,
  DEFAULT_INFLATION,
  DEFAULT_SIMULATIONS,
  DEFAULT_SEED,
  BAND_STEP,
} from '@/lib/monte-carlo-retirement';

const whole = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const pct = (rate: number, digits = 1) =>
  `${(rate * 100).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

// The reader-facing parser lives in lib/wash-sale.ts so it can be tested.
const num = parseAmount;

/** Typed something, and it is not a number this page will use. */
const unreadable = (raw: string) => raw.trim() !== '' && num(raw) === null;

/** A whole number of years, or null. */
const years = (raw: string): number | null => {
  const n = num(raw);
  return n === null || !Number.isInteger(n) ? null : n;
};

/** A percentage typed as "8.41", returned as 0.0841. */
const rate = (raw: string): number | null => {
  const n = num(raw);
  return n === null ? null : n / 100;
};

const FIELD_ERROR = 'mt-1.5 block text-[12.5px] text-[var(--color-negative)]';
const HINT = 'mt-1.5 block text-[12.5px] leading-relaxed text-[var(--color-text-muted)]';
const BAD_NUMBER = 'Enter a number, like 4200 or 4,200.50.';
const BAD_YEARS = 'Enter a whole number of years.';

const LABEL =
  'block font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2';
const INPUT =
  'w-full min-h-[44px] rounded-lg border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] px-3 py-2.5 font-mono text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-gold)] focus:outline-none transition-colors';
const TH =
  'px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]';
const TD = 'px-4 py-3 font-mono';

const SIMULATION_CHOICES = [1_000, 2_000, 5_000, 10_000];

const PERCENTILE_ROWS = [
  ['p10', '10th percentile'],
  ['p25', '25th percentile'],
  ['p50', 'Median'],
  ['p75', '75th percentile'],
  ['p90', '90th percentile'],
] as const;

export function MonteCarloTool() {
  const [startingBalance, setStartingBalance] = useState('500000');
  const [annualContribution, setAnnualContribution] = useState('20000');
  const [yearsUntilRetirement, setYearsUntilRetirement] = useState('15');
  const [yearsInRetirement, setYearsInRetirement] = useState('30');
  const [annualWithdrawal, setAnnualWithdrawal] = useState('60000');
  const [inflation, setInflation] = useState((DEFAULT_INFLATION * 100).toString());
  const [nominalReturn, setNominalReturn] = useState((DEFAULT_NOMINAL_RETURN * 100).toString());
  const [volatility, setVolatility] = useState((DEFAULT_VOLATILITY * 100).toString());
  const [simulations, setSimulations] = useState(DEFAULT_SIMULATIONS);

  const result = useMemo(() => {
    const balance = num(startingBalance);
    const contribution = annualContribution.trim() === '' ? 0 : num(annualContribution);
    const untilRetirement = years(yearsUntilRetirement);
    const inRetirement = years(yearsInRetirement);
    const withdrawal = annualWithdrawal.trim() === '' ? 0 : num(annualWithdrawal);
    const infl = rate(inflation);
    const ret = rate(nominalReturn);
    const vol = rate(volatility);
    if (
      balance === null || contribution === null || untilRetirement === null || inRetirement === null ||
      withdrawal === null || infl === null || ret === null || vol === null
    ) {
      return null;
    }
    return simulateRetirement({
      startingBalance: balance,
      annualContribution: contribution,
      yearsUntilRetirement: untilRetirement,
      yearsInRetirement: inRetirement,
      annualWithdrawal: withdrawal,
      inflationRate: infl,
      nominalReturn: ret,
      volatility: vol,
      simulations,
      seed: DEFAULT_SEED,
    });
  }, [
    startingBalance, annualContribution, yearsUntilRetirement, yearsInRetirement,
    annualWithdrawal, inflation, nominalReturn, volatility, simulations,
  ]);

  const blocker = (() => {
    if (result) return null;
    for (const [raw, name] of [
      [startingBalance, 'starting balance'],
      [annualContribution, 'annual contribution'],
      [annualWithdrawal, 'annual withdrawal'],
      [inflation, 'inflation rate'],
      [nominalReturn, 'expected return'],
      [volatility, 'volatility'],
    ] as const) {
      if (unreadable(raw)) return `The ${name} is not a number this page can read.`;
    }
    if (years(yearsUntilRetirement) === null) return 'Years until retirement must be a whole number from 0 to 100.';
    if (years(yearsInRetirement) === null) return 'Years in retirement must be a whole number from 1 to 100.';
    if ((years(yearsInRetirement) ?? 1) < 1) return 'Years in retirement must be at least 1.';
    if ((years(yearsUntilRetirement) ?? 0) > 100 || (years(yearsInRetirement) ?? 0) > 100) {
      return 'This page runs at most 100 years in each phase.';
    }
    if ((rate(nominalReturn) ?? 0) > 1) return 'The expected return must be 100 percent or less.';
    if ((rate(volatility) ?? 0) > 2) return 'The volatility must be 200 percent or less.';
    return 'Enter a starting balance to see a figure.';
  })();

  const untilRetirement = years(yearsUntilRetirement) ?? 0;

  return (
    <section className="relative z-10 container mx-auto px-6 pt-14 pb-10 max-w-3xl">
      <h1 className="type-h1 mb-3">Monte Carlo Retirement Calculator</h1>
      <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)] mb-8">
        Enter a starting balance, what you add each year until retirement, and what you plan to withdraw each
        year after. This runs {simulations.toLocaleString('en-US')} simulated paths, each with its own sequence of
        annual returns drawn from a lognormal distribution with the mean and standard deviation you set, and
        reports how many paths never ran out of money, with the spread of balances along the way. Free, no signup.
      </p>

      {/* The limit, stated before any number is shown. */}
      <div className="mb-8 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-gold)] mb-1.5">
          What this assumes
        </p>
        <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
          <strong className="text-[var(--color-text-primary)]">One return per year, independent of every other year,</strong>{' '}
          drawn from a lognormal distribution. No fees, no taxes, no Social Security or other income. Inflation is
          constant at the rate you enter, and the withdrawal you type is in today&rsquo;s dollars, so it is already
          larger by the time retirement starts and keeps growing every year. Contributions land at the end of each
          accumulation year; withdrawals come out at the start of each retirement year. A balance that reaches
          zero stays at zero. The paths are seeded, so the same inputs always print the same numbers. Illustrative
          only, not a forecast, not advice.
        </p>
      </div>

      {/* ── Inputs ── */}
      <h2 className="type-h2 mb-3">Your plan</h2>
      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <label className="block">
          <span className={LABEL}>Starting balance ($)</span>
          <input
            type="text"
            inputMode="decimal"
            value={startingBalance}
            onChange={(e) => setStartingBalance(e.target.value)}
            placeholder="500000"
            className={INPUT}
            aria-label="Starting balance in dollars"
            aria-invalid={unreadable(startingBalance)}
          />
          {unreadable(startingBalance) ? (
            <span className={FIELD_ERROR}>{BAD_NUMBER}</span>
          ) : (
            <span className={HINT}>Everything invested today, across every account.</span>
          )}
        </label>
        <label className="block">
          <span className={LABEL}>Annual contribution until retirement ($)</span>
          <input
            type="text"
            inputMode="decimal"
            value={annualContribution}
            onChange={(e) => setAnnualContribution(e.target.value)}
            placeholder="0"
            className={INPUT}
            aria-label="Annual contribution until retirement, in dollars"
            aria-invalid={unreadable(annualContribution)}
          />
          {unreadable(annualContribution) ? (
            <span className={FIELD_ERROR}>{BAD_NUMBER}</span>
          ) : (
            <span className={HINT}>Added at the end of each year. Stops at retirement.</span>
          )}
        </label>
        <label className="block">
          <span className={LABEL}>Years until retirement</span>
          <input
            type="text"
            inputMode="numeric"
            value={yearsUntilRetirement}
            onChange={(e) => setYearsUntilRetirement(e.target.value)}
            placeholder="15"
            className={INPUT}
            aria-label="Years until retirement"
            aria-invalid={yearsUntilRetirement.trim() !== '' && years(yearsUntilRetirement) === null}
          />
          {yearsUntilRetirement.trim() !== '' && years(yearsUntilRetirement) === null ? (
            <span className={FIELD_ERROR}>{BAD_YEARS}</span>
          ) : (
            <span className={HINT}>Zero means withdrawals start now.</span>
          )}
        </label>
        <label className="block">
          <span className={LABEL}>Years in retirement</span>
          <input
            type="text"
            inputMode="numeric"
            value={yearsInRetirement}
            onChange={(e) => setYearsInRetirement(e.target.value)}
            placeholder="30"
            className={INPUT}
            aria-label="Years in retirement"
            aria-invalid={yearsInRetirement.trim() !== '' && years(yearsInRetirement) === null}
          />
          {yearsInRetirement.trim() !== '' && years(yearsInRetirement) === null ? (
            <span className={FIELD_ERROR}>{BAD_YEARS}</span>
          ) : (
            <span className={HINT}>How many years the balance has to last.</span>
          )}
        </label>
        <label className="block">
          <span className={LABEL}>Annual withdrawal in retirement, today&rsquo;s dollars ($)</span>
          <input
            type="text"
            inputMode="decimal"
            value={annualWithdrawal}
            onChange={(e) => setAnnualWithdrawal(e.target.value)}
            placeholder="60000"
            className={INPUT}
            aria-label="Annual withdrawal in retirement, in today's dollars"
            aria-invalid={unreadable(annualWithdrawal)}
          />
          {unreadable(annualWithdrawal) ? (
            <span className={FIELD_ERROR}>{BAD_NUMBER}</span>
          ) : (
            <span className={HINT}>Inflated every year from today, then taken at the start of each retirement year.</span>
          )}
        </label>
        <label className="block">
          <span className={LABEL}>Inflation rate (% per year)</span>
          <input
            type="text"
            inputMode="decimal"
            value={inflation}
            onChange={(e) => setInflation(e.target.value)}
            placeholder="2"
            className={INPUT}
            aria-label="Inflation rate, percent per year"
            aria-invalid={unreadable(inflation)}
          />
          {unreadable(inflation) ? (
            <span className={FIELD_ERROR}>{BAD_NUMBER}</span>
          ) : (
            <span className={HINT}>Default is the Federal Reserve&rsquo;s stated 2 percent objective.</span>
          )}
        </label>
      </div>

      <h2 className="type-h2 mb-3">The return distribution</h2>
      <div className="grid gap-4 sm:grid-cols-3 mb-10">
        <label className="block">
          <span className={LABEL}>Expected nominal return (% per year)</span>
          <input
            type="text"
            inputMode="decimal"
            value={nominalReturn}
            onChange={(e) => setNominalReturn(e.target.value)}
            placeholder="8.41"
            className={INPUT}
            aria-label="Expected nominal annual return, percent"
            aria-invalid={unreadable(nominalReturn)}
          />
          {unreadable(nominalReturn) ? (
            <span className={FIELD_ERROR}>{BAD_NUMBER}</span>
          ) : (
            <span className={HINT}>
              Arithmetic mean, before inflation. Default is IVV&rsquo;s average annual return since May 2000.
            </span>
          )}
        </label>
        <label className="block">
          <span className={LABEL}>Volatility (% standard deviation)</span>
          <input
            type="text"
            inputMode="decimal"
            value={volatility}
            onChange={(e) => setVolatility(e.target.value)}
            placeholder="12.94"
            className={INPUT}
            aria-label="Standard deviation of the annual return, percent"
            aria-invalid={unreadable(volatility)}
          />
          {unreadable(volatility) ? (
            <span className={FIELD_ERROR}>{BAD_NUMBER}</span>
          ) : (
            <span className={HINT}>
              Of the annual return. Default is IVV&rsquo;s three-year figure, a calm window; longer histories run higher.
            </span>
          )}
        </label>
        <label className="block">
          <span className={LABEL}>Simulated paths</span>
          <select
            value={simulations}
            onChange={(e) => setSimulations(Number(e.target.value))}
            className={INPUT}
            aria-label="Number of simulated paths"
          >
            {SIMULATION_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString('en-US')}
              </option>
            ))}
          </select>
          <span className={HINT}>More paths, steadier percentiles. Capped at 10,000.</span>
        </label>
      </div>

      {/* ── Result ── */}
      {!result ? (
        <p className="mb-10 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{blocker}</p>
      ) : (
        <>
          <h2 className="type-h2 mb-3">
            {result.simulations.toLocaleString('en-US')} paths over {result.totalYears} years
          </h2>

          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>Success rate</p>
              <p className="font-mono text-2xl text-[var(--color-gold)]">{pct(result.successRate)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                {result.failedPaths === 0
                  ? 'Every path kept a positive balance through the last year.'
                  : `${(result.simulations - result.failedPaths).toLocaleString('en-US')} of ${result.simulations.toLocaleString('en-US')} paths never reached zero. Among the ${result.failedPaths.toLocaleString('en-US')} that did, the median ran out in year ${result.medianDepletionYear}${untilRetirement > 0 ? `, ${Math.round((result.medianDepletionYear ?? 0) - untilRetirement)} years into retirement` : ''}.`}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>Median balance at retirement</p>
              <p className="font-mono text-2xl text-[var(--color-text-primary)]">{whole(result.atRetirement.p50)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                {untilRetirement === 0
                  ? 'Retirement starts now, so this is the starting balance.'
                  : `After ${untilRetirement} years of returns and contributions. Half the paths finished above this, half below.`}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>First-year withdrawal</p>
              <p className="font-mono text-2xl text-[var(--color-text-primary)]">{whole(result.firstWithdrawal)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                {untilRetirement === 0
                  ? `Taken at the start of the first year. It grows with inflation to ${whole(result.lastWithdrawal)} in the last year.`
                  : `Today's withdrawal after ${untilRetirement} years of inflation. It reaches ${whole(result.lastWithdrawal)} in the last year.`}
              </p>
            </div>
          </div>

          {/* Percentiles at the two boundaries. */}
          <h2 className="type-h2 mb-1.5">Where the balance lands</h2>
          <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
            Each row is a rank across the {result.simulations.toLocaleString('en-US')} paths, in nominal dollars. The
            10th percentile is the balance that nine paths in ten finished above; the 90th is the one that only one
            in ten exceeded. A zero at the end means that rank of path ran out of money.
          </p>
          <div className="mb-4 overflow-x-auto rounded-xl border border-[var(--color-border-base)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-base)] bg-[var(--color-surface-tint)]">
                  <th className={TH}>Rank</th>
                  <th className={`${TH} text-right`}>At retirement (year {untilRetirement})</th>
                  <th className={`${TH} text-right`}>At the end (year {result.totalYears})</th>
                </tr>
              </thead>
              <tbody>
                {PERCENTILE_ROWS.map(([key, label]) => (
                  <tr key={key} className="border-b border-[var(--color-border-base)] last:border-0">
                    <td className={`${TD} text-[var(--color-text-primary)]`}>{label}</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{whole(result.atRetirement[key])}</td>
                    <td className={`${TD} text-right ${result.atEnd[key] === 0 ? 'text-[var(--color-negative)]' : 'text-[var(--color-text-primary)]'}`}>
                      {whole(result.atEnd[key])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Every five years. */}
          <h2 className="type-h2 mb-1.5">The band, every {BAND_STEP} years</h2>
          <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
            Year-end balances at the 10th, 50th and 90th percentile, plus the retirement boundary and the final
            year. The band widens over time because each year&rsquo;s return compounds on the last.
          </p>
          <div className="mb-4 overflow-x-auto rounded-xl border border-[var(--color-border-base)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-base)] bg-[var(--color-surface-tint)]">
                  <th className={TH}>Year</th>
                  <th className={TH}>Phase</th>
                  <th className={`${TH} text-right`}>10th</th>
                  <th className={`${TH} text-right`}>Median</th>
                  <th className={`${TH} text-right`}>90th</th>
                </tr>
              </thead>
              <tbody>
                {result.band.map((row) => (
                  <tr key={row.year} className="border-b border-[var(--color-border-base)] last:border-0">
                    <td className={`${TD} text-[var(--color-text-primary)]`}>{row.year}</td>
                    <td className={`${TD} text-[var(--color-text-secondary)]`}>
                      {row.phase === 'start' ? 'Today' : row.phase === 'accumulation' ? 'Saving' : 'Retired'}
                    </td>
                    <td className={`${TD} text-right ${row.p10 === 0 && row.year > 0 ? 'text-[var(--color-negative)]' : 'text-[var(--color-text-secondary)]'}`}>
                      {whole(row.p10)}
                    </td>
                    <td className={`${TD} text-right text-[var(--color-text-primary)]`}>{whole(row.p50)}</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{whole(row.p90)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Disclaimer, matching the register used elsewhere in the tool pages. */}
      <div className="mb-12 flex items-start gap-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
        <Shield className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Illustrative only. This is not a forecast of any market, account or outcome, and not investment,
          retirement or tax advice. Helm Terminal is not a registered investment adviser. The paths are random
          draws from a distribution you chose, with no fees, taxes, other income, fat tails or dependence between
          years, and the success rate is the share of those paths that stayed above zero, nothing more. The
          default return and volatility are one index fund&rsquo;s published figures and are not a prediction.
        </span>
      </div>

      {/* One CTA */}
      <div className="rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-6">
        <h2 className="type-h2 mb-2">The part a simulation cannot do</h2>
        <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
          This page draws returns for a single balance. It does not know what that balance is made of, how
          concentrated it is, or what its own volatility has been. Helm reads the holdings in the accounts you
          connect, read-only, and shows the exposure across all of them: what each position is, what share of the
          whole it carries, and what moved it. It cannot see accounts you have not connected.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 font-mono text-[13px] text-[var(--color-gold)] hover:underline"
        >
          See your own book <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
