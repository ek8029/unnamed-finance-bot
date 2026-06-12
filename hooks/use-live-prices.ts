'use client';

/**
 * Client-side live price polling against /api/market/quotes.
 *
 * Fetches once on mount, then polls on an interval — but only while the
 * tab is visible and the US market is open (ET 9:30–16:00, Mon–Fri).
 * Read-only: server endpoint does no DB writes, so polling is cheap.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

export interface LiveQuote {
  ticker: string;
  price: number;
  prevClose: number | null;
  dayChangePct: number | null;
  asOf: number;
}

export const LIVE_PRICE_INTERVAL_MS = 15_000;

export function isUsMarketOpen(): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = get('weekday');
  if (day === 'Sat' || day === 'Sun') return false;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

export function useLivePrices(
  tickers: string[],
  intervalMs: number = LIVE_PRICE_INTERVAL_MS,
  endpoint: string = '/api/market/quotes',
): { quotes: Record<string, LiveQuote>; lastUpdated: Date | null } {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const inFlight = useRef(false);

  // Stable key so the effect doesn't restart on every render.
  const tickerKey = useMemo(
    () => [...new Set(tickers.filter(Boolean).map((t) => t.toUpperCase()))].sort().join(','),
    [tickers],
  );

  useEffect(() => {
    if (!tickerKey) return;

    let cancelled = false;

    async function poll() {
      if (inFlight.current || document.hidden) return;
      inFlight.current = true;
      try {
        const res = await fetch(`${endpoint}?tickers=${encodeURIComponent(tickerKey)}`);
        if (!res.ok) return;
        const data: { quotes: LiveQuote[] } = await res.json();
        if (cancelled || !data.quotes?.length) return;
        setQuotes((prev) => {
          const next = { ...prev };
          for (const q of data.quotes) next[q.ticker] = q;
          return next;
        });
        setLastUpdated(new Date());
      } catch {
        // Non-fatal — next tick retries.
      } finally {
        inFlight.current = false;
      }
    }

    // Fetch once on mount. After hours the server returns no quotes
    // (extended-hours prints are junk) and SSR/DB close prices stand.
    poll();

    const id = setInterval(() => {
      if (isUsMarketOpen()) poll();
    }, intervalMs);

    // Catch up immediately when the user returns to the tab.
    const onVisible = () => {
      if (!document.hidden && isUsMarketOpen()) poll();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [tickerKey, intervalMs, endpoint]);

  return { quotes, lastUpdated };
}
