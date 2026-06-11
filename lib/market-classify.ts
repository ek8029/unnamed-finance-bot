/**
 * Market classification helpers — sentiment scoring and sector mapping.
 * Pure functions, no external API dependencies.
 */

// ----- Sentiment Analysis -----

const POSITIVE_WORDS = new Set([
  'beat', 'beats', 'exceeded', 'surpassed', 'upgrade', 'upgraded', 'upgrades',
  'raised', 'raises', 'raise', 'growth', 'growing', 'gains', 'gained', 'rally',
  'rallied', 'rallies', 'surge', 'surged', 'surges', 'soar', 'soared', 'soars',
  'record', 'high', 'highs', 'profit', 'profits', 'profitable', 'bullish',
  'outperform', 'outperforms', 'buy', 'strong', 'stronger', 'strength',
  'positive', 'optimistic', 'recovery', 'recovered', 'boost', 'boosted',
  'dividend', 'buyback', 'accelerate', 'accelerated', 'innovation', 'breakthrough',
]);

const NEGATIVE_WORDS = new Set([
  'miss', 'missed', 'misses', 'below', 'downgrade', 'downgraded', 'downgrades',
  'cut', 'cuts', 'decline', 'declined', 'declines', 'drop', 'dropped', 'drops',
  'fall', 'fell', 'falls', 'crash', 'crashed', 'crashes', 'plunge', 'plunged',
  'loss', 'losses', 'lost', 'losing', 'bearish', 'underperform', 'sell',
  'weak', 'weaker', 'weakness', 'negative', 'pessimistic', 'recession',
  'layoff', 'layoffs', 'lawsuit', 'investigation', 'fraud', 'warning',
  'bankruptcy', 'default', 'debt', 'risk', 'volatile', 'uncertainty',
  'inflation', 'tariff', 'tariffs', 'sanctions', 'shutdown',
]);

/**
 * Score sentiment of a text string.
 * Returns 'positive', 'negative', or 'neutral'.
 */
export function scoreSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  if (!text) return 'neutral';

  const words = text.toLowerCase().split(/\W+/);
  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positiveCount++;
    if (NEGATIVE_WORDS.has(word)) negativeCount++;
  }

  const total = positiveCount + negativeCount;
  if (total === 0) return 'neutral';

  const score = (positiveCount - negativeCount) / total;
  if (score > 0.2) return 'positive';
  if (score < -0.2) return 'negative';
  return 'neutral';
}

// ----- Sector Mapping -----

const TICKER_SECTOR_OVERRIDE: Record<string, string> = {
  AAPL: 'Technology', MSFT: 'Technology', GOOGL: 'Technology', GOOG: 'Technology',
  AMZN: 'Consumer Cyclical', META: 'Technology', NVDA: 'Technology', TSLA: 'Consumer Cyclical',
  AMD: 'Technology', INTC: 'Technology', AVGO: 'Technology', CRM: 'Technology',
  ADBE: 'Technology', CSCO: 'Technology', ORCL: 'Technology', QCOM: 'Technology',
  TXN: 'Technology', AMAT: 'Technology', NFLX: 'Communication Services', DIS: 'Communication Services',
  CMCSA: 'Communication Services', VZ: 'Communication Services', T: 'Communication Services',
  JPM: 'Financial Services', BAC: 'Financial Services', GS: 'Financial Services',
  MS: 'Financial Services', WFC: 'Financial Services', C: 'Financial Services',
  BLK: 'Financial Services', SCHW: 'Financial Services', V: 'Financial Services',
  MA: 'Financial Services', AXP: 'Financial Services', COF: 'Financial Services',
  JNJ: 'Healthcare', UNH: 'Healthcare', PFE: 'Healthcare', ABBV: 'Healthcare',
  MRK: 'Healthcare', LLY: 'Healthcare', TMO: 'Healthcare', ABT: 'Healthcare',
  AMGN: 'Healthcare', GILD: 'Healthcare', ISRG: 'Healthcare', MDT: 'Healthcare',
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy', EOG: 'Energy',
  PG: 'Consumer Defensive', KO: 'Consumer Defensive', PEP: 'Consumer Defensive',
  WMT: 'Consumer Defensive', COST: 'Consumer Defensive', MCD: 'Consumer Cyclical',
  NKE: 'Consumer Cyclical', SBUX: 'Consumer Cyclical', HD: 'Consumer Cyclical',
  LOW: 'Consumer Cyclical', TGT: 'Consumer Cyclical', TJX: 'Consumer Cyclical',
  CAT: 'Industrials', DE: 'Industrials', HON: 'Industrials', UNP: 'Industrials',
  BA: 'Industrials', GE: 'Industrials', RTX: 'Industrials', LMT: 'Industrials',
  NEE: 'Utilities', DUK: 'Utilities', SO: 'Utilities', D: 'Utilities',
  AMT: 'Real Estate', PLD: 'Real Estate', CCI: 'Real Estate', O: 'Real Estate',
  SPY: 'Diversified', VOO: 'Diversified', VTI: 'Diversified', QQQ: 'Technology',
  IWM: 'Diversified', DIA: 'Diversified', VGT: 'Technology', SCHD: 'Diversified',
  VYM: 'Diversified', BND: 'Fixed Income', AGG: 'Fixed Income', TLT: 'Fixed Income',
  LQD: 'Fixed Income', HYG: 'Fixed Income', GLD: 'Commodities', SLV: 'Commodities',
  VNQ: 'Real Estate', XLF: 'Financial Services', XLE: 'Energy', XLK: 'Technology',
  XLV: 'Healthcare', XLI: 'Industrials', XLP: 'Consumer Defensive', XLU: 'Utilities',
  XLY: 'Consumer Cyclical', XLB: 'Basic Materials', XLRE: 'Real Estate',
  ARKK: 'Technology', SOXX: 'Technology', SMH: 'Technology',
  BRK: 'Financial Services', 'BRK.B': 'Financial Services',
  PLTR: 'Technology', COIN: 'Financial Services', SQ: 'Financial Services',
  SHOP: 'Technology', SNOW: 'Technology', CRWD: 'Technology', NET: 'Technology',
  SOFI: 'Financial Services', HOOD: 'Financial Services', DKNG: 'Consumer Cyclical',
  RIVN: 'Consumer Cyclical', NIO: 'Consumer Cyclical', LCID: 'Consumer Cyclical',
  VXUS: 'Diversified', EFA: 'Diversified', VWO: 'Diversified', IEMG: 'Diversified',
  EEM: 'Diversified', VNQI: 'Real Estate', VIG: 'Diversified', VOOG: 'Diversified',
  VOOV: 'Diversified', VTV: 'Diversified', VUG: 'Diversified', MGK: 'Diversified',
  ITOT: 'Diversified', SPTM: 'Diversified', SPLG: 'Diversified', SPYG: 'Diversified',
  SPYV: 'Diversified', RSP: 'Diversified', QUAL: 'Diversified', MTUM: 'Diversified',
  USMV: 'Diversified', ACWI: 'Diversified', VT: 'Diversified', IXUS: 'Diversified',
  IEFA: 'Diversified', SPDW: 'Diversified', FXI: 'Diversified', EWJ: 'Diversified',
  EWZ: 'Diversified', INDA: 'Diversified', KWEB: 'Technology',
  IBB: 'Healthcare', XBI: 'Healthcare', XOP: 'Energy', KRE: 'Financial Services',
  ITB: 'Consumer Cyclical', JETS: 'Industrials', HACK: 'Technology', BOTZ: 'Technology',
  ICLN: 'Energy', TAN: 'Energy', XLC: 'Communication Services',
  ARKW: 'Technology', ARKG: 'Healthcare', ARKF: 'Financial Services',
  SOXL: 'Technology', TQQQ: 'Technology', SQQQ: 'Technology', UVXY: 'Diversified',
};

const SIC_TO_SECTOR: Record<string, string> = {
  'electronic computers': 'Technology',
  'computer peripheral equipment': 'Technology',
  'prepackaged software': 'Technology',
  'computer programming': 'Technology',
  'computer integrated systems design': 'Technology',
  'semiconductor': 'Technology',
  'semiconductors': 'Technology',
  'electronic components': 'Technology',
  'communication services': 'Communication Services',
  'telephone communications': 'Communication Services',
  'television broadcasting': 'Communication Services',
  'cable & other pay television services': 'Communication Services',
  'pharmaceutical preparations': 'Healthcare',
  'surgical & medical instruments': 'Healthcare',
  'hospital & medical service plans': 'Healthcare',
  'biological products': 'Healthcare',
  'national commercial banks': 'Financial Services',
  'state commercial banks': 'Financial Services',
  'security brokers': 'Financial Services',
  'fire, marine & casualty insurance': 'Financial Services',
  'investment advice': 'Financial Services',
  'real estate investment trusts': 'Real Estate',
  'crude petroleum & natural gas': 'Energy',
  'petroleum refining': 'Energy',
  'electric services': 'Utilities',
  'natural gas distribution': 'Utilities',
  'motor vehicles & passenger car bodies': 'Consumer Cyclical',
  'retail stores': 'Consumer Cyclical',
  'eating places': 'Consumer Cyclical',
  'beverages': 'Consumer Defensive',
  'soap, detergent, cleaning': 'Consumer Defensive',
  'food & kindred products': 'Consumer Defensive',
  'aerospace & defense': 'Industrials',
  'railroads': 'Industrials',
  'air transportation': 'Industrials',
  'mining': 'Basic Materials',
  'steel works': 'Basic Materials',
};

/**
 * Curated sector override for well-known tickers and ETFs.
 */
export function getTickerSectorOverride(ticker: string): string | null {
  return TICKER_SECTOR_OVERRIDE[ticker.toUpperCase()] || null;
}

/**
 * Map an SIC description to a sector name.
 */
export function mapSicToSector(sicDescription: string | null): string | null {
  if (!sicDescription) return null;
  const lower = sicDescription.toLowerCase();

  for (const [key, sector] of Object.entries(SIC_TO_SECTOR)) {
    if (lower.includes(key)) return sector;
  }

  // Fallback: try to infer from common words
  if (lower.includes('software') || lower.includes('computer') || lower.includes('data'))
    return 'Technology';
  if (lower.includes('pharma') || lower.includes('medical') || lower.includes('health'))
    return 'Healthcare';
  if (lower.includes('bank') || lower.includes('insurance') || lower.includes('financial'))
    return 'Financial Services';
  if (lower.includes('oil') || lower.includes('gas') || lower.includes('energy'))
    return 'Energy';
  if (lower.includes('retail') || lower.includes('restaurant'))
    return 'Consumer Cyclical';

  return null;
}
