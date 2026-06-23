'use client';

// Earnings — Sovereign Architect redesign. Presentation-only rebuild of the
// EDGAR-backed earnings screen. Data fetching + isPro/thesis/scenario logic from
// useEarnings() is preserved untouched; only the markup and states are new.

import Link from 'next/link';
import { useFormat } from '@/hooks/use-format';
import { useEarnings } from '@/hooks/use-financial-data';
import type { UpcomingEarning, RecentEarning } from '@/hooks/use-financial-data';
import { usePreview } from '@/lib/preview-context';
import { TierLock } from '@/components/tier-lock';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_META } from '@/lib/thesis-palette';
import {
  Calendar,
  Link2,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

// ── Tokens ──

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const TNUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: "'tnum' 1" };

// Sovereign card surface, shared across the redesign.
const CARD: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-base)',
  boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
};

// ── Shared bits ──

function HeadCell({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className="px-5 py-[11px] text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)] border-b border-[var(--color-border-base)]"
      style={{ ...MONO, textAlign: align }}
    >
      {children}
    </th>
  );
}

function timeLabel(t: UpcomingEarning['time']): string {
  if (t === 'before_open') return 'Before open';
  if (t === 'after_close') return 'After close';
  return 'TBD';
}

function fmtDateCell(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${wd} · ${md}`;
}

// ── Upcoming earnings table ──
// Columns mirror the mockup exactly: Date · Symbol · Time · Cons. EPS · Implied
// move · Your exposure. Rows link to Analyze. Implied move has no EDGAR source,
// so it renders honestly as a muted placeholder rather than a fabricated figure.

function UpcomingTable({ rows }: { rows: UpcomingEarning[] }) {
  return (
    <div className="rounded-lg overflow-hidden" style={CARD}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <HeadCell>Date</HeadCell>
              <HeadCell>Symbol</HeadCell>
              <HeadCell>Time</HeadCell>
              <HeadCell align="right">Cons. EPS</HeadCell>
              <HeadCell align="right">Implied move</HeadCell>
              <HeadCell align="right">Your exposure</HeadCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => {
              const last = i === rows.length - 1;
              const border = last ? 'none' : '1px solid var(--color-border-subtle)';
              return (
                <tr key={`${e.ticker}-${i}`} className="group hover:bg-white/[0.015] transition-colors">
                  <td className="p-0" style={{ borderBottom: border }}>
                    <Link href={`/dashboard/analyze/${e.ticker}`} className="block px-5 py-[14px] text-[12px] text-[var(--color-text-secondary)]" style={MONO}>
                      {fmtDateCell(e.date)}
                      {e.estimated && (
                        <span className="ml-1.5 text-[10px] text-[var(--color-text-muted)]">est.</span>
                      )}
                    </Link>
                  </td>
                  <td className="p-0" style={{ borderBottom: border }}>
                    <Link href={`/dashboard/analyze/${e.ticker}`} className="block px-5 py-[14px]">
                      <span className="text-[13px] font-bold text-[var(--color-gold)]" style={MONO}>{e.ticker}</span>
                      <span className="ml-2 text-[11px] text-[var(--color-text-muted)] hidden md:inline" style={MONO}>
                        {e.companyName}
                      </span>
                    </Link>
                  </td>
                  <td className="p-0" style={{ borderBottom: border }}>
                    <Link href={`/dashboard/analyze/${e.ticker}`} className="block px-5 py-[14px] text-[11px] text-[var(--color-text-muted)]" style={MONO}>
                      {timeLabel(e.time)}
                    </Link>
                  </td>
                  <td className="p-0" style={{ borderBottom: border }}>
                    <Link href={`/dashboard/analyze/${e.ticker}`} className="block px-5 py-[14px] text-right text-[13px] text-[var(--color-text-primary)]" style={{ ...MONO, ...TNUM }}>
                      {e.epsEstimate != null ? `$${e.epsEstimate.toFixed(2)}` : <span className="text-[var(--color-text-muted)]">—</span>}
                    </Link>
                  </td>
                  <td className="p-0" style={{ borderBottom: border }}>
                    <Link href={`/dashboard/analyze/${e.ticker}`} className="block px-5 py-[14px] text-right text-[13px] text-[var(--color-text-muted)]" style={{ ...MONO, ...TNUM }}>
                      —
                    </Link>
                  </td>
                  <td className="p-0" style={{ borderBottom: border }}>
                    <Link href={`/dashboard/analyze/${e.ticker}`} className="block px-5 py-[14px] text-right text-[13px] font-semibold text-[var(--color-text-primary)]" style={{ ...MONO, ...TNUM }}>
                      {e.position.allocationPct.toFixed(1)}%
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Recent earnings table ──
// Preserves the EDGAR-backed recent-results data (beat/miss, EPS actual vs est,
// pro impact figures). Same table aesthetic as upcoming; pro figures gate inline.

function RecentTable({
  rows,
  isPro,
  formatCurrency,
}: {
  rows: RecentEarning[];
  isPro: boolean;
  formatCurrency: (n: number) => string;
}) {
  return (
    <div className="rounded-lg overflow-hidden" style={CARD}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <HeadCell>Date</HeadCell>
              <HeadCell>Symbol</HeadCell>
              <HeadCell align="right">EPS actual</HeadCell>
              <HeadCell align="right">vs est.</HeadCell>
              <HeadCell align="right">Your position</HeadCell>
              <HeadCell align="right">Impact</HeadCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const last = i === rows.length - 1;
              const border = last ? 'none' : '1px solid var(--color-border-subtle)';
              const hasComparison = r.epsEstimate != null;
              const surpriseColor = !hasComparison
                ? 'var(--color-text-muted)'
                : r.beat ? 'var(--color-positive)' : 'var(--color-negative-text)';
              const impact = r.actualDollarImpact ?? 0;
              return (
                <tr key={`${r.ticker}-${i}`} className="group hover:bg-white/[0.015] transition-colors">
                  <td className="p-0" style={{ borderBottom: border }}>
                    <Link href={`/dashboard/analyze/${r.ticker}`} className="block px-5 py-[14px] text-[12px] text-[var(--color-text-secondary)]" style={MONO}>
                      {r.date || '—'}
                    </Link>
                  </td>
                  <td className="p-0" style={{ borderBottom: border }}>
                    <Link href={`/dashboard/analyze/${r.ticker}`} className="block px-5 py-[14px] flex items-center gap-2">
                      {hasComparison && (
                        r.beat
                          ? <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: 'var(--color-positive)' }} />
                          : <XCircle className="w-3 h-3 shrink-0" style={{ color: 'var(--color-negative-text)' }} />
                      )}
                      <span className="text-[13px] font-bold text-[var(--color-gold)]" style={MONO}>{r.ticker}</span>
                      <span className="text-[11px] text-[var(--color-text-muted)] hidden md:inline truncate max-w-[160px]" style={MONO}>
                        {r.companyName}
                      </span>
                    </Link>
                  </td>
                  <td className="p-0" style={{ borderBottom: border }}>
                    <Link href={`/dashboard/analyze/${r.ticker}`} className="block px-5 py-[14px] text-right text-[13px] text-[var(--color-text-primary)]" style={{ ...MONO, ...TNUM }}>
                      {r.epsActual != null ? `$${r.epsActual.toFixed(2)}` : <span className="text-[var(--color-text-muted)]">—</span>}
                    </Link>
                  </td>
                  <td className="p-0" style={{ borderBottom: border }}>
                    <Link href={`/dashboard/analyze/${r.ticker}`} className="block px-5 py-[14px] text-right text-[13px] font-semibold" style={{ ...MONO, ...TNUM, color: surpriseColor }}>
                      {hasComparison && r.surprisePct != null
                        ? `${r.surprisePct >= 0 ? '+' : ''}${r.surprisePct.toFixed(1)}%`
                        : <span className="text-[var(--color-text-muted)]">—</span>}
                    </Link>
                  </td>
                  <td className="p-0" style={{ borderBottom: border }}>
                    <Link href={`/dashboard/analyze/${r.ticker}`} className="block px-5 py-[14px] text-right text-[13px] text-[var(--color-text-primary)]" style={{ ...MONO, ...TNUM }}>
                      {formatCurrency(r.position.totalValue)}
                    </Link>
                  </td>
                  <td className="p-0" style={{ borderBottom: border }}>
                    {!isPro ? (
                      <Link href={`/dashboard/analyze/${r.ticker}`} className="block px-5 py-[14px] text-right text-[11px] text-[var(--color-text-muted)]" style={MONO}>
                        Pro
                      </Link>
                    ) : r.actualDollarImpact != null ? (
                      <Link
                        href={`/dashboard/analyze/${r.ticker}`}
                        className="block px-5 py-[14px] text-right text-[13px] font-semibold"
                        style={{ ...MONO, ...TNUM, color: impact >= 0 ? 'var(--color-positive)' : 'var(--color-negative-text)' }}
                      >
                        {impact >= 0 ? '+' : ''}{formatCurrency(impact)}
                      </Link>
                    ) : (
                      <Link href={`/dashboard/analyze/${r.ticker}`} className="block px-5 py-[14px] text-right text-[13px] text-[var(--color-text-muted)]" style={MONO}>
                        &mdash;
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Centered-panel states (shared "Connect your brokerage" vocabulary) ──

function ConnectEmpty() {
  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-6 py-10">
      <div className="max-w-[460px] text-center">
        <div
          className="mx-auto mb-[22px] inline-flex h-[60px] w-[60px] items-center justify-center rounded-[14px]"
          style={{ background: 'rgba(230,185,77,0.06)', border: '1px solid rgba(230,185,77,0.18)' }}
        >
          <Link2 size={26} className="text-[var(--color-gold)]" strokeWidth={1.6} />
        </div>
        <h1 className="text-[24px] font-bold tracking-[-0.025em] leading-[1.1] text-[var(--color-text-primary)] mb-3">
          Connect your brokerage
        </h1>
        <p className="text-[14px] leading-[1.65] text-[var(--color-text-muted)]">
          Helm tracks the earnings calendar for every position over a read-only connection, then
          surfaces your exposure here when reports approach. Link an account to get started.
        </p>
      </div>
    </div>
  );
}

function NoEarningsEmpty() {
  return (
    <div className="flex items-center justify-center px-6 py-16">
      <div className="max-w-[460px] text-center">
        <div
          className="mx-auto mb-[22px] inline-flex h-[60px] w-[60px] items-center justify-center rounded-[14px]"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border-base)' }}
        >
          <Calendar size={26} className="text-[var(--color-text-muted)]" strokeWidth={1.6} />
        </div>
        <h2 className="text-[24px] font-bold tracking-[-0.025em] leading-[1.1] text-[var(--color-text-primary)] mb-3">
          No earnings in your holdings this week
        </h2>
        <p className="text-[14px] leading-[1.65] text-[var(--color-text-muted)]">
          Helm tracks the calendar for every position and surfaces your exposure here when reports
          approach.
        </p>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <main className="mx-auto px-7 py-[26px] pb-[60px] max-w-[1240px] space-y-[22px]">
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-96 max-w-full" />
      </div>
      <div className="rounded-lg p-5 space-y-3" style={CARD}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </main>
  );
}

// ── Main page ──

export default function EarningsPage() {
  return (
    <TierLock
      required="pro"
      label="Earnings exposure is a Pro feature"
      blurb="See what's reporting across your book, the consensus expectations, and exactly how much of your portfolio is exposed each week."
    >
      <EarningsContent />
    </TierLock>
  );
}

function EarningsContent() {
  const { formatCurrency } = useFormat();
  const { dataState } = usePreview();
  const { report, loading, error, isPro } = useEarnings();

  // Connect-your-brokerage: no account linked (or preview Empty toggle).
  const notConnected = dataState === 'empty' || (!loading && !error && !report);

  if (loading) return <PageSkeleton />;

  if (notConnected) {
    return (
      <main className="mx-auto px-7 py-[26px] pb-[60px] max-w-[1240px]" aria-label="Earnings">
        <ConnectEmpty />
      </main>
    );
  }

  const upcoming = report?.upcoming ?? [];
  const recent = report?.recent ?? [];

  // Share of book reporting soon — the warning chip headline figure.
  const exposurePct = upcoming.reduce((sum, e) => sum + (e.position.allocationPct || 0), 0);

  // Connected but nothing scheduled and nothing recent → calm empty state.
  const nothingToShow = upcoming.length === 0 && recent.length === 0;

  return (
    <main className="mx-auto px-7 py-[26px] pb-[60px] max-w-[1240px] space-y-[22px]" aria-label="Earnings">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2" style={MONO}>
            Earnings · Next 14 days
          </div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.025em] leading-[1.08] text-[var(--color-text-primary)]">
            What&apos;s reporting, and your exposure
          </h1>
        </div>

        {upcoming.length > 0 && (
          <div
            className="flex items-center gap-[9px] px-[14px] py-2 rounded-md shrink-0"
            style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}
          >
            <Calendar className="w-[14px] h-[14px] shrink-0" style={{ color: 'var(--color-warning-text)' }} strokeWidth={1.7} />
            <span className="text-[12px] text-[var(--color-text-primary)]">
              <span className="font-semibold" style={{ color: 'var(--color-warning-text)' }}>{exposurePct.toFixed(1)}%</span> of your book reports soon
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-lg px-5 py-4 flex items-center gap-3"
          style={{ background: 'var(--color-negative-muted)', border: '1px solid var(--color-negative-border)' }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'var(--color-negative-text)' }} />
          <span className="text-[13px]" style={{ color: 'var(--color-negative-text)' }}>{error}</span>
        </div>
      )}

      {/* Calm empty: connected, nothing scheduled or recent */}
      {!error && nothingToShow && <NoEarningsEmpty />}

      {/* Upcoming */}
      {upcoming.length > 0 && <UpcomingTable rows={upcoming} />}

      {/* Thesis read — verbatim pillar tests for upcoming reports (preserved logic) */}
      {upcoming.some((e) => e.thesisStatus) && (
        <div className="rounded-lg overflow-hidden" style={CARD}>
          <div className="px-5 py-[11px] border-b border-[var(--color-border-base)]">
            <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]" style={MONO}>
              The next read on your theses
            </span>
          </div>
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {upcoming.filter((e) => e.thesisStatus).map((e, i) => {
              const meta = STATUS_META[e.thesisStatus as keyof typeof STATUS_META];
              return (
                <div key={`${e.ticker}-thesis-${i}`} className="px-5 py-4" style={{ borderLeft: `2px solid ${meta.color}` }}>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[13px] font-bold text-[var(--color-gold)]" style={MONO}>{e.ticker}</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.12em]"
                      style={{ ...MONO, color: meta.color, background: `${meta.color}1A` }}
                    >
                      Thesis: {meta.label}
                    </span>
                  </div>
                  {e.testPillar && (
                    <p className="text-[13.5px] leading-[1.6] text-[var(--color-text-secondary)] italic m-0 pl-3" style={{ borderLeft: `1px solid ${meta.color}` }}>
                      &ldquo;{e.testPillar}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent results */}
      {recent.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]" style={MONO}>
              Recently reported
            </div>
            {isPro && report && report.recentNetImpact != null && (
              <div className="flex items-center gap-1.5">
                {report.recentNetImpact >= 0
                  ? <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--color-positive)' }} />
                  : <TrendingDown className="w-3.5 h-3.5" style={{ color: 'var(--color-negative-text)' }} />}
                <span className="text-[12px] font-semibold" style={{ ...MONO, ...TNUM, color: report.recentNetImpact >= 0 ? 'var(--color-positive)' : 'var(--color-negative-text)' }}>
                  {report.recentNetImpact >= 0 ? '+' : ''}{formatCurrency(report.recentNetImpact)} net
                </span>
              </div>
            )}
          </div>
          <RecentTable rows={recent} isPro={isPro} formatCurrency={formatCurrency} />
        </div>
      )}

      {/* Methodology / no-black-boxes footnote */}
      {(upcoming.length > 0 || recent.length > 0) && (
        <p className="text-[10px] text-[var(--color-text-muted)] leading-[1.6]" style={MONO}>
          Dates and consensus pulled from SEC filings and the earnings calendar. Impact estimates use
          a simplified model (1% EPS surprise ≈ 0.5% move) and are not financial advice.
        </p>
      )}
    </main>
  );
}
