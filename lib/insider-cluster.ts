// lib/insider-cluster.ts
// E6.2 (spec 2026-07-16): insider-cluster pre-aggregation. The judge sees Form 4s
// one at a time, and the 10b5-1 guard rightly mutes planned sales — so a PATTERN
// of many insiders selling in the same window never reaches it. This detector
// compresses the batch into one synthetic candidate the judge can weigh.
// Pure code, no model, no schema change (rides source_type 'form4').

import type { Form4Summary } from '@/lib/edgar';

/** Distinct discretionary sellers required before the pattern is a signal. */
export const CLUSTER_MIN_SELLERS = 3;

export interface InsiderCluster {
  sellerCount: number;
  totalSaleValue: number;
  sellers: string[]; // "Name (Role)" — capped for prompt size
  firstDate: string;
  lastDate: string;
}

/**
 * Detect a discretionary-selling cluster in a scan window's Form 4 batch.
 * 10b5-1 plan sales are excluded entirely: pre-scheduled selling is not a signal.
 * Returns null when fewer than CLUSTER_MIN_SELLERS distinct insiders sold.
 */
export function detectInsiderCluster(form4s: Form4Summary[]): InsiderCluster | null {
  const sellers = new Map<string, { role: string; value: number; dates: string[] }>();
  for (const f of form4s) {
    if (f.is10b51) continue;
    const sold = f.transactions.some((t) => t.isDisposition);
    if (!sold) continue;
    const cur = sellers.get(f.ownerName) ?? { role: f.ownerRole, value: 0, dates: [] };
    cur.value += f.totalSaleValue;
    cur.dates.push(f.filedAt);
    sellers.set(f.ownerName, cur);
  }
  if (sellers.size < CLUSTER_MIN_SELLERS) return null;

  const allDates = [...sellers.values()].flatMap((s) => s.dates).sort();
  return {
    sellerCount: sellers.size,
    totalSaleValue: [...sellers.values()].reduce((sum, s) => sum + s.value, 0),
    sellers: [...sellers.entries()].slice(0, 6).map(([name, s]) => (s.role ? `${name} (${s.role})` : name)),
    firstDate: allDates[0] ?? '',
    lastDate: allDates[allDates.length - 1] ?? '',
  };
}

/** System-generated candidate text (doubles as the verbatim excerpt, like price_move). */
export function clusterText(ticker: string, c: InsiderCluster): string {
  const value = c.totalSaleValue > 0
    ? ` totaling ~$${c.totalSaleValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : '';
  return `Insider selling cluster at ${ticker}: ${c.sellerCount} distinct insiders filed discretionary (non-10b5-1) sales${value} between ${c.firstDate} and ${c.lastDate}: ${c.sellers.join(', ')}.`;
}
