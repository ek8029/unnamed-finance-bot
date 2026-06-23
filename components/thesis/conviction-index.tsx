'use client';

// Portfolio conviction index: one glanceable number (share of confirmed pillars
// still intact) plus the honest 14-day trend. Gives a KPI worth returning for and
// a demo hero metric. Trend comes from the replay endpoint (/api/thesis/conviction),
// so it is real, not hindsight.

import { useEffect, useState } from 'react';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

interface TrendPoint {
  date: string;
  intact: number;
}

function colorFor(pct: number): string {
  if (pct >= 80) return '#4ADE80';
  if (pct >= 50) return '#E6B94D';
  return '#F87171';
}

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length < 2) return null;
  const w = 96;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block" aria-hidden>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ConvictionIndex({ intact, total, className = '' }: { intact: number; total: number; className?: string }) {
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/thesis/conviction')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d && Array.isArray(d.trend)) setTrend(d.trend);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (total === 0) return null;

  const pct = Math.round((intact / total) * 100);
  const color = colorFor(pct);

  // 14-day delta in percentage points (intact count / constant pillar set).
  let deltaPts: number | null = null;
  let series: number[] = [];
  if (trend && trend.length >= 2) {
    series = trend.map((p) => Math.round((p.intact / total) * 100));
    deltaPts = series[series.length - 1] - series[0];
  }

  return (
    <div
      className={`rounded-lg border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] px-5 py-4 flex items-center gap-5 ${className}`}
      style={{ borderTop: `2px solid ${color}55` }}
    >
      <div className="min-w-0">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A]" style={MONO}>
          Conviction
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-mono text-[34px] leading-none font-semibold tabular-nums" style={{ ...MONO, color }}>
            {pct}%
          </span>
          <span className="text-[13px] text-[#8A8A8A]">
            {intact} of {total} pillars intact
          </span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-4 shrink-0">
        {deltaPts !== null && (
          <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#6A6A6A]" style={MONO}>
              14 days
            </div>
            <div
              className="font-mono text-[14px] font-semibold tabular-nums"
              style={{ ...MONO, color: deltaPts > 0 ? '#4ADE80' : deltaPts < 0 ? '#F87171' : '#6A6A6A' }}
            >
              {deltaPts > 0 ? '+' : ''}
              {deltaPts} pts
            </div>
          </div>
        )}
        {series.length >= 2 && <Sparkline values={series} stroke={color} />}
      </div>
    </div>
  );
}
