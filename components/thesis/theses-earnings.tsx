'use client';

// Earnings dates for the theses table, fetched after the table has painted.
//
// The dates come from SEC EDGAR, one HTTP call per ticker. Doing that inside the
// server render held the whole page back: /dashboard/theses answered in 2.4s
// against 40 to 60ms for every other dashboard route, and the earnings column is
// the least load-bearing thing on the page. So the table renders with the column
// in the same state it already uses for a ticker EDGAR has no estimate for, and
// the real dates arrive a moment later.
//
// The screenshot capture passes `initial` and no fetch happens, so a marketing
// capture still renders its fixture dates on the first paint.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type EarningsByTicker = ReadonlyMap<string, string | null>;

const EMPTY: EarningsByTicker = new Map();
const EarningsContext = createContext<EarningsByTicker>(EMPTY);

/** No estimate yet, whether because EDGAR has none or because it is still loading. */
const UNKNOWN = '—';

export function EarningsProvider({
  tickers,
  initial,
  children,
}: {
  /** Row order, so the earliest-date tie-break matches the table. */
  tickers: string[];
  /** Supplied by the capture fixtures; when present nothing is fetched. */
  initial?: EarningsByTicker;
  children: ReactNode;
}) {
  const [earnings, setEarnings] = useState<EarningsByTicker>(initial ?? EMPTY);
  const key = tickers.join(',');

  useEffect(() => {
    if (initial || !key) return;
    let live = true;
    fetch(`/api/thesis/earnings?tickers=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { earnings?: Record<string, string | null> } | null) => {
        if (live && body?.earnings) setEarnings(new Map(Object.entries(body.earnings)));
      })
      // Best effort, exactly as the server-side Promise.allSettled was: a vendor
      // blip leaves the column reading as no estimate, it does not blank the page.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, initial]);

  return <EarningsContext.Provider value={earnings}>{children}</EarningsContext.Provider>;
}

/** The Earnings column on one row: MM-DD, or no estimate. */
export function EarningsCell({ ticker }: { ticker: string }) {
  const next = useContext(EarningsContext).get(ticker);
  return <>{next ? next.slice(5) : UNKNOWN}</>;
}

function useNextEarnings(tickers: string[]) {
  const earnings = useContext(EarningsContext);
  return tickers
    .map((ticker) => ({ ticker, date: earnings.get(ticker) }))
    .filter((x): x is { ticker: string; date: string } => !!x.date)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

/** Summary band: which ticker reports next. */
export function NextEarningsTicker({ tickers }: { tickers: string[] }) {
  const next = useNextEarnings(tickers);
  return <>{next ? next.ticker : UNKNOWN}</>;
}

/** Summary band: when it reports. */
export function NextEarningsDate({ tickers }: { tickers: string[] }) {
  const next = useNextEarnings(tickers);
  return <>{next ? `est. ${next.date}` : 'none estimated'}</>;
}
