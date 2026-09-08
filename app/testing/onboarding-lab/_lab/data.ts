// Demo data for the onboarding lab. Nothing here is a real user's book.
export type Holding = { ticker: string; shares: number; price: number };
export type Account = { id: string; institution: string; type: string; via: 'plaid' | 'manual'; holdings: Holding[] };

export const INSTITUTIONS = ['Fidelity', 'Schwab', 'Robinhood', 'Vanguard', 'E*TRADE', 'Coinbase', 'Interactive Brokers', 'Questrade'];

const PRICES: Record<string, number> = { NVDA: 118.4, AAPL: 228.1, MSFT: 415.6, VOO: 512.2, QQQ: 478.9, TSLA: 246.3, AMZN: 186.7, META: 521.4, GOOGL: 168.2, AMD: 152.9 };
export const priceOf = (t: string) => PRICES[t.toUpperCase()] ?? 100;

// Sample look-through weights (demo values, not live fund data).
const LOOKTHROUGH: Record<string, Record<string, number>> = {
  VOO: { NVDA: 0.065, AAPL: 0.068, MSFT: 0.062, AMZN: 0.038, META: 0.024, GOOGL: 0.037 },
  QQQ: { NVDA: 0.089, AAPL: 0.084, MSFT: 0.08, AMZN: 0.052, META: 0.048, GOOGL: 0.05, TSLA: 0.031 },
};

export const SAMPLE_PLAID: Record<string, Account> = {
  Fidelity: { id: 'fid', institution: 'Fidelity', type: 'Taxable brokerage', via: 'plaid', holdings: [
    { ticker: 'NVDA', shares: 120, price: PRICES.NVDA }, { ticker: 'VOO', shares: 40, price: PRICES.VOO },
    { ticker: 'AAPL', shares: 60, price: PRICES.AAPL }, { ticker: 'QQQ', shares: 25, price: PRICES.QQQ }] },
  Schwab: { id: 'sch', institution: 'Schwab', type: 'Roth IRA', via: 'plaid', holdings: [
    { ticker: 'VOO', shares: 30, price: PRICES.VOO }, { ticker: 'MSFT', shares: 35, price: PRICES.MSFT }, { ticker: 'NVDA', shares: 40, price: PRICES.NVDA }] },
  Robinhood: { id: 'rh', institution: 'Robinhood', type: 'Taxable brokerage', via: 'plaid', holdings: [
    { ticker: 'TSLA', shares: 30, price: PRICES.TSLA }, { ticker: 'AMD', shares: 50, price: PRICES.AMD }] },
  Vanguard: { id: 'van', institution: 'Vanguard', type: 'Traditional IRA', via: 'plaid', holdings: [
    { ticker: 'VOO', shares: 55, price: PRICES.VOO }] },
};
// Institutions Plaid cannot resolve in the sandbox story (the real exit users hit most).
export const NOT_FOUND = new Set(['Questrade', 'Interactive Brokers']);

export function manualAccount(rows: { ticker: string; shares: number }[]): Account {
  return { id: `man-${Date.now()}`, institution: 'Entered by hand', type: 'Taxable brokerage', via: 'manual',
    holdings: rows.map(r => ({ ticker: r.ticker.toUpperCase(), shares: r.shares, price: priceOf(r.ticker) })) };
}

export type Exposure = { ticker: string; direct: number; indirect: number; total: number; pct: number; accounts: number; viaFunds: string[] };

export function exposure(accounts: Account[]) {
  const total = accounts.reduce((s, a) => s + a.holdings.reduce((x, h) => x + h.shares * h.price, 0), 0);
  const direct = new Map<string, number>(); const indirect = new Map<string, number>(); const via = new Map<string, Set<string>>(); const acct = new Map<string, Set<string>>();
  for (const a of accounts) for (const h of a.holdings) {
    const v = h.shares * h.price;
    direct.set(h.ticker, (direct.get(h.ticker) ?? 0) + v);
    acct.set(h.ticker, (acct.get(h.ticker) ?? new Set()).add(a.id));
    for (const [t, w] of Object.entries(LOOKTHROUGH[h.ticker] ?? {})) {
      indirect.set(t, (indirect.get(t) ?? 0) + v * w);
      via.set(t, (via.get(t) ?? new Set()).add(h.ticker));
      acct.set(t, (acct.get(t) ?? new Set()).add(a.id));
    }
  }
  const tickers = new Set([...direct.keys(), ...indirect.keys()]);
  const rows: Exposure[] = [...tickers].filter(t => !LOOKTHROUGH[t]).map(t => {
    const d = direct.get(t) ?? 0, i = indirect.get(t) ?? 0;
    return { ticker: t, direct: d, indirect: i, total: d + i, pct: total ? (d + i) / total : 0, accounts: acct.get(t)?.size ?? 0, viaFunds: [...(via.get(t) ?? [])] };
  }).sort((a, b) => b.total - a.total);
  return { total, rows, top: rows[0] ?? null, positions: accounts.reduce((s, a) => s + a.holdings.length, 0) };
}

export const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const pct = (n: number) => `${Math.round(n * 100)}%`;

// The 13 names the house covers today. Everything else gets the honest fallback.
export const COVERED = new Set(['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AMD', 'AVGO', 'MU', 'PLTR', 'NFLX', 'INTC']);

export const RECEIPTS: Record<string, { verdict: 'SUPPORTED' | 'WEAKENING'; pillar: string; quote: string; source: string; date: string }> = {
  NVDA: { verdict: 'SUPPORTED', pillar: 'Data center demand keeps compounding', quote: 'Data Center revenue grew year over year, driven by demand for our accelerated computing platform.', source: 'Form 10-Q, sample', date: 'Aug 27, 2026' },
  AAPL: { verdict: 'SUPPORTED', pillar: 'Services margin carries the mix', quote: 'Services revenue reached a new record, with gross margin above the company average.', source: 'Form 10-Q, sample', date: 'Aug 1, 2026' },
  MSFT: { verdict: 'SUPPORTED', pillar: 'Cloud consumption growth', quote: 'Azure and other cloud services revenue growth was driven by continued consumption.', source: 'Form 10-K, sample', date: 'Jul 30, 2026' },
  TSLA: { verdict: 'WEAKENING', pillar: 'Automotive gross margin recovery', quote: 'Automotive gross margin declined sequentially on lower average selling prices.', source: 'Form 10-Q, sample', date: 'Jul 23, 2026' },
};
