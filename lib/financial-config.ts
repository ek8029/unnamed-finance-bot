/**
 * Central financial configuration.
 *
 * Every financial constant, threshold, and assumption used across
 * the platform lives here. No magic numbers in business logic.
 *
 * Environment variables override defaults when set.
 */

// ── Tax ──

/** Combined federal + state SHORT-TERM capital gains / ordinary income rate for estimates. */
export const TAX_RATE = Number(process.env.TAX_RATE_BLENDED) || 0.32;

/** Default LONG-TERM capital gains rate (15% federal is the most common bracket). */
export const LTCG_RATE_DEFAULT = Number(process.env.LTCG_RATE) || 0.15;

/**
 * IRC §1211(b): Net capital losses can offset up to $3,000 of ordinary
 * income per year ($1,500 for married filing separately). Excess carries
 * forward indefinitely per IRC §1212(b).
 */
export const ANNUAL_LOSS_DEDUCTION_CAP = 3_000;

// ── Portfolio Risk ──

/** Single-position concentration thresholds (% of portfolio). */
export const CONCENTRATION_THRESHOLDS = {
  critical: 25,
  high: 20,
  medium: 10,
} as const;

/** Sector concentration alert threshold (% of portfolio). */
export const SECTOR_CONCENTRATION_THRESHOLD = 40;

// ── Spending & Cash ──

/** Spending spike: flag when category exceeds prior month by this factor. */
export const SPENDING_SPIKE_FACTOR = 1.3;

/** Spending spike: minimum dollar increase to trigger an alert. */
export const SPENDING_SPIKE_MIN_DOLLARS = 50;

/** Credit card balance threshold for high-balance alerts. */
export const CREDIT_CARD_ALERT_THRESHOLD = 5_000;

/** Assumed credit card APR for interest cost estimates. */
export const CREDIT_CARD_APR = 0.24;

/** Assumed high-yield savings APY for idle cash opportunity estimates. */
export const HYSA_APY = Number(process.env.HYSA_APY) || 0.045;

// ── Emergency Fund ──

/** Target emergency fund in months of expenses. */
export const EMERGENCY_FUND_MONTHS = 6;

// ── Performance Metrics ──

/**
 * Annualized risk-free rate for Sharpe ratio calculation.
 * Ideally fetched from Treasury yields; env var allows override.
 */
export const RISK_FREE_RATE = Number(process.env.RISK_FREE_RATE) || 0.05;

/** Trading days per year (US equity markets). */
export const TRADING_DAYS_PER_YEAR = 252;

// ── Insights ──

/** Idle cash alert: flag when cash exceeds this many months of expenses. */
export const IDLE_CASH_MONTHS = EMERGENCY_FUND_MONTHS;

/** Idle cash alert: priority escalates above this dollar amount. */
export const IDLE_CASH_HIGH_PRIORITY = 10_000;

/** Savings rate threshold for positive recognition insight. */
export const STRONG_SAVINGS_RATE = 0.3;

/** Minimum total loss to escalate tax insight to high priority. */
export const TAX_INSIGHT_HIGH_PRIORITY_LOSS = 1_000;

// ── Wash Sale ──

/** IRS wash sale window in days (not configurable — this is tax law). */
export const WASH_SALE_WINDOW_DAYS = 30;

// ── Health Score Weights ──

export const HEALTH_SCORE_WEIGHTS = {
  debt: 0.25,
  savings: 0.25,
  emergencyFund: 0.25,
  diversification: 0.25,
} as const;

/** Savings rate multiplier for health score (0.33 savings → 100 score). */
export const SAVINGS_SCORE_MULTIPLIER = 300;

// ── API & Rate Limiting ──

/** Polygon.io batch size (free tier = 5 calls/min). */
export const POLYGON_BATCH_SIZE = Number(process.env.POLYGON_BATCH_SIZE) || 5;

/** Delay in ms between Polygon batches. */
export const POLYGON_BATCH_DELAY_MS = Number(process.env.POLYGON_BATCH_DELAY_MS) || 250;

/** Delay in ms between individual Polygon calls. */
export const POLYGON_CALL_DELAY_MS = Number(process.env.POLYGON_CALL_DELAY_MS) || 300;

// ── Cache TTLs (ms) ──

export const CACHE_TTL = {
  /** Portfolio analysis (getPortfolioSummary). */
  portfolioAnalysis: 5 * 60 * 1000,       // 5 min
  /** Financial data API (Finnhub profiles). */
  financialData: 15 * 60 * 1000,           // 15 min
  /** Intelligence feed generation. */
  intelligenceFeed: 60 * 60 * 1000,        // 1 hr
  /** Portfolio Wrapped computation. */
  portfolioWrapped: 60 * 60 * 1000,        // 1 hr
  /** AI stock analysis results. */
  stockAnalysis: 24 * 60 * 60 * 1000,      // 24 hr
  /** Plaid webhook verification keys. */
  plaidWebhookKeys: 24 * 60 * 60 * 1000,   // 24 hr
} as const;
