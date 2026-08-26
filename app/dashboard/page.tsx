'use client';

import { useEffect, useMemo, useState } from 'react';
import { FirstRead } from '@/components/dashboard/first-read';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Link2, Sparkles } from 'lucide-react';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { useToast } from '@/contexts/toast-context';
import { ThesisConvictionKpi } from '@/components/thesis/conviction-kpi';
import { useFinancialSummary, useIntelligence, useHoldings } from '@/hooks/use-financial-data';
import { useFormat } from '@/hooks/use-format';
import { useDemo } from '@/contexts/demo-context';
import { usePreview } from '@/lib/preview-context';
import { AgentFirstLook } from '@/components/agent-first-look';
import { Ghost, GhostBar } from '@/components/ghost';
import { tierAtLeast } from '@/lib/tier-shared';
import { useLivePrices, isUsMarketOpen } from '@/hooks/use-live-prices';
import { liveStatus } from '@/lib/live-status';
import posthog from 'posthog-js';
import { DemoConnectCta } from '@/components/demo/demo-connect-cta';
import { AgentHeartbeat } from '@/components/thesis/agent-activity';
import { TodaysDelta } from '@/components/dashboard/todays-delta';

// ── Sovereign Architect tokens (local to this screen) ──────────────────────
const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const SCREEN: React.CSSProperties = { maxWidth: 1600 };
// Responsive page padding: tighter on phones, full bleed-in on >=sm.
const SCREEN_PAD = 'px-4 pt-6 pb-16 sm:px-7 sm:pt-[26px]';
const CARD =
  'rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.5)]';

// Sector → chart color (matches the README chart palette, in order).
const CHART_COLORS = ['#E6B94D', '#7AA3C7', '#9FB89D', '#C8A165', '#8E7DC7', '#5A6070'];

// ── Local presentational helpers ───────────────────────────────────────────

function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`text-[12px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] ${className}`}
      style={MONO}
    >
      {children}
    </div>
  );
}

function KpiTile({
  label,
  value,
  delta,
  tone = 'muted',
}: {
  label: string;
  value: string;
  delta: string;
  tone?: 'positive' | 'negative' | 'warning' | 'muted';
}) {
  const valueColor =
    tone === 'negative' ? 'text-[var(--color-negative-text)]' : 'text-[var(--color-text-primary)]';
  const deltaColor =
    tone === 'positive'
      ? 'text-[var(--color-positive)]'
      : tone === 'negative'
        ? 'text-[var(--color-negative-text)]'
        : tone === 'warning'
          ? 'text-[var(--color-warning-text)]'
          : 'text-[var(--color-text-muted)]';
  return (
    <div className={`${CARD} px-4 pt-4 pb-[15px]`}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] mb-[11px]" style={MONO}>
        {label}
      </div>
      <div className={`text-[25px] font-bold tracking-[-0.02em] leading-none tabular-nums ${valueColor}`}>
        {value}
      </div>
      <div className={`text-[14px] font-semibold mt-[9px] tabular-nums ${deltaColor}`} style={MONO}>
        {delta}
      </div>
    </div>
  );
}

// Area chart built from a value series. Gold line over a gradient fill, 3
// gridlines, month axis. No chart library — inline SVG per the spec.
function PerformanceChart({ series, gradientId }: { series: number[]; gradientId: string }) {
  const W = 1000;
  const H = 240;
  const top = 16; // headroom so the peak dot isn't clipped
  const bottom = 224;

  const pts = series.length >= 2 ? series : [0, 0];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;

  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = bottom - ((v - min) / span) * (bottom - top);
    return { x, y };
  });

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const fill = `${line} L${W},${H} L0,${H} Z`;
  const last = coords[coords.length - 1];

  return (
    <svg width="100%" height="232" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E6B94D" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#E6B94D" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1="60" x2={W} y2="60" stroke="rgba(255,255,255,0.04)" />
      <line x1="0" y1="120" x2={W} y2="120" stroke="rgba(255,255,255,0.04)" />
      <line x1="0" y1="180" x2={W} y2="180" stroke="rgba(255,255,255,0.04)" />
      <path d={fill} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="#E6B94D" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r="3.5" fill="#E6B94D" />
    </svg>
  );
}

// Allocation donut from sector slices. Segments via stroke-dasharray on r=58.
function AllocationDonut({ slices }: { slices: { name: string; pct: number; color: string }[] }) {
  const C = 2 * Math.PI * 58; // circumference ≈ 364.4
  let offset = 0;
  return (
    <svg width="124" height="124" viewBox="0 0 140 140" className="shrink-0">
      <g transform="rotate(-90 70 70)" fill="none" strokeWidth="15">
        {slices.map((s, i) => {
          const len = (s.pct / 100) * C;
          const dash = `${len.toFixed(1)} ${(C - len).toFixed(1)}`;
          const dashoffset = -offset;
          offset += len;
          return (
            <circle
              key={i}
              cx="70"
              cy="70"
              r="58"
              stroke={s.color}
              strokeDasharray={dash}
              strokeDashoffset={dashoffset.toFixed(1)}
            />
          );
        })}
      </g>
      <text x="70" y="66" textAnchor="middle" style={{ ...MONO, fill: 'var(--color-text-muted)' }} fontSize="9" letterSpacing="0.1em">
        SECTORS
      </text>
      <text x="70" y="82" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--color-text-primary)">
        {slices.length}
      </text>
    </svg>
  );
}

// ── Sector heat strip (top of overview) ────────────────────────────────────
// Weighted, day-change-colored sector bar + legend + top movers. Same info as
// the old daily-brief heat line, restyled for the Sovereign Architect look.
function heatColor(pct: number): string {
  if (pct > 0.5) return '#4ADE80';
  if (pct > 0.1) return 'rgba(74,222,128,0.5)';
  if (pct < -0.5) return '#F87171';
  if (pct < -0.1) return 'rgba(248,113,113,0.5)';
  return 'rgba(255,255,255,0.14)';
}

function SectorHeatStrip({
  sectors,
  movers,
  formatPct,
}: {
  sectors: { sector: string; weight: number; changePct: number }[];
  movers: { ticker: string; pct: number }[];
  formatPct: (n: number) => string;
}) {
  if (sectors.length === 0) return null;
  const total = sectors.reduce((s, x) => s + x.weight, 0) || 1;
  return (
    <div className={`${CARD} mb-3.5 px-[22px] py-[18px]`}>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-gold)]" style={MONO}>
          Sector heat · today
        </div>
      </div>
      {/* weighted heat bar */}
      <div className="flex h-[10px] w-full gap-[2px] overflow-hidden rounded-full">
        {sectors.map((s) => (
          <div
            key={s.sector}
            className="h-full"
            style={{ width: `${(s.weight / total) * 100}%`, backgroundColor: heatColor(s.changePct) }}
            title={`${s.sector}: ${formatPct(s.changePct)} · ${s.weight.toFixed(1)}%`}
          />
        ))}
      </div>
      {/* legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {sectors.map((s) => (
          <div key={s.sector} className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: heatColor(s.changePct) }} />
            <span className="text-[12px] text-[var(--color-text-secondary)]">{s.sector}</span>
            <span
              className={`text-[11px] tabular-nums ${s.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'}`}
              style={MONO}
            >
              {formatPct(s.changePct)}
            </span>
            <span className="text-[10px] tabular-nums text-[var(--color-text-muted)]" style={MONO}>
              {s.weight.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      {/* movers — own row so they survive on mobile */}
      {movers.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-[var(--color-border-subtle)] pt-3">
          <span className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]" style={MONO}>
            Movers
          </span>
          {movers.map((m) => (
            <span key={m.ticker} className="inline-flex items-baseline gap-1.5 text-[12px]" style={MONO}>
              <span className="font-semibold text-[var(--color-text-secondary)]">{m.ticker}</span>
              <span className={m.pct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'}>
                {formatPct(m.pct)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── General market brief (Free tier) ───────────────────────────────────────
// Non-personalized daily market read for users without Pro. Reuses the SAME
// public market data the /brief page uses: client-side polling of the
// no-auth /api/market/quotes/public endpoint via useLivePrices. No per-user
// OpenAI call. Templated text, only rendered for cells backed by real data.
const BRIEF_TICKERS = ['SPY', 'QQQ', 'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AMD', 'AVGO', 'JPM'];

function fmtPct2(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function macroRead(spyPct: number, greens: number, total: number): string {
  const abs = Math.abs(spyPct);
  if (total === 0) return 'Market data is syncing. Check back in a moment.';
  if (abs < 0.4) return 'A quiet, range-bound session with no single catalyst driving direction.';
  if (spyPct >= 1) return 'Broad participation behind the move. Breadth and volume into the close will say whether it holds.';
  if (spyPct <= -1) return 'Risk-off pressure on equities. Watch yields and breadth for a dip versus a deeper turn.';
  return greens >= total / 2
    ? 'A modest tape with more names green than red. Conviction stays moderate.'
    : 'A modest tape leaning red. Conviction stays moderate.';
}

function GeneralMarketBrief() {
  const { quotes: live } = useLivePrices(BRIEF_TICKERS, 60_000, '/api/market/quotes/public');

  const rows = useMemo(
    () =>
      BRIEF_TICKERS.map((t) => {
        const q = live[t];
        if (!q || q.price <= 0 || q.dayChangePct == null) return null;
        return { symbol: t, price: q.price, changePct: q.dayChangePct };
      }).filter((r): r is { symbol: string; price: number; changePct: number } => r !== null),
    [live],
  );

  const spy = rows.find((r) => r.symbol === 'SPY');
  const qqq = rows.find((r) => r.symbol === 'QQQ');
  const stocks = rows.filter((r) => r.symbol !== 'SPY' && r.symbol !== 'QQQ');
  const greens = stocks.filter((r) => r.changePct >= 0).length;
  const topMover = [...stocks].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
  const spyUp = spy ? spy.changePct >= 0 : true;

  return (
    <div
      className="flex h-full flex-col rounded-lg px-[22px] py-5"
      style={{
        border: '1px solid rgba(230,185,77,0.18)',
        background: 'rgba(230,185,77,0.025)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
      }}
    >
      <div className="mb-3.5 flex items-center gap-2.5">
        <Sparkles size={15} strokeWidth={1.6} className="text-[var(--color-gold)]" />
        <span className="text-[12px] uppercase tracking-[0.16em] text-[var(--color-gold)]" style={MONO}>
          Market Brief
        </span>
        <span className="h-px flex-1" style={{ background: 'rgba(230,185,77,0.12)' }} />
      </div>

      {/* Benchmarks */}
      {spy || qqq ? (
        <div className="mb-4 grid grid-cols-2 gap-3">
          {[
            { q: spy, label: 'S&P 500' },
            { q: qqq, label: 'Nasdaq 100' },
          ]
            .filter((b) => b.q)
            .map((b) => (
              <div key={b.label} className="rounded-[5px] border border-[var(--color-border-subtle)] bg-white/[0.02] px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]" style={MONO}>
                  {b.label}
                </div>
                <div className="mt-1 text-[19px] font-bold leading-none tabular-nums">
                  ${b.q!.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div
                  className={`mt-1.5 text-[15px] font-semibold tabular-nums ${
                    b.q!.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'
                  }`}
                  style={MONO}
                >
                  {fmtPct2(b.q!.changePct)}
                </div>
              </div>
            ))}
        </div>
      ) : null}

      {/* Lead line + notable movers + macro read */}
      {spy ? (
        <p className="m-0 mb-3 text-[15px] leading-[1.6] text-[var(--color-text-primary)] text-pretty">
          The S&amp;P 500 is {spyUp ? 'up' : 'down'} {fmtPct2(spy.changePct)} today
          {qqq ? `, with the Nasdaq 100 ${qqq.changePct >= 0 ? 'up' : 'down'} ${fmtPct2(qqq.changePct)}` : ''}.
        </p>
      ) : (
        <p className="m-0 mb-3 flex-1 text-[15px] leading-[1.6] text-[var(--color-text-muted)]">
          Live market data is syncing. Today&apos;s brief lands once prices come through.
        </p>
      )}

      {topMover && (
        <p className="m-0 mb-3 text-[15px] leading-[1.55] text-[var(--color-text-secondary)]">
          Notable mover:{' '}
          <span className="font-semibold text-[var(--color-gold)]" style={MONO}>
            {topMover.symbol}
          </span>{' '}
          at {fmtPct2(topMover.changePct)}
          {stocks.length > 0 ? `. ${greens} of ${stocks.length} mega-caps tracked are green.` : '.'}
        </p>
      )}

      {rows.length > 0 && (
        <p className="m-0 mb-4 text-[15px] leading-[1.55] text-[var(--color-text-secondary)]">
          {macroRead(spy?.changePct ?? 0, greens, stocks.length)}
        </p>
      )}

      {/* Inline upgrade nudge — soft, no hard lock */}
      <Link
        href="/pricing"
        className="mt-auto flex items-center justify-between rounded-[5px] px-3.5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-gold)]"
        style={{ ...MONO, border: '1px solid rgba(230,185,77,0.18)', background: 'rgba(230,185,77,0.08)' }}
      >
        Get a brief tailored to your portfolio with Pro <span>→</span>
      </Link>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="animate-pulse" role="status" aria-live="polite" aria-label="Loading dashboard data">
      <div className="mb-6 space-y-3">
        <div className="h-3.5 w-56 rounded bg-[var(--color-bg-elevated)]" />
        <div className="h-14 w-80 rounded bg-[var(--color-bg-elevated)]" />
        <div className="h-7 w-44 rounded bg-[var(--color-bg-elevated)]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.62fr_1fr] gap-3.5 mb-3.5">
        <div className="h-[300px] rounded-lg bg-[var(--color-bg-elevated)]" />
        <div className="h-[300px] rounded-lg bg-[var(--color-bg-elevated)]" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-md bg-[var(--color-bg-elevated)]" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardOverview() {
  const {
    financialSummary,
    netWorthHistory,
    netWorthDaily,
    hasPlaidConnection,
    loading,
    error,
  } = useFinancialSummary();

  const { insights: feedInsights, loading: insightsLoading } = useIntelligence();

  // Live portfolio value: useHoldings polls /api/market/quotes every 30s and
  // recomputes totalValue client-side. Overrides the static DB aggregate.
  const { holdings, totalValue: liveHoldingsValue, loading: holdingsLoading, lastQuoteAt } = useHoldings();

  // The status dot re-evaluates every 15 s so "Live" decays to "Delayed"
  // when polling stops, and flips to "Market closed" at the bell.
  const [statusNow, setStatusNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setStatusNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  const marketStatus = liveStatus(isUsMarketOpen(), lastQuoteAt, statusNow);

  const { formatCurrency, formatPercentage } = useFormat();
  const { isDemo, enableDemo, disableDemo } = useDemo();
  const { tier, dataState } = usePreview();
  const router = useRouter();
  const toast = useToast();
  const [plaidError, setPlaidError] = useState<string | null>(null);
  // Set on a successful Link exchange. Holdings are not in yet at that moment,
  // so the dashboard would render its empty state over a book that is arriving;
  // FirstRead waits for the sync and pays the connection out in the one figure
  // Helm computes deterministically.
  const [justConnected, setJustConnected] = useState<string | null>(null);
  // Set when Link ends because the broker is not in Plaid's catalogue. Kept as
  // state rather than a toast: a toast is the wrong shape for a dead end, since
  // it takes the only route out of the dead end away with it after four seconds.
  const [noInstitution, setNoInstitution] = useState(false);
  const [nwRange, setNwRange] = useState<'1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'>('ALL');

  useEffect(() => {
    posthog.capture('dashboard_viewed', { has_plaid: hasPlaidConnection, is_demo: isDemo });
  }, [hasPlaidConnection, isDemo]);

  // Snapshot-based dollar change from the API (same baseline as the % change).
  const netWorthChange = financialSummary?.changes?.net_worth_dollar ?? null;
  const netWorthPctChange = financialSummary?.changes?.net_worth ?? null;

  // Honest label: only claim "vs. last month" when the baseline is ~a month old.
  const netWorthChangeLabel = useMemo(() => {
    const baseline = financialSummary?.changes?.net_worth_baseline_date;
    if (!baseline) return 'vs. last month';
    const ageDays = (Date.now() - new Date(`${baseline}T12:00:00`).getTime()) / 86400000;
    // Only claim "vs. last month" when the baseline is actually ~a month old.
    // Snapshots have gaps, so the fallback baseline can be months back — labeling
    // a 90-day change "vs. last month" was wrong. Outside the window, name the date.
    if (ageDays >= 25 && ageDays <= 45) return 'vs. last month';
    return `since ${new Date(`${baseline}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }, [financialSummary]);

  // ── Derived presentation data ──────────────────────────────────────────
  // Net-worth history is monthly snapshots; the range pills slice trailing
  // months. ALL keeps everything. (No intraday data → no 1D/1W ranges.)
  // Chart points as {label, value}. Prefer the daily series (real per-day
  // resolution → supports 1W/1M); fall back to the monthly history when no
  // daily data exists yet (e.g. demo mode or a brand-new account).
  const chartPoints = useMemo(() => {
    if (netWorthDaily.length >= 2) {
      const days = { '1W': 7, '1M': 31, '3M': 92, '6M': 183, '1Y': 366, ALL: Infinity }[nwRange];
      const fmt = (d: string) =>
        new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      let pts = netWorthDaily;
      if (days !== Infinity) {
        const cutoff = Date.now() - days * 86400000;
        const sliced = netWorthDaily.filter((p) => new Date(`${p.date}T12:00:00`).getTime() >= cutoff);
        pts = sliced.length >= 2 ? sliced : netWorthDaily.slice(-2);
      }
      return pts.map((p) => ({ label: fmt(p.date), value: p.value }));
    }
    // Monthly fallback (no daily data): short ranges just show what we have.
    const n = { '1W': 2, '1M': 2, '3M': 3, '6M': 6, '1Y': 12, ALL: Infinity }[nwRange];
    const src = n === Infinity ? netWorthHistory : netWorthHistory.slice(-n);
    return src.map((p) => ({ label: p.month, value: p.value }));
  }, [netWorthDaily, netWorthHistory, nwRange]);

  const chartSeries = useMemo(
    () => (chartPoints.length >= 2 ? chartPoints.map((p) => p.value) : []),
    [chartPoints],
  );

  // Headline change tracks the SELECTED range: first vs last point of the
  // series the pills produced. Falls back to the month-over-month change from
  // the API when there's no daily series to slice (demo / brand-new account).
  const RANGE_LABEL: Record<typeof nwRange, string> = {
    '1W': 'past week',
    '1M': 'past month',
    '3M': 'past 3 months',
    '6M': 'past 6 months',
    '1Y': 'past year',
    ALL: 'all time',
  };
  const rangeChange = useMemo(() => {
    if (chartPoints.length < 2) return null;
    const first = chartPoints[0].value;
    const last = chartPoints[chartPoints.length - 1].value;
    return { dollar: last - first, pct: first !== 0 ? ((last - first) / first) * 100 : null };
  }, [chartPoints]);

  const sectorSlices = useMemo(() => {
    const totals = new Map<string, number>();
    let sum = 0;
    for (const h of holdings) {
      const sector = h.sector || 'Other';
      const v = h.total_value || 0;
      totals.set(sector, (totals.get(sector) || 0) + v);
      sum += v;
    }
    if (sum === 0) return [];
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, 5);
    const restPct = ranked.slice(5).reduce((acc, [, v]) => acc + (v / sum) * 100, 0);
    const slices = top.map(([name, v], i) => ({ name, pct: (v / sum) * 100, color: CHART_COLORS[i] }));
    if (restPct > 0.05) slices.push({ name: 'Other', pct: restPct, color: CHART_COLORS[5] });
    return slices;
  }, [holdings]);

  const topSectorPct = sectorSlices[0]?.pct ?? 0;

  // Sector heat: weight by value, day-change as a value-weighted average.
  const sectorHeat = useMemo(() => {
    const m = new Map<string, { value: number; weighted: number }>();
    let sum = 0;
    for (const h of holdings) {
      const sector = h.sector || 'Other';
      const v = h.total_value || 0;
      const pct = h.day_change_percentage || 0;
      const cur = m.get(sector) || { value: 0, weighted: 0 };
      cur.value += v;
      cur.weighted += v * pct;
      m.set(sector, cur);
      sum += v;
    }
    if (sum === 0) return [] as { sector: string; weight: number; changePct: number }[];
    return [...m.entries()]
      .map(([sector, { value, weighted }]) => ({
        sector,
        weight: (value / sum) * 100,
        changePct: value > 0 ? weighted / value : 0,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);
  }, [holdings]);

  const heatMovers = useMemo(
    () =>
      [...holdings]
        .filter((h) => (h.day_change_percentage ?? 0) !== 0)
        .sort((a, b) => Math.abs(b.day_change_percentage || 0) - Math.abs(a.day_change_percentage || 0))
        .slice(0, 4)
        .map((h) => ({ ticker: h.ticker, pct: h.day_change_percentage || 0 })),
    [holdings],
  );

  const movers = useMemo(() => {
    return [...holdings]
      .filter((h) => h.ticker && h.ticker !== 'UNKNOWN' && h.day_change_percentage != null)
      .sort((a, b) => Math.abs(b.day_change_percentage || 0) - Math.abs(a.day_change_percentage || 0))
      .slice(0, 8);
  }, [holdings]);

  const topHoldings = useMemo(() => {
    return [...holdings]
      .filter((h) => h.ticker && h.ticker !== 'UNKNOWN')
      .sort((a, b) => (b.total_value || 0) - (a.total_value || 0))
      .slice(0, 6);
  }, [holdings]);

  // ── Loading / error ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`mx-auto ${SCREEN_PAD}`} style={SCREEN}>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`mx-auto ${SCREEN_PAD}`} style={SCREEN}>
        <div className="rounded-lg border border-[var(--color-negative)]/20 bg-[var(--color-negative)]/10 p-6 text-[var(--color-negative-text)]">
          <h2 className="font-semibold mb-2">Error loading dashboard</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // ── Empty: connect your brokerage ──────────────────────────────────────
  // Real condition (no account/summary) OR the preview empty toggle.
  const hasNoData = !financialSummary || !hasPlaidConnection || dataState === 'empty';

  // Ahead of hasNoData deliberately: a user who just connected HAS no data yet,
  // and would otherwise be shown "See Helm in action" one second after handing
  // over their brokerage.
  if (justConnected !== null) {
    return (
      <div className={`mx-auto ${SCREEN_PAD}`} style={SCREEN}>
        {/* Full reload rather than router.refresh(): client state survives a
            refresh and the holdings never appeared without one. */}
        <FirstRead itemId={justConnected || null} onDone={() => window.location.reload()} />
      </div>
    );
  }

  if (hasNoData) {
    return (
      <div className={`mx-auto ${SCREEN_PAD}`} style={SCREEN}>
        <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
          <div className={`${CARD} w-full max-w-[560px] px-8 py-10 text-center`}>
            <div
              className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'rgba(230,185,77,0.08)', border: '1px solid rgba(230,185,77,0.18)' }}
            >
              <Link2 size={20} className="text-[var(--color-gold)]" />
            </div>
            <h1 className="text-[26px] font-bold tracking-[-0.025em] leading-[1.15] text-[var(--color-text-primary)] mb-3">
              See Helm in action
            </h1>
            <p className="mx-auto mb-6 max-w-[420px] text-[15px] leading-[1.65] text-[var(--color-text-muted)]">
              Explore a fully loaded demo portfolio right now, no account needed: net worth, allocation,
              thesis intelligence, and the daily brief. Connect your real brokerage whenever you are ready
              (read-only via Plaid, it can never move money or place trades).
            </p>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => {
                  posthog.capture('demo_explored', { source: 'dashboard_empty' });
                  enableDemo();
                  router.refresh();
                }}
                className="w-full max-w-[280px] cursor-pointer rounded-[5px] bg-[var(--color-gold)] px-9 py-3.5 text-[15px] font-bold text-[var(--color-bg-base)] transition-all hover:brightness-110"
              >
                Explore the demo &rarr;
              </button>
              <PlaidLinkButton
                className="w-full max-w-[280px] rounded-[5px] border border-[var(--color-border-strong)] bg-transparent px-9 py-3 text-[14px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                onSuccess={(itemId) => setJustConnected(itemId ?? '')}
                onError={(msg) => setPlaidError(msg)}
                onLinkError={(code, message) => {
                  // Plaid does not cover every broker. Webull and Public.com
                  // are absent from the production catalogue entirely, so
                  // "try again" is not advice, it is a loop. Verified via
                  // scripts/probe-plaid-institutions.mjs.
                  if (code === 'INSTITUTION_NOT_FOUND' || code === 'INSTITUTION_NOT_SUPPORTED') {
                    setNoInstitution(true);
                    return;
                  }
                  toast.error('Connection failed', message);
                }}
              >
                Connect your brokerage
              </PlaidLinkButton>
              {/* The third path, quiet but present. Plaid reaches most brokers
                  and not all of them, and until now the only people who found
                  this route were the ones who happened to open the sidebar. */}
              <Link
                href="/dashboard/portfolio/add"
                className="text-[13px] text-[var(--color-text-muted)] underline decoration-[var(--color-border-strong)] underline-offset-4 transition-colors hover:text-[var(--color-text-secondary)]"
              >
                Or add holdings by import
              </Link>
            </div>

            {noInstitution && (
              <div
                className="mx-auto mt-6 max-w-[420px] rounded-[6px] px-4 py-3.5 text-left"
                style={{ background: 'rgba(230,185,77,0.06)', border: '1px solid rgba(230,185,77,0.18)' }}
              >
                <p className="text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">
                  Plaid does not reach every broker. Webull and Public are not available through it
                  at all, so searching again will not find them.
                </p>
                <Link
                  href="/dashboard/portfolio/add"
                  className="mt-2.5 inline-block text-[14px] font-semibold text-[var(--color-gold)] hover:brightness-110"
                >
                  Add those holdings by import &rarr;
                </Link>
              </div>
            )}

            {plaidError && <p className="mt-3 text-[15px] text-[var(--color-negative-text)]">{plaidError}</p>}

            <p className="mt-7 text-[12px] tracking-[0.06em] text-[#5a5a5a]" style={MONO}>
              12,000+ institutions · 256-bit encryption · via Plaid
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Connected / demo ───────────────────────────────────────────────────
  const netWorth = financialSummary?.net_worth || 0;
  const isPositiveChange = netWorthChange !== null ? netWorthChange >= 0 : true;
  // Range-aware headline change (drives the net-worth badge + chart-card header).
  const dispDollar = rangeChange ? rangeChange.dollar : netWorthChange;
  const dispPct = rangeChange ? rangeChange.pct : netWorthPctChange;
  const dispPositive = dispDollar !== null ? dispDollar >= 0 : true;
  const dispLabel = rangeChange ? RANGE_LABEL[nwRange] : netWorthChangeLabel;
  const showDemoBanner = isDemo || dataState === 'demo';

  const invested = financialSummary?.total_assets || 0;
  const cash =
    (financialSummary?.total_assets || 0) - ((!isDemo && liveHoldingsValue > 0)
      ? liveHoldingsValue
      : financialSummary?.portfolio_value || 0);
  const portfolioValue =
    !isDemo && liveHoldingsValue > 0 ? liveHoldingsValue : financialSummary?.portfolio_value || 0;
  // Real intraday change, derived from each holding's day move. The old source
  // (financialSummary.changes.portfolio) is measured against LAST MONTH's
  // snapshot — it printed a month-to-date return under a "today" label.
  const dayChange = (() => {
    if (isDemo || holdings.length === 0) return financialSummary?.changes?.portfolio ?? null;
    let moved = 0;
    for (const h of holdings) {
      const p = (h.day_change_percentage ?? 0) / 100;
      moved += (h.total_value * p) / (1 + p); // value - prior close
    }
    const prior = liveHoldingsValue - moved;
    return prior > 0 ? (moved / prior) * 100 : null;
  })();

  return (
    <div className={`mx-auto stagger-fade-in ${SCREEN_PAD}`} style={SCREEN}>
      <DemoConnectCta
        headline="This is sample data. See your real net worth."
        sub="Connect your brokerages and Helm reconciles every account into one number, with your real risk, taxes, and conviction."
      />
      <div className="mb-3.5">
        <AgentHeartbeat />
      </div>
      {/* What changed since they last looked. This page is the only surface
          every retained user opens, so it is the only place a finding reliably
          reaches them. */}
      <div className="mb-3.5">
        <TodaysDelta isDemo={isDemo} />
      </div>
      {showDemoBanner && (
        <div className="mb-4 flex flex-col items-start justify-between gap-2 rounded-md border border-[var(--color-info-border)] bg-[var(--color-info-muted)] px-4 py-2.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-info-text)]" style={MONO}>
              Demo data
            </span>
            <span className="hidden text-[15px] text-[var(--color-text-muted)] sm:inline">
              You&apos;re viewing a sample portfolio.
            </span>
          </div>
          <button
            onClick={disableDemo}
            className="cursor-pointer text-[14px] font-semibold text-[var(--color-info-text)] transition-colors hover:brightness-110"
          >
            Connect →
          </button>
        </div>
      )}

      {/* ── Net-worth header ── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <Eyebrow className="mb-2 !tracking-[0.2em] !text-[14px]">Net worth · All accounts · USD</Eyebrow>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <div className="text-[34px] sm:text-[46px] font-bold leading-none tracking-[-0.03em] tabular-nums">
              {formatCurrency(netWorth)}
            </div>
            {(dispDollar !== null || dispPct !== null) && (
              <div
                className={`flex items-center gap-2 rounded-[5px] px-3 py-[5px] ${
                  dispPositive
                    ? 'border border-[var(--color-positive-border)] bg-[var(--color-positive-muted)]'
                    : 'border border-[var(--color-negative-border)] bg-[var(--color-negative-muted)]'
                }`}
              >
                <span
                  className={`text-[15px] font-semibold tabular-nums ${
                    dispPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'
                  }`}
                  style={MONO}
                >
                  {dispDollar !== null && (
                    <>
                      {dispPositive ? '+' : ''}
                      {formatCurrency(dispDollar)}
                    </>
                  )}
                  {dispDollar !== null && dispPct !== null && ' · '}
                  {dispPct !== null && formatPercentage(dispPct)}
                </span>
                <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>
                  {dispLabel}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2.5">
          <div className="flex flex-wrap justify-end gap-1 text-[12px] uppercase tracking-[0.1em]" style={MONO}>
            {(['1W', '1M', '3M', '6M', '1Y', 'ALL'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setNwRange(r)}
                className={`cursor-pointer rounded px-[11px] py-1.5 transition-colors ${
                  r === nwRange
                    ? 'bg-[var(--color-gold-surface)] text-[var(--color-gold)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div
            className={`text-[12px] tracking-[0.06em] ${
              marketStatus.state === 'live'
                ? 'text-[var(--color-positive)]'
                : marketStatus.state === 'delayed'
                  ? 'text-[var(--color-gold)]'
                  : 'text-[var(--color-text-muted)]'
            }`}
            style={MONO}
            title={lastQuoteAt ? `Last quote ${new Date(lastQuoteAt).toLocaleTimeString('en-US')}` : undefined}
          >
            ● {marketStatus.label}
          </div>
        </div>
      </div>

      {/* ── Sector heat strip ── */}
      <SectorHeatStrip sectors={sectorHeat} movers={heatMovers} formatPct={formatPercentage} />




      {/* ── Chart + Helm Brief ── */}
      <div className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.62fr_1fr]">
        {/* performance chart */}
        <div className={`${CARD} relative overflow-hidden px-[22px] pt-5 pb-3.5`}>
          <div className="mb-[18px] flex items-start justify-between">
            <div>
              <Eyebrow className="mb-2">Net worth · trend</Eyebrow>
              <div className="flex items-baseline gap-3">
                <span className="text-[21px] font-bold tracking-[-0.02em] tabular-nums">
                  {dispDollar !== null
                    ? `${dispPositive ? '+' : ''}${formatCurrency(dispDollar)}`
                    : formatCurrency(netWorth)}
                </span>
                {dispPct !== null && (
                  <span
                    className={`text-[15px] font-semibold ${
                      dispPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'
                    }`}
                    style={MONO}
                  >
                    {formatPercentage(dispPct)}
                  </span>
                )}
              </div>
            </div>
          </div>
          {chartSeries.length >= 2 ? (
            <PerformanceChart series={chartSeries} gradientId="nwFill" />
          ) : (
            <div className="flex h-[232px] items-center justify-center text-[14px] text-[var(--color-text-muted)]" style={MONO}>
              Not enough history yet — check back after a few days of snapshots.
            </div>
          )}
          {chartPoints.length >= 2 && (
            <div
              className="mt-1.5 flex justify-between border-t border-[var(--color-border-subtle)] pt-2 text-[10px] tracking-[0.08em] text-[#5a5a5a]"
              style={MONO}
            >
              {chartPoints
                .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 6)) === 0 || i === arr.length - 1)
                .slice(0, 7)
                .map((p, i) => (
                  <span key={i}>{p.label}</span>
                ))}
            </div>
          )}
        </div>

        {/* AI Helm Brief — tailored for Pro+, general market brief for Free */}
        {tierAtLeast(tier, 'pro') ? (
          <div
            className="flex h-full flex-col rounded-lg px-[22px] py-5"
            style={{
              border: '1px solid rgba(230,185,77,0.18)',
              background: 'rgba(230,185,77,0.025)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            <div className="mb-3.5 flex items-center gap-2.5">
              <Sparkles size={15} strokeWidth={1.6} className="text-[var(--color-gold)]" />
              <span className="text-[12px] uppercase tracking-[0.16em] text-[var(--color-gold)]" style={MONO}>
                Helm Brief
              </span>
              <span className="h-px flex-1" style={{ background: 'rgba(230,185,77,0.12)' }} />
            </div>

            {feedInsights.length > 0 ? (
              <>
                <p className="m-0 mb-3.5 text-[15px] leading-[1.62] text-[var(--color-text-primary)] text-pretty">
                  {feedInsights[0].summary}
                </p>
                <div className="mb-4 flex flex-col gap-2.5">
                  {feedInsights.slice(0, 3).map((ins) => {
                    const glyph =
                      ins.type === 'risk' ? '▲' : ins.type === 'opportunity' ? '＄' : '●';
                    const color =
                      ins.type === 'risk'
                        ? 'var(--color-warning-text)'
                        : ins.type === 'opportunity'
                          ? 'var(--color-positive)'
                          : 'var(--color-info-text)';
                    return (
                      <div key={ins.id} className="flex items-start gap-2.5">
                        <span className="text-[14px] leading-[1.4]" style={{ ...MONO, color }}>
                          {glyph}
                        </span>
                        <span className="text-[15px] leading-[1.5] text-[var(--color-text-secondary)]">
                          {ins.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="m-0 mb-4 flex-1 text-[15px] leading-[1.62] text-[var(--color-text-muted)]">
                Helm is still gathering signal across your book. Your first brief lands once a full day
                of data has synced.
              </p>
            )}

            <button
              onClick={() => router.push('/dashboard/brief')}
              className="mt-auto flex items-center justify-between rounded-[5px] px-3.5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-gold)]"
              style={{ ...MONO, border: '1px solid rgba(230,185,77,0.18)', background: 'rgba(230,185,77,0.08)' }}
            >
              Read full brief <span>→</span>
            </button>
          </div>
        ) : (
          <GeneralMarketBrief />
        )}
      </div>

      {/* ── KPI tiles ── */}
      <div className="mb-3.5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile
          label="Invested"
          value={formatCurrency(portfolioValue)}
          delta={netWorthPctChange !== null ? `${formatPercentage(netWorthPctChange)} · YTD` : '—'}
          tone={isPositiveChange ? 'positive' : 'negative'}
        />
        <KpiTile
          label="Cash"
          value={formatCurrency(cash)}
          delta={cash > 0 ? `${formatCurrency(cash)} liquid` : '—'}
          tone="muted"
        />
        <KpiTile
          label="Day change"
          value={dayChange !== null ? formatPercentage(dayChange) : '—'}
          delta="today"
          tone={dayChange !== null ? (dayChange >= 0 ? 'positive' : 'negative') : 'muted'}
        />
        <KpiTile
          label="Portfolio"
          value={formatCurrency(portfolioValue)}
          delta="market value"
          tone="muted"
        />
        <KpiTile
          label="Total assets"
          value={formatCurrency(invested)}
          delta="across all accounts"
          tone="muted"
        />
      </div>

      {/* ── Thesis conviction (gated; self-hides for non-allowlisted users) ── */}
      <div className="mb-3.5">
        <ThesisConvictionKpi />
      </div>

      {/* ── Actions + Allocation + Movers ── */}
      {/* The agent's first look — deterministic findings seconds after connect */}
      <AgentFirstLook />

      {/* minmax(0,…) so the donut/movers min-content can't steal width and crush
          the actions column into a one-word-per-line strip at 1024-1440. */}
      <div className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.92fr)]">
        {/* actions inbox */}
        <div className={`${CARD} px-5 py-[18px]`}>
          <div className="mb-1.5 flex items-center justify-between">
            <Eyebrow className="!text-[10px] !tracking-[0.14em]">Actions inbox</Eyebrow>
            <span className="text-[10px] tracking-[0.06em] text-[var(--color-text-muted)]" style={MONO}>
              {feedInsights.length} items · ranked by impact
            </span>
          </div>
          <div className="flex flex-col">
            {/* "You're all clear" is a FINDING, not a loading state. Rendered
                while the request was still in flight it told people the agent
                had checked and found nothing, seconds before four items
                appeared. Loading gets a shell; the all-clear waits its turn. */}
            {insightsLoading && feedInsights.length === 0 && (
              <div className="border-t border-[var(--color-border-subtle)] py-5">
                <Ghost label="Loading what the agent found">
                  <GhostBar w="64%" h={14} />
                  <GhostBar w="42%" h={12} className="mt-2.5" />
                </Ghost>
              </div>
            )}
            {!insightsLoading && feedInsights.length === 0 && (
              <div className="border-t border-[var(--color-border-subtle)] py-5 text-[15px] text-[var(--color-text-muted)]">
                You&apos;re all clear. Helm keeps watching your book.
              </div>
            )}
            {feedInsights.slice(0, 4).map((ins) => {
              const pr =
                ins.priority === 'high'
                  ? { label: 'HIGH', color: 'var(--color-negative-text)' }
                  : ins.priority === 'medium'
                    ? { label: 'MED', color: 'var(--color-warning-text)' }
                    : { label: 'LOW', color: 'var(--color-text-muted)' };
              return (
                <button
                  key={ins.id}
                  onClick={() => router.push('/dashboard/actions')}
                  className="flex cursor-pointer items-start gap-3 border-t border-[var(--color-border-subtle)] py-3.5 text-left"
                >
                  <span
                    className="mt-0.5 min-w-[34px] text-[9px] font-bold uppercase tracking-[0.12em]"
                    style={{ ...MONO, color: pr.color }}
                  >
                    {pr.label}
                  </span>
                  <div className="flex-1">
                    <div className="mb-[3px] text-[15px] font-semibold text-[var(--color-text-primary)]">
                      {ins.title}
                    </div>
                    <div className="text-[14px] leading-[1.5] text-[var(--color-text-muted)]">{ins.summary}</div>
                  </div>
                  <span
                    className="whitespace-nowrap rounded-sm border border-[var(--color-border-base)] bg-white/[0.03] px-[7px] py-[3px] text-[9px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]"
                    style={MONO}
                  >
                    {ins.type}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* allocation donut */}
        <div className={`${CARD} px-5 py-[18px]`}>
          <div className="mb-3.5 flex items-center justify-between">
            <Eyebrow className="!text-[10px] !tracking-[0.14em]">Allocation</Eyebrow>
            {topSectorPct > 40 && sectorSlices[0] && (
              <span className="text-[9px] tracking-[0.04em] text-[var(--color-warning-text)]" style={MONO}>
                ⚠ {sectorSlices[0].name} {topSectorPct.toFixed(0)}%
              </span>
            )}
          </div>
          {sectorSlices.length > 0 ? (
            <div className="flex items-center gap-[18px]">
              <AllocationDonut slices={sectorSlices} />
              <div className="flex flex-1 flex-col gap-2">
                {sectorSlices.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                    <span className="flex-1 text-[14px] text-[var(--color-text-secondary)]">{s.name}</span>
                    <span className="text-[12px] tabular-nums" style={MONO}>
                      {s.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : holdingsLoading ? (
            // Same rule as the movers list: "no sector data" is a conclusion,
            // and it cannot be drawn until the holdings request has answered.
            <div className="py-8">
              <Ghost label="Loading sector allocation">
                <GhostBar w="100%" h={10} />
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                  <GhostBar w={104} h={11} />
                  <GhostBar w={88} h={11} />
                  <GhostBar w={96} h={11} />
                </div>
              </Ghost>
            </div>
          ) : (
            <div className="py-8 text-center text-[14px] text-[var(--color-text-muted)]">
              No sector data yet.
            </div>
          )}

          {topHoldings.length > 0 && (
            <div className="mt-3.5 border-t border-[var(--color-border-subtle)] pt-3">
              <div className="mb-2 text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]" style={MONO}>
                Top positions
              </div>
              <div className="flex flex-col gap-1.5">
                {topHoldings.slice(0, 5).map((h) => (
                  <button
                    key={h.id}
                    onClick={() => router.push(`/dashboard/analyze/${h.ticker}`)}
                    className="flex cursor-pointer items-center gap-2.5 text-left"
                  >
                    <span className="w-[46px] text-[13px] font-bold text-[var(--color-gold)]" style={MONO}>
                      {h.ticker}
                    </span>
                    <span className="flex-1 truncate text-[12px] text-[var(--color-text-muted)]">{h.asset_name}</span>
                    <span className="text-[12px] tabular-nums text-[var(--color-text-secondary)]" style={MONO}>
                      {(h.portfolio_allocation || 0).toFixed(1)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* today's movers */}
        <div className={`${CARD} px-5 py-[18px]`}>
          <Eyebrow className="mb-1.5 !text-[10px] !tracking-[0.14em]">Today&apos;s movers</Eyebrow>
          <div className="flex flex-col">
            {holdingsLoading && movers.length === 0 && (
              <div className="border-t border-[var(--color-border-subtle)] py-4">
                <Ghost label="Loading today's movers">
                  <GhostBar w="52%" h={13} />
                  <GhostBar w="38%" h={13} className="mt-2.5" />
                </Ghost>
              </div>
            )}
            {!holdingsLoading && movers.length === 0 && (
              <div className="border-t border-[var(--color-border-subtle)] py-4 text-[14px] text-[var(--color-text-muted)]">
                No moves yet today.
              </div>
            )}
            {movers.map((h) => {
              const pct = h.day_change_percentage || 0;
              const up = pct >= 0;
              return (
                <button
                  key={h.id}
                  onClick={() => router.push(`/dashboard/analyze/${h.ticker}`)}
                  className="flex cursor-pointer items-center gap-2.5 border-t border-[var(--color-border-subtle)] py-[11px] text-left"
                >
                  <span className="w-[46px] text-[14px] font-bold text-[var(--color-gold)]" style={MONO}>
                    {h.ticker}
                  </span>
                  <span className="flex-1 truncate text-[12px] text-[var(--color-text-muted)]">{h.asset_name}</span>
                  <span
                    className={`text-[14px] font-semibold tabular-nums ${
                      up ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'
                    }`}
                    style={MONO}
                  >
                    {up ? '+' : ''}
                    {pct.toFixed(2)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Top holdings table ── */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-[var(--color-border-base)] px-5 py-3.5">
          <Eyebrow className="!text-[10px] !tracking-[0.14em]">
            Top holdings · {topHoldings.length} of {holdings.length}
          </Eyebrow>
          <button
            onClick={() => router.push('/dashboard/portfolio')}
            className="cursor-pointer border-none bg-transparent text-[10px] uppercase tracking-[0.12em] text-[var(--color-gold)]"
            style={MONO}
          >
            View all →
          </button>
        </div>
        <div className="overflow-x-auto">
          {/* min-width: on phones the table scrolls inside this container instead of
              crushing names to one word per line and clipping the Day column. */}
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr>
                {['Symbol', 'Name', 'Price', 'Day', 'Weight', 'Value'].map((h, i) => (
                  <th
                    key={h}
                    className={`border-b border-[var(--color-border-subtle)] px-5 py-2.5 text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)] ${
                      i >= 2 ? 'text-right' : 'text-left'
                    }`}
                    style={MONO}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topHoldings.map((h) => {
                const pct = h.day_change_percentage || 0;
                const up = pct >= 0;
                const weight = h.portfolio_allocation || 0;
                return (
                  <tr
                    key={h.id}
                    onClick={() => router.push(`/dashboard/analyze/${h.ticker}`)}
                    className="cursor-pointer hover:bg-white/[0.015]"
                  >
                    <td className="border-b border-[var(--color-border-subtle)] px-5 py-3.5 text-[15px] font-bold text-[var(--color-gold)]" style={MONO}>
                      {h.ticker}
                    </td>
                    <td className="border-b border-[var(--color-border-subtle)] px-5 py-3.5 text-[15px]">
                      {h.asset_name}
                      {h.sector && <span className="text-[12px] text-[var(--color-text-muted)]"> · {h.sector}</span>}
                    </td>
                    <td className="border-b border-[var(--color-border-subtle)] px-5 py-3.5 text-right text-[15px] tabular-nums" style={MONO}>
                      {formatCurrency(h.current_price || 0)}
                    </td>
                    <td
                      className={`border-b border-[var(--color-border-subtle)] px-5 py-3.5 text-right text-[15px] font-semibold tabular-nums ${
                        up ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'
                      }`}
                      style={MONO}
                    >
                      {up ? '+' : ''}
                      {pct.toFixed(2)}%
                    </td>
                    <td className="border-b border-[var(--color-border-subtle)] px-5 py-3.5 text-right text-[15px] text-[var(--color-text-muted)] tabular-nums" style={MONO}>
                      {weight.toFixed(1)}%
                    </td>
                    <td className="border-b border-[var(--color-border-subtle)] px-5 py-3.5 text-right text-[15px] font-semibold tabular-nums" style={MONO}>
                      {formatCurrency(h.total_value || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
