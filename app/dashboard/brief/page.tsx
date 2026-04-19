'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Static sample data -- will be replaced by AI brief generation pipeline
// ---------------------------------------------------------------------------

const ISSUE_NUMBER = 42;
const GENERATED_AT = '6:12 AM ET';
const READ_TIME = 4;

const MARKET_SNAPSHOT = [
  { label: 'S&P 500',   value: '5,428.71', delta: +0.34 },
  { label: 'NASDAQ',    value: '17,031.44', delta: +0.52 },
  { label: 'DOW',       value: '40,113.50', delta: -0.11 },
  { label: '10Y YIELD', value: '4.33%',     delta: +0.02 },
  { label: 'VIX',       value: '14.21',     delta: -3.80 },
  { label: 'OIL WTI',   value: '$78.42',    delta: -1.15 },
];

const MOVERS = [
  { ticker: 'NVDA', name: 'NVIDIA',    pct: +3.42, reason: 'Upgraded to Overweight at Morgan Stanley on AI capex cycle' },
  { ticker: 'AAPL', name: 'Apple',     pct: -1.18, reason: 'iPhone 17 supply chain delays reported by Nikkei Asia' },
  { ticker: 'TSLA', name: 'Tesla',     pct: +2.07, reason: 'Robotaxi pilot expanded to Austin; deliveries beat whisper' },
  { ticker: 'META', name: 'Meta',      pct: +0.94, reason: 'Threads MAU crossed 300M; ad monetization ahead of schedule' },
  { ticker: 'JPM',  name: 'JPMorgan',  pct: -0.61, reason: 'Net interest income guide trimmed on deposit migration' },
];

const ECON_CALENDAR = [
  { time: '8:30 AM',  event: 'Initial Jobless Claims',    value: '215K (est.)' },
  { time: '10:00 AM', event: 'Existing Home Sales',       value: '4.20M (est.)' },
  { time: '11:00 AM', event: 'Kansas City Fed Mfg Index', value: '-2 (est.)' },
  { time: '2:00 PM',  event: 'Fed Beige Book',            value: '' },
];

const LEAD_HEADLINE = 'Your Portfolio Gained $4,217 Overnight as Tech Earnings Lifted Sentiment';
const LEAD_BODY = `arnings season is shaping up to be a tailwind for your portfolio. With 68% of S&P 500 companies now reported, the blended earnings growth rate stands at +7.2% year-over-year, well ahead of the +4.1% consensus at the start of the quarter. Your technology-heavy allocation benefited disproportionately: NVIDIA, your largest single-stock position at 8.3% of portfolio, surged after Morgan Stanley upgraded the name to Overweight, citing durable AI infrastructure spending through 2027.

Across your 23 holdings, 17 closed higher overnight. The net effect: +$4,217 (+0.62%), outperforming the S&P 500 by 28 basis points. Your portfolio beta of 1.14 is running slightly hot relative to your target of 1.0, driven primarily by the semiconductor overweight. If you want to trim exposure, consider reviewing your NVDA and AMD positions, which together represent 12.1% of your portfolio.

One area to watch: Apple reports next Thursday. At 6.7% of your portfolio, a miss could offset much of this week's gains. The options market is pricing a 4.2% move in either direction.`;

const TLH_HEADLINE = 'Tax-Loss Harvesting Opportunity: $2,340 in Unrealized Losses Available';
const TLH_BODY = `Three positions in your taxable brokerage account are currently showing unrealized short-term losses that could be harvested before quarter-end. INTC (-$1,180), DIS (-$740), and PYPL (-$420) together represent $2,340 in potential tax savings at your marginal rate. Harvesting now and swapping into correlated ETFs (SMH, VCR, IPAY) would maintain sector exposure while locking in the deduction. The 30-day wash-sale window would expire before your next planned rebalance.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayFormatted(): string {
  const d = new Date();
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const rest = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `${weekday}, ${rest}`;
}

function deltaColor(v: number): string {
  if (v > 0) return 'text-emerald-400';
  if (v < 0) return 'text-red-400';
  return 'text-neutral-500';
}

function formatDelta(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Masthead() {
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();

  return (
    <header className="border-t-2 border-[var(--color-gold)] pt-6 pb-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        {/* Left: date + title */}
        <div>
          <p
            className="text-[0.6875rem] tracking-[0.2em] text-[var(--color-gold)] mb-2"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
          >
            {weekday} &middot; {dateStr}
          </p>
          <div className="flex items-center gap-3">
            <HelmMark size={36} />
            <h1
              className="text-[2.5rem] sm:text-[3.5rem] font-bold leading-none tracking-tight text-[var(--color-text-primary)]"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              The Helm Brief
            </h1>
          </div>
        </div>

        {/* Right: issue meta */}
        <div
          className="text-right space-y-0.5 shrink-0"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
        >
          <p className="text-[0.6875rem] tracking-[0.15em] text-[var(--color-text-muted)]">
            ISSUE No. {ISSUE_NUMBER} &middot; PRE-MARKET
          </p>
          <p className="text-[0.625rem] text-[var(--color-text-muted)]">
            GENERATED {GENERATED_AT} &middot; {READ_TIME} MIN READ
          </p>
        </div>
      </div>
    </header>
  );
}

function MarketSnapshotBar() {
  return (
    <div className="bg-[#080808] border border-[var(--color-border-subtle)] rounded -mx-1 px-1">
      <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-[rgba(255,255,255,0.06)]">
        {MARKET_SNAPSHOT.map((item) => (
          <div key={item.label} className="px-3 py-3 text-center">
            <p
              className="text-[0.5625rem] tracking-[0.15em] text-neutral-500 uppercase mb-1"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
            >
              {item.label}
            </p>
            <p
              className="text-[0.8125rem] font-medium text-[var(--color-text-primary)] tabular-nums"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
            >
              {item.value}
            </p>
            <p
              className={cn(
                'text-[0.6875rem] tabular-nums mt-0.5',
                deltaColor(item.delta),
              )}
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
            >
              {formatDelta(item.delta)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoldDivider() {
  return (
    <div className="flex items-center gap-3 my-8">
      <div className="flex-1 h-px bg-[var(--color-gold-border)]" />
      <div className="w-1.5 h-1.5 rotate-45 bg-[var(--color-gold)]" />
      <div className="flex-1 h-px bg-[var(--color-gold-border)]" />
    </div>
  );
}

function SectionEyebrow({ section, category }: { section: string; category: string }) {
  return (
    <p
      className="text-[0.6875rem] tracking-[0.2em] text-[var(--color-gold)] mb-3 uppercase"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
    >
      &sect; {section} &middot; {category}
    </p>
  );
}

function LeadStory() {
  const firstLetter = LEAD_BODY.charAt(0).toUpperCase();

  return (
    <article>
      <SectionEyebrow section="LEAD" category="YOUR PORTFOLIO" />

      <h2
        className="text-[1.75rem] sm:text-[2.25rem] lg:text-[2.75rem] font-bold leading-[1.15] tracking-tight text-[var(--color-text-primary)] mb-3"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        {LEAD_HEADLINE}
      </h2>

      {/* Attribution */}
      <p
        className="text-[0.625rem] tracking-[0.1em] text-[var(--color-text-muted)] mb-5 uppercase"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
      >
        HELM INTELLIGENCE ENGINE v1.0 &middot; POLYGON.IO &middot; PLAID
      </p>

      {/* Body with drop cap */}
      <div
        className="text-[1rem] leading-[1.75] text-[var(--color-text-secondary)] space-y-4"
        style={{ fontFamily: 'Georgia, "Source Serif Pro", "Times New Roman", serif' }}
      >
        <p>
          <span
            className="float-left text-[4rem] leading-[0.8] font-bold text-[var(--color-gold)] mr-3 mt-1"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            aria-hidden="true"
          >
            E
          </span>
          {LEAD_BODY.split('\n\n')[0]}
        </p>
        {LEAD_BODY.split('\n\n').slice(1).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </article>
  );
}

function TlhStory() {
  return (
    <article>
      <SectionEyebrow section="ACTIONABLE" category="TAX" />

      <h2
        className="text-[1.375rem] sm:text-[1.75rem] lg:text-[2rem] font-bold leading-[1.2] tracking-tight text-[var(--color-text-primary)] mb-3"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        {TLH_HEADLINE}
      </h2>

      <div
        className="text-[1rem] leading-[1.75] text-[var(--color-text-secondary)] mb-5"
        style={{ fontFamily: 'Georgia, "Source Serif Pro", "Times New Roman", serif' }}
      >
        <p>{TLH_BODY}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button className="px-4 py-2 text-[0.8125rem] font-medium bg-[var(--color-gold)] text-[#0D1117] rounded hover:bg-[var(--color-gold-hi)] transition-colors">
          Open harvest plan &rarr;
        </button>
        <button className="px-4 py-2 text-[0.8125rem] font-medium border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] rounded hover:bg-[var(--color-bg-elevated)] transition-colors">
          Dismiss
        </button>
      </div>
    </article>
  );
}

function SidebarMovers() {
  return (
    <div>
      <p
        className="text-[0.6875rem] tracking-[0.2em] text-[var(--color-gold)] uppercase mb-2"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
      >
        &sect; MARKET MOVERS
      </p>
      <div className="h-px bg-[var(--color-gold-border)] mb-4" />

      <div className="space-y-3">
        {MOVERS.map((m) => (
          <div key={m.ticker} className="space-y-0.5">
            <div className="flex items-baseline justify-between">
              <span
                className="text-[0.875rem] font-medium text-[var(--color-text-primary)]"
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
              >
                {m.ticker}
                <span className="ml-2 text-[0.75rem] font-normal text-[var(--color-text-muted)]">
                  {m.name}
                </span>
              </span>
              <span
                className={cn(
                  'text-[0.875rem] font-medium tabular-nums',
                  deltaColor(m.pct),
                )}
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
              >
                {formatDelta(m.pct)}
              </span>
            </div>
            <p className="text-[0.75rem] leading-[1.5] text-[var(--color-text-muted)]">
              {m.reason}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SidebarEconCalendar() {
  return (
    <div>
      <p
        className="text-[0.6875rem] tracking-[0.2em] text-[var(--color-gold)] uppercase mb-2"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
      >
        &sect; ECON CALENDAR
      </p>
      <div className="h-px bg-[var(--color-gold-border)] mb-4" />

      <div className="space-y-2.5">
        {ECON_CALENDAR.map((e, i) => (
          <div key={i} className="flex gap-3">
            <span
              className="text-[0.75rem] text-[var(--color-text-muted)] shrink-0 w-16 tabular-nums"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
            >
              {e.time}
            </span>
            <div>
              <p className="text-[0.8125rem] text-[var(--color-text-secondary)] leading-tight">
                {e.event}
              </p>
              {e.value && (
                <p
                  className="text-[0.6875rem] text-[var(--color-text-muted)] tabular-nums mt-0.5"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
                >
                  {e.value}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FooterColophon() {
  return (
    <footer className="border-t border-[var(--color-border-subtle)] mt-12 pt-4 pb-8">
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[0.625rem] text-[var(--color-text-muted)] tracking-[0.1em] uppercase"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
      >
        <p>HELM INTELLIGENCE ENGINE v1.0 &middot; POLYGON.IO &middot; PLAID &middot; RULE-BASED</p>
        <p>NEXT ISSUE: TOMORROW {todayFormatted().includes('Friday') ? 'MONDAY' : ''} 6:00 AM ET</p>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DailyBriefPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Masthead */}
        <Masthead />

        {/* Market snapshot bar */}
        <div className="mt-6 mb-8">
          <MarketSnapshotBar />
        </div>

        {/* Mobile sidebar toggle */}
        <div className="lg:hidden mb-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-2 text-[0.75rem] tracking-[0.15em] text-[var(--color-gold)] uppercase"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
            aria-expanded={sidebarOpen}
            aria-controls="brief-sidebar"
          >
            {sidebarOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Market Movers &amp; Calendar
          </button>

          {sidebarOpen && (
            <div id="brief-sidebar" className="mt-4 space-y-8 pb-6 border-b border-[var(--color-border-subtle)]">
              <SidebarMovers />
              <SidebarEconCalendar />
            </div>
          )}
        </div>

        {/* Two-column editorial layout */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-14">

          {/* Main column */}
          <main className="flex-[2.2] min-w-0">
            <LeadStory />
            <GoldDivider />
            <TlhStory />
          </main>

          {/* Sidebar -- hidden on mobile (toggle above) */}
          <aside className="hidden lg:block flex-1 min-w-0 space-y-10">
            <SidebarMovers />
            <SidebarEconCalendar />
          </aside>
        </div>

        {/* Footer colophon */}
        <FooterColophon />
      </div>
    </div>
  );
}
