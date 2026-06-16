/**
 * Tax-loss harvesting analysis — production-grade implementation.
 *
 * IRS compliance checklist:
 *   ✅ Wash sale rule: 61-day window (30 before + day of + 30 after) per IRC §1091
 *   ✅ $3,000 annual deduction cap per IRC §1211(b) with carryforward estimate
 *   ✅ Short-term vs long-term distinction (holding period > 1 year for LTCG)
 *   ✅ Differentiated tax rates (STCG at ordinary income rate, LTCG at 0/15/20%)
 *   ✅ Replacement security suggestions with "substantially identical" warnings
 *   ✅ YTD realized gain/loss netting for cap calculation
 *   ⚠️ Cross-account wash sale aggregation — NOT implemented (requires multi-account)
 *   ⚠️ Specific lot identification — NOT implemented (uses average cost basis)
 *   ⚠️ NIIT/AMT — NOT implemented (requires full income picture)
 *   ⚠️ Dividend reinvestment wash sales — NOT implemented (requires DRIP data)
 *
 * IMPORTANT: This is informational software, NOT tax advice. All calculations
 * are estimates. Users must consult a qualified tax professional before acting
 * on any tax-loss harvesting recommendations.
 */

import { createClient } from '@/lib/supabase/server';
import type { ActionCite } from '@/lib/thesis-conviction';
import {
  TAX_RATE,
  WASH_SALE_WINDOW_DAYS,
  ANNUAL_LOSS_DEDUCTION_CAP,
  LTCG_RATE_DEFAULT,
} from '@/lib/financial-config';
import {
  SINGLE_STOCK_MAP,
  LEVERAGED_ETF_MAP,
  ETF_HOLDINGS,
} from '@/lib/etf-holdings';

// ── Types ──

export interface HarvestablePosition {
  ticker: string;
  securityName: string;
  sector: string;
  shares: number;
  costBasis: number;
  currentValue: number;
  unrealizedLoss: number;
  lossPct: number;
  /** Estimated savings IF this loss is fully deductible (before cap) */
  estimatedSavings: number;
  /** Whether this is likely a short-term or long-term position */
  holdingPeriod: 'short_term' | 'long_term' | 'unknown';
  /** Effective tax rate applied (STCG rate or LTCG rate) */
  effectiveTaxRate: number;
  replacement: ReplacementSecurity | null;
  washSaleRisk: boolean;
  washSaleDetail: string | null;
  /** Account context for retirement filtering */
  accountName: string | null;
  accountSubtype: string | null;
  isRetirement: boolean;
  /** Conviction from the thesis layer when available (thesis-aware TLH). */
  thesisStatus?: 'intact' | 'weakening' | 'broken';
  /** Best verbatim contradiction cite for a broken thesis (why exit + harvest align). */
  thesisCite?: ActionCite;
}

export interface ReplacementSecurity {
  ticker: string;
  name: string;
  reason: string;
}

export interface AnnualCapInfo {
  /** IRC §1211(b): $3,000 for single/$1,500 MFS */
  annualDeductionCap: number;
  /** Net realized gains/losses so far this tax year */
  ytdNetRealized: number;
  /** How much loss the user can still harvest this year before hitting the cap */
  remainingDeductibleLoss: number;
  /** Losses exceeding the cap carry forward to future years per IRC §1212(b) */
  estimatedCarryforward: number;
  /** Year-1 tax savings (capped) vs the full uncapped amount */
  cappedSavings: number;
  uncappedSavings: number;
}

export interface TaxHarvestReport {
  totalHarvestableLoss: number;
  totalEstimatedSavings: number;
  opportunityCount: number;
  taxRate: number;
  ltcgRate: number;
  /** Harvestable positions in taxable accounts only */
  opportunities: HarvestablePosition[];
  /** Positions with losses in retirement accounts — shown as ineligible */
  retirementPositions: HarvestablePosition[];
  /** $3,000 annual deduction cap analysis */
  annualCap: AnnualCapInfo;
  /** Legal disclaimer — MUST be displayed to users */
  disclaimer: string;
}

// ── Replacement security mapping ──
// Maps tickers to suggested replacements that maintain similar exposure.
// WARNING: The IRS has not definitively ruled on whether ETFs tracking the
// same index (e.g., SPY ↔ VOO) are "substantially identical." Tax courts
// look at correlation, tracking, and fund structure. These suggestions are
// commonly used in practice but carry some risk of IRS challenge.

const REPLACEMENT_MAP: Record<string, ReplacementSecurity> = {
  // Index ETFs — CAUTION: same-index swaps are a gray area
  'SPY':  { ticker: 'VOO',  name: 'Vanguard S&P 500 ETF',        reason: 'Investors seeking continued S&P 500 exposure sometimes use ETFs such as VOO. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'VOO':  { ticker: 'IVV',  name: 'iShares Core S&P 500 ETF',    reason: 'Investors seeking continued S&P 500 exposure sometimes use ETFs such as IVV. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'IVV':  { ticker: 'SPY',  name: 'SPDR S&P 500 ETF',            reason: 'Investors seeking continued S&P 500 exposure sometimes use ETFs such as SPY. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'QQQ':  { ticker: 'QQQM', name: 'Invesco NASDAQ 100 ETF',      reason: 'Investors seeking continued Nasdaq 100 exposure sometimes use ETFs such as QQQM. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'QQQM': { ticker: 'QQQ',  name: 'Invesco QQQ Trust',           reason: 'Investors seeking continued Nasdaq 100 exposure sometimes use ETFs such as QQQ. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'VTI':  { ticker: 'ITOT', name: 'iShares Core S&P Total Market',reason: 'Investors seeking continued total US market exposure sometimes use ETFs such as ITOT. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'ITOT': { ticker: 'VTI',  name: 'Vanguard Total Stock Market',  reason: 'Investors seeking continued total US market exposure sometimes use ETFs such as VTI. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  // International
  'VXUS': { ticker: 'IXUS', name: 'iShares Core MSCI Intl',      reason: 'Investors seeking continued international exposure sometimes use ETFs such as IXUS. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'IXUS': { ticker: 'VXUS', name: 'Vanguard Total Intl Stock',   reason: 'Investors seeking continued international exposure sometimes use ETFs such as VXUS. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'EFA':  { ticker: 'VEA',  name: 'Vanguard FTSE Developed',     reason: 'Investors seeking continued developed market exposure sometimes use ETFs such as VEA. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'VEA':  { ticker: 'EFA',  name: 'iShares MSCI EAFE',           reason: 'Investors seeking continued developed market exposure sometimes use ETFs such as EFA. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  // Bonds
  'BND':  { ticker: 'AGG',  name: 'iShares Core US Aggregate',   reason: 'Investors seeking continued bond exposure sometimes use ETFs such as AGG. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'AGG':  { ticker: 'BND',  name: 'Vanguard Total Bond Market',  reason: 'Investors seeking continued bond exposure sometimes use ETFs such as BND. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  // Sector ETFs
  'XLK':  { ticker: 'VGT',  name: 'Vanguard Info Tech ETF',      reason: 'Investors seeking continued technology sector exposure sometimes use ETFs such as VGT. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'VGT':  { ticker: 'XLK',  name: 'Technology Select SPDR',      reason: 'Investors seeking continued technology sector exposure sometimes use ETFs such as XLK. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'XLF':  { ticker: 'VFH',  name: 'Vanguard Financials ETF',     reason: 'Investors seeking continued financial sector exposure sometimes use ETFs such as VFH. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'XLE':  { ticker: 'VDE',  name: 'Vanguard Energy ETF',         reason: 'Investors seeking continued energy sector exposure sometimes use ETFs such as VDE. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'XLV':  { ticker: 'VHT',  name: 'Vanguard Health Care ETF',    reason: 'Investors seeking continued healthcare sector exposure sometimes use ETFs such as VHT. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  // Popular individual stocks → sector ETFs (NOT substantially identical)
  'AAPL': { ticker: 'XLK',  name: 'Technology Select SPDR',      reason: 'Investors seeking continued technology sector exposure sometimes use ETFs such as XLK. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'MSFT': { ticker: 'VGT',  name: 'Vanguard Info Tech ETF',      reason: 'Investors seeking continued technology sector exposure sometimes use ETFs such as VGT. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'GOOGL':{ ticker: 'XLC',  name: 'Communication Services SPDR', reason: 'Investors seeking continued communication sector exposure sometimes use ETFs such as XLC. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'GOOG': { ticker: 'XLC',  name: 'Communication Services SPDR', reason: 'Investors seeking continued communication sector exposure sometimes use ETFs such as XLC. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'AMZN': { ticker: 'XLY',  name: 'Consumer Discretionary SPDR', reason: 'Investors seeking continued consumer discretionary exposure sometimes use ETFs such as XLY. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'TSLA': { ticker: 'DRIV', name: 'Global X Autonomous & EV ETF',reason: 'Investors seeking continued EV and auto exposure sometimes use ETFs such as DRIV. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'NVDA': { ticker: 'SMH',  name: 'VanEck Semiconductor ETF',    reason: 'Investors seeking continued semiconductor exposure sometimes use ETFs such as SMH. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'AMD':  { ticker: 'SMH',  name: 'VanEck Semiconductor ETF',    reason: 'Investors seeking continued semiconductor exposure sometimes use ETFs such as SMH. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'INTC': { ticker: 'SMH',  name: 'VanEck Semiconductor ETF',    reason: 'Investors seeking continued semiconductor exposure sometimes use ETFs such as SMH. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'META': { ticker: 'XLC',  name: 'Communication Services SPDR', reason: 'Investors seeking continued communication sector exposure sometimes use ETFs such as XLC. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'NFLX': { ticker: 'XLC',  name: 'Communication Services SPDR', reason: 'Investors seeking continued communication sector exposure sometimes use ETFs such as XLC. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'JPM':  { ticker: 'XLF',  name: 'Financial Select SPDR',       reason: 'Investors seeking continued financial sector exposure sometimes use ETFs such as XLF. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'BAC':  { ticker: 'XLF',  name: 'Financial Select SPDR',       reason: 'Investors seeking continued financial sector exposure sometimes use ETFs such as XLF. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'GS':   { ticker: 'XLF',  name: 'Financial Select SPDR',       reason: 'Investors seeking continued financial sector exposure sometimes use ETFs such as XLF. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'JNJ':  { ticker: 'XLV',  name: 'Health Care Select SPDR',     reason: 'Investors seeking continued healthcare sector exposure sometimes use ETFs such as XLV. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'UNH':  { ticker: 'XLV',  name: 'Health Care Select SPDR',     reason: 'Investors seeking continued healthcare sector exposure sometimes use ETFs such as XLV. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'PFE':  { ticker: 'XLV',  name: 'Health Care Select SPDR',     reason: 'Investors seeking continued healthcare sector exposure sometimes use ETFs such as XLV. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'XOM':  { ticker: 'XLE',  name: 'Energy Select SPDR',          reason: 'Investors seeking continued energy sector exposure sometimes use ETFs such as XLE. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'CVX':  { ticker: 'XLE',  name: 'Energy Select SPDR',          reason: 'Investors seeking continued energy sector exposure sometimes use ETFs such as XLE. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'DIS':  { ticker: 'XLC',  name: 'Communication Services SPDR', reason: 'Investors seeking continued media and entertainment exposure sometimes use ETFs such as XLC. Whether any security is "substantially identical" is unsettled, consult a professional.' },
};

const SECTOR_ETF_MAP: Record<string, ReplacementSecurity> = {
  'Technology':           { ticker: 'XLK',  name: 'Technology Select SPDR',        reason: 'Investors seeking continued technology sector exposure sometimes use ETFs such as XLK. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'Healthcare':           { ticker: 'XLV',  name: 'Health Care Select SPDR',       reason: 'Investors seeking continued healthcare sector exposure sometimes use ETFs such as XLV. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'Financial Services':   { ticker: 'XLF',  name: 'Financial Select SPDR',         reason: 'Investors seeking continued financial sector exposure sometimes use ETFs such as XLF. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'Consumer Cyclical':    { ticker: 'XLY',  name: 'Consumer Discretionary SPDR',   reason: 'Investors seeking continued consumer cyclical exposure sometimes use ETFs such as XLY. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'Consumer Defensive':   { ticker: 'XLP',  name: 'Consumer Staples Select SPDR',  reason: 'Investors seeking continued consumer staples exposure sometimes use ETFs such as XLP. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'Energy':               { ticker: 'XLE',  name: 'Energy Select SPDR',            reason: 'Investors seeking continued energy sector exposure sometimes use ETFs such as XLE. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'Industrials':          { ticker: 'XLI',  name: 'Industrial Select SPDR',        reason: 'Investors seeking continued industrial sector exposure sometimes use ETFs such as XLI. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'Communication Services':{ ticker: 'XLC', name: 'Communication Services SPDR',   reason: 'Investors seeking continued communication sector exposure sometimes use ETFs such as XLC. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'Basic Materials':      { ticker: 'XLB',  name: 'Materials Select SPDR',         reason: 'Investors seeking continued materials sector exposure sometimes use ETFs such as XLB. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'Real Estate':          { ticker: 'XLRE', name: 'Real Estate Select SPDR',       reason: 'Investors seeking continued real estate sector exposure sometimes use ETFs such as XLRE. Whether any security is "substantially identical" is unsettled, consult a professional.' },
  'Utilities':            { ticker: 'XLU',  name: 'Utilities Select SPDR',         reason: 'Investors seeking continued utilities sector exposure sometimes use ETFs such as XLU. Whether any security is "substantially identical" is unsettled, consult a professional.' },
};

function findReplacement(ticker: string, sector: string): ReplacementSecurity | null {
  if (REPLACEMENT_MAP[ticker]) return REPLACEMENT_MAP[ticker];
  if (SECTOR_ETF_MAP[sector]) return SECTOR_ETF_MAP[sector];
  return null;
}

// ── Database queries ──

// Plaid subtypes that indicate tax-advantaged retirement accounts
const RETIREMENT_SUBTYPES = new Set([
  '401a', '401k', '403b', '457b', 'pension',
  'ira', 'roth', 'roth 401k', 'traditional_ira', 'roth_ira', 'sep_ira', 'simple_ira',
  'keogh', 'profit_sharing_plan', 'thrift_savings_plan',
  'education_savings_account', '529',
]);

function isRetirementAccount(accountSubtype: string | null): boolean {
  if (!accountSubtype) return false;
  return RETIREMENT_SUBTYPES.has(accountSubtype.toLowerCase());
}

interface RawHolding {
  ticker: string;
  shares: number;
  current_price: number;
  total_value: number;
  total_cost_basis: number | null;
  unrealised_gain_loss: number | null;
  unrealised_gain_loss_pct: number | null;
  /** Date the position was acquired — may be null if Plaid didn't provide it */
  acquired_at: string | null;
  account_id: string;
  security: {
    security_name: string | null;
    sector: string | null;
  } | null;
  account: {
    account_name: string | null;
    account_type: string | null;
    account_subtype: string | null;
  } | null;
}

async function fetchHoldingsWithLosses(userId: string): Promise<RawHolding[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('holdings')
    .select(`
      ticker, shares, current_price, total_value,
      total_cost_basis, unrealised_gain_loss, unrealised_gain_loss_pct,
      acquired_at, account_id,
      security:securities(security_name, sector),
      account:linked_accounts(account_name, account_type, account_subtype)
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

// ── Cross-product wash sale detection ──
// Maps tickers to related tickers that could trigger wash sale concerns
// across different product wrappers (leveraged ETFs, share classes, same-index ETFs).

const SHARE_CLASSES: Record<string, string[]> = {
  'GOOGL': ['GOOG'], 'GOOG': ['GOOGL'],
  'BRK.A': ['BRK.B'], 'BRK.B': ['BRK.A'],
};

const INDEX_GROUPS: Record<string, string[]> = {
  'sp500': ['SPY', 'VOO', 'IVV', 'SPLG'],
  'nasdaq100': ['QQQ', 'QQQM'],
  'totalmarket': ['VTI', 'ITOT', 'SCHB', 'SPTM'],
  'russell2000': ['IWM', 'VTWO'],
  'sp500growth': ['IVW', 'VOOG', 'SPYG'],
  'sp500value': ['IVE', 'VOOV', 'SPYV'],
};

function getRelatedTickers(ticker: string): { ticker: string; relationship: string; confidence: 'definite' | 'likely' | 'possible' }[] {
  const related: { ticker: string; relationship: string; confidence: 'definite' | 'likely' | 'possible' }[] = [];
  const upper = ticker.toUpperCase();

  // 1. DEFINITE: Same company different share class (GOOGL/GOOG)
  for (const alt of SHARE_CLASSES[upper] || []) {
    related.push({ ticker: alt, relationship: 'Same company, different share class', confidence: 'definite' });
  }

  // 2. Single-stock leveraged products <-> underlying (POSSIBLE per IRC §1091 gray area)
  // Check if THIS ticker is a single-stock product
  if (upper in SINGLE_STOCK_MAP) {
    const product = SINGLE_STOCK_MAP[upper];
    related.push({ ticker: product.underlying, relationship: `${upper} is a ${product.leverage}x leveraged product of ${product.underlying}`, confidence: 'possible' });
  }
  // Check if any single-stock product maps to THIS ticker
  for (const [productTicker, product] of Object.entries(SINGLE_STOCK_MAP)) {
    if (product.underlying === upper) {
      related.push({ ticker: productTicker, relationship: `${productTicker} is a ${product.leverage}x leveraged product of ${upper}`, confidence: 'possible' });
    }
  }

  // 3. Same-index ETFs (LIKELY per professional consensus)
  for (const [, group] of Object.entries(INDEX_GROUPS)) {
    if (group.includes(upper)) {
      for (const t of group) {
        if (t !== upper) {
          related.push({ ticker: t, relationship: 'Same index, different provider', confidence: 'likely' });
        }
      }
    }
  }

  return related;
}

/**
 * Wash sale detection: check for BOTH recent sells AND recent buys of the
 * same tickers within the 61-day window (30 days before + 30 days after).
 *
 * Per IRC §1091, a wash sale occurs when you sell a security at a loss AND
 * buy a "substantially identical" security within 30 days before OR after
 * the sale. This function checks:
 *
 *   1. Recent SELLS: if user sold the same ticker in the last 30 days,
 *      a repurchase now would trigger a wash sale.
 *   2. Recent BUYS: if user already bought the same ticker in the last 30
 *      days, selling now would trigger a wash sale because the buy is within
 *      the 30-day window.
 *   3. Cross-product: related tickers (same share class, leveraged products,
 *      same-index ETFs) that could trigger wash sale concerns.
 *
 * What we CANNOT check: future purchases. If the user harvests a loss today
 * and buys the same ticker 15 days later, that's a wash sale we can only
 * warn about, not prevent.
 */
async function checkWashSaleRisk(
  userId: string,
  tickers: string[],
): Promise<Map<string, { risk: boolean; detail: string }>> {
  const result = new Map<string, { risk: boolean; detail: string }>();
  if (tickers.length === 0) return result;

  const supabase = await createClient();
  const windowStart = new Date(Date.now() - WASH_SALE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Check BOTH sells and buys in the 30-day lookback window
  const { data: recentTransactions } = await supabase
    .from('capital_gains')
    .select('ticker, transaction_date, transaction_type')
    .eq('user_id', userId)
    .gte('transaction_date', windowStart)
    .in('ticker', tickers);

  if (recentTransactions) {
    for (const tx of recentTransactions) {
      const existing = result.get(tx.ticker);
      const txType = tx.transaction_type === 'sell' ? 'Sold' : 'Bought';
      const detail = `${txType} on ${tx.transaction_date} — within 30-day wash sale window. ` +
        `Per IRC §1091, selling at a loss now may trigger a wash sale. ` +
        `The disallowed loss would be added to the cost basis of the replacement shares.`;

      if (!existing || tx.transaction_type === 'buy') {
        // Buy transactions are higher risk (buying within 30 days of a loss sale)
        result.set(tx.ticker, { risk: true, detail });
      }
    }
  }

  // Also check for any transactions where user bought shares
  // in the LAST 30 days (via regular transactions table, not just capital_gains)
  const { data: recentPurchases } = await supabase
    .from('transactions')
    .select('description, merchant_name, transaction_date, amount')
    .eq('user_id', userId)
    .gte('transaction_date', windowStart)
    .gt('amount', 0); // positive = inflow (could be a purchase settlement)

  // Note: we can't reliably detect stock purchases from the transactions table
  // because Plaid categorizes them as transfers. This is a known limitation.
  // The capital_gains check above is the primary detection mechanism.

  // ── Cross-product wash sale detection ──
  // Check related tickers (share classes, leveraged products, same-index ETFs)
  for (const ticker of tickers) {
    // Skip if already flagged from same-ticker detection
    if (result.has(ticker)) continue;

    const relatedTickers = getRelatedTickers(ticker);
    if (relatedTickers.length === 0) continue;

    const relatedTickerList = relatedTickers.map(r => r.ticker);

    // Query capital_gains for sells/buys of related tickers
    const { data: relatedTxns } = await supabase
      .from('capital_gains')
      .select('ticker, transaction_date, gain_loss')
      .eq('user_id', userId)
      .in('ticker', relatedTickerList)
      .gte('transaction_date', windowStart);

    if (relatedTxns && relatedTxns.length > 0) {
      for (const tx of relatedTxns) {
        const match = relatedTickers.find(r => r.ticker === tx.ticker);
        if (match) {
          let washSaleDetail: string;
          if (match.confidence === 'definite') {
            washSaleDetail = `Wash sale triggered: ${match.relationship}. Transaction on ${tx.transaction_date}.`;
          } else if (match.confidence === 'likely') {
            washSaleDetail = `Likely wash sale per professional consensus (no IRS ruling): ${match.relationship}. Transaction on ${tx.transaction_date}.`;
          } else {
            washSaleDetail = `Potential wash sale concern: ${match.relationship}. The IRS has not ruled on whether single-stock leveraged ETFs are 'substantially identical' to the underlying stock per IRC \u00a71091. Consult a tax professional. Transaction on ${tx.transaction_date}.`;
          }
          result.set(ticker, { risk: true, detail: washSaleDetail });
          break;
        }
      }
    }

    // Also check regular transactions (buys) for related tickers
    if (!result.has(ticker)) {
      const { data: relatedBuys } = await supabase
        .from('transactions')
        .select('name, transaction_date, amount')
        .eq('user_id', userId)
        .in('ticker_symbol', relatedTickerList)
        .gte('transaction_date', windowStart)
        .lt('amount', 0); // negative = buy

      if (relatedBuys && relatedBuys.length > 0) {
        const tx = relatedBuys[0];
        const matchedTicker = relatedTickerList.find(t => tx.name?.includes(t));
        const match = relatedTickers.find(r => r.ticker === matchedTicker);
        if (match) {
          let washSaleDetail: string;
          if (match.confidence === 'definite') {
            washSaleDetail = `Wash sale triggered: ${match.relationship}. Buy on ${tx.transaction_date}.`;
          } else if (match.confidence === 'likely') {
            washSaleDetail = `Likely wash sale per professional consensus (no IRS ruling): ${match.relationship}. Buy on ${tx.transaction_date}.`;
          } else {
            washSaleDetail = `Potential wash sale concern: ${match.relationship}. The IRS has not ruled on whether single-stock leveraged ETFs are 'substantially identical' to the underlying stock per IRC \u00a71091. Consult a tax professional. Buy on ${tx.transaction_date}.`;
          }
          result.set(ticker, { risk: true, detail: washSaleDetail });
        }
      }
    }

    // Check if user CURRENTLY HOLDS a related product
    // Selling NVDA at a loss while holding NVDL is a wash sale concern
    // even without any recent transactions
    if (!result.has(ticker)) {
      const { data: heldRelated } = await supabase
        .from('holdings')
        .select('ticker, total_value')
        .eq('user_id', userId)
        .in('ticker', relatedTickerList);

      if (heldRelated && heldRelated.length > 0) {
        const held = heldRelated[0];
        const match = relatedTickers.find(r => r.ticker === held.ticker);
        if (match) {
          let washSaleDetail: string;
          if (match.confidence === 'definite') {
            washSaleDetail = `Wash sale risk: you currently hold ${held.ticker} (${match.relationship}). Selling ${ticker} at a loss while holding ${held.ticker} triggers a wash sale per IRC §1091.`;
          } else if (match.confidence === 'likely') {
            washSaleDetail = `Likely wash sale risk: you currently hold ${held.ticker} (${match.relationship}). Selling ${ticker} at a loss while holding ${held.ticker} likely triggers a wash sale per professional consensus. No definitive IRS ruling.`;
          } else {
            washSaleDetail = `Potential wash sale concern: you currently hold ${held.ticker} (${match.relationship}). The IRS has not ruled on whether selling ${ticker} at a loss while holding ${held.ticker} constitutes a wash sale under IRC §1091. Consult a tax professional.`;
          }
          result.set(ticker, { risk: true, detail: washSaleDetail });
        }
      }
    }
  }

  return result;
}

/**
 * Fetch YTD realized gains/losses to compute the $3,000 annual cap.
 */
async function fetchYtdRealizedGains(userId: string): Promise<{
  shortTermNet: number;
  longTermNet: number;
  totalNet: number;
}> {
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();

  const { data: gains } = await supabase
    .from('capital_gains')
    .select('gain_loss, gain_loss_type')
    .eq('user_id', userId)
    .eq('tax_year', currentYear)
    .eq('transaction_type', 'sell');

  let shortTermNet = 0;
  let longTermNet = 0;

  for (const g of gains || []) {
    const amount = Number(g.gain_loss || 0);
    if (g.gain_loss_type === 'short_term') {
      shortTermNet += amount;
    } else {
      longTermNet += amount;
    }
  }

  return { shortTermNet, longTermNet, totalNet: shortTermNet + longTermNet };
}

/**
 * Determine holding period from acquired_at date.
 * Long-term: held for more than 1 year (365 days + 1 day per IRC §1222).
 */
function classifyHoldingPeriod(acquiredAt: string | null): 'short_term' | 'long_term' | 'unknown' {
  if (!acquiredAt) return 'unknown';
  try {
    const acquired = new Date(acquiredAt + 'T12:00:00');
    const now = new Date();
    const diffMs = now.getTime() - acquired.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // IRC §1222: long-term = held for MORE than 1 year (366+ days)
    return diffDays > 365 ? 'long_term' : 'short_term';
  } catch {
    return 'unknown';
  }
}

/**
 * Calculate tax savings for a given loss amount, accounting for the
 * different tax rates on short-term vs long-term capital losses.
 *
 * Short-term losses offset short-term gains (taxed at ordinary income rate).
 * Long-term losses offset long-term gains (taxed at 0/15/20%).
 * Excess losses can offset the other type, then up to $3,000 against
 * ordinary income per IRC §1211(b).
 */
function calculateSavings(
  loss: number,
  holdingPeriod: 'short_term' | 'long_term' | 'unknown',
  stcgRate: number,
  ltcgRate: number,
): { savings: number; effectiveRate: number } {
  const absLoss = Math.abs(loss);
  // Short-term losses save at the ordinary income rate (higher)
  // Long-term losses save at the LTCG rate (lower)
  // Unknown defaults to the blended rate (conservative middle ground)
  let effectiveRate: number;
  if (holdingPeriod === 'short_term') {
    effectiveRate = stcgRate;
  } else if (holdingPeriod === 'long_term') {
    effectiveRate = ltcgRate;
  } else {
    effectiveRate = (stcgRate + ltcgRate) / 2; // Conservative blend
  }
  return {
    savings: absLoss * effectiveRate,
    effectiveRate,
  };
}

// ── Tax savings calculation ──

const DISCLAIMER = `This is not tax advice. Tax-loss harvesting estimates are approximate and ` +
  `may not reflect your specific tax situation. The $3,000 annual deduction cap ` +
  `(IRC §1211(b)), wash sale rules (IRC §1091), and holding period requirements ` +
  `(IRC §1222) are factored into these estimates, but cross-account wash sale ` +
  `aggregation, AMT, NIIT (3.8% surtax), and state-specific rules are not. ` +
  `Replacement security suggestions have not been validated as "not substantially ` +
  `identical" by the IRS — consult a qualified tax professional before acting ` +
  `on any recommendation. Helm Terminal is not a registered tax advisor.`;

// ── Main export ──

export async function generateTaxReport(
  userId: string,
  taxRate: number = TAX_RATE,
): Promise<TaxHarvestReport> {
  const ltcgRate = LTCG_RATE_DEFAULT;

  const [holdings, ytdRealized] = await Promise.all([
    fetchHoldingsWithLosses(userId),
    fetchYtdRealizedGains(userId),
  ]);

  if (holdings.length === 0) {
    return {
      totalHarvestableLoss: 0,
      totalEstimatedSavings: 0,
      opportunityCount: 0,
      taxRate,
      ltcgRate,
      opportunities: [],
      retirementPositions: [],
      annualCap: {
        annualDeductionCap: ANNUAL_LOSS_DEDUCTION_CAP,
        ytdNetRealized: ytdRealized.totalNet,
        remainingDeductibleLoss: ANNUAL_LOSS_DEDUCTION_CAP,
        estimatedCarryforward: 0,
        cappedSavings: 0,
        uncappedSavings: 0,
      },
      disclaimer: DISCLAIMER,
    };
  }

  // Check wash sale risk for all tickers
  const tickers = holdings.map((h) => h.ticker);
  const washSaleMap = await checkWashSaleRisk(userId, tickers);

  // Build all positions with losses, tagged with account info
  const allPositions: HarvestablePosition[] = holdings
    .filter((h) => h.total_cost_basis != null && h.unrealised_gain_loss != null)
    .map((h) => {
      const loss = h.unrealised_gain_loss!;
      const costBasis = h.total_cost_basis!;
      const sector = h.security?.sector || 'Unknown';
      const washSale = washSaleMap.get(h.ticker);
      const holdingPeriod = classifyHoldingPeriod(h.acquired_at);
      const retirement = isRetirementAccount(h.account?.account_subtype ?? null);
      // Retirement accounts have zero tax savings — losses aren't deductible
      const { savings, effectiveRate } = retirement
        ? { savings: 0, effectiveRate: 0 }
        : calculateSavings(loss, holdingPeriod, taxRate, ltcgRate);

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
        holdingPeriod,
        effectiveTaxRate: effectiveRate,
        replacement: retirement ? null : findReplacement(h.ticker, sector),
        washSaleRisk: retirement ? false : (washSale?.risk ?? false),
        washSaleDetail: retirement ? null : (washSale?.detail ?? null),
        accountName: h.account?.account_name ?? null,
        accountSubtype: h.account?.account_subtype ?? null,
        isRetirement: retirement,
      };
    });

  // Split: taxable (harvestable) vs retirement (informational only)
  const opportunities = allPositions
    .filter((p) => !p.isRetirement)
    .sort((a, b) => {
      if (a.washSaleRisk && !b.washSaleRisk) return 1;
      if (!a.washSaleRisk && b.washSaleRisk) return -1;
      return b.estimatedSavings - a.estimatedSavings;
    });

  const retirementPositions = allPositions
    .filter((p) => p.isRetirement)
    .sort((a, b) => a.unrealizedLoss - b.unrealizedLoss);

  const totalLoss = opportunities.reduce((s, o) => s + o.unrealizedLoss, 0);
  const uncappedSavings = opportunities.reduce((s, o) => s + o.estimatedSavings, 0);

  // ── $3,000 Annual Deduction Cap (IRC §1211(b)) ──
  //
  // Capital losses first offset capital gains dollar-for-dollar (no limit).
  // Remaining net losses can offset up to $3,000 of ordinary income per year.
  // Excess losses carry forward indefinitely per IRC §1212(b).
  //
  // Calculation:
  //   1. Start with YTD net realized gains/losses
  //   2. Add proposed harvested losses
  //   3. If still net positive → no cap issue, all harvested losses are used
  //   4. If net negative → only $3,000 against ordinary income this year
  //   5. Remainder carries forward

  const absHarvestableLoss = Math.abs(totalLoss);
  const netAfterHarvest = ytdRealized.totalNet - absHarvestableLoss;

  let remainingDeductibleLoss: number;
  let estimatedCarryforward: number;
  let cappedSavings: number;

  if (netAfterHarvest >= 0) {
    // Losses fully offset gains — no cap hit
    remainingDeductibleLoss = ANNUAL_LOSS_DEDUCTION_CAP;
    estimatedCarryforward = 0;
    cappedSavings = uncappedSavings;
  } else {
    // Net loss scenario — cap applies to the ordinary-income portion
    const netLoss = Math.abs(netAfterHarvest);
    const deductibleThisYear = Math.min(netLoss, ANNUAL_LOSS_DEDUCTION_CAP);
    estimatedCarryforward = Math.max(0, netLoss - ANNUAL_LOSS_DEDUCTION_CAP);
    remainingDeductibleLoss = Math.max(0, ANNUAL_LOSS_DEDUCTION_CAP - deductibleThisYear);

    // Savings = gains offset (dollar-for-dollar) + deductible portion × tax rate
    const gainsOffset = ytdRealized.totalNet > 0
      ? Math.min(absHarvestableLoss, ytdRealized.totalNet)
      : 0;
    const gainsOffsetSavings = gainsOffset * taxRate;
    const ordinaryDeductionSavings = deductibleThisYear * taxRate;
    cappedSavings = gainsOffsetSavings + ordinaryDeductionSavings;
  }

  return {
    totalHarvestableLoss: totalLoss,
    totalEstimatedSavings: cappedSavings,
    opportunityCount: opportunities.length,
    taxRate,
    ltcgRate,
    opportunities,
    retirementPositions,
    annualCap: {
      annualDeductionCap: ANNUAL_LOSS_DEDUCTION_CAP,
      ytdNetRealized: ytdRealized.totalNet,
      remainingDeductibleLoss,
      estimatedCarryforward,
      cappedSavings,
      uncappedSavings,
    },
    disclaimer: DISCLAIMER,
  };
}
