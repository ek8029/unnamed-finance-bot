'use client';
import { parseResearchTicker } from '@/lib/research-ticker';

import { SiteNav } from '@/components/site-nav';
import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { ArrowRight, Shield, ChevronRight, AlertTriangle } from 'lucide-react';

/* ── Types ── */

interface VestEvent {
  date: Date;
  shares: number;
  preTax: number;
  estTax: number;
  postTax: number;
}

/* ── Constants ── */

const TAX_BRACKETS = [
  { label: '22%', rate: 0.22 },
  { label: '24%', rate: 0.24 },
  { label: '32%', rate: 0.32 },
  { label: '35%', rate: 0.35 },
  { label: '37%', rate: 0.37 },
];

const SCHEDULES = [
  { label: '4-year with 1-year cliff (standard)', value: '4y-cliff' },
  { label: '4-year quarterly', value: '4y-quarterly' },
  { label: '3-year monthly', value: '3y-monthly' },
  { label: 'Custom', value: 'custom' },
] as const;

type ScheduleValue = (typeof SCHEDULES)[number]['value'];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'How are RSUs taxed?',
    a: 'RSUs are taxed as ordinary income when they vest, not when they are granted. The amount included in income is the fair market value of the shares on the vesting date, added to wages on Form W-2. There is no way to defer this income to a later year by choice; the vesting date set in the grant agreement controls the timing.',
  },
  {
    q: 'What is the RSU tax rate?',
    a: 'There is no separate RSU tax rate. Vested RSU income is taxed at the same federal ordinary income rates as salary, based on total taxable income for the year, with a top marginal rate of 37 percent. Employers generally withhold at a flat 22 percent supplemental wage rate, which can be lower than the marginal rate actually owed. State income tax, where it applies, is added on top.',
  },
  {
    q: 'How much tax is withheld when RSUs vest?',
    a: 'Employers withhold federal income tax on RSU income as a supplemental wage: a flat 22 percent on supplemental wages up to $1,000,000 for the calendar year, and 37 percent on the amount above that threshold. This withholding rate does not adjust for an individual employee’s actual marginal bracket, so it can end up lower or higher than the tax truly owed on the income.',
  },
  {
    q: 'What is the cost basis of RSUs?',
    a: 'The cost basis of vested RSU shares is the fair market value that was already included in ordinary income at vesting. Any later increase or decrease in price between the vesting date and the sale date is a separate capital gain or loss, not additional ordinary income.',
  },
  {
    q: 'Are RSUs taxed twice?',
    a: 'No, but the two-part structure can look that way. The value at vesting is taxed once, as ordinary income; the change in value after vesting, if any, is taxed separately as a capital gain or loss when the shares are eventually sold. Because the vesting-date value becomes the cost basis, that same dollar amount is not taxed again at sale.',
  },
  {
    q: 'What happens if you sell RSUs immediately after they vest?',
    a: 'Selling at or near the vesting-date price typically produces little or no additional capital gain or loss, since the cost basis equals the price used to calculate the ordinary income at vest. The ordinary income tax on the vesting itself still applies whether the shares are sold or held. Any gain or loss from a near-immediate sale would be short-term, since the holding period only begins at vesting.',
  },
];

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtShares(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/* ── Vest schedule generation ── */

function generateVestEvents(
  totalShares: number,
  schedule: ScheduleValue,
  grantDate: Date,
  price: number,
  taxRate: number,
  customMonths?: number,
  customFrequency?: number
): VestEvent[] {
  const events: VestEvent[] = [];

  if (schedule === '4y-cliff') {
    // 25% at 1-year cliff, then 1/48 per month for remaining 36 months
    const cliffShares = Math.floor(totalShares * 0.25);
    const cliffDate = addMonths(grantDate, 12);
    events.push(makeEvent(cliffDate, cliffShares, price, taxRate));

    const remaining = totalShares - cliffShares;
    const monthlyShares = Math.floor(remaining / 36);
    let distributed = 0;
    for (let m = 13; m <= 48; m++) {
      const isLast = m === 48;
      const shares = isLast ? remaining - distributed : monthlyShares;
      distributed += shares;
      events.push(makeEvent(addMonths(grantDate, m), shares, price, taxRate));
    }
  } else if (schedule === '4y-quarterly') {
    const vestCount = 16;
    const perVest = Math.floor(totalShares / vestCount);
    let distributed = 0;
    for (let q = 1; q <= vestCount; q++) {
      const isLast = q === vestCount;
      const shares = isLast ? totalShares - distributed : perVest;
      distributed += shares;
      events.push(makeEvent(addMonths(grantDate, q * 3), shares, price, taxRate));
    }
  } else if (schedule === '3y-monthly') {
    const vestCount = 36;
    const perVest = Math.floor(totalShares / vestCount);
    let distributed = 0;
    for (let m = 1; m <= vestCount; m++) {
      const isLast = m === vestCount;
      const shares = isLast ? totalShares - distributed : perVest;
      distributed += shares;
      events.push(makeEvent(addMonths(grantDate, m), shares, price, taxRate));
    }
  } else if (schedule === 'custom') {
    const months = customMonths || 48;
    const freq = customFrequency || 3;
    const vestCount = Math.floor(months / freq);
    if (vestCount <= 0) return events;
    const perVest = Math.floor(totalShares / vestCount);
    let distributed = 0;
    for (let i = 1; i <= vestCount; i++) {
      const isLast = i === vestCount;
      const shares = isLast ? totalShares - distributed : perVest;
      distributed += shares;
      events.push(makeEvent(addMonths(grantDate, i * freq), shares, price, taxRate));
    }
  }

  return events;
}

function makeEvent(date: Date, shares: number, price: number, taxRate: number): VestEvent {
  const preTax = shares * price;
  const estTax = preTax * taxRate;
  return { date, shares, preTax, estTax, postTax: preTax - estTax };
}

/* ── Main ── */

export default function RSUCalculatorPage() {
  /* ── Form state ── */
  const [ticker, setTicker] = useState('');
  const [totalShares, setTotalShares] = useState('');
  const [schedule, setSchedule] = useState<ScheduleValue>('4y-cliff');
  const [grantDate, setGrantDate] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [priceOverride, setPriceOverride] = useState(false);
  const [bracketIdx, setBracketIdx] = useState(0); // 22% default
  const [portfolioValue, setPortfolioValue] = useState(250000);
  const [customMonths, setCustomMonths] = useState('48');
  const [customFrequency, setCustomFrequency] = useState('3');

  /* ── Price fetch state ── */
  const [fetchedPrice, setFetchedPrice] = useState<number | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [lastFetchedTicker, setLastFetchedTicker] = useState('');

  /* ── Results state ── */
  const [showResults, setShowResults] = useState(false);

  /* ── Fetch price when ticker changes ── */
  const fetchPrice = useCallback(async (sym: string) => {
    if (!sym || sym.length > 5) return;
    setFetchLoading(true);
    setFetchError('');
    try {
      const res = await fetch(`/api/market/ticker-data?symbol=${encodeURIComponent(sym)}`);
      if (!res.ok) {
        setFetchError('Ticker not found');
        setFetchedPrice(null);
        return;
      }
      const data = await res.json();
      if (data.quote?.c && data.quote.c > 0) {
        setFetchedPrice(data.quote.c);
        setLastFetchedTicker(sym);
        if (!priceOverride) {
          setPriceInput(data.quote.c.toFixed(2));
        }
      } else {
        setFetchError('No price data available');
        setFetchedPrice(null);
      }
    } catch {
      setFetchError('Failed to fetch price');
      setFetchedPrice(null);
    } finally {
      setFetchLoading(false);
    }
  }, [priceOverride]);

  useEffect(() => {
    const parsed = parseResearchTicker(ticker);
    if (!parsed.ok) { setFetchError(ticker.trim() ? parsed.message : ''); setFetchedPrice(null); return; }
    const sym = parsed.ticker;
    if (sym !== lastFetchedTicker) {
      const timeout = setTimeout(() => fetchPrice(sym), 600);
      return () => clearTimeout(timeout);
    }
  }, [ticker, fetchPrice, lastFetchedTicker]);

  /* ── Derived values ── */
  const sharesNum = Math.max(0, parseInt(totalShares.replace(/\D/g, ''), 10) || 0);
  const priceNum = Math.max(0, parseFloat(priceInput) || 0);
  const taxRate = TAX_BRACKETS[bracketIdx].rate;
  const grantDateObj = grantDate ? new Date(grantDate + 'T00:00:00') : null;

  const vestEvents = useMemo(() => {
    if (!grantDateObj || sharesNum <= 0 || priceNum <= 0) return [];
    return generateVestEvents(
      sharesNum,
      schedule,
      grantDateObj,
      priceNum,
      taxRate,
      schedule === 'custom' ? parseInt(customMonths, 10) || 48 : undefined,
      schedule === 'custom' ? parseInt(customFrequency, 10) || 3 : undefined
    );
  }, [sharesNum, schedule, grantDateObj, priceNum, taxRate, customMonths, customFrequency]);

  const totalGrantValue = sharesNum * priceNum;
  const totalTax = vestEvents.reduce((sum, e) => sum + e.estTax, 0);
  const totalPostTax = vestEvents.reduce((sum, e) => sum + e.postTax, 0);
  const concentrationPct = portfolioValue > 0 ? (totalGrantValue / portfolioValue) * 100 : 0;

  const canCalculate = sharesNum > 0 && priceNum > 0 && grantDateObj !== null && (priceOverride || (fetchedPrice !== null && lastFetchedTicker === ticker.trim().toUpperCase()));

  const handleCalculate = () => {
    if (!canCalculate) return;
    setShowResults(true);
    setTimeout(() => {
      document.getElementById('rsu-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: 'How to Calculate RSU Tax Impact',
            description: 'Use the Helm Terminal RSU calculator to estimate your tax liability, vesting schedule, and post-tax take-home for restricted stock units.',
            tool: { '@type': 'HowToTool', name: 'Helm Terminal Calculator' },
            step: [
              {
                '@type': 'HowToStep',
                name: 'Enter your RSU grant details',
                text: 'Input the total number of RSUs granted, your company ticker symbol, and the current stock price (auto-fetched if ticker provided).',
              },
              {
                '@type': 'HowToStep',
                name: 'Select your vesting schedule',
                text: 'Choose from standard 4-year with 1-year cliff, 4-year quarterly, 3-year monthly, or enter a custom schedule.',
              },
              {
                '@type': 'HowToStep',
                name: 'Choose your tax bracket',
                text: 'Select your federal income tax bracket (22%–37%). RSUs are taxed as ordinary income at vesting.',
              },
              {
                '@type': 'HowToStep',
                name: 'Review your vesting timeline and tax estimates',
                text: 'See each vest date with pre-tax value, estimated tax withholding, and post-tax take-home amount. Review concentration risk if RSUs exceed 10% of net worth.',
              },
            ],
          }),
        }}
      />
      <title>RSU Tax Calculator: Vesting and Take-Home | Helm Terminal</title>
      <meta name="description" content="Free RSU vesting calculator. Estimate your RSU tax liability across vesting schedules, model concentration risk, and see your post-tax take-home at each vest date." />
      <link rel="canonical" href="https://helmterminal.dev/tools/rsu-calculator" />
      <meta property="og:title" content="RSU Tax Calculator: Vesting and Take-Home | Helm Terminal" />
      <meta property="og:description" content="Estimate RSU taxes, vesting schedules, and concentration risk. Free calculator for engineers and founders." />
      <meta property="og:url" content="https://helmterminal.dev/tools/rsu-calculator" />
      <meta property="og:site_name" content="Helm Terminal" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="RSU Tax Calculator: Vesting and Take-Home | Helm Terminal" />
      <meta name="twitter:description" content="Estimate RSU taxes, vesting schedules, and concentration risk. Free, no signup required." />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'RSU Tax Calculator',
            description: 'Free calculator to estimate RSU tax liability, vesting timeline, and concentration risk.',
            url: 'https://helmterminal.dev/tools/rsu-calculator',
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            creator: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />

      {/* Nav */}
      <SiteNav />

      <div className="relative z-10 min-h-[80vh]">
        <section className="relative container mx-auto px-6 pt-16 pb-20 max-w-xl">

          {/* Header */}
          <div className="mb-12">
            <div className="type-eyebrow text-[var(--color-gold)] mb-4">Free tool</div>
            <h1 className="font-sans mb-3">
              RSU Tax <span className="text-[var(--color-gold)]">Calculator</span>
            </h1>
            <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed">
              What are your RSUs actually worth after taxes?
            </p>
          </div>

          {/* ── Inputs ── */}
          {!showResults && (
            <div>
              <div className="space-y-8 mb-8">
                {/* Ticker */}
                <div>
                  <label className="block text-[15px] font-medium text-[var(--color-text-primary)] mb-2">Company ticker</label>
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase();
                      setTicker(v);
                      if (v !== lastFetchedTicker) {
                        setFetchedPrice(null);
                      }
                    }}
                    placeholder="AAPL"
                    className="w-full px-4 py-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors font-mono text-2xl uppercase"
                  />
                  <div className="flex items-center gap-2 mt-1.5">
                    {fetchLoading && (
                      <span className="text-[13px] text-[var(--color-text-muted)]">Fetching price...</span>
                    )}
                    {!fetchLoading && fetchedPrice !== null && !priceOverride && (
                      <span className="text-[13px] text-[var(--color-text-muted)]">
                        Live: <span className="font-mono text-[var(--color-text-primary)]">${fetchedPrice.toFixed(2)}</span>
                      </span>
                    )}
                    {fetchError && (
                      <span className="text-[13px] text-[var(--color-negative-text)]">{fetchError}</span>
                    )}
                  </div>
                </div>

                {/* Total RSU grant */}
                <div>
                  <label className="block text-[15px] font-medium text-[var(--color-text-primary)] mb-2">Total RSU grant</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={totalShares ? Number(totalShares).toLocaleString('en-US') : ''}
                    onChange={(e) => setTotalShares(e.target.value.replace(/\D/g, ''))}
                    placeholder="1,000"
                    className="w-full px-4 py-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors font-mono text-2xl"
                  />
                  <p className="text-[13px] text-[var(--color-text-muted)] mt-1.5">Total number of shares in your RSU grant.</p>
                </div>

                {/* Vesting schedule */}
                <div>
                  <label className="block text-[15px] font-medium text-[var(--color-text-primary)] mb-2">Vesting schedule</label>
                  <select
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value as ScheduleValue)}
                    className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[15px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors cursor-pointer"
                  >
                    {SCHEDULES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Custom schedule fields */}
                {schedule === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[15px] font-medium text-[var(--color-text-secondary)] mb-2">Total months</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={customMonths}
                        onChange={(e) => setCustomMonths(e.target.value.replace(/\D/g, ''))}
                        placeholder="48"
                        className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[15px] font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[15px] font-medium text-[var(--color-text-secondary)] mb-2">Vest every N months</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={customFrequency}
                        onChange={(e) => setCustomFrequency(e.target.value.replace(/\D/g, ''))}
                        placeholder="3"
                        className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[15px] font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* Grant date */}
                <div>
                  <label className="block text-[15px] font-medium text-[var(--color-text-primary)] mb-2">Grant date</label>
                  <input
                    type="date"
                    value={grantDate}
                    onChange={(e) => setGrantDate(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[15px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors cursor-pointer"
                  />
                </div>

                {/* Stock price */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[15px] font-medium text-[var(--color-text-primary)]">Current stock price</label>
                    <button
                      onClick={() => {
                        setPriceOverride(!priceOverride);
                        if (priceOverride && fetchedPrice !== null) {
                          setPriceInput(fetchedPrice.toFixed(2));
                        }
                      }}
                      className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors cursor-pointer"
                    >
                      {priceOverride ? 'Use live price' : 'Override manually'}
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[var(--color-text-muted)] font-mono">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={priceInput}
                      onChange={(e) => {
                        setPriceInput(e.target.value.replace(/[^0-9.]/g, ''));
                        setPriceOverride(true);
                      }}
                      placeholder="150.00"
                      className="w-full pl-10 pr-4 py-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors font-mono text-2xl"
                    />
                  </div>
                  {!priceOverride && fetchedPrice !== null && (
                    <p className="text-[13px] text-[var(--color-text-muted)] mt-1.5">Auto-fetched from Finazon. Overriding locks the price.</p>
                  )}
                </div>

                {/* Tax bracket pills */}
                <div>
                  <div className="type-label text-[var(--color-text-secondary)] mb-3">Federal tax bracket</div>
                  <div className="flex flex-wrap gap-2">
                    {TAX_BRACKETS.map((b, i) => (
                      <button
                        key={i}
                        onClick={() => setBracketIdx(i)}
                        className={`px-4 py-2 rounded text-[15px] font-mono font-semibold transition-all duration-150 cursor-pointer border ${
                          i === bracketIdx
                            ? 'bg-[var(--color-gold)] border-[var(--color-gold)] text-[var(--color-bg-base)]'
                            : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-base)] text-[var(--color-text-muted)] hover:border-[var(--color-gold-border)] hover:text-[var(--color-text-secondary)]'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[13px] text-[var(--color-text-muted)] mt-2">RSU income is taxed as ordinary income at vest.</p>
                </div>
              </div>

              {/* Calculate button */}
              <button
                onClick={handleCalculate}
                disabled={!canCalculate}
                className="group w-full flex items-center justify-center gap-3 py-4 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all duration-200 hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
              >
                Calculate vesting schedule
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          )}

          {/* ── Results ── */}
          {showResults && (
            <div id="rsu-results">
              {/* Total grant value */}
              <div className="text-center py-12 mb-10">
                <div className="type-eyebrow text-[var(--color-text-muted)] mb-4">
                  Total grant value at current price
                </div>
                <div
                  className="text-4xl sm:text-6xl md:text-7xl font-sans text-[var(--color-gold)] leading-none"
                  style={{ fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}
                >
                  {fmt(totalGrantValue)}
                </div>
                <div className="text-[15px] text-[var(--color-text-muted)] mt-4">
                  {fmtShares(sharesNum)} shares {ticker ? `of ${ticker}` : ''} at ${priceNum.toFixed(2)}/share
                </div>
              </div>

              {/* Summary metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 mb-10">
                {[
                  { label: 'Post-Tax Value', value: fmt(totalPostTax) },
                  { label: 'Total Est. Tax', value: fmt(totalTax) },
                  { label: 'Effective Rate', value: `${(taxRate * 100).toFixed(0)}%` },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="text-center py-4 border-b border-[var(--color-border-subtle)] first:border-r last:border-l border-r-[var(--color-border-subtle)] border-l-[var(--color-border-subtle)]"
                  >
                    <div className="type-data-label mb-1.5">{m.label}</div>
                    <div className="type-data-sm text-[var(--color-text-primary)]">{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Concentration risk warning */}
              <div className="mb-8">
                <div className="type-data-label mb-4">
                  Concentration Risk
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[15px] text-[var(--color-text-secondary)]">Portfolio value for comparison</span>
                  <span className="text-[13px] font-mono text-[var(--color-text-muted)]">{fmt(portfolioValue)}</span>
                </div>
                <input
                  type="range"
                  min={50000}
                  max={2000000}
                  step={25000}
                  value={portfolioValue}
                  onChange={(e) => setPortfolioValue(Number(e.target.value))}
                  className="w-full accent-[var(--color-gold)] cursor-pointer h-1 mb-3"
                />
                <div className="flex items-center justify-between text-[13px] font-mono text-[var(--color-text-muted)]">
                  <span>$50K</span>
                  <span>$2M</span>
                </div>

                {concentrationPct > 10 && (
                  <div className="mt-4 flex items-start gap-3 sovereign-card rounded border-l-2 border-l-[var(--color-gold)] p-4">
                    <AlertTriangle className="w-4 h-4 text-[var(--color-gold)] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1">
                        {concentrationPct.toFixed(0)}% concentration in a single stock
                      </div>
                      <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">
                        A commonly cited guideline is keeping any single position under 10% of a portfolio.
                        At {fmt(portfolioValue)} portfolio value, your {ticker || 'RSU'} grant represents {concentrationPct.toFixed(1)}% of that total.
                      </p>
                    </div>
                  </div>
                )}

                {concentrationPct <= 10 && concentrationPct > 0 && (
                  <div className="mt-4 flex items-start gap-3 sovereign-card rounded p-4">
                    <div className="w-4 h-4 rounded-full bg-[var(--color-positive-muted)] flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-positive)]" />
                    </div>
                    <div className="text-[15px] text-[var(--color-text-muted)]">
                      {concentrationPct.toFixed(1)}% of portfolio, within typical concentration guidelines.
                    </div>
                  </div>
                )}
              </div>

              {/* Tax impact summary */}
              <div className="mb-8">
                <div className="type-data-label mb-4">Tax Impact Summary</div>
                <div className="space-y-3 text-[15px]">
                  <Row left="Total pre-tax grant value" right={fmt(totalGrantValue)} />
                  <Row left={`Federal tax at ${(taxRate * 100).toFixed(0)}%`} right={`-${fmt(totalTax)}`} rightColor="text-[var(--color-negative-text)]" />
                  <div className="h-px bg-[var(--color-border-subtle)]" />
                  <Row left="Estimated post-tax value" right={fmt(totalPostTax)} rightColor="text-[var(--color-gold)]" bold />
                  <Row left="Avg. tax per vest event" right={fmt(vestEvents.length > 0 ? totalTax / vestEvents.length : 0)} />
                </div>
              </div>

              {/* Vesting timeline table */}
              <div className="mb-10">
                <div className="type-data-label mb-4">
                  Vesting Timeline ({vestEvents.length} events)
                </div>
                <div className="overflow-x-auto sovereign-card rounded">
                  <table className="w-full text-[15px]">
                    <thead>
                      <tr className="border-b border-[var(--color-border-base)]">
                        <th className="text-left py-2.5 px-4 text-[13px] font-mono uppercase tracking-[0.1em] text-[var(--color-text-muted)] font-medium">Date</th>
                        <th className="text-right py-2.5 px-4 text-[13px] font-mono uppercase tracking-[0.1em] text-[var(--color-text-muted)] font-medium">Shares</th>
                        <th className="text-right py-2.5 px-4 text-[13px] font-mono uppercase tracking-[0.1em] text-[var(--color-text-muted)] font-medium">Pre-Tax</th>
                        <th className="text-right py-2.5 px-4 text-[13px] font-mono uppercase tracking-[0.1em] text-[var(--color-text-muted)] font-medium">Est. Tax</th>
                        <th className="text-right py-2.5 px-4 text-[13px] font-mono uppercase tracking-[0.1em] text-[var(--color-text-muted)] font-medium">Post-Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vestEvents.map((event, idx) => {
                        const isPast = event.date < new Date();
                        return (
                          <tr
                            key={idx}
                            className={`border-b border-[var(--color-border-subtle)] last:border-0 ${isPast ? 'opacity-50' : ''}`}
                          >
                            <td className="py-2.5 px-4 font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                              {fmtDate(event.date)}
                              {isPast && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">vested</span>}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-right text-[var(--color-text-primary)]">{fmtShares(event.shares)}</td>
                            <td className="py-2.5 px-4 font-mono text-right text-[var(--color-text-primary)]">{fmt(event.preTax)}</td>
                            <td className="py-2.5 px-4 font-mono text-right text-[var(--color-negative-text)]">-{fmt(event.estTax)}</td>
                            <td className="py-2.5 px-4 font-mono text-right text-[var(--color-positive)]">{fmt(event.postTax)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[var(--color-border-base)]">
                        <td className="py-3 px-4 font-semibold text-[var(--color-text-primary)]">Total</td>
                        <td className="py-3 px-4 font-mono text-right font-semibold text-[var(--color-text-primary)]">{fmtShares(sharesNum)}</td>
                        <td className="py-3 px-4 font-mono text-right font-semibold text-[var(--color-text-primary)]">{fmt(totalGrantValue)}</td>
                        <td className="py-3 px-4 font-mono text-right font-semibold text-[var(--color-negative-text)]">-{fmt(totalTax)}</td>
                        <td className="py-3 px-4 font-mono text-right font-semibold text-[var(--color-gold)]">{fmt(totalPostTax)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* CTAs */}
              <div className="space-y-3">
                <Link
                  href="/signup"
                  className="flex items-center justify-center gap-2.5 w-full py-4 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded hover:brightness-110 transition-all cursor-pointer"
                >
                  Track your actual RSU exposure alongside your full portfolio <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setShowResults(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 text-[15px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-base)] rounded transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Edit inputs
                </button>
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 text-[13px] text-[var(--color-text-muted)] leading-relaxed mt-8">
                <Shield className="w-3 h-3 shrink-0 mt-0.5" />
                <span>Estimates only. Does not account for state taxes, FICA, AMT, or stock price changes between now and vest dates. RSU income is taxed as ordinary income at the fair market value on the vesting date. Not tax or investment advice. Consult a qualified tax professional.</span>
              </div>
            </div>
          )}

        </section>
      </div>

      {/* SEO content */}
      <section className="relative z-10 container mx-auto px-6 pb-16 max-w-3xl">
        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <div>
            <h2 className="type-h2 mb-2.5">How RSUs are taxed at vesting</h2>
            <p>
              This describes the federal rules for individuals. It is not tax advice. Restricted stock units are
              not taxed when they are granted. Tax is triggered on each vesting date, when the shares actually
              become the employee&rsquo;s property. The amount included in income is the fair market value of the
              shares that vest, multiplied by the number of shares, and it is treated as ordinary income, the same
              as a cash bonus. That income is added to wages and reported on Form W-2 for the year of the vest, not
              the year of the grant. This is different from stock options, where the taxable event and its timing
              can depend on when the option is exercised. With RSUs, the grant date mostly matters for setting the
              vesting schedule; the tax clock does not start until shares actually vest.
            </p>
          </div>

          <div>
            <h2 className="type-h2 mb-2.5">Withholding at vesting</h2>
            <p>
              Employers withhold on RSU income using the IRS rules for supplemental wages, the same category that
              covers bonuses and commissions. Per{' '}
              <a
                href="https://www.irs.gov/publications/p15"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-gold)] hover:underline"
              >
                IRS Publication 15
              </a>
              , the flat federal withholding rate on supplemental wages is 22 percent. Once an employee&rsquo;s
              supplemental wages for the calendar year exceed $1,000,000, the withholding rate on the amount above
              that threshold rises to 37 percent. This is a payroll withholding rate, not a description of the
              employee&rsquo;s actual marginal tax bracket.
            </p>
          </div>

          <div>
            <h2 className="type-h2 mb-2.5">Why withholding is often short of the real bill</h2>
            <p>
              A flat 22 percent withholding rate can undershoot the actual tax owed once RSU income is stacked on
              top of salary. RSU income counts as ordinary wages, and federal ordinary rates rise well above 22
              percent for higher earners, up to a top marginal rate of{' '}
              <a
                href="https://www.irs.gov/publications/p15"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-gold)] hover:underline"
              >
                37 percent
              </a>
              . An employee whose marginal rate sits above 22 percent will typically have less withheld at vesting
              than the eventual tax on that income, which shows up as a balance due when the return is filed unless
              it is covered by other withholding or an estimated payment.
            </p>
          </div>

          <div>
            <h2 className="type-h2 mb-2.5">Sell-to-cover and shares withheld</h2>
            <p>
              Many employers cover the withholding obligation with a mechanism called sell-to-cover: a portion of
              the vesting shares, equal in value to the taxes due, is sold automatically on the vest date, and only
              the remaining shares are deposited into the employee&rsquo;s brokerage account. That sold portion
              typically appears as shares withheld for taxes on the vest confirmation or pay stub, separate from the
              total shares that vested. Some plans instead deliver all vested shares and require the employee to
              cover the withholding from other cash. Either way, the withholding shown on the vest confirmation is
              the same 22 or 37 percent supplemental rate described above, applied to the value of the shares that
              vested; it is a payroll mechanic, not a separate calculation of the tax actually owed.
            </p>
          </div>

          <div>
            <h2 className="type-h2 mb-2.5">Cost basis after vesting</h2>
            <p>
              Per{' '}
              <a
                href="https://www.irs.gov/publications/p525"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-gold)] hover:underline"
              >
                IRS Publication 525
              </a>
              , the fair market value that was included in ordinary income at vesting becomes the cost basis of the
              shares. Because that value was already taxed once as income, only the change in price between the
              vesting date and the eventual sale date is a capital gain or loss. A sale at exactly the vesting-date
              price produces no additional gain or loss; a sale above or below that price produces a gain or loss
              equal to the difference, multiplied by the number of shares sold.
            </p>
          </div>

          <div>
            <h2 className="type-h2 mb-2.5">Short-term versus long-term after vesting</h2>
            <p>
              The holding period for RSU shares starts on the vesting date, not the grant date. Per{' '}
              <a
                href="https://www.irs.gov/taxtopics/tc409"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-gold)] hover:underline"
              >
                IRS Topic 409
              </a>
              , a sale within one year of vesting is a short-term gain or loss, taxed at ordinary income rates; a
              sale more than one year after vesting is a long-term gain or loss, taxed at the 0, 15 or 20 percent
              long-term rates. State income tax applies on top of the federal treatment described here and varies by
              state.
            </p>
          </div>

          <div>
            <h2 className="type-h2 mb-2.5">A worked example</h2>
            <p>
              Consider 500 shares vesting when the stock&rsquo;s fair market value is $100 per share. The income
              added to wages is 500 shares multiplied by $100, or $50,000. Withholding at the flat 22 percent
              supplemental rate is $50,000 multiplied by 0.22, or $11,000. If the employee&rsquo;s actual marginal
              federal rate on that income is 32 percent, the real federal liability is closer to $50,000 multiplied
              by 0.32, or $16,000, leaving a gap of roughly $5,000 between what was withheld and what is owed. Under
              sell-to-cover, about $11,000 worth of shares, or 110 shares at $100, are sold to fund the withholding,
              and the remaining 390 shares are deposited into the account.
            </p>
          </div>

          <div>
            <h2 className="type-h2 mb-2.5">Frequently asked questions</h2>
            <div className="space-y-6">
              {FAQ.map((f) => (
                <div key={f.q}>
                  <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1.5">{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <LegalFooter />
    </main>
  );
}

/* ── Subcomponents ── */

function Row({ left, right, rightColor, bold }: { left: string; right: string; rightColor?: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline ${bold ? 'font-semibold' : ''}`}>
      <span className={bold ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}>{left}</span>
      <span className={`font-mono ${rightColor || 'text-[var(--color-text-primary)]'}`}>{right}</span>
    </div>
  );
}
