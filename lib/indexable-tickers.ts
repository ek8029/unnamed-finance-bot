/**
 * Tickers that should be indexed by search engines.
 * ~150 highest-search-volume tickers. The rest of TOP_TICKERS are still
 * accessible but get noindex to avoid thin content penalties.
 */
export const INDEXABLE_TICKERS = new Set([
  // Recent high-search IPOs
  'SPCX',
  // Mega-cap / FAANG+
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'AVGO',
  'LLY', 'JPM', 'V', 'UNH', 'XOM', 'MA', 'JNJ', 'PG', 'COST', 'HD',
  'ABBV', 'NFLX', 'CRM', 'BAC', 'KO', 'MRK', 'CVX', 'AMD', 'PEP', 'ADBE',

  // S&P 500 top 30-70
  'WMT', 'MCD', 'DIS', 'INTC', 'CSCO', 'VZ', 'IBM', 'AMGN', 'QCOM', 'BA',
  'GS', 'CAT', 'GE', 'LOW', 'INTU', 'NOW', 'PFE', 'T', 'BKNG', 'GILD',
  'RTX', 'HON', 'NEE', 'DE', 'CME', 'GM', 'F',

  // Popular ETFs (always high search volume)
  'SPY', 'QQQ', 'VOO', 'VTI', 'IWM', 'DIA', 'ARKK', 'VGT', 'SCHD', 'VYM',
  'XLF', 'XLE', 'XLK', 'XLV', 'BND', 'TLT', 'HYG', 'GLD', 'SLV', 'VNQ',
  'SOXX', 'SMH', 'TQQQ', 'SQQQ', 'EEM', 'VIG', 'AGG', 'IEMG', 'VWO', 'EFA',

  // High-search-volume names outside S&P 500
  'PLTR', 'RIVN', 'LCID', 'NIO', 'SOFI', 'COIN', 'SNAP', 'RBLX', 'DKNG',
  'SHOP', 'SQ', 'ROKU', 'CRWD', 'NET', 'SNOW', 'HOOD', 'MARA', 'RIOT',
  'ARM', 'SMCI', 'MSTR', 'AI', 'UPST', 'AFRM', 'RDDT', 'HIMS',
  'BABA', 'JD', 'PDD', 'SPOT', 'TTD', 'DDOG', 'ZS', 'ABNB', 'EXPE',
  'IONQ', 'RGTI', 'RKLB', 'CELH', 'DUOL', 'SE', 'GRAB', 'PATH',
]);
