/** Keep user input intact: the research providers currently accept 1–5 letters. */
export function parseResearchTicker(raw: string):
  | { ok: true; ticker: string }
  | { ok: false; message: string } {
  const ticker = raw.trim().toUpperCase();
  if (/^[A-Z]{1,5}$/.test(ticker)) return { ok: true, ticker };
  if (/^[A-Z]{1,5}[.-][A-Z]$/.test(ticker)) {
    return {
      ok: false,
      message: `Share-class symbols such as ${ticker} aren’t supported in research yet. Try another stock or ETF.`,
    };
  }
  return {
    ok: false,
    message: ticker
      ? 'Enter a US stock or ETF ticker using 1–5 letters, such as AAPL or SPY.'
      : 'Enter a stock or ETF ticker to start your research.',
  };
}
