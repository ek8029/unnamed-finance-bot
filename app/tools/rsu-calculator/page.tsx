'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
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
    const sym = ticker.toUpperCase().replace(/[^A-Z]/g, '');
    if (sym.length >= 1 && sym.length <= 5 && sym !== lastFetchedTicker) {
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

  const canCalculate = sharesNum > 0 && priceNum > 0 && grantDateObj !== null;

  const handleCalculate = () => {
    if (!canCalculate) return;
    setShowResults(true);
    setTimeout(() => {
      document.getElementById('rsu-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
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
      <title>RSU Vesting Calculator | Helm Terminal</title>
      <meta name="description" content="Free RSU vesting calculator. Estimate your RSU tax liability across vesting schedules, model concentration risk, and see your post-tax take-home at each vest date." />
      <link rel="canonical" href="https://helmterminal.dev/tools/rsu-calculator" />
      <meta property="og:title" content="RSU Vesting Calculator | Helm Terminal" />
      <meta property="og:description" content="Estimate RSU taxes, vesting schedules, and concentration risk. Free calculator for engineers and founders." />
      <meta property="og:url" content="https://helmterminal.dev/tools/rsu-calculator" />
      <meta property="og:site_name" content="Helm Terminal" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="RSU Vesting Calculator | Helm Terminal" />
      <meta name="twitter:description" content="Estimate RSU taxes, vesting schedules, and concentration risk. Free, no signup required." />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'RSU Vesting Calculator',
            description: 'Free calculator to estimate RSU tax liability, vesting timeline, and concentration risk.',
            url: 'https://helmterminal.dev/tools/rsu-calculator',
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            creator: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
          }),
        }}
      />

      {/* Nav */}
      <nav className="border-b border-[var(--color-border-base)]">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/analyze" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Analyze</Link>
            <Link href="/pricing" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Pricing</Link>
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Sign up</Link>
          </div>
        </div>
      </nav>

      <div className="relative min-h-[80vh]">
        {/* Ambient glow */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-[radial-gradient(circle,rgba(230,185,77,0.05),transparent_70%)] pointer-events-none" />

        <section className="relative container mx-auto px-6 pt-16 pb-20 max-w-xl">

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)]" />
              <div className="h-px flex-1 bg-gradient-to-r from-[var(--color-gold)]/30 to-transparent" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-[1.1] mb-3">
              What are your RSUs<br />
              <span className="text-[var(--color-gold)]">actually worth</span>
              <br />after taxes?
            </h1>
            <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed">
              Model your vesting schedule, estimate tax liability, and check concentration risk.
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
                      const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
                      setTicker(v);
                      if (v !== lastFetchedTicker) {
                        setFetchedPrice(null);
                      }
                    }}
                    placeholder="AAPL"
                    maxLength={5}
                    className="w-full px-4 py-4 bg-transparent border-b-2 border-white/[0.1] text-[var(--color-text-primary)] placeholder-white/[0.15] focus:outline-none focus:border-[var(--color-gold)] transition-colors font-mono text-2xl uppercase"
                  />
                  <div className="flex items-center gap-2 mt-1.5">
                    {fetchLoading && (
                      <span className="text-xs text-[var(--color-text-muted)]">Fetching price...</span>
                    )}
                    {!fetchLoading && fetchedPrice !== null && !priceOverride && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Live: <span className="font-mono text-[var(--color-text-primary)]">${fetchedPrice.toFixed(2)}</span>
                      </span>
                    )}
                    {fetchError && (
                      <span className="text-xs text-[var(--color-negative)]">{fetchError}</span>
                    )}
                  </div>
                </div>

                {/* Total RSU grant */}
                <div>
                  <label className="block text-[15px] font-medium text-[var(--color-text-primary)] mb-2">Total RSU grant</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={totalShares ? Number(totalShares).toLocaleString() : ''}
                    onChange={(e) => setTotalShares(e.target.value.replace(/\D/g, ''))}
                    placeholder="1,000"
                    className="w-full px-4 py-4 bg-transparent border-b-2 border-white/[0.1] text-[var(--color-text-primary)] placeholder-white/[0.15] focus:outline-none focus:border-[var(--color-gold)] transition-colors font-mono text-2xl"
                  />
                  <p className="text-xs text-[var(--color-text-muted)] mt-1.5">Total number of shares in your RSU grant.</p>
                </div>

                {/* Vesting schedule */}
                <div>
                  <label className="block text-[15px] font-medium text-[var(--color-text-primary)] mb-2">Vesting schedule</label>
                  <select
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value as ScheduleValue)}
                    className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors cursor-pointer"
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
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Total months</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={customMonths}
                        onChange={(e) => setCustomMonths(e.target.value.replace(/\D/g, ''))}
                        placeholder="48"
                        className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Vest every N months</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={customFrequency}
                        onChange={(e) => setCustomFrequency(e.target.value.replace(/\D/g, ''))}
                        placeholder="3"
                        className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors"
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
                    className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors cursor-pointer"
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
                      className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors cursor-pointer"
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
                      className="w-full pl-10 pr-4 py-4 bg-transparent border-b-2 border-white/[0.1] text-[var(--color-text-primary)] placeholder-white/[0.15] focus:outline-none focus:border-[var(--color-gold)] transition-colors font-mono text-2xl"
                    />
                  </div>
                  {!priceOverride && fetchedPrice !== null && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5">Auto-fetched from Finazon. Overriding locks the price.</p>
                  )}
                </div>

                {/* Tax bracket pills */}
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Federal tax bracket</div>
                  <div className="flex flex-wrap gap-2">
                    {TAX_BRACKETS.map((b, i) => (
                      <button
                        key={i}
                        onClick={() => setBracketIdx(i)}
                        className={`px-4 py-2 rounded-full text-sm font-mono font-semibold transition-all duration-150 cursor-pointer ${
                          i === bracketIdx
                            ? 'bg-[var(--color-gold)] text-[var(--color-bg-base)] shadow-[0_0_20px_rgba(230,185,77,0.25)]'
                            : 'bg-white/[0.04] text-[var(--color-text-muted)] hover:bg-white/[0.08] hover:text-[var(--color-text-secondary)]'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-2">RSU income is taxed as ordinary income at vest.</p>
                </div>
              </div>

              {/* Calculate button */}
              <button
                onClick={handleCalculate}
                disabled={!canCalculate}
                className="group w-full flex items-center justify-center gap-3 py-4 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[15px] tracking-wide rounded-lg shadow-[0_8px_32px_rgba(230,185,77,0.3)] transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
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
                <div className="text-xs font-mono uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-4">
                  Total grant value at current price
                </div>
                <div
                  className="text-4xl sm:text-6xl md:text-7xl font-mono text-[var(--color-gold)] leading-none"
                  style={{ fontWeight: 600, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}
                >
                  {fmt(totalGrantValue)}
                </div>
                <div className="text-sm text-[var(--color-text-muted)] mt-4">
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
                    className="text-center py-4 border-b border-white/[0.06] first:border-r last:border-l border-r-white/[0.06] border-l-white/[0.06]"
                  >
                    <div className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">{m.label}</div>
                    <div className="text-lg font-bold font-mono text-[var(--color-text-primary)]">{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Concentration risk warning */}
              <div className="mb-8">
                <div className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-4">
                  Concentration Risk
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-[var(--color-text-secondary)]">Portfolio value for comparison</span>
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">{fmt(portfolioValue)}</span>
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
                <div className="flex items-center justify-between text-xs font-mono text-[var(--color-text-muted)]">
                  <span>$50K</span>
                  <span>$2M</span>
                </div>

                {concentrationPct > 10 && (
                  <div className="mt-4 flex items-start gap-3 rounded-lg border border-[var(--color-gold)]/20 bg-[var(--color-gold)]/[0.03] p-4">
                    <AlertTriangle className="w-4 h-4 text-[var(--color-gold)] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                        {concentrationPct.toFixed(0)}% concentration in a single stock
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed" style={{ fontFamily: 'var(--font-serif, "Source Serif Pro", serif)' }}>
                        Financial advisors typically recommend keeping any single position under 10% of your total portfolio.
                        At {fmt(portfolioValue)} portfolio value, your {ticker || 'RSU'} grant represents {concentrationPct.toFixed(1)}% — consider
                        a diversification plan as shares vest.
                      </p>
                    </div>
                  </div>
                )}

                {concentrationPct <= 10 && concentrationPct > 0 && (
                  <div className="mt-4 flex items-start gap-3 rounded-lg border border-white/[0.06] p-4">
                    <div className="w-4 h-4 rounded-full bg-[var(--color-positive)]/20 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-positive)]" />
                    </div>
                    <div className="text-sm text-[var(--color-text-muted)]">
                      {concentrationPct.toFixed(1)}% of portfolio — within typical concentration guidelines.
                    </div>
                  </div>
                )}
              </div>

              {/* Tax impact summary */}
              <div className="mb-8">
                <div className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-4">Tax Impact Summary</div>
                <div className="space-y-3 text-[14px]">
                  <Row left="Total pre-tax grant value" right={fmt(totalGrantValue)} />
                  <Row left={`Federal tax at ${(taxRate * 100).toFixed(0)}%`} right={`-${fmt(totalTax)}`} rightColor="text-[var(--color-negative)]" />
                  <div className="h-px bg-white/[0.04]" />
                  <Row left="Estimated post-tax value" right={fmt(totalPostTax)} rightColor="text-[var(--color-gold)]" bold />
                  <Row left="Avg. tax per vest event" right={fmt(vestEvents.length > 0 ? totalTax / vestEvents.length : 0)} />
                </div>
              </div>

              {/* Vesting timeline table */}
              <div className="mb-10">
                <div className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-4">
                  Vesting Timeline ({vestEvents.length} events)
                </div>
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.08]">
                        <th className="text-left py-2 pr-4 text-xs font-mono uppercase tracking-[0.1em] text-[var(--color-text-muted)] font-medium">Date</th>
                        <th className="text-right py-2 px-4 text-xs font-mono uppercase tracking-[0.1em] text-[var(--color-text-muted)] font-medium">Shares</th>
                        <th className="text-right py-2 px-4 text-xs font-mono uppercase tracking-[0.1em] text-[var(--color-text-muted)] font-medium">Pre-Tax</th>
                        <th className="text-right py-2 px-4 text-xs font-mono uppercase tracking-[0.1em] text-[var(--color-text-muted)] font-medium">Est. Tax</th>
                        <th className="text-right py-2 pl-4 text-xs font-mono uppercase tracking-[0.1em] text-[var(--color-text-muted)] font-medium">Post-Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vestEvents.map((event, idx) => {
                        const isPast = event.date < new Date();
                        return (
                          <tr
                            key={idx}
                            className={`border-b border-white/[0.04] ${isPast ? 'opacity-50' : ''}`}
                          >
                            <td className="py-2.5 pr-4 font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                              {fmtDate(event.date)}
                              {isPast && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">vested</span>}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-right text-[var(--color-text-primary)]">{fmtShares(event.shares)}</td>
                            <td className="py-2.5 px-4 font-mono text-right text-[var(--color-text-primary)]">{fmt(event.preTax)}</td>
                            <td className="py-2.5 px-4 font-mono text-right text-[var(--color-negative)]">-{fmt(event.estTax)}</td>
                            <td className="py-2.5 pl-4 font-mono text-right text-[var(--color-positive)]">{fmt(event.postTax)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/[0.08]">
                        <td className="py-3 pr-4 font-semibold text-[var(--color-text-primary)]">Total</td>
                        <td className="py-3 px-4 font-mono text-right font-semibold text-[var(--color-text-primary)]">{fmtShares(sharesNum)}</td>
                        <td className="py-3 px-4 font-mono text-right font-semibold text-[var(--color-text-primary)]">{fmt(totalGrantValue)}</td>
                        <td className="py-3 px-4 font-mono text-right font-semibold text-[var(--color-negative)]">-{fmt(totalTax)}</td>
                        <td className="py-3 pl-4 font-mono text-right font-semibold text-[var(--color-gold)]">{fmt(totalPostTax)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* CTAs */}
              <div className="space-y-3">
                <Link
                  href="/signup"
                  className="flex items-center justify-center gap-2.5 w-full py-4 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[15px] tracking-wide rounded-lg shadow-[0_8px_32px_rgba(230,185,77,0.3)] hover:brightness-110 transition-all cursor-pointer"
                >
                  Track your actual RSU exposure alongside your full portfolio <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setShowResults(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-white/[0.06] hover:border-white/[0.12] rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Edit inputs
                </button>
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 text-xs text-[var(--color-text-muted)] leading-relaxed mt-8">
                <Shield className="w-3 h-3 shrink-0 mt-0.5" />
                <span>Estimates only. Does not account for state taxes, FICA, AMT, or stock price changes between now and vest dates. RSU income is taxed as ordinary income at the fair market value on the vesting date. Not tax or investment advice. Consult a qualified tax professional.</span>
              </div>
            </div>
          )}

        </section>
      </div>

      {/* SEO content */}
      <section className="container mx-auto px-6 py-16 max-w-2xl">
        <div className="space-y-8 text-[var(--color-text-secondary)] text-sm leading-relaxed" style={{ fontFamily: 'var(--font-serif, "Source Serif Pro", serif)' }}>
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-2" style={{ fontFamily: 'inherit' }}>How are RSUs taxed?</h2>
            <p>Restricted Stock Units are taxed as ordinary income when they vest — not when they&rsquo;re granted. The taxable amount is the fair market value of the shares on the vesting date multiplied by the number of shares vesting. Your employer withholds federal and state income taxes, Social Security, and Medicare at vest. If the default withholding (often 22% federal) is lower than your marginal rate, you&rsquo;ll owe the difference at tax time.</p>
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-2" style={{ fontFamily: 'inherit' }}>What is a typical RSU vesting schedule?</h2>
            <p>The most common schedule is a 4-year vest with a 1-year cliff: 25% of shares vest after 12 months, then the remaining 75% vest monthly or quarterly over the next 36 months. Some companies use a 4-year quarterly schedule with no cliff, and others use 3-year monthly vesting. The schedule is defined in your grant agreement.</p>
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-2" style={{ fontFamily: 'inherit' }}>Why concentration risk matters</h2>
            <p>If your RSU grant represents a large percentage of your net worth, you have concentration risk — your financial outcomes are tied to a single company&rsquo;s stock price. Most financial advisors recommend keeping any single position under 10% of your total portfolio. A diversification plan — selling shares as they vest and reinvesting in broad market funds — reduces this risk without requiring you to time the market.</p>
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-2" style={{ fontFamily: 'inherit' }}>How Helm tracks RSU exposure</h2>
            <p>Helm connects to your brokerage and tracks your actual RSU positions alongside the rest of your portfolio. Instead of manually updating spreadsheets, Helm shows your real-time concentration in any single stock, flags when positions exceed your risk threshold, and surfaces tax-aware rebalancing opportunities — all in one terminal.</p>
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
