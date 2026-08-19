/**
 * Tax-loss harvesting analysis — production-grade implementation.
 *
 * IRS compliance checklist:
 *   ✅ Wash sale screening: 30-day BACKWARD lookback per IRC §1091, across every
 *      linked account including retirement ones, reading investment_transactions
 *   ✅ $3,000 annual deduction cap per IRC §1211(b) with carryforward estimate
 *   ✅ Short-term vs long-term distinction (holding period > 1 year for LTCG)
 *   ✅ Differentiated tax rates (STCG at ordinary income rate, LTCG at 0/15/20%)
 *   ✅ Replacement security suggestions with "substantially identical" warnings
 *   ✅ YTD realized gain/loss netting for cap calculation
 *   ⚠️ The FORWARD half of the §1091 window — unknowable; a purchase made in the
 *      30 days after a sale disallows the loss and Helm cannot see it in advance
 *   ⚠️ Unlinked accounts and a spouse's purchases — §1091 is tested at the
 *      taxpayer level, so anything outside the linked set is invisible
 *   ⚠️ DRIP — detected only when the broker reports a reinvestment row
 *   ⚠️ Specific lot identification — NOT implemented (uses average cost basis),
 *      so IRC §1223(3) wash-sale holding-period tacking is not reflected
 *   ⚠️ NIIT/AMT/state — NOT implemented (requires full income picture)
 *   ⚠️ Per-user filing status — the §1211(b) cap is a deploy-wide constant, so
 *      married-filing-separately ($1,500) is not applied
 *
 * A clear result is NEVER a §1091 clearance. No surface may say 'wash-sale-safe'.
 *
 * IMPORTANT: This is informational software, NOT tax advice. All calculations
 * are estimates. Users must consult a qualified tax professional before acting
 * on any tax-loss harvesting recommendations.
 */

import { createClient } from '@/lib/supabase/server';
import {
  estimateCappedTlhSavings,
  classifyHoldingPeriod,
  daysToLongTerm,
  longTermFromDate,
  resolveTaxProfile,
  type TaxProfile,
} from '@/lib/tax-math';
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
  /** Whole days until the position crosses to long-term. 0 = already there,
   *  null = Helm has no acquisition date. A short-term LOSS is worth more
   *  against short-term gains, so crossing can cost the user money — the
   *  arithmetic is stated, never a recommendation. */
  daysToLongTerm: number | null;
  /** ISO date the position becomes long-term (IRC §1222(3) anniversary rule). */
  longTermFrom: string | null;
  /** Effective tax rate applied (STCG rate or LTCG rate) */
  effectiveTaxRate: number;
  replacement: ReplacementSecurity | null;
  /** True only when Helm observed an acquisition inside the 30-day lookback.
   *  Ownership of a related security alone never sets this: IRC §1091 requires
   *  an acquisition, not a holding. */
  washSaleRisk: boolean;
  washSaleDetail: string | null;
  /** 'flagged' = acquisition found in the window; 'advisory' = a related
   *  security is held but no acquisition was seen; 'none' = nothing surfaced. */
  washSaleSeverity: 'none' | 'advisory' | 'flagged';
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
  /** IRC §1211(b) waterfall, for the harvest ladder. Loss absorbed by realized
   *  capital gains — uncapped, and the lever that actually moves the number. */
  gainsOffset: number;
  /** Loss deducted against ordinary income this year, subject to the cap. */
  ordinaryIncomeOffset: number;
  /** Whole-position current-year benefit, including losses already realized. */
  totalPositionSavings: number;
  /** Benefit the user already has without harvesting anything more. */
  baselineSavings: number;
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
  /** IRC §1211(b) annual deduction cap analysis, resolved for this user */
  annualCap: AnnualCapInfo;
  /** Filing status from settings, or null if the user has not set one. */
  filingStatus: string | null;
  /** True when the rates above came from the user's settings, not app defaults. */
  ratesFromSettings: boolean;
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
  'education_savings_account', '529', 'hsa',
]);

// Account NAME patterns for tax-advantaged accounts. Plaid frequently leaves
// account_subtype NULL, so the name is the only signal — a brokerage literally
// named "…401(k)" or "Roth IRA" whose subtype is null was being treated as
// taxable and told to harvest a loss that is not deductible. Deliberately does
// NOT match ambiguous names like "Designated Beneficiary" (could be a taxable
// TOD account) — err toward taxable rather than hide a legitimate harvest.
const RETIREMENT_NAME_RE = /(401\s?\(?k\)?|403\s?\(?b\)?|\b457\b|\bira\b|roth|sep.?ira|simple.?ira|keogh|\btsp\b|thrift.?savings|\bpension\b|\bhsa\b|\b529\b|coverdell|profit.?sharing)/i;

export function isRetirementAccount(accountSubtype: string | null, accountName?: string | null): boolean {
  if (accountSubtype && RETIREMENT_SUBTYPES.has(accountSubtype.toLowerCase())) return true;
  if (accountName && RETIREMENT_NAME_RE.test(accountName)) return true;
  return false;
}

/** A loss is harvestable only if it is (1) in a taxable account, (2) a real
 *  priced position, and (3) actually at an unrealized loss. Unpriced positions
 *  (no market data → total_value 0) carry a phantom loss of -costBasis and must
 *  never count. Shared by the Tax Center, Actions Inbox, and insights engine so
 *  all three agree on what is harvestable. */
export function isHarvestableLoss(
  h: { unrealised_gain_loss: number | null; total_value: number | null },
  account: { account_subtype?: string | null; account_name?: string | null } | null,
): boolean {
  if (isRetirementAccount(account?.account_subtype ?? null, account?.account_name ?? null)) return false;
  if (h.unrealised_gain_loss == null || Number(h.unrealised_gain_loss) >= 0) return false;
  if (h.total_value == null || Number(h.total_value) <= 0) return false;
  return true;
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
    // THROW, do not return []. An empty array here is indistinguishable from
    // "this user holds nothing", and the caller turns that into "Helm checked
    // every lot you hold and found no losses" on a screen that asks for money.
    // A failed query is not a finding. Let it 500 so the UI can say so.
    console.error('tax-analysis: failed to fetch holdings', error);
    throw new Error(`failed to fetch holdings: ${error.message}`);
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

type WashSaleSeverity = 'flagged' | 'advisory';

interface WashSaleFinding {
  /** True only when Helm actually observed an acquisition inside the window.
   *  Never set by mere ownership of a related security — IRC §1091 requires an
   *  ACQUISITION, not a holding. */
  risk: boolean;
  severity: WashSaleSeverity;
  detail: string;
}

interface AcquisitionRow {
  ticker: string | null;
  name: string | null;
  transaction_type: string | null;
  transaction_date: string;
  account: { account_name: string | null; account_subtype: string | null } | null;
}

/**
 * Classify a Plaid investment-transaction type as an acquisition for IRC §1091.
 *
 * §1091(a) is triggered when the taxpayer "has acquired (by purchase or by an
 * exchange on which the entire amount of gain or loss was recognized by law)
 * ... substantially identical stock or securities". Buys qualify. Automatic
 * dividend reinvestments are purchases too, and are the most common inadvertent
 * trigger for buy-and-hold investors. Transfers, contributions and deposits are
 * ambiguous in Plaid's feed (either a purchase or a move of an existing lot), so
 * they are surfaced with that ambiguity stated rather than dropped.
 */
function classifyAcquisition(type: string | null): 'purchase' | 'reinvestment' | 'ambiguous' | null {
  const t = (type ?? '').toLowerCase().trim();
  if (!t) return null;
  if (t.includes('reinvest')) return 'reinvestment';
  if (t === 'buy' || t.startsWith('buy ')) return 'purchase';
  if (t === 'transfer' || t === 'contribution' || t === 'deposit') return 'ambiguous';
  return null;
}

/** Build the user-facing explanation for a detected in-window acquisition. */
function describeAcquisition(
  ticker: string,
  row: AcquisitionRow,
  relationship: string | null,
  confidence: 'definite' | 'likely' | 'possible',
): WashSaleFinding {
  const kind = classifyAcquisition(row.transaction_type);
  const acquired = row.ticker ?? ticker;
  const retirement = isRetirementAccount(
    row.account?.account_subtype ?? null,
    row.account?.account_name ?? null,
  );

  const how =
    kind === 'reinvestment'
      ? `an automatic reinvestment into ${acquired} settled on ${row.transaction_date}`
      : kind === 'ambiguous'
        ? `a ${row.transaction_type} of ${acquired} on ${row.transaction_date} — your brokerage feed does not say whether that was a purchase or a move of shares you already held`
        : `${acquired} was purchased on ${row.transaction_date}`;

  const scope = !relationship
    ? ''
    : confidence === 'definite'
      ? ` ${relationship}, so §1091 treats it as substantially identical.`
      : confidence === 'likely'
        ? ` ${relationship}. Professional consensus treats these as substantially identical; the IRS has not ruled.`
        : ` ${relationship}. The IRS has not ruled on whether these are substantially identical under IRC §1091 — confirm with a tax professional.`;

  const basis = retirement
    ? ` That purchase sits in ${row.account?.account_name ?? 'a retirement account'}. Under Rev. Rul. 2008-5 a purchase by your IRA or Roth IRA disallows the loss permanently: §1091(d) does not restore it and your IRA basis is not increased, so the deduction is gone rather than deferred.`
    : ` A disallowed loss is added to the basis of the replacement shares under IRC §1091(d) and the prior holding period tacks on under IRC §1223(3), so the deduction is deferred rather than lost.`;

  return {
    risk: true,
    severity: 'flagged',
    detail:
      `Wash-sale conflict found in Helm's 30-day lookback: ${how}.${scope}` +
      ` IRC §1091 disallows the loss when substantially identical stock is acquired in the 30 days before the sale, on the day of the sale, or in the 30 days after it — 61 days in total.${basis}`,
  };
}

/**
 * Detect acquisitions inside the wash-sale window for each candidate ticker.
 *
 * Reads `investment_transactions`, the table Plaid sync actually writes. The
 * previous implementation queried `capital_gains`, which only demo seed scripts
 * write, so same-ticker purchases (dollar-cost averaging, RSU vests, rebalances)
 * were structurally undetectable and every position was reported as clear.
 *
 * Hard limits, disclosed to the user rather than papered over: this is a
 * BACKWARD 30-day lookback only, it sees linked accounts only, and it cannot see
 * a spouse's purchases. A negative result is not a §1091 clearance.
 */
async function checkWashSaleRisk(
  userId: string,
  tickers: string[],
): Promise<Map<string, WashSaleFinding>> {
  const result = new Map<string, WashSaleFinding>();
  if (tickers.length === 0) return result;

  const supabase = await createClient();
  const windowStart = new Date(Date.now() - WASH_SALE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Every candidate plus the securities we treat as related, resolved once so
  // the whole window is fetched in a single query instead of one per ticker.
  const relatedByTicker = new Map<string, ReturnType<typeof getRelatedTickers>>();
  const searchTickers = new Set<string>();
  const candidateSet = new Set(tickers.map((t) => t.toUpperCase()));
  for (const ticker of tickers) {
    searchTickers.add(ticker.toUpperCase());
    const related = getRelatedTickers(ticker);
    relatedByTicker.set(ticker, related);
    for (const r of related) searchTickers.add(r.ticker.toUpperCase());
  }

  const { data: rows } = await supabase
    .from('investment_transactions')
    .select(`
      ticker, name, transaction_type, transaction_date,
      account:linked_accounts(account_name, account_subtype)
    `)
    .eq('user_id', userId)
    .gte('transaction_date', windowStart)
    .in('ticker', [...searchTickers])
    .order('transaction_date', { ascending: false });

  // Group acquisitions by ticker. Retirement-account purchases are deliberately
  // NOT filtered out: an IRA buy is the case Rev. Rul. 2008-5 makes the most
  // damaging, and this is the one place the engine can catch it.
  const acquisitionsByTicker = new Map<string, AcquisitionRow[]>();
  for (const row of (rows ?? []) as unknown as AcquisitionRow[]) {
    if (!row.ticker || !classifyAcquisition(row.transaction_type)) continue;
    const key = row.ticker.toUpperCase();
    const list = acquisitionsByTicker.get(key);
    if (list) list.push(row);
    else acquisitionsByTicker.set(key, [row]);
  }

  // Related securities the user currently holds, for the advisory branch below.
  const heldRelated = new Set<string>();
  if (searchTickers.size > candidateSet.size) {
    const { data: held } = await supabase
      .from('holdings')
      .select('ticker')
      .eq('user_id', userId)
      .in('ticker', [...searchTickers]);
    for (const h of held ?? []) {
      if (h.ticker) heldRelated.add(String(h.ticker).toUpperCase());
    }
  }

  for (const ticker of tickers) {
    // 1. The same security acquired inside the window — the clearest trigger.
    const own = acquisitionsByTicker.get(ticker.toUpperCase());
    if (own && own.length > 0) {
      result.set(ticker, describeAcquisition(ticker, own[0], null, 'definite'));
      continue;
    }

    // 2. A related security acquired inside the window.
    const related = relatedByTicker.get(ticker) ?? [];
    let flagged = false;
    for (const match of related) {
      const matchRows = acquisitionsByTicker.get(match.ticker.toUpperCase());
      if (!matchRows || matchRows.length === 0) continue;
      result.set(ticker, describeAcquisition(ticker, matchRows[0], match.relationship, match.confidence));
      flagged = true;
      break;
    }
    if (flagged) continue;

    // 3. Advisory only. The user holds a related security but Helm saw no
    //    acquisition inside the window. Ownership is not a wash sale — §1091
    //    requires an acquisition — so this must not set risk, must not badge the
    //    row, and must not drop the lot from the savings pool.
    const heldMatch = related.find((r) => heldRelated.has(r.ticker.toUpperCase()));
    if (heldMatch) {
      result.set(ticker, {
        risk: false,
        severity: 'advisory',
        detail:
          `You also hold ${heldMatch.ticker} (${heldMatch.relationship}). Holding it is not itself a wash sale:` +
          ` IRC §1091 is triggered only by acquiring substantially identical stock in the 30 days before or the 30 days after a sale.` +
          ` Helm found no such acquisition in your linked accounts in the last 30 days. A purchase of ${heldMatch.ticker} inside that window, including one Helm cannot see, would disallow the loss.`,
      });
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
  // Unknown holding period is valued at the LONG-TERM rate, matching how
  // estimateCappedTlhSavings pools unknownLoss. The old (stcg + ltcg) / 2
  // midpoint was 23.5%, a rate that does not exist in IRC §1(h), and it made
  // the per-row figures fail to sum to the headline the same page showed.
  let effectiveRate: number;
  if (holdingPeriod === 'short_term') {
    effectiveRate = stcgRate;
  } else {
    effectiveRate = ltcgRate;
  }
  return {
    savings: absLoss * effectiveRate,
    effectiveRate,
  };
}

// ── Tax savings calculation ──

/**
 * The disclosure that MUST reach the screen. Built from the rates and cap that
 * were actually applied, so it can never describe a different calculation than
 * the one the user is looking at.
 */
function buildDisclaimer(
  ordinaryRate: number,
  ltcgRate: number,
  annualCap: number,
  profile: TaxProfile | null,
): string {
  const rateBasis = profile?.fromSettings
    ? `Figures use the ${(ordinaryRate * 100).toFixed(0)}% ordinary bracket you set in settings and a `
      + `${(ltcgRate * 100).toFixed(0)}% long-term rate derived from it. IRC §1(h) ties the 0/15/20 long-term `
      + `bands to taxable income, which Helm does not know, so the long-term rate is an approximation.`
    : `Figures assume a default ${(ordinaryRate * 100).toFixed(0)}% ordinary and short-term rate and a default `
      + `${(ltcgRate * 100).toFixed(0)}% long-term rate — not your actual brackets, which depend on your taxable `
      + `income and filing status (IRC §1(h)). Set them in Settings to use your own.`;

  const capBasis = profile?.filingStatus
    ? `The $${annualCap.toLocaleString('en-US')} annual ordinary-income deduction cap (IRC §1211(b)) reflects the `
      + `"${profile.filingStatus}" filing status you set in settings.`
    : `The $${annualCap.toLocaleString('en-US')} annual ordinary-income deduction cap (IRC §1211(b)) assumes you are not `
      + `married filing separately, whose statutory limit is $1,500. Set your filing status in Settings.`;

  return `Estimates only, not tax advice. Helm Terminal is not a registered tax `
    + `advisor, CPA, or tax return preparer. ${rateBasis} ${capBasis} Excluded: the 3.8% `
    + `net investment income tax (IRC §1411, which applies above $200,000 single / `
    + `$250,000 joint MAGI), AMT, state and local tax, and prior-year loss carryovers. `
    + `Wash-sale screening (IRC §1091) is a 30-day BACKWARD lookback across the `
    + `accounts you have linked. It does not see purchases you make in the 30 days `
    + `AFTER a sale, automatic dividend reinvestments, purchases in accounts you have `
    + `not linked, or purchases by your spouse — any of which can disallow a loss `
    + `shown here as harvestable. A purchase inside your IRA or Roth IRA is worse than `
    + `an ordinary wash sale: under Rev. Rul. 2008-5 the loss is disallowed with no `
    + `basis restoration. Specific-lot identification is not implemented, so holding `
    + `periods come from your broker's acquisition date and do not reflect wash-sale `
    + `tacking under IRC §1223(3). Replacement security suggestions have not been `
    + `validated as "not substantially identical" by the IRS. Cost basis comes from `
    + `your brokerage feed and may differ from your Form 1099-B. Consult a qualified `
    + `tax professional before acting.`;
}

/** Default-rate disclosure, for the paths that never resolve a user profile. */
const DISCLAIMER = buildDisclaimer(TAX_RATE, LTCG_RATE_DEFAULT, ANNUAL_LOSS_DEDUCTION_CAP, null);

// ── The single TLH savings formula (IRC §1211(b)) ──
//
// Pure and exported: every surface that quotes a TLH dollar (tax center, daily
// brief, insights engine, thesis harvest actions) MUST route through this.
// Before extraction, three surfaces shipped three different formulas and showed
// the same user three different "savings" numbers.

export {
  estimateCappedTlhSavings,
  estimateTaxOnRealizedGains,
  classifyHoldingPeriod,
  splitLossByCharacter,
  daysToLongTerm,
  longTermFromDate,
} from '@/lib/tax-math';
export type { CappedTlhResult } from '@/lib/tax-math';

// ── Main export ──

/**
 * Rates and the §1211(b) cap the user actually told us about.
 *
 * Settings collects filing status and tax bracket under a header promising they
 * are used "for accurate tax-loss harvesting analysis", and nothing read them:
 * a married-filing-separately user saw a $3,000 cap when the statute gives them
 * $1,500, and a 24%-bracket user saw every figure priced at 32%.
 */
async function fetchTaxProfile(userId: string): Promise<TaxProfile> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('user_preferences')
      .select('filing_status, tax_bracket')
      .eq('user_id', userId)
      .maybeSingle();
    return resolveTaxProfile(data ?? null);
  } catch {
    return resolveTaxProfile(null);
  }
}

export async function generateTaxReport(
  userId: string,
  taxRateOverride?: number,
): Promise<TaxHarvestReport> {
  const [holdings, ytdRealized, profile] = await Promise.all([
    fetchHoldingsWithLosses(userId),
    fetchYtdRealizedGains(userId),
    fetchTaxProfile(userId),
  ]);

  const taxRate = taxRateOverride ?? profile.ordinaryRate;
  const ltcgRate = profile.ltcgRate;
  const annualCap = profile.annualLossCap;

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
        annualDeductionCap: annualCap,
        ytdNetRealized: ytdRealized.totalNet,
        remainingDeductibleLoss: annualCap,
        estimatedCarryforward: 0,
        cappedSavings: 0,
        uncappedSavings: 0,
        gainsOffset: 0,
        ordinaryIncomeOffset: 0,
        totalPositionSavings: 0,
        baselineSavings: 0,
      },
      filingStatus: profile.filingStatus,
      ratesFromSettings: profile.fromSettings,
      disclaimer: DISCLAIMER,
    };
  }

  // Check wash sale risk for all tickers
  const tickers = holdings.map((h) => h.ticker);
  const washSaleMap = await checkWashSaleRisk(userId, tickers);

  // Build all positions with losses, tagged with account info
  const allPositions: HarvestablePosition[] = holdings
    .filter((h) => h.total_cost_basis != null && h.unrealised_gain_loss != null && Number(h.total_value) > 0)
    .map((h) => {
      const loss = h.unrealised_gain_loss!;
      const costBasis = h.total_cost_basis!;
      const sector = h.security?.sector || 'Unknown';
      const washSale = washSaleMap.get(h.ticker);
      const holdingPeriod = classifyHoldingPeriod(h.acquired_at);
      const retirement = isRetirementAccount(h.account?.account_subtype ?? null, h.account?.account_name ?? null);
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
        daysToLongTerm: daysToLongTerm(h.acquired_at),
        longTermFrom: longTermFromDate(h.acquired_at),
        effectiveTaxRate: effectiveRate,
        replacement: retirement ? null : findReplacement(h.ticker, sector),
        washSaleRisk: retirement ? false : (washSale?.risk ?? false),
        washSaleDetail: retirement ? null : (washSale?.detail ?? null),
        washSaleSeverity: retirement ? 'none' : (washSale?.severity ?? 'none'),
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

  // Character-split loss pools for the netted estimator. Wash-flagged lots are
  // excluded: §1091 defers the loss into replacement basis, so counting it
  // would overstate current-year savings.
  let stLossPool = 0;
  let ltLossPool = 0;
  let unknownLossPool = 0;
  for (const o of opportunities) {
    if (o.washSaleRisk) continue;
    const l = Math.abs(o.unrealizedLoss);
    if (o.holdingPeriod === 'short_term') stLossPool += l;
    else if (o.holdingPeriod === 'long_term') ltLossPool += l;
    else unknownLossPool += l;
  }
  const capped = estimateCappedTlhSavings({
    stLoss: stLossPool,
    ltLoss: ltLossPool,
    unknownLoss: unknownLossPool,
    stGainYtd: ytdRealized.shortTermNet,
    ltGainYtd: ytdRealized.longTermNet,
    ordinaryRate: taxRate,
    ltcgRate,
    annualCap,
  });
  const remainingDeductibleLoss = capped.remainingDeductibleLoss;
  const estimatedCarryforward = capped.estimatedCarryforward;
  const cappedSavings = capped.cappedSavings;

  return {
    totalHarvestableLoss: totalLoss,
    totalEstimatedSavings: cappedSavings,
    opportunityCount: opportunities.length,
    taxRate,
    ltcgRate,
    opportunities,
    retirementPositions,
    annualCap: {
      annualDeductionCap: annualCap,
      ytdNetRealized: ytdRealized.totalNet,
      remainingDeductibleLoss,
      estimatedCarryforward,
      cappedSavings,
      uncappedSavings,
      gainsOffset: capped.gainsOffset,
      ordinaryIncomeOffset: capped.ordinaryIncomeOffset,
      totalPositionSavings: capped.totalPositionSavings,
      baselineSavings: capped.baselineSavings,
    },
    filingStatus: profile.filingStatus,
    ratesFromSettings: profile.fromSettings,
    disclaimer: buildDisclaimer(taxRate, ltcgRate, annualCap, profile),
  };
}
