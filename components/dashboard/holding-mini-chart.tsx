'use client';

import { useState, useEffect } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  ticker: string;
  currentPrice: number;
}

interface PricePoint {
  date: string;
  close: number;
}

function formatPrice(val: number) {
  return val >= 1000 ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${val.toFixed(2)}`;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: PricePoint }[] }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const date = new Date(d.date + 'T12:00:00');
  return (
    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded px-2.5 py-1.5 shadow-lg">
      <p className="text-[0.6875rem] text-[var(--color-text-muted)] font-mono">
        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </p>
      <p className="text-[0.8125rem] text-[var(--color-text-primary)] font-mono font-semibold tabular-nums">
        {formatPrice(d.close)}
      </p>
    </div>
  );
}

export function HoldingMiniChart({ ticker, currentPrice }: Props) {
  const [data, setData] = useState<PricePoint[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/market/history?ticker=${encodeURIComponent(ticker)}`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(d => {
        if (!cancelled) {
          const prices = (d.prices || [])
            .map((p: { price_date: string; close: string | number }) => ({
              date: p.price_date,
              close: Number(p.close),
            }))
            .filter((p: PricePoint) => p.close > 0);
          setData(prices);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData([]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="w-full h-[140px] rounded" />
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1 rounded" />
          <Skeleton className="h-10 flex-1 rounded" />
          <Skeleton className="h-10 flex-1 rounded" />
        </div>
      </div>
    );
  }

  if (!data || data.length < 2) {
    return (
      <p className="text-[0.75rem] text-[var(--color-text-muted)] py-4 text-center">
        No price history available
      </p>
    );
  }

  const firstClose = data[0].close;
  const lastClose = data[data.length - 1].close;
  const periodChange = lastClose - firstClose;
  const periodChangePct = (periodChange / firstClose) * 100;
  const isUp = periodChange >= 0;
  const color = isUp ? 'var(--color-positive)' : 'var(--color-negative)';

  const periodHigh = Math.max(...data.map(d => d.close));
  const periodLow = Math.min(...data.map(d => d.close));
  const priceRange = periodHigh - periodLow;
  const pricePosition = priceRange > 0 ? ((currentPrice - periodLow) / priceRange) * 100 : 50;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[1.0625rem] font-bold text-[var(--color-text-primary)] tabular-nums">
            {formatPrice(currentPrice)}
          </span>
          <span className={`font-mono text-[0.8125rem] font-semibold tabular-nums ${isUp ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
            {isUp ? '+' : ''}{periodChangePct.toFixed(2)}%
          </span>
        </div>
        <span className="text-[0.625rem] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">
          30d
        </span>
      </div>

      <div className="h-[140px]" role="img" aria-label={`${ticker} price chart, last 30 days`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`gradient-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.12} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={[periodLow * 0.997, periodHigh * 1.003]} hide />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-border-strong)', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="close"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#gradient-${ticker})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-3 py-2">
          <span className="block text-[0.5625rem] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-0.5">
            30d High
          </span>
          <span className="font-mono text-[0.8125rem] text-[var(--color-text-primary)] tabular-nums font-medium">
            {formatPrice(periodHigh)}
          </span>
        </div>
        <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-3 py-2">
          <span className="block text-[0.5625rem] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-0.5">
            30d Low
          </span>
          <span className="font-mono text-[0.8125rem] text-[var(--color-text-primary)] tabular-nums font-medium">
            {formatPrice(periodLow)}
          </span>
        </div>
        <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-3 py-2">
          <span className="block text-[0.5625rem] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-0.5">
            Range Position
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1 bg-[var(--color-bg-base)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-gold)]"
                style={{ width: `${Math.min(100, Math.max(0, pricePosition))}%` }}
              />
            </div>
            <span className="font-mono text-[0.6875rem] text-[var(--color-text-secondary)] tabular-nums">
              {pricePosition.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
