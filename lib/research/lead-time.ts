// Lead time: the honest, defensible value metric for thesis findings.
//
// We do NOT claim alpha ("acting on this made $X" needs a counterfactual we
// don't have). We claim coverage and lead time: Helm surfaced the evidence N
// trading days before the price actually moved — or it didn't, and that miss is
// counted too. Pure functions; callers supply the price series.

export interface PricePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

export interface ForwardMove {
  /** Close on the first trading day on/after the catch date. */
  baseDate: string;
  basePrice: number;
  /** Worst adverse move within the horizon, as a signed % (down = negative). */
  maxAdversePct: number;
  /** Trading days from base until the adverse move first crossed the threshold; null = never did. */
  daysToThreshold: number | null;
  /** % change from base to the last close inside the horizon. */
  endPct: number;
}

/**
 * What the price did in the `horizon` trading days after `dateISO`.
 * `direction` is the move that would CONFIRM the finding: 'down' for a
 * contradicting catch, 'up' for a supporting one.
 */
export function forwardMove(
  series: PricePoint[],
  dateISO: string,
  horizon: number,
  thresholdPct: number,
  direction: 'down' | 'up' = 'down',
): ForwardMove | null {
  if (thresholdPct <= 0 || horizon <= 0) return null;
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const startIdx = sorted.findIndex((p) => p.date >= dateISO);
  if (startIdx === -1) return null;
  const base = sorted[startIdx];
  if (!(base.close > 0)) return null;
  const window = sorted.slice(startIdx + 1, startIdx + 1 + horizon);
  if (window.length === 0) return null;

  const sign = direction === 'down' ? -1 : 1;
  let maxAdversePct = 0; // most-confirming move seen, signed
  let daysToThreshold: number | null = null;
  window.forEach((p, i) => {
    const pct = ((p.close - base.close) / base.close) * 100;
    if (sign * pct > sign * maxAdversePct) maxAdversePct = pct;
    if (daysToThreshold === null && sign * pct >= thresholdPct) daysToThreshold = i + 1;
  });
  const endPct = ((window[window.length - 1].close - base.close) / base.close) * 100;

  return { baseDate: base.date, basePrice: base.close, maxAdversePct, daysToThreshold, endPct };
}

/**
 * The null hypothesis: how often would a RANDOMLY timed "catch" on this series
 * have been "confirmed"? Fraction of all start days whose forward window
 * crosses the threshold. Reporting a hit rate without this is claiming signal
 * that might just be the tape.
 */
export function baseRate(
  series: PricePoint[],
  horizon: number,
  thresholdPct: number,
  direction: 'down' | 'up' = 'down',
): number | null {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  let windows = 0;
  let hits = 0;
  // Only start days with a FULL horizon ahead, so the null matches the measure.
  for (let i = 0; i + horizon < sorted.length; i++) {
    const m = forwardMove(sorted, sorted[i].date, horizon, thresholdPct, direction);
    if (!m || m.baseDate !== sorted[i].date) continue;
    windows++;
    if (m.daysToThreshold !== null) hits++;
  }
  return windows > 0 ? hits / windows : null;
}

export interface LeadTimeStats {
  catches: number;
  /** Catches whose confirming move crossed the threshold inside the horizon. */
  confirmed: number;
  /** Catches where it never did — counted, not hidden. */
  missed: number;
  medianLeadDays: number | null;
  medianConfirmedMovePct: number | null;
}

export function summarizeLeadTimes(moves: ForwardMove[]): LeadTimeStats {
  const confirmedMoves = moves.filter((m) => m.daysToThreshold !== null);
  const median = (xs: number[]): number | null => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  return {
    catches: moves.length,
    confirmed: confirmedMoves.length,
    missed: moves.length - confirmedMoves.length,
    medianLeadDays: median(confirmedMoves.map((m) => m.daysToThreshold as number)),
    medianConfirmedMovePct: median(confirmedMoves.map((m) => m.maxAdversePct)),
  };
}
