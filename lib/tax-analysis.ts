/**
 * Tax-loss harvesting analysis.
 * Scans holdings for unrealized losses, estimates tax savings,
 * suggests replacement securities, and checks for wash sale risk.
 */

import { createClient } from '@/lib/supabase/server';
import { TAX_RATE, WASH_SALE_WINDOW_DAYS } from '@/lib/financial-config';

// ── Types ──

export interface HarvestablePosition {
  ticker: string;
  securityName: string;
  sector: string;
  shares: number;
  costBasis: number;        // total cost basis
  currentValue: number;     // total current value
  unrealizedLoss: number;   // negative number (the loss)
  lossPct: number;          // loss as percentage of cost basis
  estimatedSavings: number; // at user's tax rate
  replacement: ReplacementSecurity | null;
  washSaleRisk: boolean;
  washSaleDetail: string | null;
}

export interface ReplacementSecurity {
  ticker: string;
  name: string;
  reason: string;
}

export interface TaxHarvestReport {
  totalHarvestableLoss: number;
  totalEstimatedSavings: number;
  opportunityCount: number;
  taxRate: number;
  opportunities: HarvestablePosition[];
}

// ── Replacement security mapping ──
// Maps tickers to suggested replacements that maintain similar exposure
// without triggering wash sale (not "substantially identical")

const REPLACEMENT_MAP: Record<string, ReplacementSecurity> = {
  // Index ETFs (swap between providers)
  'SPY':  { ticker: 'VOO',  name: 'Vanguard S&P 500 ETF',        reason: 'Same S&P 500 exposure, different fund' },
  'VOO':  { ticker: 'IVV',  name: 'iShares Core S&P 500 ETF',    reason: 'Same S&P 500 exposure, different fund' },
  'IVV':  { ticker: 'SPY',  name: 'SPDR S&P 500 ETF',            reason: 'Same S&P 500 exposure, different fund' },
  'QQQ':  { ticker: 'QQQM', name: 'Invesco NASDAQ 100 ETF',      reason: 'Same Nasdaq 100 exposure, lower cost' },
  'QQQM': { ticker: 'QQQ',  name: 'Invesco QQQ Trust',           reason: 'Same Nasdaq 100 exposure' },
  'VTI':  { ticker: 'ITOT', name: 'iShares Core S&P Total Market',reason: 'Total US market exposure, different fund' },
  'ITOT': { ticker: 'VTI',  name: 'Vanguard Total Stock Market',  reason: 'Total US market exposure, different fund' },
  // International
  'VXUS': { ticker: 'IXUS', name: 'iShares Core MSCI Intl',      reason: 'International exposure, different fund' },
  'IXUS': { ticker: 'VXUS', name: 'Vanguard Total Intl Stock',   reason: 'International exposure, different fund' },
  'EFA':  { ticker: 'VEA',  name: 'Vanguard FTSE Developed',     reason: 'Developed market exposure, different fund' },
  'VEA':  { ticker: 'EFA',  name: 'iShares MSCI EAFE',           reason: 'Developed market exposure, different fund' },
  // Bonds
  'BND':  { ticker: 'AGG',  name: 'iShares Core US Aggregate',   reason: 'Similar bond exposure, different fund' },
  'AGG':  { ticker: 'BND',  name: 'Vanguard Total Bond Market',  reason: 'Similar bond exposure, different fund' },
  // Sector ETFs
  'XLK':  { ticker: 'VGT',  name: 'Vanguard Info Tech ETF',      reason: 'Technology sector, different fund' },
  'VGT':  { ticker: 'XLK',  name: 'Technology Select SPDR',      reason: 'Technology sector, different fund' },
  'XLF':  { ticker: 'VFH',  name: 'Vanguard Financials ETF',     reason: 'Financial sector, different fund' },
  'XLE':  { ticker: 'VDE',  name: 'Vanguard Energy ETF',         reason: 'Energy sector, different fund' },
  'XLV':  { ticker: 'VHT',  name: 'Vanguard Health Care ETF',    reason: 'Healthcare sector, different fund' },
  // Popular individual stocks → sector ETFs
  'AAPL': { ticker: 'XLK',  name: 'Technology Select SPDR',      reason: 'Maintains tech exposure via sector ETF' },
  'MSFT': { ticker: 'VGT',  name: 'Vanguard Info Tech ETF',      reason: 'Maintains tech exposure via sector ETF' },
  'GOOGL':{ ticker: 'XLC',  name: 'Communication Services SPDR', reason: 'Maintains communication sector exposure' },
  'GOOG': { ticker: 'XLC',  name: 'Communication Services SPDR', reason: 'Maintains communication sector exposure' },
  'AMZN': { ticker: 'XLY',  name: 'Consumer Discretionary SPDR', reason: 'Maintains consumer discretionary exposure' },
  'TSLA': { ticker: 'DRIV', name: 'Global X Autonomous & EV ETF',reason: 'Maintains EV/auto exposure via thematic ETF' },
  'NVDA': { ticker: 'SMH',  name: 'VanEck Semiconductor ETF',    reason: 'Maintains semiconductor exposure' },
  'AMD':  { ticker: 'SMH',  name: 'VanEck Semiconductor ETF',    reason: 'Maintains semiconductor exposure' },
  'INTC': { ticker: 'SMH',  name: 'VanEck Semiconductor ETF',    reason: 'Maintains semiconductor exposure' },
  'META': { ticker: 'XLC',  name: 'Communication Services SPDR', reason: 'Maintains social/comm exposure' },
  'NFLX': { ticker: 'XLC',  name: 'Communication Services SPDR', reason: 'Maintains communication sector exposure' },
  'JPM':  { ticker: 'XLF',  name: 'Financial Select SPDR',       reason: 'Maintains financial sector exposure' },
  'BAC':  { ticker: 'XLF',  name: 'Financial Select SPDR',       reason: 'Maintains financial sector exposure' },
  'GS':   { ticker: 'XLF',  name: 'Financial Select SPDR',       reason: 'Maintains financial sector exposure' },
  'JNJ':  { ticker: 'XLV',  name: 'Health Care Select SPDR',     reason: 'Maintains healthcare exposure' },
  'UNH':  { ticker: 'XLV',  name: 'Health Care Select SPDR',     reason: 'Maintains healthcare exposure' },
  'PFE':  { ticker: 'XLV',  name: 'Health Care Select SPDR',     reason: 'Maintains healthcare exposure' },
  'XOM':  { ticker: 'XLE',  name: 'Energy Select SPDR',          reason: 'Maintains energy sector exposure' },
  'CVX':  { ticker: 'XLE',  name: 'Energy Select SPDR',          reason: 'Maintains energy sector exposure' },
  'DIS':  { ticker: 'XLC',  name: 'Communication Services SPDR', reason: 'Maintains media/entertainment exposure' },
};

// Sector → fallback ETF (when no specific mapping exists)
const SECTOR_ETF_MAP: Record<string, ReplacementSecurity> = {
  'Technology':           { ticker: 'XLK',  name: 'Technology Select SPDR',        reason: 'Sector ETF maintains tech exposure' },
  'Healthcare':           { ticker: 'XLV',  name: 'Health Care Select SPDR',       reason: 'Sector ETF maintains healthcare exposure' },
  'Financial Services':   { ticker: 'XLF',  name: 'Financial Select SPDR',         reason: 'Sector ETF maintains financial exposure' },
  'Consumer Cyclical':    { ticker: 'XLY',  name: 'Consumer Discretionary SPDR',   reason: 'Sector ETF maintains consumer exposure' },
  'Consumer Defensive':   { ticker: 'XLP',  name: 'Consumer Staples Select SPDR',  reason: 'Sector ETF maintains consumer staples exposure' },
  'Energy':               { ticker: 'XLE',  name: 'Energy Select SPDR',            reason: 'Sector ETF maintains energy exposure' },
  'Industrials':          { ticker: 'XLI',  name: 'Industrial Select SPDR',        reason: 'Sector ETF maintains industrial exposure' },
  'Communication Services':{ ticker: 'XLC', name: 'Communication Services SPDR',   reason: 'Sector ETF maintains comm exposure' },
  'Basic Materials':      { ticker: 'XLB',  name: 'Materials Select SPDR',         reason: 'Sector ETF maintains materials exposure' },
  'Real Estate':          { ticker: 'XLRE', name: 'Real Estate Select SPDR',       reason: 'Sector ETF maintains real estate exposure' },
  'Utilities':            { ticker: 'XLU',  name: 'Utilities Select SPDR',         reason: 'Sector ETF maintains utilities exposure' },
};

function findReplacement(ticker: string, sector: string): ReplacementSecurity | null {
  // Direct mapping first
  if (REPLACEMENT_MAP[ticker]) return REPLACEMENT_MAP[ticker];
  // Sector fallback
  if (SECTOR_ETF_MAP[sector]) return SECTOR_ETF_MAP[sector];
  return null;
}

// ── Database queries ──

interface RawHolding {
  ticker: string;
  shares: number;
  current_price: number;
  total_value: number;
  total_cost_basis: number | null;
  unrealised_gain_loss: number | null;
  unrealised_gain_loss_pct: number | null;
  security: {
    security_name: string | null;
    sector: string | null;
  } | null;
}

async function fetchHoldingsWithLosses(userId: string): Promise<RawHolding[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('holdings')
    .select(`
      ticker, shares, current_price, total_value,
      total_cost_basis, unrealised_gain_loss, unrealised_gain_loss_pct,
      security:securities(security_name, sector)
    `)
    .eq('user_id', userId)
    .lt('unrealised_gain_loss', 0)
    .order('unrealised_gain_loss', { ascending: true });

  if (error) {
    console.error('tax-analysis: failed to fetch holdings', error);
    return [];
  }
  return (data || []) as unknown as RawHolding[];
}

// Wash sale detection: check if user sold the same ticker in last 30 days
async function checkWashSaleRisk(
  userId: string,
  tickers: string[],
): Promise<Map<string, string>> {
  if (tickers.length === 0) return new Map();

  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - WASH_SALE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Check capital_gains table for recent sells
  const { data: recentSells } = await supabase
    .from('capital_gains')
    .select('ticker, transaction_date')
    .eq('user_id', userId)
    .eq('transaction_type', 'sell')
    .gte('transaction_date', thirtyDaysAgo)
    .in('ticker', tickers);

  const result = new Map<string, string>();
  if (recentSells) {
    for (const sell of recentSells) {
      result.set(
        sell.ticker,
        `Sold on ${sell.transaction_date} — within 30-day wash sale window`,
      );
    }
  }

  return result;
}

// ── Tax savings calculation ──

function calculateSavings(loss: number, taxRate: number): number {
  return Math.abs(loss) * taxRate;
}

// ── Main export ──

export async function generateTaxReport(
  userId: string,
  taxRate: number = TAX_RATE,
): Promise<TaxHarvestReport> {
  const holdings = await fetchHoldingsWithLosses(userId);

  if (holdings.length === 0) {
    return {
      totalHarvestableLoss: 0,
      totalEstimatedSavings: 0,
      opportunityCount: 0,
      taxRate,
      opportunities: [],
    };
  }

  // Check wash sale risk for all tickers
  const tickers = holdings.map((h) => h.ticker);
  const washSaleMap = await checkWashSaleRisk(userId, tickers);

  // Build opportunities
  const opportunities: HarvestablePosition[] = holdings
    .filter((h) => h.total_cost_basis != null && h.unrealised_gain_loss != null)
    .map((h) => {
      const loss = h.unrealised_gain_loss!;
      const costBasis = h.total_cost_basis!;
      const savings = calculateSavings(loss, taxRate);
      const sector = h.security?.sector || 'Unknown';
      const washSaleDetail = washSaleMap.get(h.ticker) || null;

      return {
        ticker: h.ticker,
        securityName: h.security?.security_name || h.ticker,
        sector,
        shares: h.shares,
        costBasis,
        currentValue: h.total_value,
        unrealizedLoss: loss,
        lossPct: costBasis > 0 ? (loss / costBasis) * 100 : 0,
        estimatedSavings: savings,
        replacement: findReplacement(h.ticker, sector),
        washSaleRisk: !!washSaleDetail,
        washSaleDetail,
      };
    })
    // Sort by largest savings first
    .sort((a, b) => b.estimatedSavings - a.estimatedSavings);

  const totalLoss = opportunities.reduce((s, o) => s + o.unrealizedLoss, 0);
  const totalSavings = opportunities.reduce((s, o) => s + o.estimatedSavings, 0);

  return {
    totalHarvestableLoss: totalLoss,
    totalEstimatedSavings: totalSavings,
    opportunityCount: opportunities.length,
    taxRate,
    opportunities,
  };
}
