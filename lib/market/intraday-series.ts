// Pure helpers for the intraday (1D) net-worth series.
//
// The tick stores the PORTFOLIO total per user per run; the summary route
// turns those into net-worth points. Both halves are arithmetic on plain
// arrays so tests/intraday-tick.test.ts can pin them without a database.

export interface HoldingValue {
  user_id: string;
  total_value: number | null;
}

/** Book value per user after a tick: repriced holdings use their new value,
 *  holdings the tick could not price keep the stored one. */
export function portfolioTotalsByUser(
  holdings: (HoldingValue & { id: string })[],
  repriced: Map<string, number>,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const h of holdings) {
    const v = repriced.get(h.id) ?? Number(h.total_value) ?? 0;
    if (!Number.isFinite(v)) continue;
    totals.set(h.user_id, (totals.get(h.user_id) ?? 0) + v);
  }
  return totals;
}

export interface IntradayPoint {
  captured_at: string;
  total_value: number | string;
}

/** Net worth at each tick: today's cash and liabilities are flat intraday, so
 *  every point is the current net worth with the book swapped for its value
 *  at that time. The final point therefore lands on the displayed figure. */
export function intradayNetWorthSeries(
  points: IntradayPoint[],
  netWorth: number,
  portfolioValue: number,
): { at: string; value: number }[] {
  const base = netWorth - portfolioValue;
  return points
    .map((p) => ({ at: p.captured_at, value: base + Number(p.total_value) }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

const ET_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });

/** Keep only points from today's ET session. */
export function onlyToday(points: IntradayPoint[], now: Date = new Date()): IntradayPoint[] {
  const today = ET_DAY.format(now);
  return points.filter((p) => ET_DAY.format(new Date(p.captured_at)) === today);
}
