/**
 * Earnings impact analysis.
 * Maps earnings results and upcoming reports to the user's actual portfolio,
 * calculating dollar-specific impact estimates.
 */

import { createClient } from '@/lib/supabase/server';
import { getUnderlyingExposure } from '@/lib/etf-holdings';
import {
  getEarningsCalendar,
  getEarnings,
  getCompanyProfile,
  getQuote,
  getBasicFinancials,
  type EarningsCalendarItem,
  type FinnhubEarning,
} from '@/lib/financial-data';

// ── Types ──

export interface UserPosition {
  ticker: string;
  securityName: string;
  shares: number;
  currentPrice: number;
  totalValue: number;
  allocationPct: number;
  sector: string;
}

export interface UpcomingEarningsEvent {
  ticker: string;
  companyName: string;
  date: string;                   // YYYY-MM-DD
  time: 'before_open' | 'after_close' | 'unknown';
  epsEstimate: number | null;
  revenueEstimate: number | null;
  position: UserPosition;
  // Scenario analysis
  beatImpact5pct: number;         // estimated $ impact if beats by 5%
  missImpact5pct: number;         // estimated $ impact if misses by 5%
}

export interface RecentEarningsResult {
  ticker: string;
  companyName: string;
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePct: number | null;     // e.g. 12.5 for 12.5% beat
  beat: boolean;
  position: UserPosition;
  estimatedImpact: number;        // estimated $ impact based on surprise
  actualPostEarningsMove: number | null;  // actual % move from quote
  actualDollarImpact: number | null;
}

export interface EarningsReport {
  upcoming: UpcomingEarningsEvent[];
  recent: RecentEarningsResult[];
  totalUpcomingExposure: number;
  recentNetImpact: number;
}

// ── Config ──

// Earnings surprise impact model:
// Every 1% EPS surprise → ~1% stock move.
// Historical average: stocks move ~5-8% on earnings.
// A 5% EPS beat with factor 1.0 → 5% stock move, which is realistic.
const SURPRISE_MOVE_FACTOR = 1.0;

// ── Holdings fetch ──

interface RawHolding {
  ticker: string;
  shares: number;
  current_price: number;
  total_value: number;
  portfolio_allocation_pct: number | null;
  security: {
    security_name: string | null;
    sector: string | null;
  } | null;
}

async function getUserHoldings(userId: string): Promise<Map<string, UserPosition>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('holdings')
    .select(`
      ticker, shares, current_price, total_value,
      portfolio_allocation_pct,
      security:securities(security_name, sector)
    `)
    .eq('user_id', userId)
    .order('total_value', { ascending: false });

  if (error || !data) return new Map();

  const totalValue = (data as unknown as RawHolding[]).reduce((s, h) => s + (h.total_value || 0), 0);
  const map = new Map<string, UserPosition>();

  for (const h of data as unknown as RawHolding[]) {
    map.set(h.ticker, {
      ticker: h.ticker,
      securityName: h.security?.security_name || h.ticker,
      shares: h.shares,
      currentPrice: h.current_price,
      totalValue: h.total_value || 0,
      allocationPct: h.portfolio_allocation_pct ?? (totalValue > 0 ? ((h.total_value || 0) / totalValue) * 100 : 0),
      sector: h.security?.sector || 'Unknown',
    });
  }

  return map;
}

// ── Upcoming earnings ──

async function getUpcomingEarnings(
  holdingsMap: Map<string, UserPosition>,
): Promise<UpcomingEarningsEvent[]> {
  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 86400000);
  const from = now.toISOString().split('T')[0];
  const to = twoWeeksOut.toISOString().split('T')[0];

  // Fetch earnings calendar from Finnhub
  const calendar = await getEarningsCalendar(from, to);

  // Build indirect exposure map: ticker → total exposure from ETFs
  const totalValue = Array.from(holdingsMap.values()).reduce((s, p) => s + p.totalValue, 0);
  const indirectExposure = new Map<string, { exposureValue: number; sources: string[] }>();
  for (const [hTicker, pos] of holdingsMap) {
    const underlyings = getUnderlyingExposure(hTicker, pos.totalValue, totalValue);
    for (const u of underlyings) {
      const existing = indirectExposure.get(u.ticker) || { exposureValue: 0, sources: [] };
      existing.exposureValue += (u.effectiveWeight / 100) * totalValue;
      if (!existing.sources.includes(u.source)) existing.sources.push(u.source);
      indirectExposure.set(u.ticker, existing);
    }
  }

  // Cross-reference with user holdings (direct + indirect via ETFs)
  const upcoming: UpcomingEarningsEvent[] = [];

  for (const event of calendar) {
    let position = holdingsMap.get(event.symbol);
    const indirect = indirectExposure.get(event.symbol);

    // Skip if no direct or indirect exposure
    if (!position && !indirect) continue;

    // If only indirect exposure, create a synthetic position
    if (!position && indirect) {
      position = {
        ticker: event.symbol,
        securityName: event.symbol,
        shares: 0,
        currentPrice: 0,
        totalValue: indirect.exposureValue,
        allocationPct: totalValue > 0 ? (indirect.exposureValue / totalValue) * 100 : 0,
        sector: 'Unknown',
      };
    }

    // position is guaranteed non-undefined after the guards above
    const pos = position!;

    // Refresh position with live price + company data
    const [quote, profile] = await Promise.all([
      getQuote(event.symbol),
      pos.securityName === event.symbol ? getCompanyProfile(event.symbol) : null,
    ]);

    // Use live price if available, recalculate exposure
    let livePosition = pos;
    if (quote && quote.c > 0) {
      const liveValue = pos.shares * quote.c;
      livePosition = {
        ...pos,
        currentPrice: quote.c,
        totalValue: liveValue,
      };
    }

    const companyName = profile?.name || pos.securityName;

    // Calculate scenario impacts
    // 5% EPS beat → stock moves ~5%, applied to live position value
    const beatMove = 0.05 * SURPRISE_MOVE_FACTOR;
    const beatImpact = livePosition.totalValue * beatMove;
    const missImpact = -(livePosition.totalValue * beatMove);

    upcoming.push({
      ticker: event.symbol,
      companyName,
      date: event.date,
      time: event.hour === 'bmo' ? 'before_open' : event.hour === 'amc' ? 'after_close' : 'unknown',
      epsEstimate: event.epsEstimate,
      revenueEstimate: event.revenueEstimate,
      position: livePosition,
      beatImpact5pct: beatImpact,
      missImpact5pct: missImpact,
    });
  }

  // Sort by date
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  return upcoming;
}

// ── Recent earnings results ──

async function getRecentEarnings(
  holdingsMap: Map<string, UserPosition>,
): Promise<RecentEarningsResult[]> {
  const results: RecentEarningsResult[] = [];
  const tickers = [...holdingsMap.keys()];

  // Fetch recent earnings for each holding (limited to avoid rate limits)
  const batch = tickers.slice(0, 10);

  await Promise.allSettled(
    batch.map(async (ticker) => {
      const position = holdingsMap.get(ticker)!;

      // Get historical earnings
      const earnings = await getEarnings(ticker);
      if (!earnings?.length) return;

      // Find earnings from the last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      const recent = earnings.filter((e: FinnhubEarning) => {
        if (!e.period) return false;
        const earningsDate = new Date(e.period);
        return earningsDate >= sevenDaysAgo;
      });

      // Also check the most recent earnings if within 30 days
      // (Finnhub period field may lag)
      const latestEarning = earnings[0];
      if (latestEarning?.actual != null && latestEarning?.estimate != null) {
        const latestDate = latestEarning.period ? new Date(latestEarning.period) : null;
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

        if (latestDate && latestDate >= thirtyDaysAgo && !recent.includes(latestEarning)) {
          recent.push(latestEarning);
        }
      }

      // Fetch live quote + profile once per ticker
      const [quote, profile] = await Promise.all([
        getQuote(ticker),
        position.securityName === ticker ? getCompanyProfile(ticker) : null,
      ]);

      // Use live price for position value
      let livePosition = position;
      if (quote && quote.c > 0) {
        const liveValue = position.shares * quote.c;
        livePosition = { ...position, currentPrice: quote.c, totalValue: liveValue };
      }

      const companyName = profile?.name || position.securityName;

      for (const e of recent) {
        if (e.actual == null || e.estimate == null) continue;

        const surprisePct = e.estimate !== 0 ? ((e.actual - e.estimate) / Math.abs(e.estimate)) * 100 : 0;
        const beat = e.actual > e.estimate;

        // Estimate stock move from surprise
        const estimatedStockMove = (surprisePct / 100) * SURPRISE_MOVE_FACTOR;
        const estimatedImpact = livePosition.totalValue * estimatedStockMove;

        // Actual post-earnings move from quote (day change)
        let actualMove: number | null = null;
        let actualDollarImpact: number | null = null;
        if (quote && quote.dp != null) {
          actualMove = quote.dp;
          actualDollarImpact = livePosition.totalValue * (quote.dp / 100);
        }

        results.push({
          ticker,
          companyName,
          date: e.period || '',
          epsActual: e.actual,
          epsEstimate: e.estimate,
          surprisePct,
          beat,
          position: livePosition,
          estimatedImpact,
          actualPostEarningsMove: actualMove,
          actualDollarImpact,
        });
      }
    }),
  );

  // Sort by most impactful first
  results.sort((a, b) => Math.abs(b.estimatedImpact) - Math.abs(a.estimatedImpact));
  return results;
}

// ── Main export ──

export async function generateEarningsReport(userId: string): Promise<EarningsReport> {
  const holdingsMap = await getUserHoldings(userId);

  if (holdingsMap.size === 0) {
    return { upcoming: [], recent: [], totalUpcomingExposure: 0, recentNetImpact: 0 };
  }

  const [upcoming, recent] = await Promise.all([
    getUpcomingEarnings(holdingsMap),
    getRecentEarnings(holdingsMap),
  ]);

  const totalUpcomingExposure = upcoming.reduce((s, e) => s + e.position.totalValue, 0);
  const recentNetImpact = recent.reduce((s, r) => s + r.estimatedImpact, 0);

  return { upcoming, recent, totalUpcomingExposure, recentNetImpact };
}
