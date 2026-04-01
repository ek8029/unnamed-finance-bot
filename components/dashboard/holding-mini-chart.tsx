'use client';

import { useState, useEffect } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  ticker: string;
}

export function HoldingMiniChart({ ticker }: Props) {
  const [data, setData] = useState<{ date: string; close: number }[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/market/history?ticker=${encodeURIComponent(ticker)}`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled) {
          setData((d.prices || []).map((p: { price_date: string; close: number }) => ({
            date: p.price_date,
            close: Number(p.close),
          })));
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return <Skeleton className="w-full h-[120px] rounded" />;
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
  const isUp = lastClose >= firstClose;
  const color = isUp ? 'var(--color-positive)' : 'var(--color-negative)';
  const minClose = Math.min(...data.map(d => d.close));
  const maxClose = Math.max(...data.map(d => d.close));

  return (
    <div>
      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`gradient-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.15} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={[minClose * 0.998, maxClose * 1.002]} hide />
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
      <p className="text-[0.625rem] text-[var(--color-text-muted)] mt-1 font-mono">
        30-day price history
      </p>
    </div>
  );
}
