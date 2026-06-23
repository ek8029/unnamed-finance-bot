'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProBlur } from '@/components/pro-blur';
import { useTier } from '@/hooks/use-tier';
import { isThesisUser } from '@/lib/thesis-access';
import { usePreview } from '@/lib/preview-context';
import { tierAtLeast } from '@/lib/tier-shared';
import { STATUS_META } from '@/lib/thesis-palette';
import type {
  FactorReport,
  FactorDistribution,
  ClassifiedHolding,
} from '@/lib/factor-lens';

// ── Bucket labels + tints ──

const GOOD = STATUS_META.intact.color;   // green
const MID = STATUS_META.weakening.color;  // gold
const BAD = STATUS_META.broken.color;     // red
const NEUTRAL = STATUS_META.unverified.color;

const FACTOR_LABELS: Record<FactorDistribution['factor'], string> = {
  size: 'Size',
  valueGrowth: 'Value vs Growth',
  momentum: 'Momentum',
  quality: 'Quality',
  rateSensitivity: 'Rate Sensitivity',
};

const BUCKET_LABELS: Record<string, string> = {
  mega: 'Mega-cap',
  large: 'Large-cap',
  mid: 'Mid-cap',
  small: 'Small-cap',
  value: 'Value',
  blend: 'Blend',
  growth: 'Growth',
  high: 'High',
  neutral: 'Neutral',
  low: 'Low',
  mixed: 'Mixed',
};

// Tint a bucket good/bad/neutral by factor semantics.
function bucketColor(factor: FactorDistribution['factor'], bucket: string): string {
  if (factor === 'quality') {
    if (bucket === 'high') return GOOD;
    if (bucket === 'low') return BAD;
    return MID;
  }
  if (factor === 'momentum') {
    if (bucket === 'high') return GOOD;
    if (bucket === 'low') return BAD;
    return NEUTRAL;
  }
  if (factor === 'rateSensitivity') {
    if (bucket === 'high') return BAD;
    if (bucket === 'low') return GOOD;
    return NEUTRAL;
  }
  // size + valueGrowth are descriptive, not good/bad.
  return 'var(--color-gold)';
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function label(bucket: string): string {
  return BUCKET_LABELS[bucket] ?? bucket;
}

// ── Factor weight bar ──

function FactorBar({ dist }: { dist: FactorDistribution }) {
  const entries = Object.entries(dist.weights).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-2">
      <p
        className="text-[12px] uppercase tracking-wide text-[var(--color-text-muted)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {FACTOR_LABELS[dist.factor]}
      </p>
      {entries.length === 0 ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">No coverage</p>
      ) : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
            {entries.map(([bucket, weight]) => (
              <div
                key={bucket}
                style={{
                  width: `${weight * 100}%`,
                  backgroundColor: bucketColor(dist.factor, bucket),
                  opacity: 0.85,
                }}
                title={`${label(bucket)} ${pct(weight)}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {entries.map(([bucket, weight]) => (
              <span key={bucket} className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)]">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: bucketColor(dist.factor, bucket) }}
                />
                {label(bucket)} {pct(weight)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Per-holding row tint helpers ──

function holdingCell(value: string | null, color?: string) {
  if (!value) return <span className="text-[var(--color-text-muted)]">-</span>;
  return <span style={color ? { color } : undefined}>{value}</span>;
}

// ── Report body ──

function ReportBody({ report }: { report: FactorReport }) {
  return (
    <div className="space-y-6">
      {/* (a) Tilt summary header */}
      <Card variant="elevated">
        <CardHeader>
          <p
            className="text-[12px] uppercase tracking-wide text-[var(--color-gold)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Portfolio Tilt
          </p>
          <CardTitle className="text-[var(--color-text-primary)]">{report.tiltSummary}</CardTitle>
        </CardHeader>
      </Card>

      {/* (d) What moved you today */}
      {report.dayDriver && (
        <Card>
          <CardContent className="pt-6">
            <p
              className="text-[12px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              What moved you today
            </p>
            <p className="text-[15px] text-[var(--color-text-primary)]">
              <span className="font-semibold">{label(report.dayDriver.bucket)}</span> drove most of your{' '}
              <span
                style={{
                  color: report.dayDriver.portfolioDayPct >= 0 ? GOOD : BAD,
                }}
              >
                {report.dayDriver.portfolioDayPct >= 0 ? '+' : ''}
                {report.dayDriver.portfolioDayPct.toFixed(2)}%
              </span>{' '}
              day move, contributing{' '}
              <span style={{ color: report.dayDriver.contributionPct >= 0 ? GOOD : BAD }}>
                {report.dayDriver.contributionPct >= 0 ? '+' : ''}
                {report.dayDriver.contributionPct.toFixed(2)}%
              </span>
              .
            </p>
          </CardContent>
        </Card>
      )}

      {/* (b) Factor weight bars */}
      <Card>
        <CardHeader>
          <CardTitle>Factor Exposure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {report.distributions.map((d) => (
            <FactorBar key={d.factor} dist={d} />
          ))}
        </CardContent>
      </Card>

      {/* (c) Sector allocation */}
      <Card>
        <CardHeader>
          <CardTitle>Sector Allocation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {report.sectorWeights.map((s) => (
            <div key={s.sector} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-[13px] text-[var(--color-text-secondary)]">
                {s.sector}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${s.weight * 100}%`, backgroundColor: 'var(--color-gold)', opacity: 0.85 }}
                />
              </div>
              <span
                className="w-12 shrink-0 text-right text-[12px] text-[var(--color-text-muted)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {pct(s.weight)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* (e) Per-holding table */}
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                  <th className="pb-2 pr-4 font-normal">Ticker</th>
                  <th className="pb-2 pr-4 font-normal">Sector</th>
                  <th className="pb-2 pr-4 font-normal">Size</th>
                  <th className="pb-2 pr-4 font-normal">Style</th>
                  <th className="pb-2 pr-4 font-normal">Momentum</th>
                  <th className="pb-2 pr-4 font-normal">Quality</th>
                </tr>
              </thead>
              <tbody>
                {report.holdings.map((h: ClassifiedHolding) => (
                  <tr key={h.ticker} className="border-t border-[var(--color-border-subtle)]">
                    <td className="py-2 pr-4 font-medium text-[var(--color-text-primary)]">{h.ticker}</td>
                    <td className="py-2 pr-4 text-[var(--color-text-secondary)]">{h.sector}</td>
                    <td className="py-2 pr-4 text-[var(--color-text-secondary)]">
                      {holdingCell(h.size ? label(h.size) : null)}
                    </td>
                    <td className="py-2 pr-4">
                      {holdingCell(h.valueGrowth ? label(h.valueGrowth) : null, 'var(--color-text-secondary)')}
                    </td>
                    <td className="py-2 pr-4">
                      {holdingCell(
                        h.momentum ? label(h.momentum) : null,
                        h.momentum ? bucketColor('momentum', h.momentum) : undefined,
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {holdingCell(
                        h.quality ? label(h.quality) : null,
                        h.quality ? bucketColor('quality', h.quality) : undefined,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Page ──

export default function FactorLensPage() {
  const { isPro, loading: tierLoading } = useTier();
  const { tier: previewTier } = usePreview();
  const [report, setReport] = useState<FactorReport | null>(null);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);

  // Mirror the dashboard layout: allowlisted users are entitled even off Pro.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/user/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setProfileEmail(data?.profile?.email ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Factor lens is a Max feature; drive gating off the preview tier (redesign source of truth).
  void isPro; void isThesisUser; void profileEmail; // real-entitlement gating swaps in during the pricing phase
  const entitled = tierAtLeast(previewTier, 'max');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/factor-lens')
      .then(async (res) => {
        if (!res.ok) {
          // 403 (not Pro) is handled by the blur, not as an error state.
          if (res.status === 403) return { report: null, empty: false };
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setReport(data.report ?? null);
        setEmpty(Boolean(data.empty));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const coverageNote = report
    ? `Classified ${report.coverage.classified} of ${report.coverage.total} holdings.`
    : null;

  return (
    <div className="container mx-auto max-w-[1100px] px-4 py-6">
      <div className="mb-6">
        <h1 className="type-h2 text-[var(--color-text-primary)]">Factor Lens</h1>
        <p className="type-body text-[var(--color-text-secondary)]">
          The style and factor exposure hiding in your portfolio.
        </p>
      </div>

      {/* Coverage note always visible once we have a report */}
      {coverageNote && (
        <p
          className="mb-4 text-[12px] text-[var(--color-text-muted)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {coverageNote}
        </p>
      )}

      {(loading || tierLoading) && (
        <Card>
          <CardContent className="py-16 text-center text-[var(--color-text-muted)]">
            Loading factor exposure...
          </CardContent>
        </Card>
      )}

      {!loading && !tierLoading && error && (
        <Card>
          <CardContent className="py-16 text-center text-[var(--color-text-muted)]">
            Could not load your factor lens. Please try again.
          </CardContent>
        </Card>
      )}

      {!loading && !tierLoading && !error && empty && (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-[15px] text-[var(--color-text-primary)] mb-1">No holdings yet</p>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              Connect a brokerage or add holdings to see your factor exposure.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !tierLoading && !error && !empty && !entitled && (
        <ProBlur
          label="Unlock Factor Lens with Pro"
          description="See the style and factor exposure hiding in your portfolio"
          minHeight="420px"
        >
          {report && <ReportBody report={report} />}
        </ProBlur>
      )}

      {!loading && !tierLoading && !error && !empty && entitled && report && (
        <ReportBody report={report} />
      )}
    </div>
  );
}
