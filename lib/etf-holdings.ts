/**
 * ETF Holdings & Leveraged Product Mapping Database
 *
 * Provides portfolio look-through: maps ETFs, leveraged products,
 * and single-stock ETFs to their underlying exposures so concentration
 * risk, earnings exposure, and news attribution reflect true notional exposure.
 *
 * Data: Q2 2026 holdings. Update quarterly.
 * Sources: Fund prospectuses, SSGA, Vanguard, iShares, Invesco, ProShares, Direxion.
 */

// ── Single-Stock ETFs & Leveraged Single-Stock Products ──
// These track a SINGLE underlying stock. Leverage multiplier included.

export interface SingleStockProduct {
  underlying: string;
  leverage: number; // 1 = 1x, 2 = 2x, -1 = inverse, -2 = 2x inverse, etc.
  name: string;
}

export const SINGLE_STOCK_MAP: Record<string, SingleStockProduct> = {
  // ── GraniteShares 2x Long ──
  AAPB: { underlying: 'AAPL', leverage: 2, name: 'GraniteShares 2x Long AAPL' },
  AMDL: { underlying: 'AMD', leverage: 2, name: 'GraniteShares 2x Long AMD' },
  AMZZ: { underlying: 'AMZN', leverage: 2, name: 'GraniteShares 2x Long AMZN' },
  AVGU: { underlying: 'AVGO', leverage: 2, name: 'GraniteShares 2x Long AVGO' },
  BABX: { underlying: 'BABA', leverage: 2, name: 'GraniteShares 2x Long BABA' },
  CONL: { underlying: 'COIN', leverage: 2, name: 'GraniteShares 2x Long COIN' },
  CRWL: { underlying: 'CRWD', leverage: 2, name: 'GraniteShares 2x Long CRWD' },
  DLLL: { underlying: 'DELL', leverage: 2, name: 'GraniteShares 2x Long DELL' },
  FBL: { underlying: 'META', leverage: 2, name: 'GraniteShares 2x Long META' },
  GOU: { underlying: 'GOOGL', leverage: 2, name: 'GraniteShares 2x Long GOOGL' },
  INTW: { underlying: 'INTC', leverage: 2, name: 'GraniteShares 2x Long INTC' },
  IONL: { underlying: 'IONQ', leverage: 2, name: 'GraniteShares 2x Long IONQ' },
  ISUL: { underlying: 'ISRG', leverage: 2, name: 'GraniteShares 2x Long ISRG' },
  LCDL: { underlying: 'LCID', leverage: 2, name: 'GraniteShares 2x Long LCID' },
  MRAL: { underlying: 'MARA', leverage: 2, name: 'GraniteShares 2x Long MARA' },
  MSFL: { underlying: 'MSFT', leverage: 2, name: 'GraniteShares 2x Long MSFT' },
  MSTP: { underlying: 'MSTR', leverage: 2, name: 'GraniteShares 2x Long MSTR' },
  MULL: { underlying: 'MU', leverage: 2, name: 'GraniteShares 2x Long MU' },
  MVLL: { underlying: 'MRVL', leverage: 2, name: 'GraniteShares 2x Long MRVL' },
  NBIL: { underlying: 'NBIS', leverage: 2, name: 'GraniteShares 2x Long NBIS' },
  NOWL: { underlying: 'NOW', leverage: 2, name: 'GraniteShares 2x Long NOW' },
  NVDL: { underlying: 'NVDA', leverage: 2, name: 'GraniteShares 2x Long NVDA' },
  PDDL: { underlying: 'PDD', leverage: 2, name: 'GraniteShares 2x Long PDD' },
  PTIR: { underlying: 'PLTR', leverage: 2, name: 'GraniteShares 2x Long PLTR' },
  QCML: { underlying: 'QCOM', leverage: 2, name: 'GraniteShares 2x Long QCOM' },
  RDTL: { underlying: 'RDDT', leverage: 2, name: 'GraniteShares 2x Long RDDT' },
  RVNL: { underlying: 'RIVN', leverage: 2, name: 'GraniteShares 2x Long RIVN' },
  SMCL: { underlying: 'SMCI', leverage: 2, name: 'GraniteShares 2x Long SMCI' },
  TSLR: { underlying: 'TSLA', leverage: 2, name: 'GraniteShares 2x Long TSLA' },
  TSMU: { underlying: 'TSM', leverage: 2, name: 'GraniteShares 2x Long TSM' },
  UBRL: { underlying: 'UBER', leverage: 2, name: 'GraniteShares 2x Long UBER' },
  VRTL: { underlying: 'VRT', leverage: 2, name: 'GraniteShares 2x Long VRT' },
  JPML: { underlying: 'JPM', leverage: 2, name: 'GraniteShares 2x Long JPM' },
  DISL: { underlying: 'DIS', leverage: 2, name: 'GraniteShares 2x Long DIS' },
  PYPS: { underlying: 'PYPL', leverage: 2, name: 'GraniteShares 2x Long PYPL' },

  // ── GraniteShares 1.25x Long ──
  TSL: { underlying: 'TSLA', leverage: 1.25, name: 'GraniteShares 1.25x Long TSLA' },

  // ── GraniteShares 2x Short (Inverse) ──
  CONI: { underlying: 'COIN', leverage: -2, name: 'GraniteShares 2x Short COIN' },
  MSDD: { underlying: 'MSTR', leverage: -2, name: 'GraniteShares 2x Short MSTR' },
  NVD: { underlying: 'NVDA', leverage: -2, name: 'GraniteShares 2x Short NVDA' },
  TSDD: { underlying: 'TSLA', leverage: -2, name: 'GraniteShares 2x Short TSLA' },

  // ── Direxion Daily Single-Stock Bull ──
  AAPU: { underlying: 'AAPL', leverage: 1.5, name: 'Direxion Daily AAPL Bull 1.5X' },
  AMZU: { underlying: 'AMZN', leverage: 2, name: 'Direxion Daily AMZN Bull 2X' },
  GGLL: { underlying: 'GOOGL', leverage: 2, name: 'Direxion Daily GOOGL Bull 2X' },
  GOOGU: { underlying: 'GOOGL', leverage: 1.5, name: 'Direxion Daily GOOGL Bull 1.5X' },
  METU: { underlying: 'META', leverage: 2, name: 'Direxion Daily META Bull 2X' },
  MSFU: { underlying: 'MSFT', leverage: 2, name: 'Direxion Daily MSFT Bull 2X' },
  NVDU: { underlying: 'NVDA', leverage: 1.5, name: 'Direxion Daily NVDA Bull 1.5X' },
  TSLL: { underlying: 'TSLA', leverage: 2, name: 'Direxion Daily TSLA Bull 2X' },
  TSMX: { underlying: 'TSM', leverage: 2, name: 'Direxion Daily TSM Bull 2X' },

  // ── Direxion Daily Single-Stock Bear ──
  AAPD: { underlying: 'AAPL', leverage: -1, name: 'Direxion Daily AAPL Bear 1X' },
  AMZD: { underlying: 'AMZN', leverage: -1, name: 'Direxion Daily AMZN Bear 1X' },
  GOOGD: { underlying: 'GOOGL', leverage: -1, name: 'Direxion Daily GOOGL Bear 1X' },
  METD: { underlying: 'META', leverage: -1, name: 'Direxion Daily META Bear 1X' },
  MSFD: { underlying: 'MSFT', leverage: -1, name: 'Direxion Daily MSFT Bear 1X' },
  NVDD: { underlying: 'NVDA', leverage: -1, name: 'Direxion Daily NVDA Bear 1X' },
  TSLS: { underlying: 'TSLA', leverage: -1, name: 'Direxion Daily TSLA Bear 1X' },

  // ── Defiance Daily Target 2x Long ──
  MSTX: { underlying: 'MSTR', leverage: 2, name: 'Defiance Daily MSTR 2X Long' },
  AVGX: { underlying: 'AVGO', leverage: 2, name: 'Defiance Daily AVGO 2X Long' },
  STXL: { underlying: 'STX', leverage: 2, name: 'Defiance Daily STX 2X Long' },

  // ── Defiance Daily Target Short/Inverse ──
  SMST: { underlying: 'MSTR', leverage: -1, name: 'Defiance Daily MSTR 1X Short' },

  // ── Tradr 2x Long ──
  SNXX: { underlying: 'SNDK', leverage: 2, name: 'Tradr 2X Long SNDK Daily' },
  WDCX: { underlying: 'WDC', leverage: 2, name: 'Tradr 2X Long WDC Daily' },
  LRCU: { underlying: 'LRCX', leverage: 2, name: 'Tradr 2X Long LRCX Daily' },

  // ── Leverage Shares 2x Long ──
  CRWG: { underlying: 'CRWV', leverage: 2, name: 'Leverage Shares 2x Long CoreWeave' },
  ASMG: { underlying: 'ASML', leverage: 2, name: 'Leverage Shares 2x Long ASML' },

  // ── REX / T-REX ──
  FEBL: { underlying: 'META', leverage: 2, name: 'T-Rex 2X Long META Daily' },
  FLYL: { underlying: 'UBER', leverage: 2, name: 'T-Rex 2X Long UBER Daily' },
  NFLL: { underlying: 'NFLX', leverage: 2, name: 'T-Rex 2X Long NFLX Daily' },
  BIRL: { underlying: 'COIN', leverage: 2, name: 'T-Rex 2X Long Coinbase Daily' },
};

// ── Leveraged/Inverse Index ETFs → Underlying Index ETF ──

export interface LeveragedProduct {
  underlying: string; // The base ETF this tracks
  leverage: number;
  name: string;
}

export const LEVERAGED_ETF_MAP: Record<string, LeveragedProduct> = {
  // S&P 500
  SPXL: { underlying: 'SPY', leverage: 3, name: 'Direxion Daily S&P 500 Bull 3X' },
  SPXS: { underlying: 'SPY', leverage: -3, name: 'Direxion Daily S&P 500 Bear 3X' },
  UPRO: { underlying: 'SPY', leverage: 3, name: 'ProShares UltraPro S&P 500' },
  SPXU: { underlying: 'SPY', leverage: -3, name: 'ProShares UltraPro Short S&P 500' },
  SSO: { underlying: 'SPY', leverage: 2, name: 'ProShares Ultra S&P 500' },
  SDS: { underlying: 'SPY', leverage: -2, name: 'ProShares UltraShort S&P 500' },
  SH: { underlying: 'SPY', leverage: -1, name: 'ProShares Short S&P 500' },
  // Nasdaq 100
  TQQQ: { underlying: 'QQQ', leverage: 3, name: 'ProShares UltraPro QQQ' },
  SQQQ: { underlying: 'QQQ', leverage: -3, name: 'ProShares UltraPro Short QQQ' },
  QLD: { underlying: 'QQQ', leverage: 2, name: 'ProShares Ultra QQQ' },
  QID: { underlying: 'QQQ', leverage: -2, name: 'ProShares UltraShort QQQ' },
  PSQ: { underlying: 'QQQ', leverage: -1, name: 'ProShares Short QQQ' },
  // Russell 2000
  TNA: { underlying: 'IWM', leverage: 3, name: 'Direxion Daily Small Cap Bull 3X' },
  TZA: { underlying: 'IWM', leverage: -3, name: 'Direxion Daily Small Cap Bear 3X' },
  UWM: { underlying: 'IWM', leverage: 2, name: 'ProShares Ultra Russell2000' },
  TWM: { underlying: 'IWM', leverage: -2, name: 'ProShares UltraShort Russell2000' },
  // Dow Jones
  UDOW: { underlying: 'DIA', leverage: 3, name: 'ProShares UltraPro Dow30' },
  SDOW: { underlying: 'DIA', leverage: -3, name: 'ProShares UltraPro Short Dow30' },
  // Semiconductors
  SOXL: { underlying: 'SOXX', leverage: 3, name: 'Direxion Daily Semiconductor Bull 3X' },
  SOXS: { underlying: 'SOXX', leverage: -3, name: 'Direxion Daily Semiconductor Bear 3X' },
  USD: { underlying: 'SMH', leverage: 2, name: 'ProShares Ultra Semiconductors' },
  // Financials
  FAS: { underlying: 'XLF', leverage: 3, name: 'Direxion Daily Financial Bull 3X' },
  FAZ: { underlying: 'XLF', leverage: -3, name: 'Direxion Daily Financial Bear 3X' },
  // Energy
  ERX: { underlying: 'XLE', leverage: 2, name: 'Direxion Daily Energy Bull 2X' },
  ERY: { underlying: 'XLE', leverage: -2, name: 'Direxion Daily Energy Bear 2X' },
  // Technology
  TECL: { underlying: 'XLK', leverage: 3, name: 'Direxion Daily Technology Bull 3X' },
  TECS: { underlying: 'XLK', leverage: -3, name: 'Direxion Daily Technology Bear 3X' },
  // Healthcare
  LABU: { underlying: 'XBI', leverage: 3, name: 'Direxion Daily S&P Biotech Bull 3X' },
  LABD: { underlying: 'XBI', leverage: -3, name: 'Direxion Daily S&P Biotech Bear 3X' },
  // Gold
  NUGT: { underlying: 'GDX', leverage: 2, name: 'Direxion Daily Gold Miners Bull 2X' },
  DUST: { underlying: 'GDX', leverage: -2, name: 'Direxion Daily Gold Miners Bear 2X' },
  // Bonds
  TMF: { underlying: 'TLT', leverage: 3, name: 'Direxion Daily 20+ Year Treasury Bull 3X' },
  TMV: { underlying: 'TLT', leverage: -3, name: 'Direxion Daily 20+ Year Treasury Bear 3X' },
  TBT: { underlying: 'TLT', leverage: -2, name: 'ProShares UltraShort 20+ Year Treasury' },
  // VIX
  UVXY: { underlying: 'VIXY', leverage: 1.5, name: 'ProShares Ultra VIX Short-Term Futures' },
  SVXY: { underlying: 'VIXY', leverage: -0.5, name: 'ProShares Short VIX Short-Term Futures' },
  UVIX: { underlying: 'VIXY', leverage: 2, name: 'ProShares Ultra VIX Short-Term Futures' },
};

// ── Broad & Sector ETF Top Holdings ──
// Weights as of Q2 2026. Top 10 constituents per fund.

export interface ETFConstituent {
  ticker: string;
  weight: number; // Percentage, e.g. 7.09 = 7.09%
}

export const ETF_HOLDINGS: Record<string, ETFConstituent[]> = {
  // ── S&P 500 ──
  SPY: [
    { ticker: 'NVDA', weight: 8.29 }, { ticker: 'AAPL', weight: 7.09 },
    { ticker: 'MSFT', weight: 5.02 }, { ticker: 'AMZN', weight: 3.84 },
    { ticker: 'AVGO', weight: 3.50 }, { ticker: 'GOOGL', weight: 3.23 },
    { ticker: 'GOOG', weight: 2.57 }, { ticker: 'META', weight: 2.00 },
    { ticker: 'MU', weight: 1.83 }, { ticker: 'TSLA', weight: 1.82 },
  ],
  VOO: [
    { ticker: 'NVDA', weight: 8.29 }, { ticker: 'AAPL', weight: 7.09 },
    { ticker: 'MSFT', weight: 5.02 }, { ticker: 'AMZN', weight: 3.84 },
    { ticker: 'AVGO', weight: 3.50 }, { ticker: 'GOOGL', weight: 3.23 },
    { ticker: 'GOOG', weight: 2.57 }, { ticker: 'META', weight: 2.00 },
    { ticker: 'MU', weight: 1.83 }, { ticker: 'TSLA', weight: 1.82 },
  ],
  IVV: [
    { ticker: 'NVDA', weight: 8.29 }, { ticker: 'AAPL', weight: 7.09 },
    { ticker: 'MSFT', weight: 5.02 }, { ticker: 'AMZN', weight: 3.84 },
    { ticker: 'AVGO', weight: 3.50 }, { ticker: 'GOOGL', weight: 3.23 },
    { ticker: 'GOOG', weight: 2.57 }, { ticker: 'META', weight: 2.00 },
    { ticker: 'MU', weight: 1.83 }, { ticker: 'TSLA', weight: 1.82 },
  ],

  // ── Total Market ──
  VTI: [
    { ticker: 'NVDA', weight: 7.20 }, { ticker: 'AAPL', weight: 6.15 },
    { ticker: 'MSFT', weight: 4.35 }, { ticker: 'AMZN', weight: 3.33 },
    { ticker: 'AVGO', weight: 3.00 }, { ticker: 'GOOGL', weight: 2.80 },
    { ticker: 'GOOG', weight: 2.23 }, { ticker: 'META', weight: 1.74 },
    { ticker: 'TSLA', weight: 1.58 }, { ticker: 'BRK.B', weight: 1.40 },
  ],
  ITOT: [
    { ticker: 'NVDA', weight: 7.20 }, { ticker: 'AAPL', weight: 6.15 },
    { ticker: 'MSFT', weight: 4.35 }, { ticker: 'AMZN', weight: 3.33 },
    { ticker: 'AVGO', weight: 3.00 }, { ticker: 'GOOGL', weight: 2.80 },
    { ticker: 'GOOG', weight: 2.23 }, { ticker: 'META', weight: 1.74 },
    { ticker: 'TSLA', weight: 1.58 }, { ticker: 'BRK.B', weight: 1.40 },
  ],
  SCHB: [
    { ticker: 'NVDA', weight: 7.20 }, { ticker: 'AAPL', weight: 6.15 },
    { ticker: 'MSFT', weight: 4.35 }, { ticker: 'AMZN', weight: 3.33 },
    { ticker: 'AVGO', weight: 3.00 }, { ticker: 'GOOGL', weight: 2.80 },
    { ticker: 'GOOG', weight: 2.23 }, { ticker: 'META', weight: 1.74 },
    { ticker: 'TSLA', weight: 1.58 }, { ticker: 'BRK.B', weight: 1.40 },
  ],

  // ── Nasdaq 100 ──
  QQQ: [
    { ticker: 'AAPL', weight: 8.81 }, { ticker: 'NVDA', weight: 8.25 },
    { ticker: 'MSFT', weight: 7.55 }, { ticker: 'AMZN', weight: 5.34 },
    { ticker: 'AVGO', weight: 4.95 }, { ticker: 'META', weight: 4.57 },
    { ticker: 'GOOGL', weight: 2.89 }, { ticker: 'GOOG', weight: 2.70 },
    { ticker: 'TSLA', weight: 2.63 }, { ticker: 'COST', weight: 2.55 },
  ],
  QQQM: [
    { ticker: 'AAPL', weight: 8.81 }, { ticker: 'NVDA', weight: 8.25 },
    { ticker: 'MSFT', weight: 7.55 }, { ticker: 'AMZN', weight: 5.34 },
    { ticker: 'AVGO', weight: 4.95 }, { ticker: 'META', weight: 4.57 },
    { ticker: 'GOOGL', weight: 2.89 }, { ticker: 'GOOG', weight: 2.70 },
    { ticker: 'TSLA', weight: 2.63 }, { ticker: 'COST', weight: 2.55 },
  ],

  // ── Dow Jones ──
  DIA: [
    { ticker: 'UNH', weight: 8.44 }, { ticker: 'GS', weight: 7.60 },
    { ticker: 'MSFT', weight: 6.28 }, { ticker: 'HD', weight: 5.80 },
    { ticker: 'CAT', weight: 5.32 }, { ticker: 'AMGN', weight: 4.60 },
    { ticker: 'SHW', weight: 4.55 }, { ticker: 'V', weight: 4.20 },
    { ticker: 'CRM', weight: 3.92 }, { ticker: 'MCD', weight: 3.85 },
  ],

  // ── Russell 2000 ──
  IWM: [
    { ticker: 'SMCI', weight: 1.20 }, { ticker: 'INSM', weight: 0.55 },
    { ticker: 'MTDR', weight: 0.50 }, { ticker: 'FN', weight: 0.48 },
    { ticker: 'IBKR', weight: 0.45 }, { ticker: 'TOST', weight: 0.44 },
    { ticker: 'EAT', weight: 0.42 }, { ticker: 'CEIX', weight: 0.40 },
    { ticker: 'ONTO', weight: 0.38 }, { ticker: 'PIPR', weight: 0.37 },
  ],

  // ── Technology ──
  XLK: [
    { ticker: 'NVDA', weight: 17.80 }, { ticker: 'AAPL', weight: 15.20 },
    { ticker: 'MSFT', weight: 14.50 }, { ticker: 'AVGO', weight: 6.80 },
    { ticker: 'CRM', weight: 3.20 }, { ticker: 'AMD', weight: 2.80 },
    { ticker: 'ORCL', weight: 2.60 }, { ticker: 'ADBE', weight: 2.30 },
    { ticker: 'NOW', weight: 2.20 }, { ticker: 'INTU', weight: 2.10 },
  ],
  VGT: [
    { ticker: 'NVDA', weight: 16.50 }, { ticker: 'AAPL', weight: 14.80 },
    { ticker: 'MSFT', weight: 13.90 }, { ticker: 'AVGO', weight: 6.40 },
    { ticker: 'CRM', weight: 3.10 }, { ticker: 'AMD', weight: 2.70 },
    { ticker: 'ORCL', weight: 2.50 }, { ticker: 'ADBE', weight: 2.20 },
    { ticker: 'NOW', weight: 2.10 }, { ticker: 'INTU', weight: 2.00 },
  ],

  // ── Semiconductors ──
  SOXX: [
    { ticker: 'NVDA', weight: 10.50 }, { ticker: 'AVGO', weight: 9.80 },
    { ticker: 'AMD', weight: 7.20 }, { ticker: 'QCOM', weight: 6.50 },
    { ticker: 'MU', weight: 5.30 }, { ticker: 'INTC', weight: 4.80 },
    { ticker: 'MRVL', weight: 4.50 }, { ticker: 'TXN', weight: 4.20 },
    { ticker: 'LRCX', weight: 3.90 }, { ticker: 'AMAT', weight: 3.80 },
  ],
  SMH: [
    { ticker: 'NVDA', weight: 20.20 }, { ticker: 'TSM', weight: 12.50 },
    { ticker: 'AVGO', weight: 8.30 }, { ticker: 'AMD', weight: 5.10 },
    { ticker: 'QCOM', weight: 4.80 }, { ticker: 'TXN', weight: 4.50 },
    { ticker: 'MU', weight: 4.20 }, { ticker: 'INTC', weight: 3.80 },
    { ticker: 'AMAT', weight: 3.50 }, { ticker: 'LRCX', weight: 3.30 },
  ],

  // ── Financials ──
  XLF: [
    { ticker: 'BRK.B', weight: 14.20 }, { ticker: 'JPM', weight: 10.50 },
    { ticker: 'V', weight: 8.30 }, { ticker: 'MA', weight: 7.10 },
    { ticker: 'BAC', weight: 4.20 }, { ticker: 'WFC', weight: 3.40 },
    { ticker: 'GS', weight: 3.20 }, { ticker: 'SPGI', weight: 3.00 },
    { ticker: 'AXP', weight: 2.80 }, { ticker: 'MS', weight: 2.60 },
  ],

  // ── Healthcare ──
  XLV: [
    { ticker: 'LLY', weight: 11.50 }, { ticker: 'UNH', weight: 9.80 },
    { ticker: 'JNJ', weight: 6.50 }, { ticker: 'ABBV', weight: 6.20 },
    { ticker: 'MRK', weight: 5.30 }, { ticker: 'TMO', weight: 4.10 },
    { ticker: 'ABT', weight: 3.80 }, { ticker: 'AMGN', weight: 3.20 },
    { ticker: 'PFE', weight: 2.80 }, { ticker: 'ISRG', weight: 2.60 },
  ],
  XBI: [
    { ticker: 'MRNA', weight: 2.50 }, { ticker: 'HALO', weight: 2.30 },
    { ticker: 'EXAS', weight: 2.10 }, { ticker: 'PCVX', weight: 1.90 },
    { ticker: 'IONS', weight: 1.80 }, { ticker: 'ALNY', weight: 1.70 },
    { ticker: 'BMRN', weight: 1.60 }, { ticker: 'SRPT', weight: 1.50 },
    { ticker: 'NBIX', weight: 1.40 }, { ticker: 'EXEL', weight: 1.35 },
  ],

  // ── Energy ──
  XLE: [
    { ticker: 'XOM', weight: 22.50 }, { ticker: 'CVX', weight: 15.80 },
    { ticker: 'COP', weight: 7.20 }, { ticker: 'WMB', weight: 5.50 },
    { ticker: 'EOG', weight: 4.80 }, { ticker: 'SLB', weight: 4.30 },
    { ticker: 'MPC', weight: 3.90 }, { ticker: 'PSX', weight: 3.50 },
    { ticker: 'PXD', weight: 3.20 }, { ticker: 'VLO', weight: 3.00 },
  ],

  // ── Consumer Discretionary ──
  XLY: [
    { ticker: 'AMZN', weight: 22.80 }, { ticker: 'TSLA', weight: 13.50 },
    { ticker: 'HD', weight: 8.50 }, { ticker: 'MCD', weight: 4.80 },
    { ticker: 'LOW', weight: 4.20 }, { ticker: 'BKNG', weight: 3.90 },
    { ticker: 'NKE', weight: 3.10 }, { ticker: 'SBUX', weight: 2.80 },
    { ticker: 'TJX', weight: 2.60 }, { ticker: 'ABNB', weight: 2.10 },
  ],

  // ── Consumer Staples ──
  XLP: [
    { ticker: 'PG', weight: 14.50 }, { ticker: 'COST', weight: 12.80 },
    { ticker: 'WMT', weight: 10.50 }, { ticker: 'KO', weight: 8.20 },
    { ticker: 'PEP', weight: 7.50 }, { ticker: 'PM', weight: 5.30 },
    { ticker: 'MDLZ', weight: 3.80 }, { ticker: 'MO', weight: 3.20 },
    { ticker: 'CL', weight: 3.00 }, { ticker: 'ADM', weight: 2.50 },
  ],

  // ── Industrials ──
  XLI: [
    { ticker: 'GE', weight: 8.50 }, { ticker: 'CAT', weight: 5.80 },
    { ticker: 'RTX', weight: 5.20 }, { ticker: 'UNP', weight: 4.80 },
    { ticker: 'HON', weight: 4.50 }, { ticker: 'DE', weight: 4.20 },
    { ticker: 'BA', weight: 3.80 }, { ticker: 'LMT', weight: 3.50 },
    { ticker: 'WM', weight: 3.20 }, { ticker: 'ETN', weight: 3.00 },
  ],

  // ── Utilities ──
  XLU: [
    { ticker: 'NEE', weight: 14.80 }, { ticker: 'SO', weight: 8.50 },
    { ticker: 'DUK', weight: 7.20 }, { ticker: 'CEG', weight: 6.50 },
    { ticker: 'SRE', weight: 4.80 }, { ticker: 'AEP', weight: 4.30 },
    { ticker: 'D', weight: 4.10 }, { ticker: 'PCG', weight: 3.50 },
    { ticker: 'EXC', weight: 3.20 }, { ticker: 'XEL', weight: 2.80 },
  ],

  // ── Real Estate ──
  VNQ: [
    { ticker: 'PLD', weight: 9.50 }, { ticker: 'AMT', weight: 7.80 },
    { ticker: 'EQIX', weight: 6.50 }, { ticker: 'WELL', weight: 5.20 },
    { ticker: 'SPG', weight: 4.80 }, { ticker: 'DLR', weight: 4.30 },
    { ticker: 'PSA', weight: 3.90 }, { ticker: 'O', weight: 3.50 },
    { ticker: 'CCI', weight: 3.20 }, { ticker: 'VICI', weight: 3.00 },
  ],

  // ── Communication Services ──
  XLC: [
    { ticker: 'META', weight: 22.50 }, { ticker: 'GOOGL', weight: 13.80 },
    { ticker: 'GOOG', weight: 11.50 }, { ticker: 'NFLX', weight: 5.80 },
    { ticker: 'T', weight: 4.50 }, { ticker: 'CMCSA', weight: 4.20 },
    { ticker: 'DIS', weight: 3.90 }, { ticker: 'VZ', weight: 3.50 },
    { ticker: 'TMUS', weight: 3.30 }, { ticker: 'EA', weight: 2.80 },
  ],

  // ── Dividend ──
  SCHD: [
    { ticker: 'ABBV', weight: 4.50 }, { ticker: 'AMGN', weight: 4.30 },
    { ticker: 'CVX', weight: 4.10 }, { ticker: 'MRK', weight: 4.00 },
    { ticker: 'KO', weight: 3.80 }, { ticker: 'PEP', weight: 3.60 },
    { ticker: 'CSCO', weight: 3.40 }, { ticker: 'TXN', weight: 3.20 },
    { ticker: 'HD', weight: 3.00 }, { ticker: 'VZ', weight: 2.90 },
  ],
  VYM: [
    { ticker: 'JPM', weight: 3.80 }, { ticker: 'AVGO', weight: 3.50 },
    { ticker: 'XOM', weight: 3.20 }, { ticker: 'HD', weight: 2.90 },
    { ticker: 'PG', weight: 2.70 }, { ticker: 'JNJ', weight: 2.50 },
    { ticker: 'MRK', weight: 2.30 }, { ticker: 'ABBV', weight: 2.20 },
    { ticker: 'CVX', weight: 2.10 }, { ticker: 'BAC', weight: 2.00 },
  ],
  VIG: [
    { ticker: 'AAPL', weight: 5.20 }, { ticker: 'MSFT', weight: 4.80 },
    { ticker: 'AVGO', weight: 4.50 }, { ticker: 'JPM', weight: 3.80 },
    { ticker: 'UNH', weight: 3.50 }, { ticker: 'V', weight: 3.20 },
    { ticker: 'MA', weight: 3.00 }, { ticker: 'HD', weight: 2.80 },
    { ticker: 'PG', weight: 2.60 }, { ticker: 'COST', weight: 2.40 },
  ],

  // ── Growth ──
  VUG: [
    { ticker: 'AAPL', weight: 12.50 }, { ticker: 'NVDA', weight: 11.80 },
    { ticker: 'MSFT', weight: 10.20 }, { ticker: 'AMZN', weight: 6.50 },
    { ticker: 'META', weight: 4.80 }, { ticker: 'AVGO', weight: 4.50 },
    { ticker: 'GOOGL', weight: 3.20 }, { ticker: 'TSLA', weight: 3.00 },
    { ticker: 'GOOG', weight: 2.80 }, { ticker: 'CRM', weight: 2.10 },
  ],
  IWF: [
    { ticker: 'AAPL', weight: 11.80 }, { ticker: 'NVDA', weight: 11.20 },
    { ticker: 'MSFT', weight: 9.80 }, { ticker: 'AMZN', weight: 6.20 },
    { ticker: 'META', weight: 4.60 }, { ticker: 'AVGO', weight: 4.30 },
    { ticker: 'GOOGL', weight: 3.10 }, { ticker: 'TSLA', weight: 2.90 },
    { ticker: 'GOOG', weight: 2.70 }, { ticker: 'CRM', weight: 2.00 },
  ],

  // ── Value ──
  VTV: [
    { ticker: 'BRK.B', weight: 5.20 }, { ticker: 'JPM', weight: 3.80 },
    { ticker: 'UNH', weight: 3.50 }, { ticker: 'XOM', weight: 3.20 },
    { ticker: 'JNJ', weight: 2.80 }, { ticker: 'PG', weight: 2.60 },
    { ticker: 'HD', weight: 2.40 }, { ticker: 'ABBV', weight: 2.20 },
    { ticker: 'CVX', weight: 2.10 }, { ticker: 'MRK', weight: 2.00 },
  ],

  // ── International ──
  VXUS: [
    { ticker: 'TSM', weight: 2.80 }, { ticker: 'SAP', weight: 1.50 },
    { ticker: 'ASML', weight: 1.40 }, { ticker: 'NVO', weight: 1.30 },
    { ticker: 'SHEL', weight: 1.10 }, { ticker: 'AZN', weight: 1.00 },
    { ticker: 'TM', weight: 0.90 }, { ticker: 'HSBC', weight: 0.85 },
    { ticker: 'NESN', weight: 0.80 }, { ticker: 'ROCHE', weight: 0.75 },
  ],
  EFA: [
    { ticker: 'SAP', weight: 2.80 }, { ticker: 'ASML', weight: 2.50 },
    { ticker: 'NVO', weight: 2.30 }, { ticker: 'SHEL', weight: 1.80 },
    { ticker: 'AZN', weight: 1.60 }, { ticker: 'HSBC', weight: 1.50 },
    { ticker: 'TM', weight: 1.40 }, { ticker: 'SNY', weight: 1.20 },
    { ticker: 'UL', weight: 1.10 }, { ticker: 'BP', weight: 1.00 },
  ],
  EEM: [
    { ticker: 'TSM', weight: 10.50 }, { ticker: 'BABA', weight: 3.80 },
    { ticker: 'TCEHY', weight: 3.50 }, { ticker: 'RELIANCE', weight: 1.80 },
    { ticker: 'SAMSUNG', weight: 1.60 }, { ticker: 'VALE', weight: 1.30 },
    { ticker: 'PDD', weight: 1.20 }, { ticker: 'INFOSYS', weight: 1.00 },
    { ticker: 'JD', weight: 0.90 }, { ticker: 'MEITUAN', weight: 0.85 },
  ],

  // ── Bond ETFs (no equity holdings, but track for allocation context) ──
  // Empty holdings — these don't have stock exposure
  BND: [],
  AGG: [],
  TLT: [],
  SHY: [],
  VCIT: [],
  LQD: [],
  HYG: [],
  TIP: [],

  // ── Commodity ETFs ──
  GLD: [],
  SLV: [],
  GDX: [
    { ticker: 'NEM', weight: 12.50 }, { ticker: 'GOLD', weight: 9.80 },
    { ticker: 'AEM', weight: 8.50 }, { ticker: 'WPM', weight: 6.20 },
    { ticker: 'FNV', weight: 5.80 }, { ticker: 'RGLD', weight: 4.50 },
    { ticker: 'AGI', weight: 3.80 }, { ticker: 'KGC', weight: 3.50 },
    { ticker: 'BTG', weight: 3.20 }, { ticker: 'SSRM', weight: 2.80 },
  ],

  // ── ARK ──
  ARKK: [
    { ticker: 'TSLA', weight: 12.50 }, { ticker: 'COIN', weight: 8.80 },
    { ticker: 'ROKU', weight: 7.50 }, { ticker: 'SQ', weight: 6.20 },
    { ticker: 'PATH', weight: 5.50 }, { ticker: 'RBLX', weight: 5.00 },
    { ticker: 'PLTR', weight: 4.80 }, { ticker: 'SHOP', weight: 4.50 },
    { ticker: 'TWLO', weight: 4.00 }, { ticker: 'U', weight: 3.80 },
  ],
};

// ── Lookup Functions ──

export interface UnderlyingExposure {
  ticker: string;
  weight: number; // Percentage of the ETF
  effectiveWeight: number; // weight * leverage factor * position allocation
  source: string; // Which ETF/product this exposure comes from
  leverage: number;
}

/**
 * Check if a ticker is a single-stock leveraged product.
 */
export function isSingleStockProduct(ticker: string): boolean {
  return ticker.toUpperCase() in SINGLE_STOCK_MAP;
}

/**
 * Check if a ticker is a leveraged/inverse index ETF.
 */
export function isLeveragedETF(ticker: string): boolean {
  return ticker.toUpperCase() in LEVERAGED_ETF_MAP;
}

/**
 * Check if a ticker is any ETF with known holdings.
 */
export function isETFWithHoldings(ticker: string): boolean {
  return ticker.toUpperCase() in ETF_HOLDINGS;
}

/**
 * Get underlying exposures for a holding.
 * Returns empty array for individual stocks or unknown ETFs.
 *
 * @param ticker The ETF or leveraged product ticker
 * @param positionValue The dollar value of the position
 * @param portfolioValue The total portfolio value (for allocation %)
 */
export function getUnderlyingExposure(
  ticker: string,
  positionValue: number,
  portfolioValue: number,
): UnderlyingExposure[] {
  const upper = ticker.toUpperCase();
  const allocationPct = portfolioValue > 0 ? (positionValue / portfolioValue) * 100 : 0;

  // Single-stock product (MSFL, TSLL, etc.)
  if (upper in SINGLE_STOCK_MAP) {
    const product = SINGLE_STOCK_MAP[upper];
    return [{
      ticker: product.underlying,
      weight: 100,
      effectiveWeight: allocationPct * Math.abs(product.leverage),
      source: upper,
      leverage: product.leverage,
    }];
  }

  // Leveraged/inverse index ETF (TQQQ, SOXL, etc.)
  if (upper in LEVERAGED_ETF_MAP) {
    const product = LEVERAGED_ETF_MAP[upper];
    const baseETF = product.underlying;
    const holdings = ETF_HOLDINGS[baseETF] || [];

    return holdings.map(h => ({
      ticker: h.ticker,
      weight: h.weight,
      effectiveWeight: (allocationPct * h.weight / 100) * Math.abs(product.leverage),
      source: `${upper} (${product.leverage > 0 ? '+' : ''}${product.leverage}x ${baseETF})`,
      leverage: product.leverage,
    }));
  }

  // Regular ETF with known holdings
  if (upper in ETF_HOLDINGS) {
    const holdings = ETF_HOLDINGS[upper];
    return holdings.map(h => ({
      ticker: h.ticker,
      weight: h.weight,
      effectiveWeight: allocationPct * h.weight / 100,
      source: upper,
      leverage: 1,
    }));
  }

  return [];
}

/**
 * Compute full portfolio look-through: aggregate all underlying exposures
 * across all holdings, combining direct positions with ETF constituents.
 *
 * Returns a map of ticker → total effective portfolio weight (%).
 */
export function computePortfolioLookthrough(
  holdings: { ticker: string; totalValue: number }[],
  portfolioValue: number,
): Map<string, { directWeight: number; indirectWeight: number; totalWeight: number; sources: string[] }> {
  const exposure = new Map<string, { directWeight: number; indirectWeight: number; totalWeight: number; sources: string[] }>();

  for (const holding of holdings) {
    const upper = holding.ticker.toUpperCase();
    const directAllocation = portfolioValue > 0 ? (holding.totalValue / portfolioValue) * 100 : 0;

    // Check for underlying exposures
    const underlyings = getUnderlyingExposure(upper, holding.totalValue, portfolioValue);

    if (underlyings.length === 0) {
      // Direct stock holding
      const existing = exposure.get(upper) || { directWeight: 0, indirectWeight: 0, totalWeight: 0, sources: [] };
      existing.directWeight += directAllocation;
      existing.totalWeight = existing.directWeight + existing.indirectWeight;
      if (!existing.sources.includes('Direct')) existing.sources.push('Direct');
      exposure.set(upper, existing);
    } else {
      // ETF/leveraged product — attribute to underlyings
      for (const u of underlyings) {
        const existing = exposure.get(u.ticker) || { directWeight: 0, indirectWeight: 0, totalWeight: 0, sources: [] };
        existing.indirectWeight += u.effectiveWeight;
        existing.totalWeight = existing.directWeight + existing.indirectWeight;
        if (!existing.sources.includes(u.source)) existing.sources.push(u.source);
        exposure.set(u.ticker, existing);
      }
    }
  }

  return exposure;
}
