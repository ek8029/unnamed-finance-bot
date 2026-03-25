/**
 * Top tickers for programmatic SEO — used by sitemap.ts to generate
 * /analyze/[ticker] entries so Google discovers and indexes them.
 *
 * S&P 500 + popular ETFs + high-search-volume mid/small caps.
 */

export const TOP_TICKERS = [
  // ── Mega-cap / FAANG+ ──
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'AVGO',
  'LLY', 'JPM', 'V', 'UNH', 'XOM', 'MA', 'JNJ', 'PG', 'COST', 'HD',
  'ABBV', 'NFLX', 'CRM', 'BAC', 'KO', 'MRK', 'CVX', 'AMD', 'PEP', 'ADBE',

  // ── S&P 500 core (31-100) ──
  'TMO', 'LIN', 'CSCO', 'WMT', 'ACN', 'MCD', 'ABT', 'DHR', 'TXN', 'PM',
  'NEE', 'CMCSA', 'INTC', 'VZ', 'IBM', 'AMGN', 'DIS', 'RTX', 'HON', 'QCOM',
  'INTU', 'UNP', 'AMAT', 'CAT', 'SPGI', 'GE', 'LOW', 'BA', 'GS', 'ISRG',
  'BLK', 'NOW', 'PFE', 'T', 'ELV', 'BKNG', 'ADP', 'MDLZ', 'GILD', 'SYK',
  'TJX', 'MMC', 'VRTX', 'LRCX', 'ADI', 'REGN', 'PANW', 'SCHW', 'CB', 'MO',
  'FI', 'ETN', 'BSX', 'CME', 'ZTS', 'DE', 'SO', 'PGR', 'KLAC', 'CI',
  'DUK', 'SNPS', 'SHW', 'CDNS', 'CL', 'BMY', 'ICE', 'MCO', 'EOG', 'WM',

  // ── S&P 500 (101-200) ──
  'APH', 'NOC', 'CMG', 'SLB', 'PH', 'FDX', 'ITW', 'TDG', 'MPC', 'ORLY',
  'USB', 'MSI', 'EMR', 'CTAS', 'NSC', 'CARR', 'GD', 'PNC', 'TGT', 'AJG',
  'APD', 'HCA', 'ECL', 'OXY', 'NXPI', 'PSX', 'SRE', 'ADSK', 'AFL', 'CCI',
  'AEP', 'MAR', 'KMB', 'TFC', 'PCAR', 'MET', 'PSA', 'GM', 'F', 'HLT',
  'COF', 'ROP', 'AIG', 'WMB', 'MCHP', 'D', 'O', 'STZ', 'DLR', 'RSG',
  'KHC', 'HES', 'ROST', 'NEM', 'IDXX', 'TEL', 'AMP', 'MNST', 'GIS', 'EXC',

  // ── S&P 500 (201-300) ──
  'ALL', 'FTNT', 'BK', 'A', 'OKE', 'YUM', 'PRU', 'KR', 'DHI', 'OTIS',
  'MSCI', 'PPG', 'LHX', 'DOW', 'CTVA', 'ED', 'EW', 'HPQ', 'IQV', 'EXR',
  'VLO', 'VRSK', 'RMD', 'HAL', 'XEL', 'AME', 'DD', 'CDW', 'MTD', 'PWR',
  'MLM', 'WEC', 'VICI', 'CSGP', 'PCG', 'ANSS', 'FAST', 'KEYS', 'GPN', 'GEHC',
  'DLTR', 'BKR', 'FANG', 'DAL', 'AVB', 'EBAY', 'IR', 'ON', 'TSCO', 'ROK',

  // ── S&P 500 (301-400) ──
  'EQR', 'WBD', 'CAH', 'APTV', 'CPAY', 'FTV', 'TRGP', 'ACGL', 'EFX', 'VMC',
  'WST', 'DXCM', 'STT', 'RCL', 'WAB', 'HPE', 'CLX', 'ES', 'ZBH', 'GWW',
  'K', 'LYV', 'MTB', 'SYY', 'BAX', 'WTW', 'IRM', 'LUV', 'FE', 'TDY',
  'IT', 'UAL', 'BALL', 'CF', 'DG', 'HOLX', 'AWK', 'CHD', 'BR', 'PPL',
  'NTAP', 'DRI', 'J', 'MKC', 'SBAC', 'TER', 'CINF', 'PFG', 'TRMB', 'LYB',

  // ── S&P 500 (401-503) ──
  'STE', 'WAT', 'AMCR', 'MOS', 'IP', 'AES', 'KIM', 'L', 'SWK', 'WRB',
  'POOL', 'KEY', 'PKG', 'ARE', 'COO', 'ZBRA', 'TSN', 'JBHT', 'EXPD', 'ULTA',
  'RVTY', 'CRL', 'ALB', 'BRO', 'TECH', 'ATO', 'EVRG', 'MGM', 'TXT', 'VTRS',
  'NI', 'DPZ', 'EMN', 'REG', 'UDR', 'HST', 'BXP', 'CPT', 'AOS', 'RL',
  'NDSN', 'CHRW', 'HWM', 'GL', 'CZR', 'AIZ', 'GNRC', 'HII', 'BBWI', 'PARA',
  'VFC', 'FRT', 'MTCH', 'IVZ', 'NWSA', 'NWS', 'BEN', 'MHK', 'BWA', 'DVA',

  // ── Popular ETFs ──
  'SPY', 'QQQ', 'VOO', 'VTI', 'IWM', 'DIA', 'ARKK', 'VGT', 'SCHD', 'VYM',
  'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLP', 'XLU', 'XLY', 'XLB', 'XLRE',
  'BND', 'TLT', 'HYG', 'LQD', 'AGG', 'GLD', 'SLV', 'VNQ', 'VNQI', 'IEMG',
  'VWO', 'EFA', 'SOXX', 'SMH', 'KWEB', 'HACK', 'BOTZ', 'ICLN', 'TAN', 'JETS',

  // ── High-search-volume names outside S&P 500 ──
  'PLTR', 'RIVN', 'LCID', 'NIO', 'SOFI', 'COIN', 'SNAP', 'RBLX', 'U', 'DKNG',
  'SHOP', 'SQ', 'ROKU', 'CRWD', 'NET', 'SNOW', 'PINS', 'HOOD', 'MARA', 'RIOT',
  'ARM', 'SMCI', 'MSTR', 'IONQ', 'RGTI', 'AI', 'UPST', 'AFRM', 'PATH', 'BILL',
] as const;

export type Ticker = (typeof TOP_TICKERS)[number];
