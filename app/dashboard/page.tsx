'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { tierAtLeast } from '@/lib/tier-shared';
import { useLivePrices } from '@/hooks/use-live-prices';
import posthog from 'posthog-js';

// ── Sovereign Architect tokens (local to this screen) ──────────────────────
const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const SCREEN: React.CSSProperties = { padding: '26px 28px 60px', maxWidth: 1320 };
const CARD =
  'rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.5)]';

// Sector → chart color (matches the README chart palette, in order).
const CHART_COLORS = ['#E6B94D', '#7AA3C7', '#9FB89D', '#C8A165', '#8E7DC7', '#5A6070'];

// ── Local presentational helpers ───────────────────────────────────────────

function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] ${className}`}
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
      <div className={`text-[13px] font-semibold mt-[9px] tabular-nums ${deltaColor}`} style={MONO}>
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
        <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-gold)]" style={MONO}>
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
                  className={`mt-1.5 text-[14px] font-semibold tabular-nums ${
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
        <p className="m-0 mb-3 flex-1 text-[14px] leading-[1.6] text-[var(--color-text-muted)]">
          Live market data is syncing. Today&apos;s brief lands once prices come through.
        </p>
      )}

      {topMover && (
        <p className="m-0 mb-3 text-[14px] leading-[1.55] text-[var(--color-text-secondary)]">
          Notable mover:{' '}
          <span className="font-semibold text-[var(--color-gold)]" style={MONO}>
            {topMover.symbol}
          </span>{' '}
          at {fmtPct2(topMover.changePct)}
          {stocks.length > 0 ? `. ${greens} of ${stocks.length} mega-caps tracked are green.` : '.'}
        </p>
      )}

      {rows.length > 0 && (
        <p className="m-0 mb-4 text-[14px] leading-[1.55] text-[var(--color-text-secondary)]">
          {macroRead(spy?.changePct ?? 0, greens, stocks.length)}
        </p>
      )}

      {/* Inline upgrade nudge — soft, no hard lock */}
      <Link
        href="/pricing"
        className="mt-auto flex items-center justify-between rounded-[5px] px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-gold)]"
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
    hasPlaidConnection,
    loading,
    error,
  } = useFinancialSummary();

  const { insights: feedInsights } = useIntelligence();

  // Live portfolio value: useHoldings polls /api/market/quotes every 30s and
  // recomputes totalValue client-side. Overrides the static DB aggregate.
  const { holdings, totalValue: liveHoldingsValue } = useHoldings();

  const { formatCurrency, formatPercentage } = useFormat();
  const { isDemo, enableDemo, disableDemo } = useDemo();
  const { tier, dataState } = usePreview();
  const router = useRouter();
  const toast = useToast();
  const [plaidError, setPlaidError] = useState<string | null>(null);
  const [nwRange, setNwRange] = useState<'3M' | '6M' | '1Y' | 'ALL'>('ALL');

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
    if (ageDays >= 25) return 'vs. last month';
    return `since ${new Date(`${baseline}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }, [financialSummary]);

  // ── Derived presentation data ──────────────────────────────────────────
  // Net-worth history is monthly snapshots; the range pills slice trailing
  // months. ALL keeps everything. (No intraday data → no 1D/1W ranges.)
  const rangedHistory = useMemo(() => {
    const n = { '3M': 3, '6M': 6, '1Y': 12, ALL: Infinity }[nwRange];
    return n === Infinity ? netWorthHistory : netWorthHistory.slice(-n);
  }, [netWorthHistory, nwRange]);

  const chartSeries = useMemo(
    () => (rangedHistory.length >= 2 ? rangedHistory.map((p) => p.value) : []),
    [rangedHistory],
  );

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

  const movers = useMemo(() => {
    return [...holdings]
      .filter((h) => h.ticker && h.ticker !== 'UNKNOWN' && h.day_change_percentage != null)
      .sort((a, b) => Math.abs(b.day_change_percentage || 0) - Math.abs(a.day_change_percentage || 0))
      .slice(0, 5);
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
      <div className="mx-auto" style={SCREEN}>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto" style={SCREEN}>
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

  if (hasNoData) {
    return (
      <div className="mx-auto" style={SCREEN}>
        <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
          <div className={`${CARD} w-full max-w-[560px] px-8 py-10 text-center`}>
            <div
              className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'rgba(230,185,77,0.08)', border: '1px solid rgba(230,185,77,0.18)' }}
            >
              <Link2 size={20} className="text-[var(--color-gold)]" />
            </div>
            <h1 className="text-[26px] font-bold tracking-[-0.025em] leading-[1.15] text-[var(--color-text-primary)] mb-3">
              Connect your brokerage
            </h1>
            <p className="mx-auto mb-6 max-w-[420px] text-[14px] leading-[1.65] text-[var(--color-text-muted)]">
              Helm reads your accounts over a read-only Plaid connection. It can never move money or
              place trades. Link an account to see your real net worth, allocation, and daily brief.
            </p>

            <div className="flex flex-col items-center gap-3">
              <PlaidLinkButton
                className="w-full max-w-[280px] rounded-[5px] px-9 py-3.5 text-[14px] font-bold"
                onSuccess={() => router.refresh()}
                onError={(msg) => setPlaidError(msg)}
                onLinkError={(_code, message) => {
                  toast.error('Connection failed', message);
                }}
              >
                Connect account
              </PlaidLinkButton>
              <button
                onClick={() => {
                  enableDemo();
                  router.refresh();
                }}
                className="cursor-pointer bg-transparent text-[14px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold)]"
              >
                Explore with demo data →
              </button>
            </div>

            {plaidError && <p className="mt-3 text-[14px] text-[var(--color-negative-text)]">{plaidError}</p>}

            <p className="mt-7 text-[11px] tracking-[0.06em] text-[#5a5a5a]" style={MONO}>
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
  const showDemoBanner = isDemo || dataState === 'demo';

  const invested = financialSummary?.total_assets || 0;
  const cash =
    (financialSummary?.total_assets || 0) - ((!isDemo && liveHoldingsValue > 0)
      ? liveHoldingsValue
      : financialSummary?.portfolio_value || 0);
  const portfolioValue =
    !isDemo && liveHoldingsValue > 0 ? liveHoldingsValue : financialSummary?.portfolio_value || 0;
  const dayChange = financialSummary?.changes?.portfolio ?? null;

  return (
    <div className="mx-auto stagger-fade-in" style={SCREEN}>
      {showDemoBanner && (
        <div className="mb-4 flex flex-col items-start justify-between gap-2 rounded-md border border-[var(--color-info-border)] bg-[var(--color-info-muted)] px-4 py-2.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-info-text)]" style={MONO}>
              Demo data
            </span>
            <span className="hidden text-[14px] text-[var(--color-text-muted)] sm:inline">
              You&apos;re viewing a sample portfolio.
            </span>
          </div>
          <button
            onClick={disableDemo}
            className="cursor-pointer text-[13px] font-semibold text-[var(--color-info-text)] transition-colors hover:brightness-110"
          >
            Connect →
          </button>
        </div>
      )}

      {/* ── Net-worth header ── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <Eyebrow className="mb-2 !tracking-[0.2em] !text-[13px]">Net worth · All accounts · USD</Eyebrow>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <div className="text-[46px] font-bold leading-none tracking-[-0.03em] tabular-nums">
              {formatCurrency(netWorth)}
            </div>
            {(netWorthChange !== null || netWorthPctChange !== null) && (
              <div
                className={`flex items-center gap-2 rounded-[5px] px-3 py-[5px] ${
                  isPositiveChange
                    ? 'border border-[var(--color-positive-border)] bg-[var(--color-positive-muted)]'
                    : 'border border-[var(--color-negative-border)] bg-[var(--color-negative-muted)]'
                }`}
              >
                <span
                  className={`text-[14px] font-semibold tabular-nums ${
                    isPositiveChange ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'
                  }`}
                  style={MONO}
                >
                  {netWorthChange !== null && (
                    <>
                      {isPositiveChange ? '+' : ''}
                      {formatCurrency(netWorthChange)}
                    </>
                  )}
                  {netWorthChange !== null && netWorthPctChange !== null && ' · '}
                  {netWorthPctChange !== null && formatPercentage(netWorthPctChange)}
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)]" style={MONO}>
                  {netWorthChangeLabel}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2.5">
          <div className="flex gap-1 text-[11px] uppercase tracking-[0.1em]" style={MONO}>
            {(['3M', '6M', '1Y', 'ALL'] as const).map((r) => (
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
          <div className="text-[11px] tracking-[0.06em] text-[var(--color-text-muted)]" style={MONO}>
            ● Live
          </div>
        </div>
      </div>

      {/* ── Chart + Helm Brief ── */}
      <div className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.62fr_1fr]">
        {/* performance chart */}
        <div className={`${CARD} relative overflow-hidden px-[22px] pt-5 pb-3.5`}>
          <div className="mb-[18px] flex items-start justify-between">
            <div>
              <Eyebrow className="mb-2">Net worth · trend</Eyebrow>
              <div className="flex items-baseline gap-3">
                <span className="text-[21px] font-bold tracking-[-0.02em] tabular-nums">
                  {netWorthChange !== null
                    ? `${isPositiveChange ? '+' : ''}${formatCurrency(netWorthChange)}`
                    : formatCurrency(netWorth)}
                </span>
                {netWorthPctChange !== null && (
                  <span
                    className={`text-[14px] font-semibold ${
                      isPositiveChange ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'
                    }`}
                    style={MONO}
                  >
                    {formatPercentage(netWorthPctChange)}
                  </span>
                )}
              </div>
            </div>
          </div>
          {chartSeries.length >= 2 ? (
            <PerformanceChart series={chartSeries} gradientId="nwFill" />
          ) : (
            <div className="flex h-[232px] items-center justify-center text-[13px] text-[var(--color-text-muted)]" style={MONO}>
              Not enough history yet — check back after a few days of snapshots.
            </div>
          )}
          {rangedHistory.length >= 2 && (
            <div
              className="mt-1.5 flex justify-between border-t border-[var(--color-border-subtle)] pt-2 text-[10px] tracking-[0.08em] text-[#5a5a5a]"
              style={MONO}
            >
              {rangedHistory
                .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 6)) === 0 || i === arr.length - 1)
                .slice(0, 7)
                .map((p, i) => (
                  <span key={i}>{p.month}</span>
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
              <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-gold)]" style={MONO}>
                Helm Brief
              </span>
              <span className="h-px flex-1" style={{ background: 'rgba(230,185,77,0.12)' }} />
            </div>

            {feedInsights.length > 0 ? (
              <>
                <p className="m-0 mb-3.5 text-[14px] leading-[1.62] text-[var(--color-text-primary)] text-pretty">
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
                        <span className="text-[13px] leading-[1.4]" style={{ ...MONO, color }}>
                          {glyph}
                        </span>
                        <span className="text-[14px] leading-[1.5] text-[var(--color-text-secondary)]">
                          {ins.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="m-0 mb-4 flex-1 text-[14px] leading-[1.62] text-[var(--color-text-muted)]">
                Helm is still gathering signal across your book. Your first brief lands once a full day
                of data has synced.
              </p>
            )}

            <button
              onClick={() => router.push('/dashboard/brief')}
              className="mt-auto flex items-center justify-between rounded-[5px] px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-gold)]"
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
          value={dayChange !== null ? `${dayChange >= 0 ? '+' : ''}${formatPercentage(dayChange)}` : '—'}
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
      <div className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.5fr_1fr_0.92fr]">
        {/* actions inbox */}
        <div className={`${CARD} px-5 py-[18px]`}>
          <div className="mb-1.5 flex items-center justify-between">
            <Eyebrow className="!text-[10px] !tracking-[0.14em]">Actions inbox</Eyebrow>
            <span className="text-[10px] tracking-[0.06em] text-[var(--color-text-muted)]" style={MONO}>
              {feedInsights.length} items · ranked by impact
            </span>
          </div>
          <div className="flex flex-col">
            {feedInsights.length === 0 && (
              <div className="border-t border-[var(--color-border-subtle)] py-5 text-[14px] text-[var(--color-text-muted)]">
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
                    <div className="mb-[3px] text-[14px] font-semibold text-[var(--color-text-primary)]">
                      {ins.title}
                    </div>
                    <div className="text-[13px] leading-[1.5] text-[var(--color-text-muted)]">{ins.summary}</div>
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
                    <span className="flex-1 text-[13px] text-[var(--color-text-secondary)]">{s.name}</span>
                    <span className="text-[11px] tabular-nums" style={MONO}>
                      {s.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-[13px] text-[var(--color-text-muted)]">
              No sector data yet.
            </div>
          )}
        </div>

        {/* today's movers */}
        <div className={`${CARD} px-5 py-[18px]`}>
          <Eyebrow className="mb-1.5 !text-[10px] !tracking-[0.14em]">Today&apos;s movers</Eyebrow>
          <div className="flex flex-col">
            {movers.length === 0 && (
              <div className="border-t border-[var(--color-border-subtle)] py-4 text-[13px] text-[var(--color-text-muted)]">
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
                  <span className="w-[46px] text-[13px] font-bold text-[var(--color-gold)]" style={MONO}>
                    {h.ticker}
                  </span>
                  <span className="flex-1 truncate text-[11px] text-[var(--color-text-muted)]">{h.asset_name}</span>
                  <span
                    className={`text-[13px] font-semibold tabular-nums ${
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
          <table className="w-full border-collapse">
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
                    <td className="border-b border-[var(--color-border-subtle)] px-5 py-3.5 text-[14px] font-bold text-[var(--color-gold)]" style={MONO}>
                      {h.ticker}
                    </td>
                    <td className="border-b border-[var(--color-border-subtle)] px-5 py-3.5 text-[14px]">
                      {h.asset_name}
                      {h.sector && <span className="text-[11px] text-[var(--color-text-muted)]"> · {h.sector}</span>}
                    </td>
                    <td className="border-b border-[var(--color-border-subtle)] px-5 py-3.5 text-right text-[14px] tabular-nums" style={MONO}>
                      {formatCurrency(h.current_price || 0)}
                    </td>
                    <td
                      className={`border-b border-[var(--color-border-subtle)] px-5 py-3.5 text-right text-[14px] font-semibold tabular-nums ${
                        up ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'
                      }`}
                      style={MONO}
                    >
                      {up ? '+' : ''}
                      {pct.toFixed(2)}%
                    </td>
                    <td className="border-b border-[var(--color-border-subtle)] px-5 py-3.5 text-right text-[14px] text-[var(--color-text-muted)] tabular-nums" style={MONO}>
                      {weight.toFixed(1)}%
                    </td>
                    <td className="border-b border-[var(--color-border-subtle)] px-5 py-3.5 text-right text-[14px] font-semibold tabular-nums" style={MONO}>
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
