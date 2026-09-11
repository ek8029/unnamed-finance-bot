// What screen 2 reads back to the person: the positions they typed in by hand.
// Pure.
//
// Only manual accounts expand. An imported book runs to hundreds of rows and is
// usually still syncing while this screen is up, so a Plaid account stays a
// single line with its position count.

export type ManualPosition = { ticker: string; shares: number; value: number };
export type ManualBook = { rows: ManualPosition[]; more: number; total: number };

type Account = { id: string; source: 'plaid' | 'manual' };
type Holding = { ticker: string; total_value: number; account_id: string | null; shares: number };

const EMPTY: ManualBook = { rows: [], more: 0, total: 0 };

/** Largest first. `more` is how many were cut by `cap`; `total` is every row's value, not just the shown ones. */
export function manualPositions(accounts: Account[], holdings: Holding[], cap = 6): ManualBook {
  const manual = new Set(accounts.filter((a) => a.source === 'manual').map((a) => a.id));
  if (manual.size === 0) return EMPTY;
  const mine = holdings.filter((h) => h.account_id != null && manual.has(h.account_id));
  if (mine.length === 0) return EMPTY;
  const rows = mine
    .map((h) => ({ ticker: h.ticker.toUpperCase(), shares: Number(h.shares) || 0, value: Number(h.total_value) || 0 }))
    .sort((a, b) => b.value - a.value);
  return {
    rows: rows.slice(0, cap),
    more: Math.max(0, rows.length - cap),
    total: rows.reduce((n, r) => n + r.value, 0),
  };
}

/** 4 renders "4", 0.5 renders "0.5": a fractional share is real and must not round to zero. */
export function shareLabel(shares: number): string {
  if (!Number.isFinite(shares)) return '0';
  if (Number.isInteger(shares)) return String(shares);
  return String(Number(shares.toFixed(4)));
}
