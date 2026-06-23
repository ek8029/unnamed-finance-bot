'use client';

import { useEffect, useState } from 'react';
import { usePreview } from '@/lib/preview-context';
import { tierAtLeast } from '@/lib/tier-shared';
import { TierLock } from '@/components/tier-lock';
import { useTier } from '@/hooks/use-tier';
import { isThesisUser } from '@/lib/thesis-access';
import type {
  FactorReport,
  FactorDistribution,
  ClassifiedHolding,
} from '@/lib/factor-lens';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

const POSITIVE = 'var(--color-positive)';
const NEGATIVE = 'var(--color-negative-text)';
const WARNING = 'var(--color-warning-text)';

// ── Labels ──

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

function label(bucket: string): string {
  return BUCKET_LABELS[bucket] ?? bucket;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

// ── Signed tilt derivation ───────────────────────────────────────────────
// The diverging-bar visual reads a single signed magnitude per factor. We map
// each value-weighted bucket distribution to an ordinal position (low -> high)
// and take the weighted mean offset from the neutral center. This is a
// presentation of the same underlying distribution, not new data.

type Tilt = {
  factor: FactorDistribution['factor'];
  label: string;
  // -1..+1 signed magnitude; sign sets bar direction, magnitude sets length.
  value: number;
  // Whether positive direction is a "warning" tone (more risk) rather than green.
  warnOnPositive?: boolean;
};

// Ordinal scales per factor, mapped to a centered position in [-1, +1].
const TILT_SCALES: Record<
  FactorDistribution['factor'],
  { label: string; order: Record<string, number>; warnOnPositive?: boolean }
> = {
  momentum: {
    label: 'Momentum',
    order: { low: -1, neutral: 0, high: 1 },
  },
  valueGrowth: {
    // Positive = growth tilt, negative = value tilt.
    label: 'Value vs Growth',
    order: { value: -1, blend: 0, growth: 1 },
  },
  quality: {
    label: 'Quality',
    order: { low: -1, mixed: 0, high: 1 },
  },
  rateSensitivity: {
    // Higher rate sensitivity reads as a risk tone.
    label: 'Rate sensitivity',
    order: { low: -1, neutral: 0, high: 1 },
    warnOnPositive: true,
  },
  size: {
    // Positive = large/mega, negative = small. Small-cap tilt is the
    // diversifying direction; show it as the negative end.
    label: 'Size',
    order: { small: -1, mid: -0.33, large: 0.33, mega: 1 },
  },
};

function deriveTilt(dist: FactorDistribution): Tilt {
  const scale = TILT_SCALES[dist.factor];
  let acc = 0;
  let base = 0;
  for (const [bucket, weight] of Object.entries(dist.weights)) {
    const pos = scale.order[bucket];
    if (pos == null) continue;
    acc += pos * weight;
    base += weight;
  }
  const value = base > 0 ? acc / base : 0;
  return { factor: dist.factor, label: scale.label, value, warnOnPositive: scale.warnOnPositive };
}

function tiltColor(t: Tilt): string {
  if (t.value >= 0) return t.warnOnPositive ? WARNING : POSITIVE;
  return NEGATIVE;
}

// Render the signed magnitude as a sigma-style figure for legibility.
function tiltFigure(value: number): string {
  const sigma = (value * 2.2).toFixed(1); // scale to a readable +/- range
  const sign = value >= 0 ? '+' : '−';
  return `${sign}${Math.abs(Number(sigma)).toFixed(1)}σ`;
}

// ── Diverging factor bar ──

function DivergingBar({ tilt }: { tilt: Tilt }) {
  const color = tiltColor(tilt);
  const widthPct = Math.min(Math.abs(tilt.value), 1) * 46; // half-track max ~46%
  const positive = tilt.value >= 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-[7px]">
        <span className="text-[15px] text-[var(--color-text-primary)]">{tilt.label}</span>
        <span className="text-[15px] font-semibold tabular-nums" style={{ ...MONO, color }}>
          {tiltFigure(tilt.value)}
        </span>
      </div>
      <div className="relative h-2 rounded bg-white/[0.04]">
        <div
          className="absolute -top-[3px] -bottom-[3px] w-px bg-white/15"
          style={{ left: '50%' }}
        />
        <div
          className="absolute h-full rounded"
          style={{
            backgroundColor: color,
            width: `${widthPct}%`,
            ...(positive ? { left: '50%' } : { right: '50%' }),
          }}
        />
      </div>
    </div>
  );
}

// ── Style box (size x value/growth) ──

const STYLE_ROWS: Array<'mega' | 'mid' | 'small'> = ['mega', 'mid', 'small'];
const STYLE_COLS: Array<'value' | 'blend' | 'growth'> = ['value', 'blend', 'growth'];

// Build a 3x3 weight grid from the size + valueGrowth distributions. We have
// marginal distributions, not the joint, so approximate the cell weight as the
// product of the two marginals (independence assumption). Honest: it is an
// estimate from the data we hold, and large-cap-growth dominance still shows.
function buildStyleGrid(report: FactorReport): number[][] {
  const sizeDist = report.distributions.find((d) => d.factor === 'size')?.weights ?? {};
  const vgDist = report.distributions.find((d) => d.factor === 'valueGrowth')?.weights ?? {};
  // Collapse 'large' into the top row alongside 'mega' for a 3-row box.
  const sizeWeight = (row: 'mega' | 'mid' | 'small'): number => {
    if (row === 'mega') return (sizeDist.mega ?? 0) + (sizeDist.large ?? 0);
    return sizeDist[row] ?? 0;
  };
  return STYLE_ROWS.map((row) =>
    STYLE_COLS.map((col) => sizeWeight(row) * (vgDist[col] ?? 0)),
  );
}

function StyleBox({ report }: { report: FactorReport }) {
  const grid = buildStyleGrid(report);
  const flat = grid.flat();
  const max = Math.max(...flat, 0.0001);
  return (
    <div
      className="rounded-lg border p-5 sm:p-[22px]"
      style={{
        borderColor: 'var(--color-border-base)',
        background: 'var(--color-bg-surface)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] mb-3.5"
        style={MONO}
      >
        Style box
      </div>
      <div className="grid grid-cols-3 gap-[3px]" style={{ gridTemplateRows: 'repeat(3, 44px)' }}>
        {grid.map((rowVals, r) =>
          rowVals.map((w, c) => {
            const intensity = w / max; // 0..1
            const isPeak = w === max && w > 0;
            const textColor = isPeak
              ? '#0A0A0A'
              : intensity > 0.35
                ? 'var(--color-text-primary)'
                : 'var(--color-text-muted)';
            const bg = isPeak
              ? 'var(--color-gold)'
              : `rgba(230,185,77,${(0.06 + intensity * 0.3).toFixed(3)})`;
            return (
              <div
                key={`${r}-${c}`}
                className="rounded-[2px] flex items-center justify-center text-[12px] tabular-nums"
                style={{ ...MONO, background: bg, color: textColor, fontWeight: isPeak ? 700 : 400 }}
              >
                {w > 0.005 ? pct(w) : ''}
              </div>
            );
          }),
        )}
      </div>
      <div
        className="flex justify-between text-[9px] uppercase tracking-[0.1em] mt-2"
        style={{ ...MONO, color: '#5a5a5a' }}
      >
        <span>Value</span>
        <span>Blend</span>
        <span>Growth</span>
      </div>
    </div>
  );
}

// ── Day driver line ──

function DayDriverLine({ report }: { report: FactorReport }) {
  const d = report.dayDriver;
  if (!d) return null;
  const up = d.portfolioDayPct >= 0;
  return (
    <div
      className="rounded-lg border p-5"
      style={{
        borderColor: 'var(--color-border-base)',
        background: 'var(--color-bg-surface)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] mb-2.5"
        style={MONO}
      >
        What moved you today
      </div>
      <p className="text-[15px] leading-[1.6] text-[var(--color-text-primary)] m-0">
        <span className="font-semibold">{label(d.bucket)}</span> drove most of your{' '}
        <span className="font-semibold tabular-nums" style={{ color: up ? POSITIVE : NEGATIVE }}>
          {up ? '+' : ''}
          {d.portfolioDayPct.toFixed(2)}%
        </span>{' '}
        day move, contributing{' '}
        <span className="font-semibold tabular-nums" style={{ color: d.contributionPct >= 0 ? POSITIVE : NEGATIVE }}>
          {d.contributionPct >= 0 ? '+' : ''}
          {d.contributionPct.toFixed(2)}%
        </span>
        .
      </p>
    </div>
  );
}

// ── Holdings table ──

function holdingCell(value: string | null, color?: string) {
  if (!value) return <span className="text-[var(--color-text-muted)]">{'—'}</span>;
  return <span style={color ? { color } : undefined}>{value}</span>;
}

function holdingTone(
  factor: FactorDistribution['factor'],
  bucket: string,
): string | undefined {
  if (factor === 'quality') {
    if (bucket === 'high') return POSITIVE;
    if (bucket === 'low') return NEGATIVE;
    return undefined;
  }
  if (factor === 'momentum') {
    if (bucket === 'high') return POSITIVE;
    if (bucket === 'low') return NEGATIVE;
    return undefined;
  }
  return undefined;
}

function HoldingsTable({ report }: { report: FactorReport }) {
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: 'var(--color-border-base)',
        background: 'var(--color-bg-surface)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
      }}
    >
      <div
        className="px-5 py-3.5 border-b text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]"
        style={{ ...MONO, borderColor: 'var(--color-border-base)' }}
      >
        Per-holding classification
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead>
            <tr
              className="text-left text-[var(--color-text-muted)] text-[10px] uppercase tracking-[0.1em]"
              style={MONO}
            >
              <th className="py-3 px-5 font-normal">Ticker</th>
              <th className="py-3 px-5 font-normal">Sector</th>
              <th className="py-3 px-5 font-normal">Size</th>
              <th className="py-3 px-5 font-normal">Style</th>
              <th className="py-3 px-5 font-normal">Momentum</th>
              <th className="py-3 px-5 font-normal">Quality</th>
            </tr>
          </thead>
          <tbody>
            {report.holdings.map((h: ClassifiedHolding) => (
              <tr key={h.ticker} className="border-t border-[var(--color-border-subtle)]">
                <td className="py-3 px-5 font-semibold tabular-nums text-[var(--color-gold)]" style={MONO}>
                  {h.ticker}
                </td>
                <td className="py-3 px-5 text-[var(--color-text-secondary)]">{h.sector}</td>
                <td className="py-3 px-5 text-[var(--color-text-secondary)]">
                  {holdingCell(h.size ? label(h.size) : null)}
                </td>
                <td className="py-3 px-5">
                  {holdingCell(h.valueGrowth ? label(h.valueGrowth) : null, 'var(--color-text-secondary)')}
                </td>
                <td className="py-3 px-5">
                  {holdingCell(
                    h.momentum ? label(h.momentum) : null,
                    h.momentum ? holdingTone('momentum', h.momentum) : undefined,
                  )}
                </td>
                <td className="py-3 px-5">
                  {holdingCell(
                    h.quality ? label(h.quality) : null,
                    h.quality ? holdingTone('quality', h.quality) : undefined,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Report body ──

function ReportBody({ report }: { report: FactorReport }) {
  const tilts = report.distributions
    .filter((d) => Object.keys(d.weights).length > 0)
    .map(deriveTilt);

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5">
        {/* Left: diverging factor tilt bars */}
        <div
          className="rounded-lg border p-5 sm:p-6"
          style={{
            borderColor: 'var(--color-border-base)',
            background: 'var(--color-bg-surface)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] mb-5"
            style={MONO}
          >
            Factor tilt {'·'} relative to benchmark
          </div>
          {tilts.length === 0 ? (
            <p className="text-[15px] text-[var(--color-text-muted)]">
              Not enough classified holdings to compute a factor tilt.
            </p>
          ) : (
            <div className="flex flex-col gap-[18px]">
              {tilts.map((t) => (
                <DivergingBar key={t.factor} tilt={t} />
              ))}
            </div>
          )}
        </div>

        {/* Right: gold "Read" interpretation + style box */}
        <div className="flex flex-col gap-3.5">
          <div
            className="rounded-lg border p-5"
            style={{
              borderColor: 'rgba(230,185,77,0.18)',
              background: 'rgba(230,185,77,0.025)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            <div
              className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-gold)] mb-3"
              style={MONO}
            >
              {'✦'} Read
            </div>
            <p className="text-[15px] leading-[1.6] text-[var(--color-text-primary)] m-0">
              {report.tiltSummary}
            </p>
          </div>

          <StyleBox report={report} />
        </div>
      </div>

      <DayDriverLine report={report} />

      <HoldingsTable report={report} />
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
    <div className="container mx-auto max-w-[1240px] px-4 py-6 sm:px-7 sm:py-[26px]">
      {/* Header */}
      <div className="mb-[22px]">
        <div
          className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2"
          style={MONO}
        >
          Factor lens {'·'} vs S&amp;P 500
        </div>
        <h1 className="text-[28px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)]">
          What&apos;s really driving your returns
        </h1>
      </div>

      {/* Coverage note always visible once we have a report */}
      {coverageNote && (
        <p className="mb-4 text-[14px] text-[var(--color-text-muted)]" style={MONO}>
          {coverageNote}
        </p>
      )}

      {(loading || tierLoading) && (
        <div
          className="rounded-lg border py-16 text-center text-[15px] text-[var(--color-text-muted)]"
          style={{ borderColor: 'var(--color-border-base)', background: 'var(--color-bg-surface)' }}
        >
          Loading factor exposure...
        </div>
      )}

      {!loading && !tierLoading && error && (
        <div
          className="rounded-lg border py-16 text-center text-[15px] text-[var(--color-text-muted)]"
          style={{ borderColor: 'var(--color-border-base)', background: 'var(--color-bg-surface)' }}
        >
          Could not load your factor lens. Please try again.
        </div>
      )}

      {!loading && !tierLoading && !error && empty && (
        <div
          className="rounded-lg border py-16 text-center"
          style={{ borderColor: 'var(--color-border-base)', background: 'var(--color-bg-surface)' }}
        >
          <p className="text-[16px] text-[var(--color-text-primary)] mb-1">No holdings yet</p>
          <p className="text-[15px] text-[var(--color-text-muted)]">
            Connect a brokerage or add holdings to see your factor exposure.
          </p>
        </div>
      )}

      {!loading && !tierLoading && !error && !empty && !entitled && (
        <TierLock
          required="max"
          label="Unlock Factor Lens with Max"
          blurb="See the style and factor exposure hiding in your portfolio."
        >
          {report && <ReportBody report={report} />}
        </TierLock>
      )}

      {!loading && !tierLoading && !error && !empty && entitled && report && (
        <ReportBody report={report} />
      )}
    </div>
  );
}
