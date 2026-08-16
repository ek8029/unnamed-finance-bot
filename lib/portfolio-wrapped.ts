/**
 * Portfolio Wrapped — "Year in Review" / "Quarter in Review" generator.
 * Compiles investing stats for a shareable, story-format summary.
 * Designed around the user's actual data from Supabase.
 */

import { createClient } from '@/lib/supabase/server';
import { getPortfolioSummary } from '@/lib/portfolio-analysis';
import { assetBalance, isLiabilityType, liabilityBalance } from '@/lib/account-balance';
import { generateTaxReport } from '@/lib/tax-analysis';
import { getQuote } from '@/lib/financial-data';
import { getHistoricalPrices } from '@/lib/finazon';
import { CACHE_TTL as GLOBAL_CACHE_TTL } from '@/lib/financial-config';

// ── Types ──

export interface WrappedPosition {
  ticker: string;
  name: string;
  returnPct: number;
  returnDollars: number;
  value: number;
}

export interface WrappedDay {
  date: string;          // snapshot_date of the day (later of the pair)
  changeDollars: number; // market P/L move that day
  changePct: number;     // move as % of prior day value
}

export interface InvestorPersonality {
  type: string;
  title: string;
  description: string;
  traits: string[];
}

export interface WrappedData {
  period: 'quarter' | 'year';
  periodLabel: string;           // "Q1 2026" or "2026"
  periodRange: string;           // "Jan 1 – Mar 13, 2026"
  totalReturn: { pct: number; dollars: number };
  bestPosition: WrappedPosition | null;
  worstPosition: WrappedPosition | null;
  bestDays: WrappedDay[];
  worstDays: WrappedDay[];
  upDays: number;
  downDays: number;
  daySeries: { date: string; v: number }[];
  totalDividends: number;
  tradeCount: number;
  spyComparison: { userReturn: number; spyReturn: number | null; beat: boolean | null };
  taxSavings: number;
  mostActiveTradingDay: { date: string; trades: number } | null;
  sectorBreakdown: { sector: string; pct: number; value: number }[];
  healthScoreTrend: { start: number | null; end: number | null; change: number };
  netWorthChange: { start: number; end: number; change: number; changePct: number };
  positionCount: number;
  portfolioValue: number;
  topHoldings: { ticker: string; name: string; value: number; pct: number }[];
  investorPersonality: InvestorPersonality;
  uniqueTickersTraded: number;
}

// ── Investor Personality Classification ──

const PERSONALITIES: Record<string, InvestorPersonality> = {
  concentrator: {
    type: 'concentrator',
    title: 'The Concentrator',
    description: "You don't follow the crowd — you go deep on your highest-conviction picks.",
    traits: ['High conviction', 'Research-driven', 'Focused'],
  },
  activeTrader: {
    type: 'active-trader',
    title: 'The Active Trader',
    description: "Markets don't sleep and neither does your portfolio. Always in motion, always looking for the next opportunity.",
    traits: ['Market-aware', 'Opportunity-driven', 'Decisive'],
  },
  incomeInvestor: {
    type: 'income-investor',
    title: 'The Income Investor',
    description: 'You build wealth that works for you. Dividends are your compounding engine.',
    traits: ['Patient', 'Cash-flow focused', 'Long-term thinker'],
  },
  diversifier: {
    type: 'diversifier',
    title: 'The Diversifier',
    description: 'Your portfolio is built like a fortress. Broad exposure keeps risk in check while capturing upside.',
    traits: ['Risk-aware', 'Methodical', 'Well-balanced'],
  },
  growthHunter: {
    type: 'growth-hunter',
    title: 'The Growth Hunter',
    description: "You bet on the future. A tech-forward portfolio shows you're chasing the next big thing.",
    traits: ['Forward-looking', 'Tech-savvy', 'Ambitious'],
  },
  taxOptimizer: {
    type: 'tax-optimizer',
    title: 'The Tax Optimizer',
    description: "Returns aren't just about gains — it's what you keep. Smart tax moves are your edge.",
    traits: ['Strategic', 'Detail-oriented', 'Efficient'],
  },
  steadyHand: {
    type: 'steady-hand',
    title: 'The Steady Hand',
    description: 'Buy and hold is your mantra. You tune out noise and let time do the heavy lifting.',
    traits: ['Disciplined', 'Patient', 'Low-maintenance'],
  },
  momentumRider: {
    type: 'momentum-rider',
    title: 'The Momentum Rider',
    description: "You know how to catch a wave. Strong returns show you're positioned in the right places at the right time.",
    traits: ['Trend-aware', 'Well-timed', 'Performance-driven'],
  },
  balancedNavigator: {
    type: 'balanced-navigator',
    title: 'The Balanced Navigator',
    description: 'Strategic and measured. You chart a steady course through any market conditions.',
    traits: ['Measured', 'Adaptive', 'Thoughtful'],
  },
};

function classifyInvestor(params: {
  positionCount: number;
  tradeCount: number;
  totalDividends: number;
  portfolioValue: number;
  taxSavings: number;
  sectorBreakdown: { sector: string; pct: number }[];
  totalReturnPct: number;
  period: 'quarter' | 'year';
}): InvestorPersonality {
  const { positionCount, tradeCount, totalDividends, portfolioValue, taxSavings, sectorBreakdown, totalReturnPct, period } = params;

  const techPct = sectorBreakdown
    .filter(s => ['Technology', 'Communication Services'].includes(s.sector))
    .reduce((sum, s) => sum + s.pct, 0);

  // Annualize dividend yield for quarter comparison
  const annualizedDividends = period === 'quarter' ? totalDividends * 4 : totalDividends;
  const dividendYield = portfolioValue > 0 ? (annualizedDividends / portfolioValue) * 100 : 0;

  // Priority-based classification — strongest behavioral signals first
  if (positionCount <= 3 && positionCount > 0) return PERSONALITIES.concentrator;
  if (tradeCount >= 50) return PERSONALITIES.activeTrader;
  if (dividendYield >= 2) return PERSONALITIES.incomeInvestor;
  if (positionCount >= 20) return PERSONALITIES.diversifier;
  if (techPct >= 50) return PERSONALITIES.growthHunter;
  if (taxSavings >= 500) return PERSONALITIES.taxOptimizer;
  if (tradeCount <= 3) return PERSONALITIES.steadyHand;
  if (totalReturnPct >= 15) return PERSONALITIES.momentumRider;
  return PERSONALITIES.balancedNavigator;
}

// ── Cache (1 hour per user+period) ──

const wrappedCache = new Map<string, { data: WrappedData; expiry: number }>();
const CACHE_TTL = GLOBAL_CACHE_TTL.portfolioWrapped;

function getCached(key: string): WrappedData | null {
  const entry = wrappedCache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  if (entry) wrappedCache.delete(key);
  return null;
}

// ── Period helpers ──

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getPeriodDates(period: 'quarter' | 'year') {
  const now = new Date();
  const year = now.getFullYear();
  const today = now.toISOString().split('T')[0];

  if (period === 'year') {
    return {
      start: `${year}-01-01`,
      end: today,
      label: `${year}`,
      range: `Jan 1 – ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}, ${year}`,
    };
  }

  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const qStartMonth = (quarter - 1) * 3;
  const startDate = new Date(year, qStartMonth, 1);
  return {
    start: startDate.toISOString().split('T')[0],
    end: today,
    label: `Q${quarter} ${year}`,
    range: `${MONTH_NAMES[qStartMonth]} 1 – ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}, ${year}`,
  };
}

// ── Main export ──

// ── Best / worst market days ──
// Day change = delta of total_gain_loss between consecutive snapshots. This is
// deposit-immune: a deposit raises total_value AND cost basis but not gain_loss,
// so the delta reflects market move only (a deposit day can't fake a "best day").
function computeBestWorstDays(
  snapshots: { snapshot_date: string; total_value: number | null; total_gain_loss: number | null }[],
): { bestDays: WrappedDay[]; worstDays: WrappedDay[]; upDays: number; downDays: number } {
  const deltas: WrappedDay[] = [];
  let upDays = 0;
  let downDays = 0;
  for (let i = 1; i < snapshots.length; i++) {
    // A "day" must actually be a day: snapshot history has gaps (missed cron
    // runs, backfills), and the delta across a multi-week gap is not a daily
    // move — it once produced a "+$182K best day" spanning 37 calendar days.
    // Allow up to 4 days so a Friday→Monday pair still counts.
    const spanDays =
      (Date.parse(snapshots[i].snapshot_date) - Date.parse(snapshots[i - 1].snapshot_date)) / 86400000;
    if (!(spanDays > 0 && spanDays <= 4)) continue;
    // Null gain_loss on either side means unknown, not zero — a null→value
    // pair would fabricate the entire cumulative gain as one day's move.
    if (snapshots[i].total_gain_loss == null || snapshots[i - 1].total_gain_loss == null) continue;
    const gl = Number(snapshots[i].total_gain_loss) - Number(snapshots[i - 1].total_gain_loss);
    const base = Number(snapshots[i - 1].total_value ?? 0);
    if (gl === 0 || base <= 0) continue;
    if (gl > 0) upDays++; else downDays++;
    deltas.push({
      date: snapshots[i].snapshot_date,
      changeDollars: Math.round(gl * 100) / 100,
      changePct: Math.round((gl / base) * 10000) / 100,
    });
  }
  return {
    bestDays: deltas.filter((d) => d.changeDollars > 0).sort((a, b) => b.changeDollars - a.changeDollars).slice(0, 3),
    worstDays: deltas.filter((d) => d.changeDollars < 0).sort((a, b) => a.changeDollars - b.changeDollars).slice(0, 3),
    upDays,
    downDays,
  };
}

export async function generateWrapped(
  userId: string,
  period: 'quarter' | 'year' = 'quarter',
): Promise<WrappedData> {
  const cacheKey = `${userId}:${period}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const supabase = await createClient();
  const { start, end, label, range } = getPeriodDates(period);

  // ── Run all queries concurrently ──
  const [
    portfolioSummary,
    taxReport,
    spyQuote,
    snapshotsResult,
    netWorthResult,
    healthResult,
    tradesResult,
    dividendsResult,
    accountsResult,
    holdingsResult,
  ] = await Promise.all([
    getPortfolioSummary(userId),
    generateTaxReport(userId),
    getHistoricalPrices('SPY', start, end),
    // Portfolio snapshots: earliest and latest in period
    supabase
      .from('portfolio_snapshots')
      .select('snapshot_date, total_value, total_cost_basis, total_gain_loss, total_gain_loss_pct')
      .eq('user_id', userId)
      .gte('snapshot_date', start)
      .lte('snapshot_date', end)
      .order('snapshot_date', { ascending: true }),
    // Net worth snapshots
    supabase
      .from('net_worth_snapshots')
      .select('snapshot_date, net_worth')
      .eq('user_id', userId)
      .gte('snapshot_date', start)
      .lte('snapshot_date', end)
      .order('snapshot_date', { ascending: true }),
    // Health scores
    supabase
      .from('financial_health_scores')
      .select('overall_score, calculated_at')
      .eq('user_id', userId)
      .gte('calculated_at', `${start}T00:00:00Z`)
      .order('calculated_at', { ascending: true }),
    // Capital gains / trades
    supabase
      .from('capital_gains')
      .select('transaction_date, transaction_type, ticker')
      .eq('user_id', userId)
      .gte('transaction_date', start)
      .lte('transaction_date', end),
    // Dividends from transactions
    supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .gte('transaction_date', start)
      .lte('transaction_date', end)
      .gt('amount', 0)
      .or('category_name.ilike.%dividend%,category_name.ilike.%interest earned%'),
    // Live accounts for accurate net worth (avoids stale double-counted snapshots)
    supabase
      .from('linked_accounts')
      .select('account_type, account_subtype, current_balance, available_balance')
      .eq('user_id', userId)
      .eq('is_active', true),
    // Live holdings for accurate net worth
    supabase
      .from('holdings')
      .select('total_value')
      .eq('user_id', userId),
  ]);

  // ── Total Return (cost-basis, not inflated by deposits/withdrawals) ──
  const snapshots = snapshotsResult.data || [];
  const { bestDays, worstDays, upDays, downDays } = computeBestWorstDays(snapshots);
  const rawSeries = snapshots
    .map((s) => ({ date: s.snapshot_date, v: Number(s.total_value ?? 0) }))
    .filter((p) => p.v > 0);
  // Downsample to keep the sparkline payload small; always keep the last point
  // AND the best/worst-day dates — the slide places its markers by matching
  // dates into this series, so a dropped date silently loses its marker.
  const markerDates = new Set([...bestDays, ...worstDays].map((d) => d.date));
  const step = rawSeries.length > 80 ? Math.ceil(rawSeries.length / 80) : 1;
  const daySeries = rawSeries.filter(
    (p, i) => i % step === 0 || i === rawSeries.length - 1 || markerDates.has(p.date),
  );
  let totalReturnPct = 0;
  let totalReturnDollars = 0;

  // Always prefer cost-basis return — it's true investment return.
  // Snapshot-based (value change) gets inflated by deposits/withdrawals.
  if (portfolioSummary.totalValue > 0 && portfolioSummary.totalCostBasis > 0) {
    totalReturnDollars = portfolioSummary.totalUnrealizedGainLoss;
    totalReturnPct = portfolioSummary.totalUnrealizedGainLossPct;
  } else if (snapshots.length >= 2) {
    // Fallback: snapshot-based if no cost basis data
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    totalReturnDollars = (last.total_value || 0) - (first.total_value || 0);
    totalReturnPct = first.total_value > 0
      ? (totalReturnDollars / first.total_value) * 100
      : 0;
  }

  // ── Best / Worst position ──
  let bestPosition: WrappedPosition | null = null;
  let worstPosition: WrappedPosition | null = null;

  const holdingsWithGL = portfolioSummary.holdings.filter(h => h.unrealizedGainLoss != null);
  if (holdingsWithGL.length > 0) {
    const best = holdingsWithGL.reduce((a, b) =>
      (b.unrealizedGainLoss ?? 0) > (a.unrealizedGainLoss ?? 0) ? b : a,
    );
    if ((best.unrealizedGainLoss ?? 0) > 0) {
      bestPosition = {
        ticker: best.ticker,
        name: best.securityName,
        returnPct: (best.unrealizedGainLossPct ?? 0) * 100,
        returnDollars: best.unrealizedGainLoss!,
        value: best.totalValue,
      };
    }

    const worst = holdingsWithGL.reduce((a, b) =>
      (b.unrealizedGainLoss ?? 0) < (a.unrealizedGainLoss ?? 0) ? b : a,
    );
    if ((worst.unrealizedGainLoss ?? 0) < 0) {
      worstPosition = {
        ticker: worst.ticker,
        name: worst.securityName,
        returnPct: (worst.unrealizedGainLossPct ?? 0) * 100,
        returnDollars: worst.unrealizedGainLoss!,
        value: worst.totalValue,
      };
    }
  }

  // ── Top Holdings ──
  const topHoldings = portfolioSummary.holdings
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5)
    .map(h => ({
      ticker: h.ticker,
      name: h.securityName,
      value: h.totalValue,
      pct: portfolioSummary.totalValue > 0
        ? (h.totalValue / portfolioSummary.totalValue) * 100
        : 0,
    }));

  // ── Dividends ──
  const dividends = dividendsResult.data || [];
  const totalDividends = dividends.reduce((s, d) => s + (d.amount || 0), 0);

  // ── Trades ──
  const trades = tradesResult.data || [];
  const tradeCount = trades.length;
  const uniqueTickersTraded = new Set(trades.map(t => t.ticker)).size;

  // Most active trading day
  let mostActiveTradingDay: { date: string; trades: number } | null = null;
  if (trades.length > 0) {
    const dayCounts = new Map<string, number>();
    for (const t of trades) {
      dayCounts.set(t.transaction_date, (dayCounts.get(t.transaction_date) || 0) + 1);
    }
    let maxDay = '';
    let maxCount = 0;
    for (const [day, count] of dayCounts) {
      if (count > maxCount) { maxDay = day; maxCount = count; }
    }
    if (maxCount > 1) {
      mostActiveTradingDay = { date: maxDay, trades: maxCount };
    }
  }

  // ── SPY Comparison (YTD, not daily) ──
  let spyReturn: number | null = null;
  if (spyQuote && spyQuote.length >= 2) {
    const firstClose = spyQuote[0].close;
    const lastClose = spyQuote[spyQuote.length - 1].close;
    if (firstClose > 0) {
      spyReturn = ((lastClose - firstClose) / firstClose) * 100;
    }
  }

  // Period-scoped, deposit-immune user return for the SPY comparison: delta of
  // total_gain_loss across the period's snapshots over the starting value.
  // totalReturnPct is since-purchase — comparing it to SPY's period return
  // made "beat the S&P by X" wrong for any portfolio older than the period.
  let periodReturnPct: number | null = null;
  const glSnaps = snapshots.filter((s) => s.total_gain_loss != null && Number(s.total_value ?? 0) > 0);
  if (glSnaps.length >= 2) {
    const glDelta = Number(glSnaps[glSnaps.length - 1].total_gain_loss) - Number(glSnaps[0].total_gain_loss);
    const base = Number(glSnaps[0].total_value);
    if (base > 0) periodReturnPct = (glDelta / base) * 100;
  }

  const spyComparison = {
    userReturn: periodReturnPct ?? totalReturnPct,
    spyReturn,
    // Only claim beat/lost when both sides cover the same period.
    beat: spyReturn != null && periodReturnPct != null ? periodReturnPct > spyReturn : null,
  };

  // ── Tax savings ──
  const taxSavings = taxReport.totalEstimatedSavings;

  // ── Sector breakdown ──
  const sectorBreakdown = portfolioSummary.sectorExposure
    .filter(s => s.sector !== 'Unknown')
    .map(s => ({ sector: s.sector, pct: s.allocationPct, value: s.totalValue }))
    .slice(0, 6);

  // ── Health score trend ──
  const healthScores = healthResult.data || [];
  const healthStart = healthScores.length > 0 ? healthScores[0].overall_score : null;
  const healthEnd = healthScores.length > 1
    ? healthScores[healthScores.length - 1].overall_score
    : healthScores.length === 1 ? healthScores[0].overall_score : null;

  // ── Net worth change ──
  // Compute CURRENT net worth live from accounts + holdings to avoid
  // stale snapshots that may have been recorded with double-counting bugs.
  const liveAccounts = accountsResult.data || [];
  const liveHoldings = holdingsResult.data || [];
  let liveAssets = 0;
  let liveLiabilities = 0;
  for (const a of liveAccounts) {
    const type = a.account_type;
    if (isLiabilityType(type)) {
      // Signed, not abs(): a card in credit is money owed TO the user, and
      // abs() was subtracting it from their net worth instead of adding it.
      liveLiabilities += liabilityBalance(a);
    } else if (type !== 'brokerage') {
      // Skip brokerage — investment value comes from holdings.
      // Not clamped at zero either: an overdrawn account genuinely reduces net
      // worth, and Math.max(0, …) hid the overdraft.
      liveAssets += assetBalance(a);
    }
  }
  liveAssets += liveHoldings.reduce((s: number, h: { total_value: number }) => s + Number(h.total_value), 0);
  const liveNetWorth = liveAssets - liveLiabilities;

  // For start-of-period, use the earliest snapshot (best available historical data)
  const netWorthData = netWorthResult.data || [];
  const nwStart = netWorthData.length > 0 ? (netWorthData[0].net_worth || 0) : 0;
  const nwEnd = liveNetWorth;
  const nwChange = nwEnd - nwStart;
  const nwChangePct = nwStart > 0 ? (nwChange / nwStart) * 100 : 0;

  // ── Investor Personality ──
  const investorPersonality = classifyInvestor({
    positionCount: portfolioSummary.positionCount,
    tradeCount,
    totalDividends,
    portfolioValue: portfolioSummary.totalValue,
    taxSavings,
    sectorBreakdown,
    totalReturnPct,
    period,
  });

  const result: WrappedData = {
    period,
    periodLabel: label,
    periodRange: range,
    totalReturn: { pct: totalReturnPct, dollars: totalReturnDollars },
    bestPosition,
    worstPosition,
    bestDays,
    worstDays,
    upDays,
    downDays,
    daySeries,
    totalDividends,
    tradeCount,
    spyComparison,
    taxSavings,
    mostActiveTradingDay,
    sectorBreakdown,
    healthScoreTrend: {
      start: healthStart,
      end: healthEnd,
      change: (healthEnd ?? 0) - (healthStart ?? 0),
    },
    netWorthChange: { start: nwStart, end: nwEnd, change: nwChange, changePct: nwChangePct },
    positionCount: portfolioSummary.positionCount,
    portfolioValue: portfolioSummary.totalValue,
    topHoldings,
    investorPersonality,
    uniqueTickersTraded,
  };

  wrappedCache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
  return result;
}
