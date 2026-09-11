// The one sentence the reveal and the manual preview are built on. Pure.
import { computePortfolioLookthrough, getUnderlyingExposure } from '@/lib/etf-holdings';
import { canonicalTicker } from '@/lib/ticker-alias';

export type ExposureRow = { ticker: string; totalPct: number; directPct: number; indirectPct: number; funds: string[]; accounts: number; accountIds: string[] };
export type BookExposure = { total: number; rows: ExposureRow[]; top: ExposureRow | null };

type Holding = { ticker: string; total_value: number | string | null; account_id?: string | null };

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
// A leveraged product's source reads `TQQQ (+3x QQQ)` (etf-holdings.ts:606); prose gets the bare ticker.
const fundName = (s: string) => s.split(' (')[0];

export function bookExposure(holdings: Holding[]): BookExposure {
  // total_value arrives as a Postgres numeric (string) or an already-typed number; NaN is not expected and reads as zero on purpose.
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
      funds: [...new Set(d.sources.filter((s) => s !== 'Direct').map(fundName))],
      accounts: accountsByTicker.get(ticker)?.size ?? 0,
      // Which accounts, not just how many: the overlap graphic draws a cell
      // per account and needs to know which ones to fill.
      accountIds: [...(accountsByTicker.get(ticker) ?? [])],
    }))
    .sort((a, b) => b.totalPct - a.totalPct);
  return { total, rows: out, top: out[0] ?? null };
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// The displayed parts are derived from the displayed total so they always sum.
const rounded = (t: ExposureRow) => {
  const rt = Math.round(t.totalPct);
  const rd = Math.round(t.directPct);
  return { rt, rd, ri: rt - rd };
};

export function exposureSentence(book: BookExposure): string {
  const t = book.top;
  if (!t) return '';
  const { rt, rd, ri } = rounded(t);
  const tail = ' That figure comes from every account and the funds inside them.';
  const across = t.accounts > 1 ? `, across ${t.accounts} accounts` : '';
  if (ri <= 0) {
    const all = t.indirectPct > 0 ? 'nearly all of it' : 'all of it';
    return `${t.ticker} is ${rt}% of your book, ${all} held directly${across}.${tail}`;
  }
  if (rd <= 0) {
    const all = t.directPct > 0 ? 'nearly all of it' : 'all of it';
    return `${t.ticker} is ${rt}% of your book, ${all} inside ${list(t.funds)}${across}.${tail}`;
  }
  return `${t.ticker} is ${rt}% of your book: ${rd}% held directly, ${ri}% inside ${list(t.funds)}${across}.${tail}`;
}

/** The exposure sentence when the person asked to see overlap between accounts. */
export function overlapSentence(book: BookExposure, accounts: number): string {
  const t = book.top;
  if (!t) return '';
  return `${t.ticker} sits in ${t.accounts} of your ${accounts} accounts.`;
}

export function previewSentence(rows: { ticker: string; value: number | null }[]): string {
  if (rows.length === 0) return '';
  if (rows.some((r) => r.value == null)) return 'Prices load when the book is read.';
  const book = bookExposure(rows.map((r) => ({ ticker: r.ticker, total_value: r.value })));
  const t = book.top;
  if (!t) return '';
  const { rt, ri } = rounded(t);
  const n = rows.length;
  const count = n === 1 ? 'this one position' : `these ${WORDS[n] ?? n} positions`;
  const inside = ri > 0 ? `, ${ri}% of it inside ${list(t.funds)}` : '';
  return `${t.ticker} is ${rt}% of ${count}${inside}.`;
}
