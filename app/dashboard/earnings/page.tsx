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
import { useTier } from '@/hooks/use-tier';
import { ProGate } from '@/components/pro-gate';

// ── Upcoming Earnings Card ──

function UpcomingCard({ event, formatCurrency }: { event: UpcomingEarning; formatCurrency: (n: number) => string }) {
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
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-2.5 h-2.5 text-[var(--color-text-muted)]" />
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>{timeLabel}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-3.5">
          <div className="flex items-baseline justify-between mb-1">
            <div>
              <span className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">{event.ticker}</span>
              <span className="text-[11px] text-[var(--color-text-muted)] ml-2" style={{ fontFamily: 'var(--font-mono)' }}>
                {event.companyName}
              </span>
            </div>
            <span className="type-eyebrow text-[var(--color-text-muted)]">{event.position.sector}</span>
          </div>

          <div className="flex items-center gap-4 mt-2 mb-3">
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

          {/* Scenario analysis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-sm" style={{ background: 'rgba(56, 211, 159, 0.06)', border: '1px solid rgba(56, 211, 159, 0.15)' }}>
              <TrendingUp className="w-3 h-3 text-[var(--color-positive)] shrink-0" />
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>If beats by 5%</div>
                <div className="text-[13px] font-bold text-[var(--color-positive)] font-tabular">
                  +{formatCurrency(event.beatImpact5pct)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-sm" style={{ background: 'rgba(248, 113, 113, 0.06)', border: '1px solid rgba(248, 113, 113, 0.15)' }}>
              <TrendingDown className="w-3 h-3 text-[var(--color-negative)] shrink-0" />
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>If misses by 5%</div>
                <div className="text-[13px] font-bold text-[var(--color-negative)] font-tabular">
                  {formatCurrency(event.missImpact5pct)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Recent Earnings Card ──

function RecentCard({ result, formatCurrency }: { result: RecentEarning; formatCurrency: (n: number) => string }) {
  const borderColor = result.beat ? 'rgba(56, 211, 159, 0.25)' : 'rgba(248, 113, 113, 0.25)';
  const StatusIcon = result.beat ? CheckCircle2 : XCircle;
  const statusColor = result.beat ? 'var(--color-positive)' : 'var(--color-negative)';
  const statusText = result.beat
    ? `beat estimates by ${Math.abs(result.surprisePct || 0).toFixed(1)}%`
    : `missed estimates by ${Math.abs(result.surprisePct || 0).toFixed(1)}%`;

  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{ background: 'var(--color-bg-surface)', border: `1px solid ${borderColor}` }}
    >
      {/* Status header */}
      <div className="px-5 py-2.5 flex items-center gap-2 border-b border-[var(--color-border-subtle)]" style={{ background: result.beat ? 'rgba(56, 211, 159, 0.04)' : 'rgba(248, 113, 113, 0.04)' }}>
        <StatusIcon className="w-3.5 h-3.5" style={{ color: statusColor }} />
        <span className="text-[12px] font-semibold" style={{ color: statusColor, fontFamily: 'var(--font-mono)' }}>
          {result.ticker} {statusText}
        </span>
      </div>

      {/* Details */}
      <div className="px-5 py-3.5">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">{result.ticker}</span>
          <span className="text-[11px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
            {result.companyName}
          </span>
          {result.date && (
            <span className="type-eyebrow text-[var(--color-text-muted)] ml-auto">{result.date}</span>
          )}
        </div>

        {/* EPS comparison */}
        {result.epsActual != null && result.epsEstimate != null && (
          <div className="flex items-center gap-4 mb-3">
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
          <div className="bg-[var(--color-bg-surface)] px-4 py-3">
            <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Your Position</div>
            <div className="text-[15px] font-bold text-[var(--color-text-primary)] font-tabular">
              {formatCurrency(result.position.totalValue)}
            </div>
          </div>
          <div className="bg-[var(--color-bg-surface)] px-4 py-3">
            <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Est. Impact</div>
            <div
              className="text-[15px] font-bold font-tabular"
              style={{ color: result.estimatedImpact >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
            >
              {result.estimatedImpact >= 0 ? '+' : ''}{formatCurrency(result.estimatedImpact)}
            </div>
          </div>
          {result.actualPostEarningsMove != null && (
            <div className="bg-[var(--color-bg-surface)] px-4 py-3">
              <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Post-Earnings Move</div>
              <div
                className="text-[15px] font-bold font-tabular"
                style={{ color: result.actualPostEarningsMove >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
              >
                {result.actualPostEarningsMove >= 0 ? '+' : ''}{result.actualPostEarningsMove.toFixed(2)}%
              </div>
            </div>
          )}
          {result.actualDollarImpact != null && (
            <div className="bg-[var(--color-bg-surface)] px-4 py-3">
              <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Your Gain/Loss</div>
              <div
                className="text-[15px] font-bold font-tabular"
                style={{ color: result.actualDollarImpact >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
              >
                {result.actualDollarImpact >= 0 ? '+' : ''}{formatCurrency(result.actualDollarImpact)}
              </div>
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
  const { isPro, loading: tierLoading } = useTier();
  const { report, loading, error, proRequired } = useEarnings();

  // Block rendering while tier is loading — prevents flash of Pro content
  if (tierLoading) {
    return (
      <div className="container mx-auto p-6 max-w-5xl animate-pulse">
        <div className="h-8 bg-[var(--color-bg-elevated)] rounded w-1/4 mb-4" />
        <div className="h-64 bg-[var(--color-bg-elevated)] rounded-xl" />
      </div>
    );
  }

  if (!isPro || proRequired) {
    return (
      <ProGate
        feature="Earnings Impact"
        description="See how upcoming and recent earnings reports affect your portfolio with specific dollar amounts. Available on the Pro plan."
      />
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="type-h1">Earnings Impact</h1>
        <p className="type-body text-[var(--color-text-secondary)]">
          How earnings results affect your portfolio — with specific dollar amounts
        </p>
      </div>

      {/* Summary cards */}
      {!loading && report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className="rounded-sm px-5 py-4"
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
            className="rounded-sm px-5 py-4"
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
            className="rounded-sm px-5 py-4"
            style={{
              background: 'var(--color-bg-surface)',
              border: report.recentNetImpact >= 0
                ? '1px solid rgba(56, 211, 159, 0.20)'
                : '1px solid rgba(248, 113, 113, 0.20)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              {report.recentNetImpact >= 0
                ? <TrendingUp className="w-3.5 h-3.5 text-[var(--color-positive)]" />
                : <TrendingDown className="w-3.5 h-3.5 text-[var(--color-negative)]" />
              }
              <span className="type-eyebrow text-[var(--color-text-muted)]">Recent Net Impact</span>
            </div>
            <div
              className="type-data text-2xl"
              style={{ color: report.recentNetImpact >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
            >
              {report.recentNetImpact >= 0 ? '+' : ''}{formatCurrency(report.recentNetImpact)}
            </div>
            <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
              from recent earnings
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <RecentCard key={`${result.ticker}-${i}`} result={result} formatCurrency={formatCurrency} />
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
            <UpcomingCard key={`${event.ticker}-${i}`} event={event} formatCurrency={formatCurrency} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && report && report.upcoming.length === 0 && report.recent.length === 0 && (
        <div className="rounded-sm px-8 py-12 text-center" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}>
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
