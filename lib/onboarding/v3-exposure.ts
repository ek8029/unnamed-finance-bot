// The one sentence the reveal and the manual preview are built on. Pure.
import { computePortfolioLookthrough, getUnderlyingExposure } from '@/lib/etf-holdings';
import { canonicalTicker } from '@/lib/ticker-alias';

export type ExposureRow = { ticker: string; totalPct: number; directPct: number; indirectPct: number; funds: string[]; accounts: number };
export type BookExposure = { total: number; rows: ExposureRow[]; top: ExposureRow | null };

type Holding = { ticker: string; total_value: number | string | null; account_id?: string | null };

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'];
const pct = (n: number) => `${Math.round(n)}%`;

export function bookExposure(holdings: Holding[]): BookExposure {
  const rows = holdings.map((h) => ({ ticker: h.ticker, totalValue: Number(h.total_value) || 0, account: h.account_id ?? 'manual' }));
  const total = rows.reduce((n, r) => n + r.totalValue, 0);
  if (total <= 0) return { total: 0, rows: [], top: null };
  const map = computePortfolioLookthrough(rows, total);
  // An account counts for a name it holds directly or through a fund it holds.
  // Keys mirror computePortfolioLookthrough (etf-holdings.ts:642-660): the held
  // ticker is canonicalized, fund constituents are keyed as the fund lists them.
  const accountsByTicker = new Map<string, Set<string>>();
  const note = (key: string, account: string) => {
    if (!accountsByTicker.has(key)) accountsByTicker.set(key, new Set());
    accountsByTicker.get(key)!.add(account);
  };
  for (const r of rows) {
    const key = canonicalTicker(r.ticker);
    const underlyings = getUnderlyingExposure(key, r.totalValue, total);
    if (underlyings.length === 0) note(key, r.account);
    for (const u of underlyings) note(u.ticker, r.account);
  }
  const out: ExposureRow[] = [...map.entries()]
    .map(([ticker, d]) => ({
      ticker,
      totalPct: d.totalWeight,
      directPct: d.directWeight,
      indirectPct: d.indirectWeight,
      funds: d.sources.filter((s) => s !== 'Direct'),
      accounts: accountsByTicker.get(ticker)?.size ?? 0,
    }))
    .sort((a, b) => b.totalPct - a.totalPct);
  return { total, rows: out, top: out[0] ?? null };
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function exposureSentence(book: BookExposure): string {
  const t = book.top;
  if (!t) return '';
  const tail = ' That figure comes from every account and the funds inside them.';
  const across = t.accounts > 1 ? `, across ${t.accounts} accounts` : '';
  if (t.indirectPct <= 0) return `${t.ticker} is ${pct(t.totalPct)} of your book, all of it held directly${across}.${tail}`;
  if (t.directPct <= 0) return `${t.ticker} is ${pct(t.totalPct)} of your book, all of it inside ${list(t.funds)}${across}.${tail}`;
  return `${t.ticker} is ${pct(t.totalPct)} of your book: ${pct(t.directPct)} held directly, ${pct(t.indirectPct)} inside ${list(t.funds)}${across}.${tail}`;
}

export function previewSentence(rows: { ticker: string; value: number | null }[]): string {
  if (rows.length === 0) return '';
  if (rows.some((r) => r.value == null)) return 'Prices load when the book is read.';
  const book = bookExposure(rows.map((r) => ({ ticker: r.ticker, total_value: r.value })));
  const t = book.top;
  if (!t) return '';
  const n = rows.length;
  const count = n === 1 ? 'this one position' : `these ${WORDS[n] ?? n} positions`;
  const inside = t.indirectPct > 0 ? `, ${pct(t.indirectPct)} of it inside ${list(t.funds)}` : '';
  return `${t.ticker} is ${pct(t.totalPct)} of ${count}${inside}.`;
}
