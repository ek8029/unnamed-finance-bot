import { describe, expect, it } from 'vitest';
import { parseResearchTicker } from '@/lib/research-ticker';

describe('research ticker input', () => {
  it.each(['A', 'SPY', 'AAPL', 'GOOGL'])('accepts supported symbol %s', (ticker) => {
    expect(parseResearchTicker(ticker)).toEqual({ ok: true, ticker });
  });

  it('normalizes only casing and surrounding whitespace', () => {
    expect(parseResearchTicker('  aapl  ')).toEqual({ ok: true, ticker: 'AAPL' });
  });

  it.each(['BRK.B', 'BRK-B', ' brk.b '])('explains unsupported share classes without routing %s to BRKB', (raw) => {
    const result = parseResearchTicker(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('Share-class symbols');
    expect(result).not.toHaveProperty('ticker');
  });

  it.each(['AA PL', '$AAPL', 'AAPL1', 'AAPL/MSFT', 'ABCDEF', '', '  ', 'ＡＡＰＬ'])('rejects %j instead of manufacturing a ticker', (raw) => {
    expect(parseResearchTicker(raw).ok).toBe(false);
  });
});
