'use client';

import { useFormat } from '@/hooks/use-format';
import { useEarnings } from '@/hooks/use-financial-data';
import type { UpcomingEarning, RecentEarning } from '@/hooks/use-financial-data';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import { ProBlur } from '@/components/pro-blur';
import { STATUS_META } from '@/lib/thesis-palette';

// ── Upcoming Earnings Card ──

function UpcomingCard({ event, formatCurrency, isPro }: { event: UpcomingEarning; formatCurrency: (n: number) => string; isPro: boolean }) {
  const dateObj = new Date(event.date + 'T12:00:00');
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = dateObj.getDate();
  const timeLabel = event.time === 'before_open' ? 'Before Open' : event.time === 'after_close' ? 'After Close' : 'TBD';

  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}
    >
      <div className="flex">
        {/* Date column */}
        <div className="w-20 shrink-0 flex flex-col items-center justify-center py-4 border-r border-[var(--color-border-subtle)]" style={{ background: 'var(--color-bg-elevated)' }}>
          <span className="type-eyebrow text-[var(--color-text-muted)]">{month}</span>
          <span className="type-data text-2xl">{day}</span>
          {event.estimated ? (
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mt-1" style={{ fontFamily: 'var(--font-mono)' }}>Est.</span>
          ) : (
            <div className="flex items-center gap-1 mt-1">
              <Clock className="w-2.5 h-2.5 text-[var(--color-text-muted)]" />
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>{timeLabel}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 px-3 sm:px-5 py-3 sm:py-3.5">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
              <span className="text-base sm:text-lg font-bold tracking-tight text-[var(--color-text-primary)]">{event.ticker}</span>
              <span className="text-[11px] text-[var(--color-text-muted)] truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                {event.companyName}
              </span>
            </div>
            <span className="type-eyebrow text-[var(--color-text-muted)] shrink-0 hidden sm:inline">{event.position.sector}</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 mt-2 mb-3 flex-wrap">
            <div>
              <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Your Exposure</div>
              <div className="text-[14px] font-semibold text-[var(--color-text-primary)] font-tabular">
                {formatCurrency(event.position.totalValue)}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                {event.position.allocationPct.toFixed(1)}% of portfolio
              </div>
            </div>
            {event.epsEstimate != null && (
              <div>
                <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Consensus EPS</div>
                <div className="text-[14px] font-semibold text-[var(--color-text-primary)] font-tabular">
                  ${event.epsEstimate.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {event.estimated && (
            <div className="text-[11px] text-[var(--color-text-muted)] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
              Date estimated from filing history.
            </div>
          )}

          {/* Thesis test */}
          {event.thesisStatus && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: STATUS_META[event.thesisStatus].color,
                    background: `${STATUS_META[event.thesisStatus].color}1A`,
                  }}
                >
                  THESIS: {STATUS_META[event.thesisStatus].label.toUpperCase()}
                </span>
                <span className="text-[13px] text-[var(--color-text-secondary)]">
                  Next earnings is the next read on this thesis.
                </span>
              </div>
              {event.testPillar && (
                <div
                  className="pl-2.5 text-[13px] italic text-[var(--color-text-secondary)]"
                  style={{ borderLeft: `2px solid ${STATUS_META[event.thesisStatus].color}` }}
                >
                  &ldquo;{event.testPillar}&rdquo;
                </div>
              )}
            </div>
          )}

          {/* Scenario analysis */}
          {isPro ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-sm" style={{ background: 'rgba(56, 211, 159, 0.06)', border: '1px solid rgba(56, 211, 159, 0.15)' }}>
                <TrendingUp className="w-3 h-3 text-[var(--color-positive)] shrink-0" />
                <div>
                  <div className="text-[10px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>If beats by 5%</div>
                  <div className="text-[13px] font-bold text-[var(--color-positive)] font-tabular">
                    +{formatCurrency(event.beatImpact5pct ?? 0)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-sm" style={{ background: 'rgba(248, 113, 113, 0.06)', border: '1px solid rgba(248, 113, 113, 0.15)' }}>
                <TrendingDown className="w-3 h-3 text-[var(--color-negative)] shrink-0" />
                <div>
                  <div className="text-[10px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>If misses by 5%</div>
                  <div className="text-[13px] font-bold text-[var(--color-negative)] font-tabular">
                    {formatCurrency(event.missImpact5pct ?? 0)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <ProBlur label="Unlock scenario analysis" description="See estimated portfolio impact if this stock beats or misses earnings." variant="overlay" minHeight="56px">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-sm" style={{ background: 'rgba(56, 211, 159, 0.06)' }}>
                  <TrendingUp className="w-3 h-3 text-[var(--color-positive)]" />
                  <div className="text-[13px] font-bold text-[var(--color-positive)]">+$X,XXX</div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-sm" style={{ background: 'rgba(248, 113, 113, 0.06)' }}>
                  <TrendingDown className="w-3 h-3 text-[var(--color-negative)]" />
                  <div className="text-[13px] font-bold text-[var(--color-negative)]">-$X,XXX</div>
                </div>
              </div>
            </ProBlur>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Recent Earnings Card ──

function RecentCard({ result, formatCurrency, isPro }: { result: RecentEarning; formatCurrency: (n: number) => string; isPro: boolean }) {
  // EDGAR gives the report date but no EPS estimate, so beat/miss framing only
  // applies when an estimate is present.
  const hasComparison = result.epsEstimate != null;
  const borderColor = !hasComparison
    ? 'var(--color-border-base)'
    : result.beat ? 'rgba(56, 211, 159, 0.25)' : 'rgba(248, 113, 113, 0.25)';
  const StatusIcon = !hasComparison ? CheckCircle2 : result.beat ? CheckCircle2 : XCircle;
  const statusColor = !hasComparison
    ? 'var(--color-text-secondary)'
    : result.beat ? 'var(--color-positive)' : 'var(--color-negative)';
  const headerBg = !hasComparison
    ? 'var(--color-bg-elevated)'
    : result.beat ? 'rgba(56, 211, 159, 0.04)' : 'rgba(248, 113, 113, 0.04)';
  const statusText = !hasComparison
    ? (result.date ? `reported ${result.date}` : 'reported earnings')
    : result.beat
    ? `beat estimates by ${Math.abs(result.surprisePct || 0).toFixed(1)}%`
    : `missed estimates by ${Math.abs(result.surprisePct || 0).toFixed(1)}%`;

  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{ background: 'var(--color-bg-surface)', border: `1px solid ${borderColor}` }}
    >
      {/* Status header */}
      <div className="px-3 sm:px-5 py-2 sm:py-2.5 flex items-center gap-2 border-b border-[var(--color-border-subtle)]" style={{ background: headerBg }}>
        <StatusIcon className="w-3.5 h-3.5" style={{ color: statusColor }} />
        <span className="text-[12px] font-semibold" style={{ color: statusColor, fontFamily: 'var(--font-mono)' }}>
          {result.ticker} {statusText}
        </span>
      </div>

      {/* Details */}
      <div className="px-3 sm:px-5 py-3 sm:py-3.5">
        <div className="flex items-baseline gap-2 mb-3 flex-wrap">
          <span className="text-base sm:text-lg font-bold tracking-tight text-[var(--color-text-primary)]">{result.ticker}</span>
          <span className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[120px] sm:max-w-none" style={{ fontFamily: 'var(--font-mono)' }}>
            {result.companyName}
          </span>
          {result.date && (
            <span className="type-eyebrow text-[var(--color-text-muted)] ml-auto shrink-0">{result.date}</span>
          )}
        </div>

        {/* EPS comparison */}
        {result.epsActual != null && result.epsEstimate != null && (
          <div className="flex items-center gap-3 sm:gap-4 mb-3 flex-wrap">
            <div>
              <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">EPS Actual</div>
              <div className="text-[14px] font-semibold text-[var(--color-text-primary)] font-tabular">
                ${result.epsActual.toFixed(2)}
              </div>
            </div>
            <div className="text-[var(--color-text-muted)]">vs</div>
            <div>
              <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">EPS Estimate</div>
              <div className="text-[14px] font-semibold text-[var(--color-text-secondary)] font-tabular">
                ${result.epsEstimate.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Impact grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--color-border-subtle)] rounded-sm overflow-hidden">
          <div className="bg-[var(--color-bg-surface)] px-3 sm:px-4 py-2 sm:py-3">
            <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Your Position</div>
            <div className="text-[15px] font-bold text-[var(--color-text-primary)] font-tabular">
              {formatCurrency(result.position.totalValue)}
            </div>
          </div>
          {isPro ? (
            <>
              <div className="bg-[var(--color-bg-surface)] px-3 sm:px-4 py-2 sm:py-3">
                <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Est. Impact</div>
                <div
                  className="text-[15px] font-bold font-tabular"
                  style={{ color: (result.estimatedImpact ?? 0) >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
                >
                  {(result.estimatedImpact ?? 0) >= 0 ? '+' : ''}{formatCurrency(result.estimatedImpact ?? 0)}
                </div>
              </div>
              {result.actualPostEarningsMove != null && (
                <div className="bg-[var(--color-bg-surface)] px-3 sm:px-4 py-2 sm:py-3">
                  <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Today&apos;s Move</div>
                  <div
                    className="text-[15px] font-bold font-tabular"
                    style={{ color: result.actualPostEarningsMove >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
                  >
                    {result.actualPostEarningsMove >= 0 ? '+' : ''}{result.actualPostEarningsMove.toFixed(2)}%
                  </div>
                </div>
              )}
              {result.actualDollarImpact != null && (
                <div className="bg-[var(--color-bg-surface)] px-3 sm:px-4 py-2 sm:py-3">
                  <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Your Gain/Loss</div>
                  <div
                    className="text-[15px] font-bold font-tabular"
                    style={{ color: result.actualDollarImpact >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
                  >
                    {result.actualDollarImpact >= 0 ? '+' : ''}{formatCurrency(result.actualDollarImpact)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[var(--color-bg-surface)] px-3 sm:px-4 py-2 sm:py-3 col-span-1 sm:col-span-1">
              <ProBlur label="Unlock impact analysis" variant="inline" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──

export default function EarningsPage() {
  const { formatCurrency } = useFormat();
  const { report, loading, error, isPro } = useEarnings();

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-5xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="type-h1">Earnings Impact</h1>
        <p className="type-body text-[var(--color-text-secondary)]">
          How earnings results affect your portfolio, with specific dollar amounts
        </p>
      </div>

      {/* Summary cards */}
      {!loading && report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div
            className="rounded-sm px-3 sm:px-5 py-3 sm:py-4"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <span className="type-eyebrow text-[var(--color-text-muted)]">Upcoming Reports</span>
            </div>
            <div className="type-data text-2xl">{report.upcoming.length}</div>
            <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
              next 14 days
            </div>
          </div>

          <div
            className="rounded-sm px-3 sm:px-5 py-3 sm:py-4"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <span className="type-eyebrow text-[var(--color-text-muted)]">Upcoming Exposure</span>
            </div>
            <div className="type-data text-2xl">{formatCurrency(report.totalUpcomingExposure)}</div>
            <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
              in positions reporting soon
            </div>
          </div>

          <div
            className="rounded-sm px-3 sm:px-5 py-3 sm:py-4"
            style={{
              background: 'var(--color-bg-surface)',
              border: isPro && report.recentNetImpact != null
                ? (report.recentNetImpact >= 0
                  ? '1px solid rgba(56, 211, 159, 0.20)'
                  : '1px solid rgba(248, 113, 113, 0.20)')
                : '1px solid var(--color-border-base)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              {isPro && report.recentNetImpact != null
                ? (report.recentNetImpact >= 0
                  ? <TrendingUp className="w-3.5 h-3.5 text-[var(--color-positive)]" />
                  : <TrendingDown className="w-3.5 h-3.5 text-[var(--color-negative)]" />)
                : <BarChart3 className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              }
              <span className="type-eyebrow text-[var(--color-text-muted)]">Recent Net Impact</span>
            </div>
            {isPro && report.recentNetImpact != null ? (
              <>
                <div
                  className="type-data text-2xl"
                  style={{ color: report.recentNetImpact >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
                >
                  {report.recentNetImpact >= 0 ? '+' : ''}{formatCurrency(report.recentNetImpact)}
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                  from recent earnings
                </div>
              </>
            ) : (
              <>
                <div className="type-data text-2xl text-[var(--color-text-muted)]">—</div>
                <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                  Pro feature
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-sm p-5 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)]">
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>
          {[1, 2].map(i => (
            <div key={i} className="rounded-sm p-5 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] space-y-3">
              <div className="flex gap-3">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-40" />
              </div>
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-sm px-5 py-4 flex items-center gap-3" style={{ background: 'rgba(248, 113, 113, 0.06)', border: '1px solid rgba(248, 113, 113, 0.20)' }}>
          <AlertTriangle className="w-4 h-4 text-[var(--color-negative)]" />
          <span className="text-[13px] text-[var(--color-negative)]">{error}</span>
        </div>
      )}

      {/* Recent Earnings Results */}
      {!loading && report && report.recent.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--color-text-muted)]" />
            <h2 className="type-h2">Recent Earnings Results</h2>
          </div>
          {report.recent.map((result, i) => (
            <RecentCard key={`${result.ticker}-${i}`} result={result} formatCurrency={formatCurrency} isPro={isPro} />
          ))}
        </div>
      )}

      {/* Upcoming Earnings */}
      {!loading && report && report.upcoming.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--color-text-muted)]" />
            <h2 className="type-h2">Upcoming Earnings (Next 14 Days)</h2>
          </div>
          {report.upcoming.map((event, i) => (
            <UpcomingCard key={`${event.ticker}-${i}`} event={event} formatCurrency={formatCurrency} isPro={isPro} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && report && report.upcoming.length === 0 && report.recent.length === 0 && (
        <div className="rounded-sm px-4 sm:px-8 py-8 sm:py-12 text-center" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}>
          <div className="w-12 h-12 rounded-sm mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-base)' }}>
            <Calendar className="w-5 h-5 text-[var(--color-text-muted)]" />
          </div>
          <h3 className="type-h2 mb-1">No earnings activity</h3>
          <p className="text-[13px] text-[var(--color-text-secondary)] max-w-sm mx-auto">
            None of your holdings have upcoming earnings in the next 14 days, and no recent results were found. Check back during earnings season.
          </p>
        </div>
      )}

      {/* Methodology note */}
      <p className="text-[10px] text-[var(--color-text-muted)] text-center" style={{ fontFamily: 'var(--font-mono)' }}>
        Impact estimates use a simplified model: 1% EPS surprise ≈ 0.5% stock move. Actual market reactions vary. This is not financial advice.
      </p>
    </div>
  );
}
