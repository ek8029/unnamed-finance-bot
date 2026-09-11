// What screen 2 reads back to the person: the positions they typed in by hand.
// Pure.
//
// Only manual accounts expand. An imported book runs to hundreds of rows and is
// usually still syncing while this screen is up, so a Plaid account stays a
// single line with its position count.

export type ManualPosition = { ticker: string; shares: number; value: number };
export type ManualBook = { rows: ManualPosition[]; more: number };

type Holding = { ticker: string; total_value: number; account_id: string | null; shares: number };

const EMPTY: ManualBook = { rows: [], more: 0 };

/**
 * One account's typed positions, largest first. `more` is how many were cut by
 * `cap`.
 *
 * Scoped to a single account on purpose. Pooling every manual account's
 * holdings looked right on a book with one hand-entered account and wrong on
 * the demo, whose 23 accounts all carry source='manual': the same six rows
 * rendered under every one of them.
 */
export function manualPositions(accountId: string, holdings: Holding[], cap = 6): ManualBook {
  const mine = holdings.filter((h) => h.account_id === accountId);
  if (mine.length === 0) return EMPTY;
  const rows = mine
    .map((h) => ({ ticker: h.ticker.toUpperCase(), shares: Number(h.shares) || 0, value: Number(h.total_value) || 0 }))
    .sort((a, b) => b.value - a.value);
  return { rows: rows.slice(0, cap), more: Math.max(0, rows.length - cap) };
}

/**
 * 4 renders "4", 0.5 renders "0.5": a fractional share is real and must not
 * round to zero. Two decimals above one share, the way a brokerage prints it
 * ("51.1503 shares" read as noise on screen), and six below one, because a
 * coin position is small and every digit of it counts.
 */
export function shareLabel(shares: number): string {
  if (!Number.isFinite(shares)) return '0';
  if (Number.isInteger(shares)) return String(shares);
  const rounded = Number(shares.toFixed(Math.abs(shares) >= 1 ? 2 : 6));
  if (rounded !== 0) return String(rounded);
  // Dust. Printing "0 shares" beside a dollar value would be a lie, and the
  // column carries eight decimals, so show what it actually holds.
  return String(Number(shares.toFixed(8)));
}

/**
 * The accounts worth showing as columns beside `rows`: the ones that actually
 * hold the names on display, most first. Slicing the account list instead put
 * five arbitrary accounts against a name held in the twentieth, so every cell
 * read empty while the card said the name was in two accounts.
 */
export function overlapColumns<T extends { id: string }>(
  rows: { accountIds: readonly string[] }[],
  accounts: readonly T[],
  max = 5,
): T[] {
  const hits = new Map<string, number>();
  for (const r of rows) for (const id of new Set(r.accountIds)) hits.set(id, (hits.get(id) ?? 0) + 1);
  return accounts
    .filter((a) => (hits.get(a.id) ?? 0) > 0)
    .sort((a, b) => (hits.get(b.id) ?? 0) - (hits.get(a.id) ?? 0))
    .slice(0, max);
}

export type SectorSlice = { label: string; pct: number; value: number };

type Classified = { total_value: number | string | null; sector?: string | null; assetClass?: string | null };

/**
 * The book by sector, largest first. Only 46% of the securities anyone holds
 * carry a sector (measured 2026-09-11), and most of the rest are funds, so the
 * unnamed part is bucketed honestly rather than dropped: a fund is a fund, a
 * coin is a coin, and an equity with no sector on file says so.
 */
export function sectorSplit(holdings: Classified[], labels: { funds: string; crypto: string; unclassified: string }): SectorSlice[] {
  const byLabel = new Map<string, number>();
  let total = 0;
  for (const h of holdings) {
    const value = Number(h.total_value) || 0;
    if (value <= 0) continue;
    // What a thing IS outranks the sector a vendor filed it under. The demo
    // holds SPY and VTI with sector='Diversified', which drew them as a
    // "Diversified" sector slice while the card promised a fund counted as a
    // fund.
    const klass = (h.assetClass ?? '').toLowerCase();
    const label =
      klass === 'etf' || klass === 'mutual_fund'
        ? labels.funds
        : klass === 'crypto'
          ? labels.crypto
          : h.sector
            ? h.sector
            : labels.unclassified;
    byLabel.set(label, (byLabel.get(label) ?? 0) + value);
    total += value;
  }
  if (total <= 0) return [];
  return [...byLabel.entries()]
    .map(([label, value]) => ({ label, value, pct: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}

// The vendor's sector names are too long for a treemap tile at 9px. These are
// the standard short forms, not new categories: anything unlisted is returned
// unchanged, and the caller still truncates what will not fit.
const SHORT_SECTOR: Record<string, string> = {
  'Financial Services': 'Financials',
  'Consumer Cyclical': 'Consumer cyc',
  'Consumer Defensive': 'Consumer def',
  'Communication Services': 'Comms',
  'Basic Materials': 'Materials',
  'Information Technology': 'Technology',
  'Health Care': 'Healthcare',
};

export function shortSector(label: string): string {
  return SHORT_SECTOR[label] ?? label;
}
