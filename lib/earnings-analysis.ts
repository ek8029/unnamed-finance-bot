/**
 * Earnings impact analysis.
 * Maps earnings results and upcoming reports to the user's actual portfolio,
 * calculating dollar-specific impact estimates.
 */

import { createClient } from '@/lib/supabase/server';
import { getEdgarEarnings } from '@/lib/earnings-edgar';
import { getQuarterlyEps } from '@/lib/edgar';
import {
  getCompanyProfile,
  getQuote,
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
  estimated?: boolean;            // date derived from filing history, not a confirmed calendar
  thesisStatus?: 'intact' | 'weakening' | 'broken';
  testPillar?: string;
}

export interface RecentEarningsResult {
  /** Filing-sourced quarterly EPS comparison (XBRL). Estimate-vs-actual needs a
   *  consensus vendor Helm doesn't have; year-over-year is what a filing can
   *  ground, so that is what we show. */
  epsYearAgo?: number | null;
  epsYoyPct?: number | null;
  epsQuarterEnd?: string | null;
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
  const today = new Date().toISOString().split('T')[0];
  const ninetyDaysOut = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

  const totalValue = Array.from(holdingsMap.values()).reduce((s, p) => s + p.totalValue, 0);

  // Derive an estimated next-report date per held ticker from EDGAR 8-K 2.02
  // filing history. getRecentFilings caches, so this stays cheap in parallel.
  const tickers = [...holdingsMap.keys()];
  const dated = await Promise.all(
    tickers.map(async (ticker) => ({
      ticker,
      nextEstimatedDate: (await getEdgarEarnings(ticker)).nextEstimatedDate,
    })),
  );

  const upcoming: UpcomingEarningsEvent[] = [];

  for (const { ticker, nextEstimatedDate } of dated) {
    // Only keep estimates landing inside the forward window
    if (!nextEstimatedDate || nextEstimatedDate < today || nextEstimatedDate > ninetyDaysOut) {
      continue;
    }

    const pos = holdingsMap.get(ticker)!;

    // Refresh position with live price + company data
    const [quote, profile] = await Promise.all([
      getQuote(ticker),
      pos.securityName === ticker ? getCompanyProfile(ticker) : null,
    ]);

    // Use live price if available, recalculate exposure
    let livePosition = pos;
    if (quote && quote.c > 0 && pos.shares > 0) {
      const liveValue = pos.shares * quote.c;
      livePosition = {
        ...pos,
        currentPrice: quote.c,
        totalValue: liveValue,
      };
    }

    const totalExposureValue = livePosition.totalValue;
    const companyName = profile?.name || pos.securityName;

    // Scenario impacts on total exposure
    const beatMove = 0.05 * SURPRISE_MOVE_FACTOR;
    const beatImpact = totalExposureValue * beatMove;
    const missImpact = -(totalExposureValue * beatMove);

    const exposurePosition = {
      ...livePosition,
      totalValue: totalExposureValue,
      allocationPct: totalValue > 0 ? (totalExposureValue / totalValue) * 100 : 0,
    };

    upcoming.push({
      ticker,
      companyName,
      date: nextEstimatedDate,
      time: 'unknown',
      epsEstimate: null,
      revenueEstimate: null,
      position: exposurePosition,
      beatImpact5pct: beatImpact,
      missImpact5pct: missImpact,
      estimated: true,
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

  const totalValue = Array.from(holdingsMap.values()).reduce((s, p) => s + p.totalValue, 0);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

  // Most recent earnings release date per held ticker, from EDGAR 8-K 2.02.
  const tickers = [...holdingsMap.keys()];

  await Promise.allSettled(
    tickers.map(async (ticker) => {
      const { lastReportDate } = await getEdgarEarnings(ticker);

      // Only surface a report from the trailing ~90 days
      if (!lastReportDate || lastReportDate < ninetyDaysAgo) return;

      const pos = holdingsMap.get(ticker)!;

      // Fetch live quote + profile + filing-sourced EPS once per ticker
      const [quote, profile, qEps] = await Promise.all([
        getQuote(ticker),
        pos.securityName === ticker ? getCompanyProfile(ticker) : null,
        getQuarterlyEps(ticker).catch(() => null),
      ]);

      // Use live price for position value
      let livePosition = pos;
      if (quote && quote.c > 0 && pos.shares > 0) {
        const liveValue = pos.shares * quote.c;
        livePosition = { ...pos, currentPrice: quote.c, totalValue: liveValue };
      }

      const totalExposureValue = livePosition.totalValue;

      const exposurePosition = {
        ...livePosition,
        totalValue: totalExposureValue,
        allocationPct: totalValue > 0 ? (totalExposureValue / totalValue) * 100 : 0,
      };

      const companyName = profile?.name || pos.securityName;

      // Actual post-earnings move from quote (day change). EDGAR carries no
      // EPS estimate, so surprise/beat-miss are not available.
      let actualMove: number | null = null;
      let actualDollarImpact: number | null = null;
      if (quote && quote.dp != null) {
        actualMove = quote.dp;
        actualDollarImpact = totalExposureValue * (quote.dp / 100);
      }

      results.push({
        ticker,
        companyName,
        date: lastReportDate,
        // Actual from XBRL. Estimate stays null: EDGAR carries no analyst
        // consensus and we don't fake one — YoY is the grounded comparison.
        epsActual: qEps?.eps ?? null,
        epsEstimate: null,
        epsYearAgo: qEps?.yearAgoEps ?? null,
        epsYoyPct: qEps?.yoyGrowthPct ?? null,
        epsQuarterEnd: qEps?.end ?? null,
        surprisePct: null,
        beat: false,
        position: exposurePosition,
        estimatedImpact: 0,
        actualPostEarningsMove: actualMove,
        actualDollarImpact,
      });
    }),
  );

  // Sort by most recent report first
  results.sort((a, b) => b.date.localeCompare(a.date));
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
  const recentNetImpact = recent.reduce((s, r) => s + (r.actualDollarImpact ?? 0), 0);

  return { upcoming, recent, totalUpcomingExposure, recentNetImpact };
}
