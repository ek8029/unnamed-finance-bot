'use client';
// The book as the v3 screens see it: accounts with a source and a position
// count, plus the raw holdings. Reads /api/financial-summary, which now returns
// each account's `source` ('plaid' | 'manual').
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { previewSentence } from '@/lib/onboarding/v3-exposure';
import { V3_COPY } from '@/lib/onboarding/v3-copy';

export type BookAccount = { id: string; institution: string; account_type: string; source: 'plaid' | 'manual'; positions: number };
export type BookHolding = { ticker: string; total_value: number; account_id: string | null; shares: number };

export function useBook(enabled = true) {
  const [accounts, setAccounts] = useState<BookAccount[]>([]);
  const [holdings, setHoldings] = useState<BookHolding[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/financial-summary', { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      const hs: BookHolding[] = (d.holdings ?? []).map((h: Record<string, unknown>) => ({ ticker: String(h.ticker), total_value: Number(h.total_value) || 0, account_id: (h.account_id as string) ?? null, shares: Number(h.shares) || 0 }));
      const counts = new Map<string, number>();
      for (const h of hs) if (h.account_id) counts.set(h.account_id, (counts.get(h.account_id) ?? 0) + 1);
      setAccounts((d.accounts ?? []).map((a: Record<string, unknown>) => ({ id: String(a.id), institution: String(a.institution), account_type: String(a.account_type), source: a.source === 'manual' ? 'manual' : 'plaid', positions: counts.get(String(a.id)) ?? 0 })));
      setHoldings(hs);
      setError(null);
    } catch {
      setError(V3_COPY.ask.loadError);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { if (enabled) void refetch(); }, [enabled, refetch]);
  return { accounts, holdings, loading, error, refetch };
}

export type PreviewRow = { ticker: string; shares: number };

/** The manual panel's live line. Quotes are fetched once per distinct ticker
 *  set, 600 ms after it last changed; a share edit re-reads cached prices and
 *  never refetches. fill=close asks the route for the last close on tickers
 *  with no live quote, so the sentence reads the same off hours. A failed
 *  fetch leaves prices empty, which previewSentence renders as its no-price line. */
export function useQuotePreview(rows: PreviewRow[]): string {
  const [prices, setPrices] = useState<Map<string, number>>(() => new Map());
  const key = useMemo(() => [...new Set(rows.map((r) => r.ticker.toUpperCase()))].sort().join(','), [rows]);
  const lastFetched = useRef<string | null>(null);
  useEffect(() => {
    if (!key || key === lastFetched.current) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const next = new Map<string, number>();
      try {
        const r = await fetch(`/api/market/quotes?tickers=${encodeURIComponent(key)}&fill=close`);
        if (r.ok) {
          const d = await r.json();
          for (const q of (d.quotes ?? []) as { ticker?: unknown; price?: unknown }[]) {
            if (typeof q.ticker === 'string' && typeof q.price === 'number') next.set(q.ticker.toUpperCase(), q.price);
          }
        }
      } catch {}
      if (cancelled) return;
      // An empty or failed answer keeps the prices already known and leaves no
      // set marked as fetched, so the next set change or remount asks again.
      if (next.size === 0) { lastFetched.current = null; return; }
      lastFetched.current = key;
      setPrices(next);
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [key]);
  return useMemo(() => {
    if (rows.length === 0) return '';
    return previewSentence(rows.map((r) => {
      const price = prices.get(r.ticker.toUpperCase());
      return { ticker: r.ticker.toUpperCase(), value: price != null ? price * r.shares : null };
    }));
  }, [rows, prices]);
}
